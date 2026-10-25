import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand} from '../lib/commands.mjs';
import {notificationEvents,normalizePlayerEmail,paymentReminders} from '../lib/notifications.mjs';
import {emailHtml} from '../lib/email-html.mjs';
import {makeStore} from '../lib/engine.mjs';
let serial=0;
const change=(before,type,payload={})=>{const command={id:'notify-'+(++serial),type,payload};const after=applyCommand(before,command);return {after,command,events:notificationEvents(before,after,command)};};
function game(){let d=makeStore();d=change(d,'add-player',{name:'Alex'}).after;d=change(d,'add-player',{name:'Blair'}).after;d=change(d,'create-session',{title:'Friday'}).after;const [a,b]=d.players.map(p=>p.id),s=d.sessions[0].id;for(const playerId of [a,b])d=change(d,'buyin',{sessionId:s,playerId,amount:'20'}).after;return {d,a,b,s};}
function closed(){let {d,a,b,s}=game();d=change(d,'cashout',{sessionId:s,playerId:a,amount:'30'}).after;d=change(d,'cashout',{sessionId:s,playerId:b,amount:'10'}).after;const r=change(d,'close-session',{sessionId:s});return {...r,a,b,s};}

test('email is validated but never stored in the public player ledger',()=>{
 assert.equal(normalizePlayerEmail(' alex@example.com '),'alex@example.com');
 for(const e of ['x','a@b','a@b.com,evil@b.com','x\nBcc:evil@a.com'])assert.throws(()=>normalizePlayerEmail(e));
 const {after}=change(makeStore(),'add-player',{name:'Alex',email:'alex@example.com',emailEnabled:true});assert.equal(after.players[0].email,undefined);
});
test('nothing is emailed during the game: buy-ins, cash-outs, profiles and payments stay quiet',()=>{
 let {d,a,b,s}=game();
 for(const [type,payload] of [['buyin',{sessionId:s,playerId:a,amount:'10'}],['cashout',{sessionId:s,playerId:a,amount:'30'}],['edit-player',{playerId:a,name:'Alex',email:'alex@example.com'}],['transfer',{sessionId:s,from:a,to:b,amount:'5',method:'Cash'}]]){const r=change(d,type,payload);assert.deepEqual(r.events,[],type);d=r.after;}
});
test('closing sends one summary per player with buy-ins, cash-out and who to pay',()=>{
 const {events,a,b}=closed();
 assert.equal(events.length,2);
 const alex=events.find(e=>e.playerId===a),blair=events.find(e=>e.playerId===b);
 assert.equal(alex.subject,"Friday: you're owed $10.00");assert.match(alex.body,/Bought in: \$20\.00/);assert.match(alex.body,/Cashed out: \$30\.00/);assert.match(alex.body,/\$10\.00 from Blair/);
 assert.equal(blair.subject,'Friday: you owe $10.00');assert.match(blair.body,/You need to send:\n  \$10\.00 to Alex/);
 assert.doesNotMatch(alex.body+blair.body,/—/);
});
test('the summary is not resent by later edits to an already-final game',()=>{
 const {after,a,b,s}=closed();
 assert.deepEqual(change(after,'transfer',{sessionId:s,from:b,to:a,amount:'10',method:'Cash',paid:true}).events,[]);
});
test('reminders go only to players who still owe, and stop once the payment is recorded',()=>{
 const {after,a,b,s}=closed();
 const r=paymentReminders(after);
 assert.equal(r.length,1);assert.equal(r[0].playerId,b);assert.equal(r[0].subject,'Reminder: you owe $10.00');assert.match(r[0].body,/\$10\.00 to Alex \(Friday\)/);
 const paid=change(after,'transfer',{sessionId:s,from:b,to:a,amount:'10',method:'Cash',paid:true}).after;
 assert.deepEqual(paymentReminders(paid),[]);
 assert.deepEqual(paymentReminders(game().d),[]);
});
test('manual resend repeats the final summary for chosen players only',()=>{
 const {after,a,s}=closed();
 const r=change(after,'send-update',{sessionId:s,playerIds:[a]});
 assert.equal(r.events.length,1);assert.equal(r.events[0].playerId,a);
 const open=game();assert.deepEqual(change(open.d,'send-update',{sessionId:open.s}).events,[]);
});
test('plain HTML emails escape content and link the details page',()=>{
 const html=emailHtml('x','Hi <script>,\n\nYou need to send:\n  $10.00 to <b>Alex</b>\n\nDetails: https://pokertracker-cfb7b.web.app/games/abc/settlements');
 assert.doesNotMatch(html,/<script>|<b>Alex/);assert.match(html,/href="https:\/\/pokertracker-cfb7b\.web\.app\/games\/abc\/settlements"/);
});
test('players who still owe from a finished game cannot buy in until it is marked paid',()=>{
 let {after,a,b,s}=closed();
 const next=change(after,'create-session',{title:'Saturday'});const s2=next.command.id;let d=next.after;
 assert.throws(()=>change(d,'buyin',{sessionId:s2,playerId:b,amount:'20'}),/Blair still owes \$10\.00 from Friday/);
 d=change(d,'buyin',{sessionId:s2,playerId:a,amount:'20'}).after;
 d=change(d,'transfer',{sessionId:s,from:b,to:a,amount:'10',method:'Other',paid:true}).after;
 assert.doesNotThrow(()=>change(d,'buyin',{sessionId:s2,playerId:b,amount:'20'}));
});
test('manual reminders email only the chosen debtors and link the all-time settlements page',()=>{
 const {after,a,b}=closed();
 const all=change(after,'send-reminders',{});assert.deepEqual(all.events.map(e=>e.playerId),[b]);assert.match(all.events[0].body,/\/settlements\n/);
 assert.deepEqual(change(after,'send-reminders',{playerIds:[a]}).events,[]);
});
