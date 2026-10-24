import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,validateBackup} from '../lib/commands.mjs';
import {makeStore,simplify,stats} from '../lib/engine.mjs';
let counter=0;
const command=(data,type,payload={})=>applyCommand(data,{id:`action-${++counter}`,type,payload});
function game(){let d=command(makeStore(),'create-session',{title:'Test table'});d=command(d,'add-player',{name:'Alex'});d=command(d,'add-player',{name:'Blair'});return d;}
test('decentralized buy-ins defer methods and net into one settlement',()=>{
 let d=game();const sessionId=d.sessions[0].id,[a,b]=d.players.map(p=>p.id);
 for(const playerId of [a,b])d=command(d,'buyin',{sessionId,playerId,amount:'20'});
 assert.ok(d.sessions[0].entries.every(e=>e.status==='pending'&&!e.method));
 d=command(d,'cashout',{sessionId,playerId:a,amount:'30'});d=command(d,'cashout',{sessionId,playerId:b,amount:'10'});d=command(d,'close-session',{sessionId});
 assert.deepEqual(simplify(d.sessions[0]),[{from:b,to:a,amount:1000}]);
 d=command(d,'transfer',{sessionId,from:b,to:a,amount:'10',method:'Zelle',paid:true});assert.equal(simplify(d.sessions[0]).length,0);
});
test('rejects early close and duplicate chip cash-outs',()=>{
 let d=game();const sessionId=d.sessions[0].id,playerId=d.players[0].id;d=command(d,'buyin',{sessionId,playerId,amount:'20'});
 assert.throws(()=>command(d,'close-session',{sessionId}),/final cash-out/);
 d=command(d,'cashout',{sessionId,playerId,amount:'0'});assert.throws(()=>command(d,'cashout',{sessionId,playerId,amount:'20'}),/already cashed out/);
});
test('import preserves history, merges names, and does not duplicate a session',()=>{
 const original=game();let incoming=game();incoming.players[0].name='alex';
 let merged=command(original,'import',{ledger:incoming});assert.equal(merged.players.length,2);assert.equal(merged.sessions.length,2);
 merged=command(merged,'import',{ledger:incoming});assert.equal(merged.sessions.length,2);
 assert.equal(original.sessions.length,1);
});
test('voiding preserves original entry but removes its financial effect',()=>{
 let d=game();const sessionId=d.sessions[0].id,playerId=d.players[0].id;d=command(d,'buyin',{sessionId,playerId,amount:'20'});const entryId=d.sessions[0].entries[0].id;
 d=command(d,'void-entry',{sessionId,entryId});assert.equal(stats(d.sessions[0]).totalIn,0);assert.equal(d.sessions[0].entries.length,1);
});
test('invalid money and unknown backup references fail validation',()=>{
 const d=game();assert.throws(()=>command(d,'buyin',{sessionId:d.sessions[0].id,playerId:d.players[0].id,amount:'1.001'}));
 const backup=structuredClone(d);backup.sessions[0].entries.push({id:'bad',type:'buyin',playerId:'missing',amount:2000,status:'pending'});assert.throws(()=>validateBackup(backup),/unknown player/);
});
