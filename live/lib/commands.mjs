import {normalizePlayerEmail} from './notifications.mjs';
import {makeStore, makeSession, createPlayer, cents, money, METHODS, BANK_ID, participants, playerStats, allocateVariance, splitVariance, validateImported, headOf, gameReady} from './engine.mjs';
import {outstandingDebts} from './analytics.mjs';
export class CommandError extends Error {}
const fail=message=>{throw new CommandError(message)};
const text=(v,max=150)=>typeof v==='string'?v.trim().slice(0,max):'';
// Profile photos are small JPEG data URLs kept on the player record.
const photo=v=>{if(v===undefined||v==='')return v;if(typeof v!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v)||v.length>60000)fail('That photo is too large. Choose a smaller one.');return v;};
const amount=(v,zero=false)=>{const n=cents(v);if(!zero&&!n)fail('Enter an amount greater than $0.');return n;};
export const recordJSON=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export function applyCommand(original,command){
 const data=structuredClone(original||makeStore());
 if(!command||typeof command.id!=='string'||! /^[A-Za-z0-9_:.-]{1,100}$/.test(command.id))fail('Missing action ID.');
 const p=command.payload||{};if(['add-player','edit-player'].includes(command.type)&&p.email!==undefined)normalizePlayerEmail(p.email);const at=Number.isSafeInteger(command.queuedAt)&&command.queuedAt>0?new Date(command.queuedAt).toISOString():new Date().toISOString(),id=command.id;
 const session=()=>data.sessions.find(s=>s.id===p.sessionId)||fail('This game no longer exists. Refresh and try again.');
 const player=pid=>data.players.find(x=>x.id===pid)||fail('Choose a player.');
 const open=s=>{if(s.status!=='open')fail('This game is closed. Reopen it before adding chips.');};
 const setBanker=(s,pid,holder)=>{if(holder===pid)fail('A player can’t be their own banker.');if(headOf({bankers:s.bankers||{}},holder)===pid)fail('That would make a loop of bankers.');s.bankers={...(s.bankers||{}),[pid]:holder};};
 const entry=(s,type,n,fields)=>s.entries.push({id,type,amount:n,at,...fields});
 const unchanged=row=>{if(p.expected&&recordJSON(row)!==recordJSON(p.expected))fail('This record changed on another device. Close and reopen the editor to load its latest version.');};
 switch(command.type){
 case 'edit-session':{
  const s=session();unchanged(s);const title=text(p.title,100);if(!title)fail('Give your game a name.');
  s.title=title;s.notes=text(p.notes,5000);
  if(p.createdAt){const date=new Date(p.createdAt);if(!Number.isFinite(date.getTime()))fail('Choose a valid game date.');s.createdAt=date.toISOString();}
  break;
 }
 case 'delete-session':{const s=session();unchanged(s);data.sessions=data.sessions.filter(g=>g.id!==s.id);break;}
 case 'replace-session':{
  const s=session();unchanged(s);if(!p.game||p.game.id!==s.id)fail('Keep the original game ID.');
  data.sessions[data.sessions.indexOf(s)]=structuredClone(p.game);validateBackup(data);break;
 }
 case 'edit-entry':{
  const s=session(),e=s.entries.find(e=>e.id===p.entryId);if(!e||e.voidedAt)fail('Entry no longer exists or was voided.');unchanged(e);
  e.amount=amount(p.amount,e.type==='cashout');e.note=text(p.note);
  if(['transfer','tip'].includes(e.type)){
   if(p.from===p.to)fail('Choose different people for sender and recipient.');
   if(e.type==='tip'&&(p.from===BANK_ID||p.to===BANK_ID))fail('Tips must be between two players.');
   if(p.from!==BANK_ID)player(p.from);if(p.to!==BANK_ID)player(p.to);
   const paid=p.status==='paid';if((e.type==='transfer'||paid)&&!METHODS.includes(p.method))fail('Choose a payment method.');
   e.from=p.from;e.to=p.to;e.status=paid?'paid':'pending';if(e.type==='transfer'||paid)e.method=p.method;else delete e.method;
  }else{
   player(p.playerId);e.playerId=p.playerId;
   if(e.type==='cashout'&&!s.entries.some(x=>x.type==='buyin'&&x.playerId===e.playerId&&!x.voidedAt))fail('Record this player’s buy-in first.');
   if(e.type==='cashout'&&s.entries.some(x=>x.id!==e.id&&x.type==='cashout'&&x.playerId===e.playerId&&!x.voidedAt))fail('This player already has a cash-out.');
   if(e.type==='buyin'){
    e.status=p.status==='received'?'received':'pending';delete e.heldBy;delete e.method;
    if(p.heldBy){player(p.heldBy);if(p.heldBy===e.playerId)fail('Choose a different player to receive the payment.');if(s.mode!=='decentralized')fail('Payments to another player are for pay-at-end games.');const method=p.method??'Cash';if(!METHODS.includes(method))fail('Choose a payment method.');e.heldBy=p.heldBy;e.method=method;e.status='received';}
    else if(p.method){if(!METHODS.includes(p.method))fail('Choose a payment method.');e.method=p.method;}
    else if(s.mode==='centralized')fail('Choose a payment method.');
   }
  }
  delete e.confirmedAt;e.updatedAt=at;break;
 }
 case 'delete-entry':{
  const s=session(),e=s.entries.find(e=>e.id===p.entryId);if(!e)fail('This entry no longer exists.');unchanged(e);
  s.entries=s.entries.filter(x=>x.id!==e.id);break;
 }
 case 'create-session':{
  const title=text(p.title,100);if(!title)fail('Give your game a name.');
  if(p.bankerId)player(p.bankerId);
  data.sessions.push({...makeSession(title,{mode:p.mode==='centralized'?'centralized':'decentralized',bankerId:p.bankerId||null}),id,createdAt:at});break;
 }
 case 'add-player':{
  const name=text(p.name,100);if(!name)fail('Enter a player name.');
  if(data.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))fail('That player is already in your directory.');
  const pic=photo(p.photo);data.players.push({...createPlayer(name),id,createdAt:at,...(pic?{photo:pic}:{})});break;
 }
 case 'edit-player':{
  const row=player(p.playerId),name=text(p.name,100);if(!name)fail('Enter a player name.');
  if(data.players.some(x=>x.id!==row.id&&x.name.toLowerCase()===name.toLowerCase()))fail('That name is already taken.');
  row.name=name;const pic=photo(p.photo);if(pic==='')delete row.photo;else if(pic)row.photo=pic;break;
 }
 case 'buyin':{
  const s=session();open(s);const who=player(p.playerId);
  const debts=outstandingDebts(data).get(p.playerId);
  if(debts)fail(`${who.name} still owes ${money(debts.reduce((n,d)=>n+d.amount,0))} from ${[...new Set(debts.map(d=>d.game.title))].join(', ')}. Mark it paid on Settlements before they buy in.`);
  const deferred=s.mode==='decentralized';
  if(!deferred&&!METHODS.includes(p.method))fail('Choose a payment method.');
  // Cash handed over at the start: another player holds it and settles for this player at the end.
  const cashUp=p.paidUpfront===true||p.paidUpfront==='on'||p.cashUpfront===true||p.cashUpfront==='on';let heldBy='';const depositMethod=p.method??'Cash';
  if(cashUp){
   if(!deferred)fail('Payments to another player are for pay-at-end games.');
   if(!METHODS.includes(depositMethod))fail('Choose a payment method.');
   heldBy=text(p.heldBy,100)||s.bankers?.[p.playerId]||'';
   if(!heldBy)fail('Choose who is holding the payment.');
   player(heldBy);if(heldBy===p.playerId)fail('Choose a different player to receive the payment.');
   if(p.makeBanker===true||p.makeBanker==='on'){if(!s.bankers?.[p.playerId])setBanker(s,p.playerId,heldBy);}
  }
  entry(s,'buyin',amount(p.amount),cashUp?{playerId:p.playerId,status:'received',method:depositMethod,heldBy,note:text(p.note)}:{playerId:p.playerId,status:deferred?'pending':p.received?'received':'pending',...(!deferred?{method:p.method}:{}),note:text(p.note)});break;
 }
 case 'set-banker':{
  const s=session();player(p.playerId);const holder=text(p.holderId,100);
  if(holder){player(holder);setBanker(s,p.playerId,holder);}else if(s.bankers)delete s.bankers[p.playerId];
  break;
 }
 case 'set-cash-unit':{const s=session();s.cashUnit=amount(p.unit);if(s.cashUnit>1000000)fail('Choose a smaller bill size.');break;}
 case 'set-prefs':{
  const s=session();player(p.playerId);
  s.prefs={...(s.prefs||{}),[p.playerId]:{cashOnly:p.cashOnly===true||p.cashOnly==='on',canBreak:p.canBreak===true||p.canBreak==='on',cash:p.cash===''||p.cash==null?0:amount(p.cash,true)}};
  break;
 }
 case 'cashout':{
  const s=session();open(s);player(p.playerId);
  if(!s.entries.some(e=>e.type==='buyin'&&e.playerId===p.playerId&&!e.voidedAt))fail('Record this player’s buy-in first.');
  if(s.entries.some(e=>e.type==='cashout'&&e.playerId===p.playerId&&!e.voidedAt))fail('This player is already cashed out. Void the old cash-out to correct it.');
  entry(s,'cashout',amount(p.amount,true),{playerId:p.playerId,note:text(p.note)});break;
 }
 case 'tip':{
  const s=session();player(p.from);player(p.to);if(p.from===p.to)fail('Choose different people for sender and recipient.');
  const paid=p.paid===true;if(paid&&!METHODS.includes(p.method))fail('Choose how the tip was paid.');
  entry(s,'tip',amount(p.amount),{from:p.from,to:p.to,status:paid?'paid':'pending',...(paid?{method:p.method}:{}),note:text(p.note)});break;
 }
 case 'transfer':{
  const s=session();if(p.from===p.to)fail('Choose different people for sender and recipient.');
  if(p.from!==BANK_ID)player(p.from);if(p.to!==BANK_ID)player(p.to);
  if(!METHODS.includes(p.method))fail('Choose a payment method.');
  entry(s,'transfer',amount(p.amount),{from:p.from,to:p.to,method:p.method,status:p.paid?'paid':'pending',note:text(p.note)});break;
 }
 case 'void-entry':{
  const s=session(),e=s.entries.find(e=>e.id===p.entryId);if(!e||e.voidedAt)fail('This entry was already voided or no longer exists.');
  e.voidedAt=at;e.voidNote=text(p.note)||'Corrected by table host';break;
 }
 case 'confirm-entry':{
  const s=session(),e=s.entries.find(e=>e.id===p.entryId);if(!e||e.voidedAt)fail('Entry not found.');
  if(e.type==='transfer')e.status='paid';else if(e.type==='tip'){const method=p.method||e.method;if(!METHODS.includes(method))fail('Choose how the tip was paid.');e.method=method;e.status='paid';}else if(e.type==='buyin')e.status='received';else fail('Chip cash-outs are not payments.');
  e.confirmedAt=at;break;
 }
 case 'close-session':{
  const s=session();open(s);const missing=participants(s).filter(pid=>playerStats(s,pid).open);
  if(missing.length)fail('Record a final cash-out, even $0, for '+missing.map(pid=>player(pid).name).join(', ')+'.');
  s.status='closed';s.endedAt=at;break;
 }
 case 'send-reminders':{if(p.playerIds!==undefined&&(!Array.isArray(p.playerIds)||p.playerIds.length>100||p.playerIds.some(pid=>typeof pid!=='string')))fail('Choose players to remind.');break;}
 case 'send-update':{const s=session();if(p.playerIds!==undefined&&(!Array.isArray(p.playerIds)||p.playerIds.length>100||p.playerIds.some(pid=>!participants(s).includes(pid))))fail('Choose players from this game.');break;}
 case 'reopen-session':{const s=session();s.status='open';s.endedAt=null;break;}
 case 'notes':{session().notes=text(p.notes,5000);break;}
 case 'allocate':{const a=allocateVariance(session(),p.playerId,amount(p.amount),text(p.note));a.id=id;a.at=at;break;}
 case 'split-variance':{const s=session(),start=s.adjustments.length;splitVariance(s,participants(s),p.mode==='bank'?'bank':'equal');s.adjustments.slice(start).forEach((a,i)=>{a.id=`${id}:${i}`;a.at=at;});break;}
 case 'undo-allocation':{const a=session().adjustments.find(a=>a.id===p.allocationId);if(!a||a.voidedAt)fail('Allocation not found.');a.voidedAt=at;break;}
 case 'import':{
  const backup=validateBackup(p.ledger),mapping=new Map();
  for(const incoming of backup.players){const existing=data.players.find(x=>x.id===incoming.id||x.name.toLowerCase()===incoming.name.toLowerCase());if(existing)mapping.set(incoming.id,existing.id);else{data.players.push(incoming);mapping.set(incoming.id,incoming.id);}}
  for(const incoming of backup.sessions){if(data.sessions.some(x=>x.id===incoming.id))continue;
   const s=structuredClone(incoming);if(s.bankerId)s.bankerId=mapping.get(s.bankerId)||s.bankerId;
   for(const e of s.entries){if(e.playerId)e.playerId=mapping.get(e.playerId)||e.playerId;if(e.from&&e.from!==BANK_ID)e.from=mapping.get(e.from)||e.from;if(e.to&&e.to!==BANK_ID)e.to=mapping.get(e.to)||e.to;}
   for(const a of s.adjustments)a.playerId=mapping.get(a.playerId)||a.playerId;
   for(const e of s.entries)if(e.heldBy)e.heldBy=mapping.get(e.heldBy)||e.heldBy;
   const remap=m=>Object.fromEntries(Object.entries(m||{}).map(([k,v])=>[mapping.get(k)||k,typeof v==='string'?mapping.get(v)||v:v]));
   if(s.bankers)s.bankers=remap(s.bankers);if(s.prefs)s.prefs=remap(s.prefs);
   data.sessions.push(s);
  }validateBackup(data);break;
 }
 default:fail('Unknown action.');
 }
 if(new TextEncoder().encode(JSON.stringify(data)).length>900000)fail('The shared ledger is approaching its storage limit. Export a backup and archive old games before adding more data.');
 return data;
}
export function validateBackup(value){
 const data=validateImported(value),ids=new Set();
 for(const p of data.players){if(!p.id||[BANK_ID,'__proto__','constructor','prototype'].includes(p.id)||!p.name.trim()||ids.has(p.id))fail('Backup has an invalid or duplicate player.');ids.add(p.id);}
 const sessions=new Set();
 for(const s of data.sessions){
  if(typeof s.id!=='string'||!s.id||sessions.has(s.id)||typeof s.title!=='string'||!['open','closed'].includes(s.status))fail('Backup has an invalid game.');sessions.add(s.id);
  if(!s.title.trim()||s.title.length>100||(s.notes!==undefined&&(typeof s.notes!=='string'||s.notes.length>5000)))fail('Game needs a name and valid notes.');
  for(const date of [s.createdAt,s.endedAt])if(date!=null&&(typeof date!=='string'||!Number.isFinite(Date.parse(date))))fail('Game has an invalid date.');
  if(s.bankerId&&!ids.has(s.bankerId))fail('Game references an unknown banker.');
  for(const [pid,holder] of Object.entries(s.bankers||{})){
   if(!ids.has(pid)||!ids.has(holder))fail('Game references an unknown personal banker.');
   const seen=new Set([pid]);let cur=holder;while(cur){if(seen.has(cur))fail('Game has a loop of bankers.');seen.add(cur);cur=s.bankers[cur];}
  }
  for(const pref of Object.values(s.prefs||{})){if(['cashOnly','canBreak'].some(k=>pref[k]!==undefined&&typeof pref[k]!=='boolean'))fail('Cash preferences must use true or false.');}
  if(Object.keys(s.prefs||{}).some(pid=>!ids.has(pid)))fail('Game preferences reference an unknown player.');
  const entries=new Set(),cashed=new Set();
  for(const e of s.entries){
   if(typeof e.id!=='string'||!e.id||entries.has(e.id))fail('Backup has duplicate or invalid entries.');entries.add(e.id);
   if(['transfer','tip'].includes(e.type)){if(e.from===e.to||![e.from,e.to].every(pid=>(e.type==='transfer'&&pid===BANK_ID)||ids.has(pid)))fail('Backup has an invalid transfer.');}
   else if(!ids.has(e.playerId))fail('Backup references an unknown player.');
   if(e.heldBy&&!ids.has(e.heldBy))fail('Backup references an unknown cash holder.');
   if(e.heldBy&&(e.type!=='buyin'||e.heldBy===e.playerId||e.status!=='received'||!METHODS.includes(e.method)||s.mode!=='decentralized'))fail('Invalid upfront payment.');
   if(e.method!==undefined&&!METHODS.includes(e.method))fail('Entry has an invalid payment method.');
   if(e.type==='transfer'&&!METHODS.includes(e.method))fail('Payment needs a method.');
   if(e.at!=null&&(typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))))fail('Entry has an invalid date.');
   if(e.note!==undefined&&(typeof e.note!=='string'||e.note.length>150))fail('Entry has an invalid note.');
   if(e.type==='buyin'&&!['pending','received'].includes(e.status))fail('Backup has an invalid buy-in status.');
   if(e.type==='tip'&&(e.status==='paid'&&!METHODS.includes(e.method)))fail('Paid tip needs a method.');
   if(e.type==='cashout'&&!e.voidedAt){if(cashed.has(e.playerId))fail('Game has duplicate cash-outs.');cashed.add(e.playerId);}
   for(const field of ['voidedAt','confirmedAt','updatedAt'])if(e[field]!=null&&(typeof e[field]!=='string'||!Number.isFinite(Date.parse(e[field]))))fail('Entry has an invalid date.');
   if(['transfer','tip'].includes(e.type)&&!['pending','paid'].includes(e.status))fail('Backup has an invalid payment status.');
  }
  const allocations=new Set();
  for(const a of s.adjustments){
   if(!ids.has(a.playerId))fail('Backup allocation references an unknown player.');
   if(typeof a.id!=='string'||!a.id||allocations.has(a.id))fail('Backup has duplicate or invalid adjustments.');allocations.add(a.id);
   if(a.note!==undefined&&(typeof a.note!=='string'||a.note.length>150))fail('Adjustment has an invalid note.');
  }
  if(s.bankVariance!==undefined&&!Number.isSafeInteger(s.bankVariance))fail('Backup has an invalid variance.');
 }
 return data;
}
