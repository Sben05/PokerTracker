import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeSession, simplify, BANK_ID, balances} from '../lib/engine.mjs';
import {outstandingPayments, ledgerAnalytics, settlementSteps, balanceCalculation, playerProfiles} from '../lib/analytics.mjs';
import {readRoute,routePath} from '../lib/navigation.mjs';
function settledGame(){
 const s=makeSession('Friday',{mode:'decentralized'});s.status='closed';
 s.entries=[{id:'a-in',type:'buyin',playerId:'a',amount:2000,status:'pending'},{id:'b-in',type:'buyin',playerId:'b',amount:2000,status:'pending'},{id:'a-out',type:'cashout',playerId:'a',amount:3500},{id:'b-out',type:'cashout',playerId:'b',amount:500}];return s;
}
test('game links round trip and unknown routes do not silently open the latest game',()=>{
 for(const page of ['game','activity','settlements'])assert.deepEqual(readRoute(routePath(page,'Friday / 1')),{page,sessionId:'Friday / 1'});
 assert.deepEqual(readRoute('/'),{page:'overview',sessionId:''});
 assert.equal(readRoute('/games').page,'history');
 for(const path of ['/games/%ZZ','/games/id/nope','/bad','/games/id/activity/extra'])assert.equal(readRoute(path).page,'missing');
});
test('a deferred buy-in is not overdue until the game closes',()=>{
 const s=settledGame();s.status='open';assert.deepEqual(outstandingPayments(s),[]);
 s.mode='centralized';assert.equal(outstandingPayments(s)[0].id,'b');
});
test('pending payments remain unpaid but reserve amounts in the suggested plan',()=>{
 const s=settledGame();s.entries.push({id:'payment',type:'transfer',from:'b',to:'a',amount:500,status:'pending'});
 assert.deepEqual(outstandingPayments(s),[{id:'b',amount:1500,pending:500}]);
 assert.equal(simplify(s)[0].amount,1000);
 const c=balanceCalculation(s,'b');assert.equal(c.balance,-1500);assert.equal(c.plannedBalance,-1000);assert.equal(c.pending,500);
 s.entries.at(-1).status='paid';assert.deepEqual(outstandingPayments(s),[{id:'b',amount:1000,pending:0}]);assert.equal(balanceCalculation(s,'b').confirmed,500);
 s.entries.at(-1).voidedAt='now';assert.equal(outstandingPayments(s)[0].amount,1500);
});
test('settlement explanations match the real plan exactly, including cent remainders',()=>{
 const s=settledGame();s.entries.push({id:'c-in',type:'buyin',playerId:'c',amount:1001,status:'pending'},{id:'c-out',type:'cashout',playerId:'c',amount:0},{id:'extra',type:'cashout',playerId:'a',amount:1001});
 const steps=settlementSteps(s);assert.deepEqual(steps.map(({from,to,amount})=>({from,to,amount})),simplify(s));
 const remaining=balances(s,{includePending:true});
 for(const step of steps){assert.equal(step.amount,Math.min(step.owedBefore,step.dueBefore));assert.equal(step.owedAfter,step.owedBefore-step.amount);assert.equal(step.dueAfter,step.dueBefore-step.amount);remaining.set(step.from,remaining.get(step.from)+step.amount);remaining.set(step.to,remaining.get(step.to)-step.amount);}
 assert.ok([...remaining.values()].every(n=>n===0));
});
test('dashboard keeps separate game debts and excludes unfinished results',()=>{
 const one=settledGame(),two=settledGame();two.id='two';two.entries=two.entries.map(e=>({...e,playerId:e.playerId==='a'?'b':'a'}));
 const open=settledGame();open.id='open';open.status='open';
 const result=ledgerAnalytics({players:[{id:'a',name:'Alex'},{id:'b',name:'Blair'}],sessions:[one,two,open]});
 assert.equal(result.outstanding,3000);assert.equal(result.unpaid.length,2);assert.equal(result.completed,2);assert.equal(result.open,1);assert.equal(result.leaderboard[0].net,0);assert.equal(result.leaderboard[0].games,2);
});
test('centralized arithmetic includes money already collected and confirmed transfers',()=>{
 const s=settledGame();s.mode='centralized';s.entries.filter(e=>e.type==='buyin').forEach(e=>e.status='received');s.adjustments.push({id:'adj',playerId:'a',amount:25});s.entries.push({id:'paid',type:'transfer',from:BANK_ID,to:'a',amount:1000,status:'paid'});
 const c=balanceCalculation(s,'a');assert.equal(c.cashed-c.bought+c.adjustment+c.paidIn+c.confirmed,c.balance);assert.equal(c.balance,2525);
});
test('unresolved chip differences are flagged for review rather than published as debts',()=>{
 const s=settledGame();s.entries.find(e=>e.id==='a-out').amount+=1;
 assert.deepEqual(outstandingPayments(s),[]);
 const a=ledgerAnalytics({players:[],sessions:[s]});assert.equal(a.needsReview.length,1);assert.equal(a.outstanding,0);
});
test('player profiles chart running totals in game order and track streaks',()=>{
 const g1=settledGame();g1.id='g1';g1.createdAt='2026-01-01T00:00:00Z';
 const g2=settledGame();g2.id='g2';g2.createdAt='2026-02-01T00:00:00Z';g2.entries[2].amount=1000;g2.entries[3].amount=3000;
 const open=settledGame();open.id='g3';open.status='open';
 const data={players:[{id:'a',name:'Alex'},{id:'b',name:'Bo'},{id:'c',name:'Cy'}],sessions:[g2,open,g1]};
 const [a,b,c]=playerProfiles(data);
 assert.deepEqual(a.series,[1500,500]);assert.equal(a.net,500);assert.equal(a.winRate,0.5);assert.equal(a.best,1500);assert.equal(a.worst,-1000);assert.equal(a.streak,-1);
 assert.deepEqual(b.series,[-1500,-500]);assert.equal(b.streak,1);assert.equal(b.bought,4000);
 assert.equal(c.games,0);assert.deepEqual(c.series,[]);
});
