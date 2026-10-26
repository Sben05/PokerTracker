import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,validateBackup} from '../lib/commands.mjs';
import {makeStore,simplify,balances,payBalances,BANK_ID} from '../lib/engine.mjs';
import {outstandingDebts,settlementSteps} from '../lib/analytics.mjs';
let n=0;
const run=(d,type,payload={})=>applyCommand(d,{id:`c-${++n}`,type,payload});
function table(...names){let d=run(makeStore(),'create-session',{title:'Cash night'});for(const name of names)d=run(d,'add-player',{name});return {d,sessionId:d.sessions[0].id,id:Object.fromEntries(d.players.map(p=>[p.name,p.id]))};}
const play=(d,sessionId,pid,inn,out)=>{d=run(d,'buyin',{sessionId,playerId:pid,amount:inn});return run(d,'cashout',{sessionId,playerId:pid,amount:out});};

test('cash handed to another player is paid out by that player when the depositor is down',()=>{
 let {d,sessionId,id}=table('Brett','Rishit','Alex');
 d=run(d,'buyin',{sessionId,playerId:id.Brett,amount:'20',cashUpfront:true,heldBy:id.Rishit});
 d=run(d,'buyin',{sessionId,playerId:id.Alex,amount:'20'});
 d=run(d,'cashout',{sessionId,playerId:id.Brett,amount:'0'});d=run(d,'cashout',{sessionId,playerId:id.Alex,amount:'40'});d=run(d,'close-session',{sessionId});
 const s=d.sessions[0];
 assert.equal(s.entries[0].heldBy,id.Rishit);assert.equal(s.entries[0].status,'received');assert.equal(s.entries[0].method,'Cash');
 assert.deepEqual(simplify(s),[{from:id.Rishit,to:id.Alex,amount:2000,method:'Cash'}]);
});
test('a personal banker settles for the player and absorbs their balance',()=>{
 let {d,sessionId,id}=table('Brett','Rishit','Alex');
 d=run(d,'set-banker',{sessionId,playerId:id.Brett,holderId:id.Rishit});
 d=play(d,sessionId,id.Brett,'40','0');d=play(d,sessionId,id.Rishit,'20','20');d=play(d,sessionId,id.Alex,'20','60');d=run(d,'close-session',{sessionId});
 const s=d.sessions[0];
 assert.deepEqual(simplify(s),[{from:id.Rishit,to:id.Alex,amount:4000}]);
 assert.equal(payBalances(s).get(id.Rishit),-4000);
 assert.equal(outstandingDebts(d).get(id.Brett),undefined);assert.equal(outstandingDebts(d).get(id.Rishit)[0].amount,4000);
 d=run(d,'set-banker',{sessionId,playerId:id.Brett,holderId:''});
 assert.deepEqual(simplify(d.sessions[0]).map(t=>t.from),[id.Brett]);
});
test('bankers cannot be themselves or form a loop',()=>{
 let {d,sessionId,id}=table('A','B','C');
 assert.throws(()=>run(d,'set-banker',{sessionId,playerId:id.A,holderId:id.A}),/own banker/);
 d=run(d,'set-banker',{sessionId,playerId:id.A,holderId:id.B});d=run(d,'set-banker',{sessionId,playerId:id.B,holderId:id.C});
 assert.throws(()=>run(d,'set-banker',{sessionId,playerId:id.C,holderId:id.A}),/loop/);
});
test('cash-only winners are paid from players who hold cash, in whole bills',()=>{
 let {d,sessionId,id}=table('Winner','Cashy','Broke');
 d=run(d,'set-prefs',{sessionId,playerId:id.Winner,cashOnly:true});d=run(d,'set-prefs',{sessionId,playerId:id.Cashy,cash:'30'});
 d=play(d,sessionId,id.Winner,'20','70');d=play(d,sessionId,id.Cashy,'30','0');d=play(d,sessionId,id.Broke,'20','0');d=run(d,'close-session',{sessionId});
 const plan=simplify(d.sessions[0]);
 assert.deepEqual(plan,[{from:id.Cashy,to:id.Winner,amount:3000,method:'Cash'},{from:id.Broke,to:id.Winner,amount:2000,method:'Cash',short:true}]);
});
test('odd cents on a cash payment need someone who can make change',()=>{
 const build=breaker=>{let {d,sessionId,id}=table('Winner','Payer');
  d=run(d,'set-prefs',{sessionId,playerId:id.Winner,cashOnly:true});d=run(d,'set-prefs',{sessionId,playerId:id.Payer,cash:'20',canBreak:breaker});
  d=play(d,sessionId,id.Winner,'20','32.50');d=play(d,sessionId,id.Payer,'20','7.50');d=run(d,'close-session',{sessionId});return {plan:simplify(d.sessions[0]),id};};
 let r=build(false);assert.deepEqual(r.plan,[{from:r.id.Payer,to:r.id.Winner,amount:1000,method:'Cash'},{from:r.id.Payer,to:r.id.Winner,amount:250,method:'Cash',short:true}]);
 r=build(true);assert.deepEqual(r.plan,[{from:r.id.Payer,to:r.id.Winner,amount:1250,method:'Cash'}]);
});
test('every plan still clears all balances exactly',()=>{
 let {d,sessionId,id}=table('A','B','C','D');
 d=run(d,'set-prefs',{sessionId,playerId:id.A,cashOnly:true});d=run(d,'set-prefs',{sessionId,playerId:id.B,cash:'25',canBreak:true});d=run(d,'set-banker',{sessionId,playerId:id.D,holderId:id.C});
 d=run(d,'buyin',{sessionId,playerId:id.D,amount:'20',cashUpfront:true,heldBy:id.C});
 d=play(d,sessionId,id.A,'20','55.55');d=play(d,sessionId,id.B,'20','3.45');d=play(d,sessionId,id.C,'20','31');d=run(d,'cashout',{sessionId,playerId:id.D,amount:'10'});d=run(d,'close-session',{sessionId});
 const s=d.sessions[0],left=payBalances(s,{includePending:true});
 for(const t of simplify(s)){left.set(t.from,left.get(t.from)+t.amount);left.set(t.to,left.get(t.to)-t.amount);}
 assert.ok([...left.values()].every(v=>v===0));
 assert.deepEqual(settlementSteps(s).map(({from,to,amount})=>({from,to,amount})),simplify(s).map(({from,to,amount})=>({from,to,amount})));
});
test('cash deposits need a different holder and a pay-at-end game, and backups keep them',()=>{
 let {d,sessionId,id}=table('A','B');
 assert.throws(()=>run(d,'buyin',{sessionId,playerId:id.A,amount:'20',cashUpfront:true}),/who is holding/);
 assert.throws(()=>run(d,'buyin',{sessionId,playerId:id.A,amount:'20',cashUpfront:true,heldBy:id.A}),/different player/);
 d=run(d,'set-banker',{sessionId,playerId:id.A,holderId:id.B});
 d=run(d,'buyin',{sessionId,playerId:id.A,amount:'20',cashUpfront:true});assert.equal(d.sessions[0].entries[0].heldBy,id.B);
 const copy=validateBackup(structuredClone(d));assert.equal(copy.sessions[0].bankers[id.A],id.B);
 const bad=structuredClone(d);bad.sessions[0].entries[0].heldBy='nobody';assert.throws(()=>validateBackup(bad),/unknown cash holder/);
 const merged=run(makeStore(),'import',{ledger:d});assert.equal(merged.sessions[0].entries[0].heldBy,id.B);
 let central=run(makeStore(),'create-session',{title:'Banker',mode:'centralized'});central=run(central,'add-player',{name:'X'});central=run(central,'add-player',{name:'Y'});
 assert.throws(()=>run(central,'buyin',{sessionId:central.sessions[0].id,playerId:central.players[0].id,amount:'20',method:'Cash',cashUpfront:true,heldBy:central.players[1].id}),/pay-at-end/);
});

test('the smallest bill is adjustable per game, down to exact cents',()=>{
 const build=unit=>{let {d,sessionId,id}=table('Winner','Payer');
  d=run(d,'set-prefs',{sessionId,playerId:id.Winner,cashOnly:true});d=run(d,'set-prefs',{sessionId,playerId:id.Payer,cash:'20'});
  if(unit)d=run(d,'set-cash-unit',{sessionId,unit});
  d=play(d,sessionId,id.Winner,'20','32.50');d=play(d,sessionId,id.Payer,'20','7.50');d=run(d,'close-session',{sessionId});return simplify(d.sessions[0]).map(t=>t.amount+(t.short?'s':'')).map(String);};
 assert.deepEqual(build(),['1000','250s']);assert.deepEqual(build('0.01'),['1250']);assert.deepEqual(build('1'),['1200','50s']);assert.deepEqual(build('10'),['1000','250s']);
 let {d,sessionId}=table('A');assert.throws(()=>run(d,'set-cash-unit',{sessionId,unit:'0'}),/greater than \$0/);
});
