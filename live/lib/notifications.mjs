import {BANK_ID,participants,playerStats,stats,money,signedMoney,simplify,gameReady} from './engine.mjs';
import {outstandingDebts} from './analytics.mjs';
export const SITE='https://pokertracker-cfb7b.web.app';
export function normalizePlayerEmail(value) {
 const email=String(value??'').trim();
 if(email && (email.length>254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)))throw Error('Enter a valid email address.');
 return email;
}
const nameIn=ledger=>id=>id===BANK_ID?'the bank':ledger.players.find(p=>p.id===id)?.name||'a player';
const settled=s=>!!s&&gameReady(s);
const link=s=>`${SITE}/games/${encodeURIComponent(s.id)}/settlements`;

// One email per player when a game's results become final.
export function gameSummary(ledger,game,playerId){
 const name=nameIn(ledger),p=playerStats(game,playerId),plan=simplify(game,{includePending:false});
 const pay=plan.filter(t=>t.from===playerId),get=plan.filter(t=>t.to===playerId);
 const owe=pay.reduce((n,t)=>n+t.amount,0),due=get.reduce((n,t)=>n+t.amount,0);
 const lines=[`Hi ${name(playerId)},`,'',`Results from ${game.title}:`,'',`Bought in: ${money(p.bought)}`,`Cashed out: ${money(p.cashed+p.adjustment)}`,`Net: ${signedMoney(p.net)}`,''];
 if(p.tipsGiven||p.tipsReceived)lines.push(`Tips given: ${money(p.tipsGiven)}`,`Tips received: ${money(p.tipsReceived)}`,'');
 if(pay.length)lines.push('You need to send:',...pay.map(t=>`  ${money(t.amount)} to ${name(t.to)}`),'');
 if(get.length)lines.push('You will receive:',...get.map(t=>`  ${money(t.amount)} from ${name(t.from)}`),'');
 const banker=game.bankers?.[playerId];
 if(banker)lines.push(`${name(banker)} is settling for you, so there is nothing to send or receive directly.`,'');
 else if(!pay.length&&!get.length)lines.push('You are all square. Nothing to send or receive.','');
 lines.push(`Details: ${link(game)}`,'','OpenStax Poker');
 const subject=`${game.title}: ${owe?`you owe ${money(owe)}`:due?`you're owed ${money(due)}`:'all square'}`;
 return {playerId,subject,body:lines.join('\n'),gameId:game.id};
}

export function notificationEvents(before,after,command){
 const {type,payload:p={}}=command;
 if(type==='send-reminders')return paymentReminders(after).filter(r=>!Array.isArray(p.playerIds)||p.playerIds.includes(r.playerId));
 const game=after.sessions.find(s=>s.id===p.sessionId);
 if(!game)return [];
 if(type==='send-update'){
  if(!settled(game))return [];
  return participants(game).filter(id=>id!==BANK_ID&&(!Array.isArray(p.playerIds)||p.playerIds.includes(id))).map(id=>gameSummary(after,game,id));
 }
 // Fires once when a game becomes final: on close, or when a chip-count difference is resolved after closing.
 const previous=before.sessions.find(s=>s.id===p.sessionId);
 if(settled(game)&&!settled(previous))return participants(game).filter(id=>id!==BANK_ID).map(id=>gameSummary(after,game,id));
 return [];
}

// Payment reminders, sent on request: one email per player who still owes in any final game.
export function paymentReminders(ledger){
 const name=nameIn(ledger),owed=outstandingDebts(ledger);
 return [...owed].map(([playerId,items])=>{
  const total=items.reduce((n,t)=>n+t.amount,0);
  const lines=[`Hi ${name(playerId)},`,'','Quick reminder, you still need to send:',...items.map(t=>`  ${money(t.amount)} to ${name(t.to)} (${t.game.title})`),'',`Already paid? Ask the organizer to mark it paid so these reminders stop.`,'',`Details: ${SITE}/settlements`,'','OpenStax Poker'];
  return {playerId,subject:`Reminder: you owe ${money(total)}`,body:lines.join('\n')};
 });
}

// Verify private recipient settings and current accounting immediately before delivery.
export function notificationCurrent(ledger,contact,message){
 if(!contact?.enabled||!contact.email||contact.email!==message.to)return false;
 const current=message.gameId?(()=>{const game=ledger.sessions.find(s=>s.id===message.gameId);return game&&gameReady(game)&&gameSummary(ledger,game,message.playerId);})():paymentReminders(ledger).find(m=>m.playerId===message.playerId);
 return !!current&&current.subject===message.subject&&current.body===message.body;
}
