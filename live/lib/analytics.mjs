import {BANK_ID, balances, payBalances, participants, playerStats, stats, simplify, planSteps} from './engine.mjs';
// Keep obligations per game: a win in another game does not confirm a payment here.
export function outstandingPayments(s) {
  if (s.status !== 'closed' && s.mode === 'decentralized') return [];
  if (s.status === 'closed' && stats(s).unresolved !== 0) return [];
  return [...payBalances(s)].filter(([, amount]) => amount < 0).map(([id, amount]) => {
    const pending = s.entries.filter(e => !e.voidedAt && e.type === 'transfer' && e.status === 'pending' && e.from === id).reduce((sum, e) => sum + e.amount, 0);
    return {id, amount: -amount, pending};
  });
}
export function ledgerAnalytics(data) {
  const games = data.sessions;
  const completed = games.filter(s => s.status === 'closed');
  const needsReview = completed.filter(s => stats(s).unresolved !== 0);
  const unpaid = games.flatMap(game => outstandingPayments(game).map(row => ({...row, game})));
  const leaderboard = data.players.map(player => {
    const played = completed.filter(s => participants(s).includes(player.id));
    return {...player, games: played.length, net: played.reduce((sum, s) => sum + playerStats(s, player.id).net, 0)};
  }).filter(p => p.games).sort((a, b) => b.net - a.net);
  return {needsReview, volume: games.reduce((sum, s) => sum + stats(s).totalIn, 0), completed: completed.length, open: games.filter(s => s.status === 'open').length, unpaid, outstanding: unpaid.reduce((sum, row) => sum + row.amount, 0), leaderboard, profiles: playerProfiles(data)};
}
export function gameDate(s) {
  return s.createdAt || s.entries.find(e => e.at)?.at || null;
}
// Chronological per-player results across completed games, for sparklines and form stats.
export function playerProfiles(data) {
  const completed = data.sessions.filter(s => s.status === 'closed').map((s, i) => ({s, i, at: gameDate(s)})).sort((a, b) => (a.at && b.at ? a.at.localeCompare(b.at) : a.i - b.i)).map(x => x.s);
  return data.players.map(player => {
    const results = completed.filter(s => participants(s).includes(player.id)).map(s => {const p = playerStats(s, player.id); return {gameId: s.id, title: s.title, at: gameDate(s), net: p.net, bought: p.bought};});
    let running = 0;
    const series = results.map(r => (running += r.net));
    const nets = results.map(r => r.net), bought = results.reduce((sum, r) => sum + r.bought, 0), net = running;
    return {id: player.id, name: player.name, games: results.length, net, bought, series, results,
      wins: nets.filter(n => n > 0).length, winRate: results.length ? nets.filter(n => n > 0).length / results.length : 0,
      best: results.length ? Math.max(...nets) : 0, worst: results.length ? Math.min(...nets) : 0,
      roi: bought ? net / bought : 0, streak: streakOf(nets)};
  });
}
function streakOf(nets) {
  let n = 0; const last = Math.sign(nets.at(-1) || 0);
  if (!last) return 0;
  for (let i = nets.length - 1; i >= 0 && Math.sign(nets[i]) === last; i--) n++;
  return n * last;
}
export function settlementSteps(s) {
  return planSteps(s);
}
export function balanceCalculation(s, id) {
  const p = playerStats(s, id);
  const pending = s.entries.filter(e => !e.voidedAt && e.type === 'transfer' && e.status === 'pending').reduce((sum, e) => sum + (e.from === id ? e.amount : e.to === id ? -e.amount : 0), 0);
  return {id, ...p, confirmed: p.sentDirect - p.paidOut, pending, balance: balances(s).get(id) || 0, plannedBalance: balances(s, {includePending: true}).get(id) || 0};
}
export {BANK_ID};

// Unpaid transfers from finished games, keyed by the player who must pay.
export function outstandingDebts(ledger) {
  const owed = new Map();
  for (const game of ledger.sessions.filter(s => s.status === 'closed' && stats(s).unresolved === 0)) {
    for (const t of simplify(game)) {
      if (t.from === BANK_ID) continue;
      if (!owed.has(t.from)) owed.set(t.from, []);
      owed.get(t.from).push({...t, game});
    }
  }
  return owed;
}
