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

test('closed-game corrections update totals without replacing entry identity or payments',()=>{
 let d=game();const sessionId=d.sessions[0].id,[a,b]=d.players.map(p=>p.id);
 for(const playerId of [a,b])d=command(d,'buyin',{sessionId,playerId,amount:'20'});
 d=command(d,'cashout',{sessionId,playerId:a,amount:'30'});
 d=command(d,'cashout',{sessionId,playerId:b,amount:'10'});
 d=command(d,'close-session',{sessionId});
 d=command(d,'transfer',{sessionId,from:b,to:a,amount:'10',method:'Zelle',paid:true});
 const original=structuredClone(d),entryId=d.sessions[0].entries[0].id;
 d=command(d,'edit-entry',{sessionId,entryId,playerId:a,amount:'25.25',status:'pending',note:'Corrected'});
 assert.equal(d.sessions[0].status,'closed');assert.equal(stats(d.sessions[0]).totalIn,4525);
 assert.equal(d.sessions[0].entries[0].id,entryId);assert.equal(d.sessions[0].entries[0].at,original.sessions[0].entries[0].at);
 assert.equal(d.sessions[0].entries.at(-1).status,'paid');assert.equal(original.sessions[0].entries[0].amount,2000);
 assert.deepEqual(simplify(d.sessions[0]),[{from:a,to:'__bank__',amount:525}]);
 d=command(d,'delete-entry',{sessionId,entryId});assert.equal(stats(d.sessions[0]).totalIn,2000);
 assert.ok(!d.sessions[0].entries.some(e=>e.id===entryId));assert.equal(d.sessions[0].entries.at(-1).status,'paid');
});
test('entry edits validate amounts, references, cash holders and duplicate cash-outs',()=>{
 let d=game();const sessionId=d.sessions[0].id,[a,b]=d.players.map(p=>p.id);
 d=command(d,'buyin',{sessionId,playerId:a,amount:'20'});const entryId=d.sessions[0].entries[0].id;
 const payload={sessionId,entryId,playerId:a,amount:'20',status:'received',method:'Cash',heldBy:b};
 d=command(d,'edit-entry',payload);assert.equal(d.sessions[0].entries[0].heldBy,b);
 assert.throws(()=>command(d,'edit-entry',{...payload,heldBy:a}),/different player/);
 assert.throws(()=>command(d,'edit-entry',{...payload,amount:'1.001'}));
 assert.throws(()=>command(d,'edit-entry',{...payload,playerId:'missing'}),/Choose a player/);
 d=command(d,'edit-entry',{...payload,heldBy:'',method:'',status:'pending'});
 assert.equal(d.sessions[0].entries[0].heldBy,undefined);assert.equal(d.sessions[0].entries[0].method,undefined);
 for(const playerId of [a,b]){if(playerId===b)d=command(d,'buyin',{sessionId,playerId,amount:'20'});d=command(d,'cashout',{sessionId,playerId,amount:'0'});}
 const cashout=d.sessions[0].entries.find(e=>e.type==='cashout');
 assert.throws(()=>command(d,'edit-entry',{sessionId,entryId:cashout.id,playerId:b,amount:'10'}),/already has a cash-out/);
});
test('payment corrections can change parties and undo paid status',()=>{
 let d=game();const sessionId=d.sessions[0].id,[a,b]=d.players.map(p=>p.id);
 d=command(d,'transfer',{sessionId,from:a,to:b,amount:'10',method:'Cash',paid:true});const entryId=d.sessions[0].entries[0].id;
 d=command(d,'edit-entry',{sessionId,entryId,from:b,to:a,amount:'5',method:'Venmo',status:'pending'});
 assert.equal(d.sessions[0].entries[0].status,'pending');assert.equal(d.sessions[0].entries[0].from,b);
 assert.deepEqual(simplify(d.sessions[0],{includePending:false}),[]);
 assert.throws(()=>command(d,'edit-entry',{sessionId,entryId,from:a,to:a,amount:'5',method:'Cash'}),/different people/);
});
test('stale edits and deletes fail, while database field ordering does not matter',()=>{
 let d=game();const sessionId=d.sessions[0].id,playerId=d.players[0].id;
 d=command(d,'buyin',{sessionId,playerId,amount:'20'});const expected=d.sessions[0].entries[0],entryId=expected.id;
 const reversed=Object.fromEntries(Object.entries(expected).reverse());
 const payload={sessionId,entryId,expected:reversed,playerId,amount:'30',status:'pending'};
 const edited=command(d,'edit-entry',payload);assert.equal(edited.sessions[0].entries[0].amount,3000);
 assert.throws(()=>command(edited,'edit-entry',payload),/another device/);
 assert.throws(()=>command(edited,'delete-entry',{sessionId,entryId,expected}),/another device/);
 assert.throws(()=>command(edited,'delete-session',{sessionId,expected:d.sessions[0]}),/another device/);
});
test('game editing and deletion leave the player directory and other games intact',()=>{
 let d=game();const sessionId=d.sessions[0].id;
 d=command(d,'create-session',{title:'Keep me'});
 d=command(d,'edit-session',{sessionId,title:'Corrected game',notes:'Corrected notes',createdAt:'2026-10-25T18:00:00Z'});
 assert.equal(d.sessions[0].title,'Corrected game');assert.equal(d.sessions[0].createdAt,'2026-10-25T18:00:00.000Z');
 d=command(d,'delete-session',{sessionId,expected:d.sessions[0]});assert.equal(d.sessions.length,1);
 assert.equal(d.sessions[0].title,'Keep me');assert.equal(d.players.length,2);
 assert.throws(()=>command(d,'delete-session',{sessionId}),/no longer exists/);
});
test('game JSON replacement validates identities, money and banker loops',()=>{
 let d=game();const sessionId=d.sessions[0].id,[a,b]=d.players.map(p=>p.id),expected=structuredClone(d.sessions[0]);
 const replace=game=>command(d,'replace-session',{sessionId,expected,game});
 assert.throws(()=>replace({...expected,id:'different'}),/original game ID/);
 assert.throws(()=>replace({...expected,entries:[{id:'bad',type:'buyin',playerId:'missing',amount:2000,status:'pending'}]}),/unknown player/);
 assert.throws(()=>replace({...expected,bankers:{[a]:b,[b]:a}}),/loop/);
 assert.throws(()=>replace({...expected,entries:[{id:'bad',type:'buyin',playerId:a,amount:20.5,status:'pending'}]}),/money/);
 d=replace({...expected,title:'Fixed',bankers:{[a]:b},entries:[{id:'fixed',type:'buyin',playerId:a,amount:2500,status:'pending'}]});
 assert.equal(d.sessions[0].title,'Fixed');assert.equal(stats(d.sessions[0]).totalIn,2500);
 assert.equal(validateBackup(d).sessions.length,1);
});
