import {ChevronRight, Play, Circle, CircleAlert, Banknote, Coins, Spade} from 'lucide-react';
import {money} from '../lib/engine.mjs';

const tones = ['sage', 'clay', 'lilac', 'blue', 'sand', 'rose', 'teal'];
const initials = (name: string) => name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();

export function Avatar({name, index = 0, small = false}: {name: string, index?: number, small?: boolean}) {
 return <span className={`avatar ${tones[Math.max(0, index) % tones.length]} ${small ? 'small' : ''}`}>{initials(name)}</span>;
}

export function Who({name, index, small = false}: {name: string, index: number, small?: boolean}) {
 return <span className="who"><Avatar name={name} index={index} small={small}/><span>{name}</span></span>;
}

export function Method({method}: {method?: string}) {
 if (!method) return <span className="muted">—</span>;
 const badge = method === 'Venmo' ? <i className="method-badge venmo">V</i> : method === 'Zelle' ? <i className="method-badge zelle">Z</i> : method === 'Cash' ? <i className="method-badge cash"><Banknote size={13}/></i> : method === 'Coins' ? <i className="method-badge coins"><Coins size={13}/></i> : <i className="method-badge other">·</i>;
 return <span className="method">{badge}{method}</span>;
}

export function Pill({kind, children}: {kind: 'open' | 'closed' | 'unsettled' | 'unpaid' | 'paid' | 'pending' | 'playing', children: React.ReactNode}) {
 const icon = kind === 'open' ? <Play size={12} fill="currentColor"/> : kind === 'closed' ? <Circle size={12}/> : kind === 'unsettled' ? <CircleAlert size={12}/> : kind === 'playing' ? <i className="dot"/> : null;
 return <span className={`pill ${kind}`}>{icon}{children}</span>;
}

export function StatCard({icon: Icon, label, value, sub, tone, onClick, view}: {icon: any, label: string, value: React.ReactNode, sub?: React.ReactNode, tone?: 'up' | 'down', onClick?: () => void, view?: boolean}) {
 return <button type="button" className="stat" onClick={onClick} disabled={!onClick}>
  <span className="stat-ring"><Icon size={30} strokeWidth={1.4}/></span>
  <span className="stat-text"><span className="stat-label">{label}</span><strong className={`stat-value ${tone || ''}`}>{value}</strong>{sub && <span className="stat-sub">{sub}</span>}</span>
  {onClick && (view ? <span className="stat-view">View <ChevronRight size={14}/></span> : <ChevronRight className="stat-go" size={20}/>)}
 </button>;
}

const CARDS = [['A', '♠'], ['K', '♦'], ['10', '♣'], ['7', '♥'], ['2', '♠']];
const CHIP_COLORS = ['#e9e4d4', '#b3262b', '#1f6b43', '#1c1c1f', '#2f4f9a'];

// A tidy stack of chips; height grows with the amount.
export function ChipStack({amount, seed = 0, className = ''}: {amount: number, seed?: number, className?: string}) {
 const count = Math.max(1, Math.min(9, Math.ceil(amount / 1500)));
 const stacks = amount > 6000 ? 2 : 1;
 return <span className={`chips ${className}`} aria-hidden="true">{Array.from({length: stacks}, (_, k) => <span className="chip-stack" key={k}>{Array.from({length: Math.max(1, count - k * 2)}, (_, i) => <i key={i} style={{'--c': CHIP_COLORS[(seed + k + (i > 5 ? 1 : 0)) % CHIP_COLORS.length], bottom: `${i * 3}px`} as React.CSSProperties}/>)}</span>)}</span>;
}

// Oval felt table: wood rail, brass trim, leather chairs and one seat per player around the rail.
export function PokerTable({seats, title, subtitle, total, totalLabel = 'In play', onSeat}: {seats: {id: string, name: string, index: number, amount: number, out?: boolean}[], title: string, subtitle?: string, total: number, totalLabel?: string, onSeat?: (id: string) => void}) {
 const at = (i: number, rx: number, ry: number) => {const angle = (i / seats.length) * Math.PI * 2 - Math.PI / 2; return {angle, left: `${50 + Math.cos(angle) * rx}%`, top: `${50 + Math.sin(angle) * ry}%`};};
 return <div className="felt-wrap"><div className="felt">
  <div className="felt-grain" aria-hidden="true"/>
  <svg className="felt-line" viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="50" cy="23" rx="43" ry="17.5" fill="none" stroke="rgba(228,184,98,.35)" strokeWidth=".25"/><ellipse cx="50" cy="23" rx="42" ry="16.6" fill="none" stroke="rgba(228,184,98,.15)" strokeWidth=".15"/></svg>
  <div className="felt-center">
   <span className="felt-mark"><Spade size={24} fill="currentColor"/></span>
   <b>{title}</b>{subtitle && <small>{subtitle}</small>}
   <div className="felt-cards" aria-hidden="true">{CARDS.map(([r, s], i) => <span key={r + s} className={`card ${s === '♦' || s === '♥' ? 'red' : ''}`} style={{'--r': `${(i - 2) * 2.5}deg`} as React.CSSProperties}><b>{r}</b><i>{s}</i></span>)}</div>
   <span className="felt-pot"><ChipStack amount={total} seed={1} className="pot-chips"/><small>{totalLabel}</small>{money(total)}</span>
  </div>
  {seats.map((p, i) => {const chair = at(i, 58, 66), seat = at(i, 47, 50), pile = at(i, 33, 34);
   return <span key={p.id}>
    <span className="chair" style={{left: chair.left, top: chair.top, '--a': `${chair.angle + Math.PI / 2}rad`} as React.CSSProperties} aria-hidden="true"/>
    <span className="seat-chips" style={{left: pile.left, top: pile.top}}><ChipStack amount={p.amount} seed={i}/></span>
    <button type="button" className={`seat ${p.out ? 'out' : ''}`} style={{left: seat.left, top: seat.top}} onClick={() => onSeat?.(p.id)}>
     <Avatar name={p.name} index={p.index}/><span><b>{p.name}</b><em>{money(p.amount)}</em></span>
    </button>
   </span>;
  })}
  {seats.length > 0 && <span className="dealer" style={{left: `${50 + Math.cos(-Math.PI / 2 + 0.35) * 40}%`, top: `${50 + Math.sin(-Math.PI / 2 + 0.35) * 38}%`}} aria-hidden="true">D</span>}
 </div></div>;
}
