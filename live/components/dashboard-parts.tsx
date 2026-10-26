import {useState} from 'react';
import {Trophy} from 'lucide-react';
import {money, signedMoney, stats} from '../lib/engine.mjs';
import {gameDate} from '../lib/analytics.mjs';
import {Avatar} from './player-visuals';

const shortDate = (g: any) => {const at = gameDate(g); return at ? new Date(at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '—';};
const niceMax = (v: number) => {if (v <= 0) return 100; const pow = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow; return 10 * pow;};

// Total chips bought in per game: the only money figure recorded for every game.
export function BuyinChart({games}: {games: any[]}) {
 const [range, setRange] = useState('12');
 const shown = (range === 'all' ? games : games.slice(-Number(range)));
 const values = shown.map(g => stats(g).totalIn), top = niceMax(Math.max(0, ...values)), ticks = [0, .25, .5, .75, 1];
 return <section className="box chart-panel"><div className="box-title"><h2>Buy-ins Over Time</h2><label className="filter"><select aria-label="Number of games" value={range} onChange={e => setRange(e.target.value)}><option value="6">Last 6 games</option><option value="12">Last 12 games</option><option value="all">All games</option></select></label></div>
  {shown.length ? <div className="chart">
   <div className="chart-y">{ticks.map(t => <span key={t} style={{bottom: `${t * 100}%`}}>${Math.round(top * t / 100)}</span>)}</div>
   <div className="chart-plot">
    <div className="chart-grid">{ticks.map(t => <i key={t} style={{bottom: `${t * 100}%`}}/>)}</div>
    <div className="chart-bars">{shown.map((g, i) => <div className="chart-col" key={g.id} title={`${g.title}: ${money(values[i])}`}><div className="chart-slot"><span className={`chart-bar ${g.status === 'open' ? 'open' : ''}`} style={{height: `${Math.max(1.5, values[i] / top * 100)}%`}}/></div><small>{shortDate(g)}</small></div>)}</div>
   </div>
  </div> : <p className="empty-note">No games yet.</p>}
 </section>;
}

export function LeaderCard({profiles, indexOf}: {profiles: any[], indexOf: (id: string) => number}) {
 const leader = [...profiles].filter(p => p.games).sort((a, b) => b.net - a.net)[0];
 return <section className="box leader-panel"><div className="box-title"><h2>Current Leader</h2></div>
  {leader ? <div className="leader">
   <div className="leader-head"><Avatar name={leader.name} index={indexOf(leader.id)}/><div><h3><Trophy size={18} className="leader-icon"/>{leader.name}</h3><strong className={leader.net > 0 ? 'positive' : leader.net < 0 ? 'negative' : ''}>{signedMoney(leader.net)}</strong></div></div>
   <dl><div><dt>Games</dt><dd>{leader.games}</dd></div><div><dt>Won</dt><dd>{Math.round(leader.winRate * 100)}%</dd></div><div><dt>Best night</dt><dd>{signedMoney(leader.best)}</dd></div></dl>
  </div> : <p className="empty-note">The leader appears after the first closed game.</p>}
 </section>;
}
