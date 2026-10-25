import {BANK_ID,participants,playerStats,stats,money,signedMoney,simplify} from './engine.mjs';
export const SITE='https://pokertracker-cfb7b.web.app';
export function normalizePlayerEmail(value) {
 const email=String(value??'').trim();
 if(email && (email.length>254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)))throw Error('Enter a valid email address.');
 return email;
}
const nameIn=ledger=>id=>id===BANK_ID?'the bank':ledger.players.find(p=>p.id===id)?.name||'a player';
const settled=s=>!!s&&s.status==='closed'&&stats(s).unresolved===0;
const link=s=>`${SITE}/games/${encodeURIComponent(s.id)}/settlements`;

// One email per player when a game's results become final.
export function gameSummary(ledger,game,playerId){
 const name=nameIn(ledger),p=playerStats(game,playerId),plan=simplify(game);
 const pay=plan.filter(t=>t.from===playerId),get=plan.filter(t=>t.to===playerId);
 const owe=pay.reduce((n,t)=>n+t.amount,0),due=get.reduce((n,t)=>n+t.amount,0);
 const lines=[`Hi ${name(playerId)},`,'',`Results from ${game.title}:`,'',`Bought in: ${money(p.bought)}`,`Cashed out: ${money(p.cashed+p.adjustment)}`,`Net: ${signedMoney(p.net)}`,''];
 if(pay.length)lines.push('You need to send:',...pay.map(t=>`  ${money(t.amount)} to ${name(t.to)}`),'');
 if(get.length)lines.push('You will receive:',...get.map(t=>`  ${money(t.amount)} from ${name(t.from)}`),'');
 if(!pay.length&&!get.length)lines.push('You are all square. Nothing to send or receive.','');
 lines.push(`Details: ${link(game)}`,'','Felt Club Poker OS');
 const subject=`${game.title}: ${owe?`you owe ${money(owe)}`:due?`you're owed ${money(due)}`:'all square'}`;
 return {playerId,subject,body:lines.join('\n'),gameId:game.id};
}

export function notificationEvents(before,after,command){
 const {type,payload:p={}}=command;
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

// Morning reminders: one email per player who still owes money in any final game.
export function paymentReminders(ledger){
 const name=nameIn(ledger),owed=new Map();
 for(const game of ledger.sessions.filter(settled))for(const t of simplify(game)){
  if(t.from===BANK_ID)continue;
  if(!owed.has(t.from))owed.set(t.from,[]);
  owed.get(t.from).push({...t,game});
 }
 return [...owed].map(([playerId,items])=>{
  const total=items.reduce((n,t)=>n+t.amount,0);
  const lines=[`Hi ${name(playerId)},`,'','Quick reminder, you still need to send:',...items.map(t=>`  ${money(t.amount)} to ${name(t.to)} (${t.game.title})`),'',`Already paid? Ask the organizer to mark it paid so these reminders stop.`,'',`Details: ${link(items[0].game)}`,'','Felt Club Poker OS'];
  return {playerId,subject:`Reminder: you owe ${money(total)}`,body:lines.join('\n')};
 });
}
