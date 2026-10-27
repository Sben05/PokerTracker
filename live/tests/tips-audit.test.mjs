import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,validateBackup} from '../lib/commands.mjs';
import {makeStore,stats,playerStats,balances,payBalances,planSteps,simplify,cashOnHand,gameReady,BANK_ID} from '../lib/engine.mjs';
import {outstandingDebts,outstandingPayments,balanceCalculation,ledgerAnalytics} from '../lib/analytics.mjs';
import {gameSummary,notificationCurrent,paymentReminders} from '../lib/notifications.mjs';
let serial=0;
const run=(d,type,payload={})=>applyCommand(d,{id:`audit-${++serial}`,queuedAt:1700000000000+serial,type,payload});
function table(mode='decentralized'){
 let d=run(makeStore(),'create-session',{title:'Audit',mode});
 for(const name of ['Alex','Blair','Casey','Drew'])d=run(d,'add-player',{name});
 return {d,s:d.sessions[0].id,ids:d.players.map(p=>p.id)};
}
function closed(mode){let {d,s,ids:[a,b,c,z]}=table(mode);for(const playerId of [a,b])d=run(d,'buyin',{sessionId:s,playerId,amount:'20',method:'Cash'});for(const [playerId,amount] of [[a,'30'],[b,'10']])d=run(d,'cashout',{sessionId:s,playerId,amount});d=run(d,'close-session',{sessionId:s});return {d,s,a,b,c,z};}
function arithmetic(s){
 assert.equal([...balances(s).values()].reduce((n,v)=>n+v,0),0,'all obligations sum to zero');
 const remaining=payBalances(s,{includePending:true});
 for(const step of planSteps(s)){
  assert.ok(Number.isSafeInteger(step.amount)&&step.amount>0);
  assert.ok(step.amount<=step.owedBefore&&step.amount<=step.dueBefore);
  remaining.set(step.from,(remaining.get(step.from)||0)+step.amount);remaining.set(step.to,(remaining.get(step.to)||0)-step.amount);
 }
 assert.ok([...remaining.values()].every(n=>n===0),'planned payments clear every account');
 for(const id of [...new Set([...balances(s).keys()])]){
  const c=balanceCalculation(s,id);
  if(id===BANK_ID){const t=stats(s);assert.equal(t.totalIn-t.adjusted-t.bankHoldings,c.balance,'bank balance matches remaining bank holdings');}
  else assert.equal(c.cashed-c.bought+c.adjustment+c.tipNet+c.paidIn-c.heldFunds+c.confirmed,c.balance,'visible balance arithmetic matches account');
  assert.equal(c.balance+c.pending,c.plannedBalance);
 }
}
test('tip in settlement is a zero-sum gift, not chips or a repayment',()=>{
 let {d,s,a,b,c}=closed();const before=stats(d.sessions[0]);
 d=run(d,'tip',{sessionId:s,from:a,to:c,amount:'3.25'});const g=d.sessions[0];
 assert.equal(playerStats(g,a).net,675);assert.equal(playerStats(g,c).net,325);
 assert.equal(playerStats(g,c).bought,0);assert.equal(playerStats(g,c).open,false);
 assert.equal(stats(g).totalIn,before.totalIn);assert.equal(stats(g).totalOut,before.totalOut);assert.equal(stats(g).unresolved,0);
 assert.equal(balances(g).get(a),675);assert.equal(balances(g).get(c),325);assert.equal(balances(g).get(b),-1000);
 assert.equal(gameReady(g),true);arithmetic(g);
});
test('an already-given tip changes results but is never collected twice',()=>{
 for(const method of ['Cash','Venmo','Zelle','Other']){
  let {d,s,a,b,c}=closed();const before=simplify(d.sessions[0]);
  d=run(d,'tip',{sessionId:s,from:a,to:c,amount:'5',paid:true,method});const g=d.sessions[0];
  assert.deepEqual(simplify(g),before);assert.equal(playerStats(g,a).net,500);assert.equal(playerStats(g,c).net,500);
  assert.equal(cashOnHand(g,c),method==='Cash'?500:0);arithmetic(g);
 }
});
test('tip edits, direct confirmation, voids, deletes and backups preserve accounting',()=>{
 let {d,s,a,b,c}=closed();d=run(d,'tip',{sessionId:s,from:a,to:c,amount:'5'});const entryId=d.sessions[0].entries.at(-1).id;
 d=run(d,'edit-entry',{sessionId:s,entryId,from:b,to:c,amount:'2.50',status:'pending'});
 assert.equal(playerStats(d.sessions[0],b).net,-1250);arithmetic(d.sessions[0]);
 assert.throws(()=>run(d,'confirm-entry',{sessionId:s,entryId}),/how the tip/);
 d=run(d,'confirm-entry',{sessionId:s,entryId,method:'Venmo'});assert.equal(d.sessions[0].entries.at(-1).status,'paid');arithmetic(d.sessions[0]);
 assert.equal(validateBackup(d).sessions[0].entries.at(-1).type,'tip');
 const imported=run(makeStore(),'import',{ledger:d});assert.deepEqual(imported.sessions,d.sessions);
 const voided=run(d,'void-entry',{sessionId:s,entryId});assert.equal(playerStats(voided.sessions[0],c).net,0);arithmetic(voided.sessions[0]);
 const deleted=run(d,'delete-entry',{sessionId:s,entryId});assert.equal(playerStats(deleted.sessions[0],c).net,0);arithmetic(deleted.sessions[0]);
 for(const payload of [{from:a,to:a,amount:'1'},{from:a,to:'missing',amount:'1'},{from:BANK_ID,to:a,amount:'1'},{from:a,to:c,amount:'0'},{from:a,to:c,amount:'0.001'},{from:a,to:c,amount:'2',paid:true,method:'Bogus'}])assert.throws(()=>run(d,'tip',{sessionId:s,...payload}));
});
test('settling a game with tips clears every debt including banker groups',()=>{
 let {d,s,a,b,c,z}=closed();d=run(d,'tip',{sessionId:s,from:a,to:c,amount:'4.01'});d=run(d,'set-banker',{sessionId:s,playerId:c,holderId:z});
 for(const t of simplify(d.sessions[0]))d=run(d,'transfer',{sessionId:s,...t,amount:(t.amount/100).toFixed(2),method:t.method||'Venmo',paid:true});
 assert.deepEqual(simplify(d.sessions[0]),[]);assert.equal(outstandingDebts(d).size,0);arithmetic(d.sessions[0]);
});
test('pending payments reserve the plan but never bypass the buy-in debt check',()=>{
 let {d,s,a,b}=closed();d=run(d,'transfer',{sessionId:s,from:b,to:a,amount:'10',method:'Venmo'});
 assert.deepEqual(simplify(d.sessions[0]),[]);assert.equal(outstandingDebts(d).get(b)[0].amount,1000);
 assert.equal(outstandingPayments(d.sessions[0])[0].amount,1000);assert.equal(paymentReminders(d)[0].playerId,b);
 const payment=d.sessions[0].entries.at(-1).id;
 d=run(d,'create-session',{title:'Next'});const next=d.sessions.at(-1).id;
 assert.throws(()=>run(d,'buyin',{sessionId:next,playerId:b,amount:'20'}),/still owes/);
 d=run(d,'confirm-entry',{sessionId:s,entryId:payment});assert.doesNotThrow(()=>run(d,'buyin',{sessionId:next,playerId:b,amount:'20'}));
});
test('held money is excluded from bank holdings and included in per-player math',()=>{
 let {d,s,ids:[a,b,c]}=table();d=run(d,'buyin',{sessionId:s,playerId:a,amount:'20',paidUpfront:true,heldBy:b,method:'Venmo'});
 d=run(d,'cashout',{sessionId:s,playerId:a,amount:'20'});d=run(d,'close-session',{sessionId:s});
 assert.equal(stats(d.sessions[0]).received,2000);assert.equal(stats(d.sessions[0]).bankHoldings,0);assert.equal(balanceCalculation(d.sessions[0],b).heldFunds,2000);arithmetic(d.sessions[0]);
});
test('cash-only preferences follow dependent bankers, and bank cash can fund cash payouts',()=>{
 let {d,s,a,b,c,z}=closed();d=run(d,'set-banker',{sessionId:s,playerId:a,holderId:c});d=run(d,'set-prefs',{sessionId:s,playerId:a,cashOnly:true});
 assert.ok(simplify(d.sessions[0]).every(t=>t.to!==c||t.method==='Cash'));
 ({d,s,a,b}=closed('centralized'));
 // Mark the buy-ins collected by the bank; it now has $40 in physical cash.
 for(const e of d.sessions[0].entries.filter(e=>e.type==='buyin'))d=run(d,'confirm-entry',{sessionId:s,entryId:e.id});
 d=run(d,'set-prefs',{sessionId:s,playerId:a,cashOnly:true});assert.equal(cashOnHand(d.sessions[0],BANK_ID),4000);
 const toWinner=simplify(d.sessions[0]).filter(t=>t.to===a);assert.ok(toWinner.every(t=>t.method==='Cash'&&!t.short));arithmetic(d.sessions[0]);
});
test('deleting a zero cash-out still requires review even if chips balance',()=>{
 let {d,s,a,b}=closed();const e=d.sessions[0].entries.find(e=>e.type==='cashout'&&e.playerId===b);
 d=run(d,'edit-entry',{sessionId:s,entryId:e.id,playerId:b,amount:'0'});
 const aOut=d.sessions[0].entries.find(e=>e.type==='cashout'&&e.playerId===a);
 d=run(d,'edit-entry',{sessionId:s,entryId:aOut.id,playerId:a,amount:'40'});
 d=run(d,'delete-entry',{sessionId:s,entryId:e.id});assert.equal(stats(d.sessions[0]).unresolved,0);
 assert.equal(stats(d.sessions[0]).incomplete,1);assert.equal(gameReady(d.sessions[0]),false);assert.equal(outstandingDebts(d).size,0);assert.equal(ledgerAnalytics(d).needsReview.length,1);
});
test('operation IDs and timestamps stay deterministic through queued corrections',()=>{
 let {d,s,a,b}=closed();
 const command={id:'offline-tip',queuedAt:1701000000000,type:'tip',payload:{sessionId:s,from:a,to:b,amount:'1'}};
 const first=applyCommand(d,command),replayed=applyCommand(d,command);assert.deepEqual(replayed,first);
 const expected=first.sessions[0].entries.at(-1);
 assert.doesNotThrow(()=>run(replayed,'edit-entry',{sessionId:s,entryId:command.id,expected,from:a,to:b,amount:'2',status:'pending'}));
 d=run(d,'edit-entry',{sessionId:s,entryId:d.sessions[0].entries.find(e=>e.type==='cashout'&&e.playerId===a).id,playerId:a,amount:'29'});
 const allocate={id:'allocation-offline',queuedAt:1701000000100,type:'allocate',payload:{sessionId:s,playerId:a,amount:'1'}};
 const x=applyCommand(d,allocate),y=applyCommand(d,allocate);assert.deepEqual(x,y);assert.equal(x.sessions[0].adjustments.at(-1).id,allocate.id);
 assert.doesNotThrow(()=>run(y,'undo-allocation',{sessionId:s,allocationId:allocate.id}));
});
test('email delivery honors opt-outs, changed addresses, deleted games and changed balances',()=>{
 let {d,s,a,b}=closed();const contact={email:'alex@example.com',enabled:true};const message={...gameSummary(d,d.sessions[0],a),to:contact.email};
 assert.equal(notificationCurrent(d,contact,message),true);
 assert.equal(notificationCurrent(d,{...contact,enabled:false},message),false);assert.equal(notificationCurrent(d,{...contact,email:'new@example.com'},message),false);
 assert.equal(notificationCurrent(run(d,'delete-session',{sessionId:s}),contact,message),false);
 d=run(d,'tip',{sessionId:s,from:a,to:b,amount:'1'});assert.equal(notificationCurrent(d,contact,message),false);
 const fresh=gameSummary(d,d.sessions[0],a);assert.match(fresh.body,/Tips given: \$1\.00/);
});
test('randomized ledgers conserve every cent across modes, tips, held money, bankers and pending payments',()=>{
 let seed=123456789;const rnd=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
 for(let i=0;i<400;i++){
  let {d,s,ids}=table(i%2?'centralized':'decentralized');const decentralized=d.sessions[0].mode==='decentralized';let pot=0;
  for(const [j,playerId] of ids.entries()){
   const amount=1000+rnd(5000);pot+=amount;
   d=run(d,'buyin',{sessionId:s,playerId,amount:(amount/100).toFixed(2),method:rnd(2)?'Cash':'Venmo',received:!!rnd(2),...(decentralized&&rnd(2)?{paidUpfront:true,heldBy:ids[(j+1)%ids.length]}:{})});
  }
  for(const [j,playerId] of ids.entries()){const n=j===ids.length-1?pot:rnd(pot+1);pot-=n;d=run(d,'cashout',{sessionId:s,playerId,amount:(n/100).toFixed(2)});}
  d=run(d,'close-session',{sessionId:s});
  for(let j=0;j<3;j++){const from=rnd(4),to=(from+1+rnd(3))%4;d=run(d,'tip',{sessionId:s,from:ids[from],to:ids[to],amount:((1+rnd(2000))/100).toFixed(2),paid:!!rnd(2),method:rnd(2)?'Cash':'Zelle'});}
  if(rnd(2))d=run(d,'set-banker',{sessionId:s,playerId:ids[3],holderId:ids[1]});
  for(const playerId of ids)if(rnd(2))d=run(d,'set-prefs',{sessionId:s,playerId,cashOnly:!!rnd(2),canBreak:!!rnd(2),cash:(rnd(5000)/100).toFixed(2)});
  const plan=simplify(d.sessions[0]);if(plan.length&&rnd(2)){const t=plan[0];d=run(d,'transfer',{sessionId:s,from:t.from,to:t.to,amount:(t.amount/100).toFixed(2),method:t.method||'Other',paid:false});}
  const g=d.sessions[0];assert.equal(stats(g).unresolved,0);assert.equal(ids.reduce((n,id)=>n+playerStats(g,id).net,0),0);arithmetic(g);validateBackup(d);
 }
});
