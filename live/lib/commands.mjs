import {makeStore, makeSession, createPlayer, cents, METHODS, BANK_ID, participants, playerStats, allocateVariance, splitVariance, validateImported} from './engine.mjs';
export class CommandError extends Error {}
const fail=message=>{throw new CommandError(message)};
const text=(v,max=150)=>typeof v==='string'?v.trim().slice(0,max):'';
const amount=(v,zero=false)=>{const n=cents(v);if(!zero&&!n)fail('Enter an amount greater than $0.');return n;};
export function applyCommand(original,command){
 const data=structuredClone(original||makeStore());
 if(!command||typeof command.id!=='string'||command.id.length>100||!command.id)fail('Missing action ID.');
 const p=command.payload||{},at=new Date().toISOString(),id=command.id;
 const session=()=>data.sessions.find(s=>s.id===p.sessionId)||fail('This game no longer exists. Refresh and try again.');
 const player=pid=>data.players.find(x=>x.id===pid)||fail('Choose a player.');
 const open=s=>{if(s.status!=='open')fail('This game is closed. Reopen it before adding chips.');};
 const entry=(s,type,n,fields)=>s.entries.push({id,type,amount:n,at,...fields});
 switch(command.type){
 case 'create-session':{
  const title=text(p.title,100);if(!title)fail('Give your game a name.');
  if(p.bankerId)player(p.bankerId);
  data.sessions.push({...makeSession(title,{mode:p.mode==='centralized'?'centralized':'decentralized',bankerId:p.bankerId||null}),id,createdAt:at});break;
 }
 case 'add-player':{
  const name=text(p.name,100);if(!name)fail('Enter a player name.');
  if(data.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))fail('That player is already in your directory.');
  data.players.push({...createPlayer(name),id,createdAt:at});break;
 }
 case 'edit-player':{
  const row=player(p.playerId),name=text(p.name,100);if(!name)fail('Enter a player name.');
  if(data.players.some(x=>x.id!==row.id&&x.name.toLowerCase()===name.toLowerCase()))fail('That name is already taken.');
  row.name=name;break;
 }
 case 'buyin':{
  const s=session();open(s);player(p.playerId);
  const deferred=s.mode==='decentralized';
  if(!deferred&&!METHODS.includes(p.method))fail('Choose a payment method.');
  entry(s,'buyin',amount(p.amount),{playerId:p.playerId,status:deferred?'pending':p.received?'received':'pending',...(!deferred?{method:p.method}:{}),note:text(p.note)});break;
 }
 case 'cashout':{
  const s=session();open(s);player(p.playerId);
  if(!s.entries.some(e=>e.type==='buyin'&&e.playerId===p.playerId&&!e.voidedAt))fail('Record this player’s buy-in first.');
  if(s.entries.some(e=>e.type==='cashout'&&e.playerId===p.playerId&&!e.voidedAt))fail('This player is already cashed out. Void the old cash-out to correct it.');
  entry(s,'cashout',amount(p.amount,true),{playerId:p.playerId,note:text(p.note)});break;
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
  if(e.type==='transfer')e.status='paid';else if(e.type==='buyin')e.status='received';else fail('Chip cash-outs are not payments.');
  e.confirmedAt=at;break;
 }
 case 'close-session':{
  const s=session();open(s);const missing=participants(s).filter(pid=>playerStats(s,pid).open);
  if(missing.length)fail('Record a final cash-out, even $0, for '+missing.map(pid=>player(pid).name).join(', ')+'.');
  s.status='closed';s.endedAt=at;break;
 }
 case 'reopen-session':{const s=session();s.status='open';s.endedAt=null;break;}
 case 'notes':{session().notes=text(p.notes,5000);break;}
 case 'allocate':{allocateVariance(session(),p.playerId,amount(p.amount),text(p.note));break;}
 case 'split-variance':{const s=session();splitVariance(s,participants(s),p.mode==='bank'?'bank':'equal');break;}
 case 'undo-allocation':{const a=session().adjustments.find(a=>a.id===p.allocationId);if(!a||a.voidedAt)fail('Allocation not found.');a.voidedAt=at;break;}
 case 'import':{
  const backup=validateBackup(p.ledger),mapping=new Map();
  for(const incoming of backup.players){const existing=data.players.find(x=>x.id===incoming.id||x.name.toLowerCase()===incoming.name.toLowerCase());if(existing)mapping.set(incoming.id,existing.id);else{data.players.push(incoming);mapping.set(incoming.id,incoming.id);}}
  for(const incoming of backup.sessions){if(data.sessions.some(x=>x.id===incoming.id))continue;
   const s=structuredClone(incoming);if(s.bankerId)s.bankerId=mapping.get(s.bankerId)||s.bankerId;
   for(const e of s.entries){if(e.playerId)e.playerId=mapping.get(e.playerId)||e.playerId;if(e.from&&e.from!==BANK_ID)e.from=mapping.get(e.from)||e.from;if(e.to&&e.to!==BANK_ID)e.to=mapping.get(e.to)||e.to;}
   for(const a of s.adjustments)a.playerId=mapping.get(a.playerId)||a.playerId;
   data.sessions.push(s);
  }break;
 }
 default:fail('Unknown action.');
 }
 return data;
}
export function validateBackup(value){
 const data=validateImported(value),ids=new Set();
 for(const p of data.players){if(!p.id||!p.name.trim()||ids.has(p.id))fail('Backup has an invalid or duplicate player.');ids.add(p.id);}
 const sessions=new Set();
 for(const s of data.sessions){
  if(typeof s.id!=='string'||!s.id||sessions.has(s.id)||typeof s.title!=='string'||!['open','closed'].includes(s.status))fail('Backup has an invalid game.');sessions.add(s.id);
  const entries=new Set();
  for(const e of s.entries){
   if(typeof e.id!=='string'||!e.id||entries.has(e.id))fail('Backup has duplicate or invalid entries.');entries.add(e.id);
   if(e.type==='transfer'){if(e.from===e.to||![e.from,e.to].every(pid=>pid===BANK_ID||ids.has(pid)))fail('Backup has an invalid transfer.');}
   else if(!ids.has(e.playerId))fail('Backup references an unknown player.');
   if(e.type==='buyin'&&!['pending','received'].includes(e.status))fail('Backup has an invalid buy-in status.');
   if(e.type==='transfer'&&!['pending','paid'].includes(e.status))fail('Backup has an invalid payment status.');
  }
  for(const a of s.adjustments)if(!ids.has(a.playerId))fail('Backup allocation references an unknown player.');
  if(s.bankVariance!==undefined&&!Number.isSafeInteger(s.bankVariance))fail('Backup has an invalid variance.');
 }
 return data;
}
