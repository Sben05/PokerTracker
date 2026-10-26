/* OpenStax Poker accounting engine. Every monetary value is an integer number of cents. */
export const METHODS = ['Cash', 'Coins', 'Zelle', 'Venmo', 'Other'];
export const BANK_ID = '__bank__';
export const uid = () => (globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);
export const cents = raw => {
  const text = String(raw ?? '').trim().replace(/^\$/,'');
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(text)) throw Error('Enter a nonnegative dollar amount with at most 2 decimal places.');
  const [whole, decimal=''] = text.split('.');
  const value = Number(whole)*100 + Number(decimal.padEnd(2,'0'));
  if (!Number.isSafeInteger(value) || value > 1000000000) throw Error('Amount is too large.');
  return value;
};
export const money = c => `${c<0?'−':''}$${(Math.abs(c)/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const signedMoney = c => `${c>0?'+':c<0?'−':''}$${(Math.abs(c)/100).toFixed(2)}`;
export const makeStore = () => ({version:1,players:[],sessions:[]});
export const createPlayer = (name,methods=METHODS.slice(0,4)) => ({id:uid(),name:name.trim(),methods:[...methods],createdAt:new Date().toISOString()});
export const makeSession = (title,{mode='centralized',bankerId=null}={}) => ({id:uid(),title:title.trim(),createdAt:new Date().toISOString(),mode,bankerId:mode==='centralized'?bankerId:null,status:'open',entries:[],adjustments:[],bankVariance:0,varianceNote:'',notes:'',endedAt:null});
export const buyins = s => s.entries.filter(e=>e.type==='buyin'&&!e.voidedAt);
export const cashouts = s => s.entries.filter(e=>e.type==='cashout'&&!e.voidedAt);
export const transfers = s => s.entries.filter(e=>e.type==='transfer'&&!e.voidedAt);
export const participants = s => [...new Set(s.entries.filter(e=>!e.voidedAt).flatMap(e=>e.playerId?[e.playerId,...(e.heldBy?[e.heldBy]:[])]:(e.type==='transfer'?[e.from,e.to].filter(x=>x!==BANK_ID):[])))];
export function stats(s) {
  const ins=buyins(s),outs=cashouts(s),ts=transfers(s);
  const totalIn=ins.reduce((a,e)=>a+e.amount,0), totalOut=outs.reduce((a,e)=>a+e.amount,0);
  const variance=totalIn-totalOut;
  const adjusted=totalOut+s.adjustments.filter(e=>!e.voidedAt).reduce((a,e)=>a+e.amount,0);
  const unresolved=totalIn-adjusted-(s.bankVariance||0);
  const outstandingIn=ins.filter(e=>e.status!=='received').reduce((a,e)=>a+e.amount,0);
  const received=ins.filter(e=>e.status==='received').reduce((a,e)=>a+e.amount,0);
  const outgoing=ts.filter(e=>e.status==='paid'&&e.from===BANK_ID).reduce((a,e)=>a+e.amount,0);
  const incoming=ts.filter(e=>e.status==='paid'&&e.to===BANK_ID).reduce((a,e)=>a+e.amount,0);
  return {totalIn,totalOut,variance,unresolved,adjusted,received,outstandingIn,bankHoldings:received+incoming-outgoing,paidOut:outgoing,transactions:s.entries.length};
}
export function playerStats(s,id) {
  const ins=buyins(s).filter(e=>e.playerId===id), outs=cashouts(s).filter(e=>e.playerId===id);
  const bought=ins.reduce((a,e)=>a+e.amount,0), cashed=outs.reduce((a,e)=>a+e.amount,0);
  const adjustment=s.adjustments.filter(e=>e.playerId===id&&!e.voidedAt).reduce((a,e)=>a+e.amount,0);
  const paidIn=ins.filter(e=>e.status==='received').reduce((a,e)=>a+e.amount,0);
  const paidOut=transfers(s).filter(e=>e.status==='paid'&&e.to===id).reduce((a,e)=>a+e.amount,0);
  const sentDirect=transfers(s).filter(e=>e.status==='paid'&&e.from===id).reduce((a,e)=>a+e.amount,0);
  const open=ins.length>0 && !outs.length;
  return {bought,cashed,adjustment,net:cashed+adjustment-bought,paidIn,paidOut,sentDirect,open,unpaidBuyins:bought-paidIn};
}
/** Net amount each party should still RECEIVE (+) or PAY (-). Bank is a clearing participant.
 * confirmed/paid transfers are already applied; optional pending transfers reserve a planned payment.
 */
export function balances(s,{includePending=false}={}) {
  const result = new Map([[BANK_ID,0]]);
  const add=(id,n)=>result.set(id,(result.get(id)||0)+n);
  for(const e of s.entries) {
    if(e.voidedAt)continue;
    if(e.type==='buyin') {add(e.playerId,-e.amount);add(BANK_ID,e.amount);if(e.status==='received'){add(e.playerId,e.amount);add(e.heldBy||BANK_ID,-e.amount);}}
    if(e.type==='cashout'){add(e.playerId,e.amount);add(BANK_ID,-e.amount);}
    if(e.type==='transfer'&&(e.status==='paid'||(includePending&&e.status==='pending'))){add(e.from,e.amount);add(e.to,-e.amount);}
  }
  for(const a of s.adjustments){if(a.voidedAt)continue;add(a.playerId,a.amount);add(BANK_ID,-a.amount);}
  // bankVariance is the explicit value borne/retained by the bank, not an obligation to players.
  // It does not affect outstanding transfers, which must always reflect actual entitlements.
  return result;
}
/** Default smallest bill. Each game can set its own with cashUnit; cash moves in multiples of it unless someone can make change. */
export const CASH_UNIT = 500;
export const cashUnit = s => Number.isSafeInteger(s.cashUnit)&&s.cashUnit>0?s.cashUnit:CASH_UNIT;
export const cashPrefs = (s,id) => ({cashOnly:!!s.prefs?.[id]?.cashOnly,canBreak:!!s.prefs?.[id]?.canBreak,cash:s.prefs?.[id]?.cash||0});
/** The player who settles for this one: follow personal-banker links to the end of the chain. */
export function headOf(s,id){const seen=new Set();let cur=id;while(s.bankers?.[cur]&&!seen.has(cur)){seen.add(cur);cur=s.bankers[cur];}return cur;}
export const dependentsOf = (s,id) => Object.keys(s.bankers||{}).filter(x=>x!==id&&headOf(s,x)===id);
/** Physical cash a player can hand out: deposits they hold, cash they brought, and cash payments already made or received. */
export function cashOnHand(s,id){
  let n=cashPrefs(s,id).cash;
  for(const e of s.entries){
    if(e.voidedAt)continue;
    if(e.type==='buyin'&&e.heldBy===id&&e.status==='received')n+=e.amount;
    if(e.type==='transfer'&&e.method==='Cash'){
      if(e.from===id&&(e.status==='paid'||e.status==='pending'))n-=e.amount;
      if(e.to===id&&e.status==='paid')n+=e.amount;
    }
  }
  return Math.max(0,n);
}
export const isAdvanced = s => !!(s.cashUnit||Object.keys(s.bankers||{}).length||Object.keys(s.prefs||{}).length||s.entries.some(e=>!e.voidedAt&&e.heldBy));
/** Balances as the table actually settles them: players with a personal banker are folded into that banker. */
export function payBalances(s,opts){
  const b=balances(s,opts);
  if(!Object.keys(s.bankers||{}).length)return b;
  const out=new Map();
  for(const [id,n] of b){const head=id===BANK_ID?id:headOf(s,id);out.set(head,(out.get(head)||0)+n);}
  return out;
}
/** Settlement plan with the arithmetic of every step. Without bankers or cash preferences this is the plain
 * largest-debt-to-largest-credit match; with them, cash-only players are paid from players who actually hold cash,
 * cash moves in whole bills unless someone can make change, and anything that cannot be covered is flagged. */
export function planSteps(s,{includePending=true}={}){
  const b=payBalances(s,{includePending});
  const advanced=isAdvanced(s);
  const group=id=>[id,...dependentsOf(s,id)];
  const make=([id,n],sign)=>({id,remaining:sign*n,...(advanced&&id!==BANK_ID?{cash:group(id).reduce((t,m)=>t+cashOnHand(s,m),0),cashOnly:cashPrefs(s,id).cashOnly,canBreak:group(id).some(m=>cashPrefs(s,m).canBreak)}:{cash:0,cashOnly:false,canBreak:false})});
  const debtors=[...b].filter(([,n])=>n<0).map(e=>make(e,-1)).sort((x,y)=>y.remaining-x.remaining);
  const creditors=[...b].filter(([,n])=>n>0).map(e=>make(e,1)).sort((x,y)=>y.remaining-x.remaining);
  const steps=[];
  const pay=(d,c,amount,extra={})=>{
    if(amount<=0)return;
    steps.push({from:d.id,to:c.id,amount,owedBefore:d.remaining,dueBefore:c.remaining,owedAfter:d.remaining-amount,dueAfter:c.remaining-amount,...extra});
    d.remaining-=amount;c.remaining-=amount;
    if(extra.method==='Cash')d.cash=Math.max(0,d.cash-amount);
  };
  const unit=cashUnit(s),cashAmount=(d,c)=>{const raw=Math.min(d.remaining,c.remaining,d.cash);return d.canBreak||c.canBreak?raw:Math.floor(raw/unit)*unit;};
  if(advanced){
    // 1. Cash-only players are paid first, from whoever is holding cash.
    for(const c of creditors.filter(x=>x.cashOnly)){
      for(const d of [...debtors].sort((x,y)=>y.cash-x.cash)){if(!c.remaining)break;pay(d,c,cashAmount(d,c),{method:'Cash'});}
    }
    // 2. Anyone still holding cash pays it to whoever they owe.
    for(const d of [...debtors].filter(x=>x.cash>0).sort((x,y)=>y.cash-x.cash)){
      for(const c of [...creditors].sort((x,y)=>y.remaining-x.remaining)){if(!d.remaining||!d.cash)break;if(c.remaining)pay(d,c,cashAmount(d,c),{method:'Cash'});}
    }
  }
  // 3. Whatever is left is matched largest to largest. Cash-only players still have to be paid in cash: flagged as short.
  const left=debtors.filter(d=>d.remaining>0).sort((x,y)=>y.remaining-x.remaining),owed=creditors.filter(c=>c.remaining>0).sort((x,y)=>y.remaining-x.remaining);
  let i=0,j=0;
  while(i<left.length&&j<owed.length){
    const d=left[i],c=owed[j],amount=Math.min(d.remaining,c.remaining);
    pay(d,c,amount,c.cashOnly?{method:'Cash',short:true}:{});
    if(d.remaining===0)i++;if(c.remaining===0)j++;
  }
  return steps;
}
export function simplify(s,{includePending=true}={}){
  return planSteps(s,{includePending}).map(({from,to,amount,method,short})=>({from,to,amount,...(method?{method}:{}),...(short?{short:true}:{})}));
}
/** Assign a share of the remaining discrepancy to exactly one person.
 * Positive difference distributes surplus, negative difference charges a player to cover a shortfall.
 * Allow partial allocations, with every monetary operation in integer cents.
 */
export function allocateVariance(s,playerId,share,note=''){
  if(s.status!=='closed') throw Error('Close the session before assigning a discrepancy.');
  if(!participants(s).includes(playerId)) throw Error('Choose a participant in this game.');
  const remaining=stats(s).unresolved;
  if(!remaining) throw Error('There is no discrepancy left to assign.');
  if(!Number.isSafeInteger(share)||share<=0||share>Math.abs(remaining)) throw Error('Share must be greater than zero and no more than the remaining difference.');
  const adjustment={id:uid(),playerId,amount:Math.sign(remaining)*share,at:new Date().toISOString(),note:String(note||'Individual discrepancy allocation').slice(0,150)};
  s.adjustments.push(adjustment);
  return adjustment;
}
export function splitVariance(s,players,mode='equal') {
  if(s.status!=='closed') throw Error('Close the session before resolving the variance.');
  const discrepancy=stats(s).unresolved;
  if(!discrepancy) throw Error('There is no remaining variance.');
  if(mode==='bank') {s.bankVariance=(s.bankVariance||0)+discrepancy;return;}
  if(!players.length) throw Error('Add players before sharing variance.');
  const ids=[...players].sort();
  const sign=Math.sign(discrepancy),abs=Math.abs(discrepancy),base=Math.floor(abs/ids.length),extra=abs%ids.length;
  ids.forEach((playerId,i)=>s.adjustments.push({id:uid(),playerId,amount:sign*(base+(i<extra?1:0)),at:new Date().toISOString(),note:'Equal share of session variance'}));
}
export function validateImported(v) {
  if(!v||v.version!==1||!Array.isArray(v.players)||!Array.isArray(v.sessions)) throw Error('Invalid OpenStax Poker backup (expected version 1).');
  if(v.players.length>5000||v.sessions.length>10000) throw Error('Backup too large.');
  for(const p of v.players){if(typeof p.id!=='string'||typeof p.name!=='string'||p.name.length>120||!Array.isArray(p.methods)) throw Error('Invalid player in backup.');if(p.photo!==undefined&&(typeof p.photo!=='string'||!p.photo.startsWith('data:image/jpeg;base64,')||p.photo.length>60000)) throw Error('Invalid player photo in backup.');}
  for(const s of v.sessions){if(!Array.isArray(s.entries)||!Array.isArray(s.adjustments)||s.entries.length>100000) throw Error('Invalid session in backup.');if(s.mode!==undefined&&!['centralized','decentralized'].includes(s.mode))throw Error('Invalid banking mode.');if(s.bankerId!==undefined&&s.bankerId!==null&&typeof s.bankerId!=='string')throw Error('Invalid banker.');if(s.bankers!==undefined&&(typeof s.bankers!=='object'||s.bankers===null||Object.values(s.bankers).some(x=>typeof x!=='string')))throw Error('Invalid personal bankers.');if(s.cashUnit!==undefined&&(!Number.isSafeInteger(s.cashUnit)||s.cashUnit<1||s.cashUnit>1000000))throw Error('Invalid cash unit.');if(s.prefs!==undefined&&(typeof s.prefs!=='object'||s.prefs===null||Object.values(s.prefs).some(x=>!x||!Number.isSafeInteger(x.cash||0)||x.cash<0)))throw Error('Invalid cash preferences.');for(const a of s.adjustments){if(!Number.isSafeInteger(a.amount)||Math.abs(a.amount)>1000000000||typeof a.playerId!=='string')throw Error('Invalid discrepancy allocation.');}for(const e of s.entries){if(!['buyin','cashout','transfer'].includes(e.type)||!Number.isSafeInteger(e.amount)||e.amount<0||e.amount>1000000000)throw Error('Invalid money entry.');}}
  return v;
}
export const createDemo = () => {
  const v=makeStore();const people=['Sonkiya','Brett','Rishit','Shreeni','Tahmid','Basu','Manan'];people.forEach(n=>v.players.push(createPlayer(n)));
  const s=makeSession('Example · October 22 poker night');s.status='closed';s.endedAt=new Date().toISOString();
  const map=Object.fromEntries(v.players.map(p=>[p.name,p.id]));
  const now=new Date().toISOString();
  const add=(type,name,amount,extra={})=>s.entries.push({id:uid(),type,playerId:map[name],amount,at:now,...extra});
  add('buyin','Sonkiya',2000,{method:'Cash',status:'received'});add('buyin','Brett',2500,{method:'Coins',status:'received'});add('buyin','Brett',2000,{method:'Cash',status:'received'});
  add('buyin','Rishit',2000,{method:'Zelle',status:'received'});add('buyin','Shreeni',2000,{method:'Cash',status:'received'});add('buyin','Shreeni',2000,{method:'Cash',status:'received'});
  for(let i=0;i<3;i++)add('buyin','Tahmid',1000,{method:'Zelle',status:'received'});
  add('buyin','Basu',1500,{method:'Venmo',status:'received'});add('buyin','Manan',2000,{method:'Zelle',status:'received'});
  for(const [name,amount] of [['Sonkiya',7100],['Brett',4530],['Rishit',0],['Shreeni',1530],['Tahmid',0],['Basu',2400],['Manan',3420]])add('cashout',name,amount);
  // Mark only confirmed transfers; Brett's actual cash-out is a $0.30 short settlement he accepted.
  s.entries.push({id:uid(),type:'transfer',from:BANK_ID,to:map.Brett,amount:4500,method:'Cash',status:'paid',at:now});
  s.entries.push({id:uid(),type:'transfer',from:BANK_ID,to:map.Basu,amount:2000,method:'Cash',status:'paid',at:now});
  v.sessions.push(s);return v;
};
