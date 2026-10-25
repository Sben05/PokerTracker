import {useState} from 'react';
import {Layers, Trophy, TrendingUp, Flame, Mail} from 'lucide-react';
import {money, signedMoney} from '../lib/engine.mjs';

const tones = ['sage', 'clay', 'lilac', 'blue', 'sand', 'rose', 'teal'];
const initials = (name: string) => name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();
const shortDate = (at: string | null) => at ? new Date(at).toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : 'Undated';

export function Avatar({name, index = 0, small = false}: {name: string, index?: number, small?: boolean}) {
 return <span className={`avatar ${tones[index % tones.length]} ${small ? 'small' : ''}`}>{initials(name)}</span>;
}

export function Sparkline({profile, height = 46}: {profile: any, height?: number}) {
 const [hover, setHover] = useState<number | null>(null);
 const points = [0, ...profile.series], w = 200, pad = 5;
 const lo = Math.min(0, ...points), hi = Math.max(0, ...points), span = hi - lo || 1;
 const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
 const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
 const path = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
 const tone = profile.net >= 0 ? 'up' : 'down';
 const active = hover !== null && hover > 0 ? profile.results[hover - 1] : null;
 if (profile.results.length < 1) return <div className="spark-empty" style={{height}}>No closed games</div>;
 return <div className="spark" onPointerLeave={() => setHover(null)} onPointerMove={e => {const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)));}}>
  <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{height}} role="img" aria-label={`Running total over ${profile.games} games: ${signedMoney(profile.net)}`}>
   <line className="spark-zero" x1={pad} x2={w - pad} y1={y(0)} y2={y(0)}/>
   <path className={`spark-area ${tone}`} d={`${path}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`}/>
   <path className={`spark-line ${tone}`} d={path} vectorEffect="non-scaling-stroke"/>
   {hover !== null && <line className="spark-cursor" x1={x(hover)} x2={x(hover)} y1={0} y2={height} vectorEffect="non-scaling-stroke"/>}
  </svg>
  <span className={`spark-dot ${tone}`} style={{left: `${(x(hover ?? points.length - 1) / w) * 100}%`, top: `${(y(points[hover ?? points.length - 1]) / height) * 100}%`}}/>
  {active && <span className="spark-tip"><b>{active.title}</b><span>{shortDate(active.at)} · {signedMoney(active.net)}</span><span>Running {signedMoney(profile.series[hover! - 1])}</span></span>}
 </div>;
}

export function Standings({profiles, onPlayer}: {profiles: any[], onPlayer?: (id: string) => void}) {
 const rows = profiles.filter(p => p.games).sort((a, b) => b.net - a.net);
 const max = Math.max(1, ...rows.map(p => Math.abs(p.net)));
 return <div className="standings-chart" role="table" aria-label="All-time net by player">
  {rows.map((p, i) => <button className="standing-row" role="row" key={p.id} onClick={() => onPlayer?.(p.id)} title={`${p.name}: ${signedMoney(p.net)} over ${p.games} game${p.games === 1 ? '' : 's'} · ${Math.round(p.winRate * 100)}% winning nights`}>
   <span className="standing-name" role="cell"><Avatar name={p.name} index={i} small/>{p.name}</span>
   <span className="standing-track" role="cell" aria-hidden="true">
    <i className="standing-axis"/>
    <i className={`standing-bar ${p.net >= 0 ? 'up' : 'down'}`} style={{width: `${(Math.abs(p.net) / max) * 50}%`}}/>
   </span>
   <span className={`standing-value ${p.net > 0 ? 'positive' : p.net < 0 ? 'negative' : ''}`} role="cell">{signedMoney(p.net)}</span>
  </button>)}
 </div>;
}

export function PlayerCard({profile, index, email, onEmail}: {profile: any, index: number, email?: {email?: string, enabled?: boolean} | null, onEmail?: () => void}) {
 const p = profile;
 return <article className="player-tile">
  <header>
   <Avatar name={p.name} index={index}/>
   <div><h3>{p.name}</h3><span className="tile-sub"><Layers size={12}/>{p.games} game{p.games === 1 ? '' : 's'}</span></div>
   {onEmail && <button className={`mail-chip ${email?.email ? (email.enabled ? 'on' : 'off') : 'none'}`} onClick={onEmail} title={email?.email ? `${email.email}${email.enabled ? '' : ' (updates off)'}` : 'Add email for updates'} aria-label={email?.email ? `Email settings for ${p.name}` : `Add email for ${p.name}`}><Mail size={14}/></button>}
  </header>
  <strong className={`tile-net ${p.net > 0 ? 'positive' : p.net < 0 ? 'negative' : ''}`}>{p.games ? signedMoney(p.net) : '—'}</strong>
  <Sparkline profile={p}/>
  <footer>
   <span title="Winning nights"><Trophy size={13}/>{p.games ? `${Math.round(p.winRate * 100)}%` : '—'}</span>
   <span title="Best night"><TrendingUp size={13}/>{p.games ? signedMoney(p.best) : '—'}</span>
   <span title={p.streak > 0 ? 'Winning streak' : p.streak < 0 ? 'Losing streak' : 'Streak'} className={p.streak > 1 ? 'hot' : ''}><Flame size={13}/>{p.streak ? `${Math.abs(p.streak)}${p.streak > 0 ? 'W' : 'L'}` : '—'}</span>
   <span title="Total bought in"><span className="chip-glyph" aria-hidden="true"/>{money(p.bought)}</span>
  </footer>
 </article>;
}
