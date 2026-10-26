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

// A stack of chips standing on the felt; height grows with the amount.
export function ChipStack({amount, seed = 0, className = ''}: {amount: number, seed?: number, className?: string}) {
 const count = Math.max(2, Math.min(10, Math.ceil(amount / 1200)));
 const stacks = amount > 5000 ? 2 : 1;
 return <span className={`chips ${className}`} aria-hidden="true">{Array.from({length: stacks}, (_, k) => {const n = Math.max(2, count - k * 3);return <span className="chip-stack" key={k} style={{height: `${n * 4 + 8}px`}}>{Array.from({length: n}, (_, i) => <i key={i} style={{'--c': CHIP_COLORS[(seed + k * 2 + (i >= n - 2 ? 1 : 0)) % CHIP_COLORS.length], bottom: `${i * 4}px`} as React.CSSProperties}/>)}</span>;})}</span>;
}

// Oval table seen from above at an angle: padded rail, brass ring, walnut edge, felt, leather chairs.
// Seats, chips and the pot stand up off the table so they stay readable.
export function PokerTable({seats, title, subtitle, total, totalLabel = 'In play', onSeat}: {seats: {id: string, name: string, index: number, amount: number, out?: boolean}[], title: string, subtitle?: string, total: number, totalLabel?: string, onSeat?: (id: string) => void}) {
 const at = (i: number, rx: number, ry: number) => {const angle = (i / Math.max(1, seats.length)) * Math.PI * 2 - Math.PI / 2; return {angle, left: `${50 + Math.cos(angle) * rx}%`, top: `${50 + Math.sin(angle) * ry}%`};};
 const chairs = Math.max(8, seats.length);
 return <div className="table-stage" role="img" aria-label={`${title}${subtitle ? `, ${subtitle}` : ''}`}>
  <div className="table-3d"><div className="table-plane">
   {Array.from({length: chairs}, (_, i) => {const angle = (i / chairs) * Math.PI * 2 - Math.PI / 2;return <span key={i} className="chair" style={{left: `${50 + Math.cos(angle) * 55}%`, top: `${50 + Math.sin(angle) * 63}%`, '--a': `${angle + Math.PI / 2}rad`} as React.CSSProperties}/>;})}
   <div className="rail"><div className="rail-brass"><div className="rail-wood"><div className="felt">
    <div className="felt-grain"/>
    <svg className="felt-line" viewBox="0 0 100 50" preserveAspectRatio="none"><ellipse cx="50" cy="25" rx="44" ry="20" fill="none" stroke="rgba(240,214,150,.38)" strokeWidth=".22"/></svg>
    <div className="felt-logo"><Spade size={34} fill="currentColor" strokeWidth={1}/><span>OpenStax Poker</span></div>
    {seats.length ? <div className="felt-cards">{CARDS.map(([r, s], i) => <span key={r + s} className={`card ${s === '♦' || s === '♥' ? 'red' : ''}`} style={{'--r': `${(i - 2) * 1.5}deg`} as React.CSSProperties}><b>{r}</b><i>{s}</i></span>)}</div>
     : <div className="felt-empty"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</div>}
   </div></div></div></div>
   {seats.length > 0 && <span className="dealer" style={{left: '61%', top: '20%'}}>D</span>}
   {seats.map((p, i) => {const pile = at(i, 34, 24);return <span key={p.id} className="stand" style={{left: pile.left, top: pile.top}}><ChipStack amount={p.amount} seed={i}/></span>;})}
   <span className="stand pot-stand" style={{left: '50%', top: '86%'}}><span className="felt-pot"><ChipStack amount={total} seed={1}/><span><small>{totalLabel}</small><strong>{money(total)}</strong></span><ChipStack amount={total} seed={3}/></span></span>
   {seats.map((p, i) => {const seat = at(i, 47, 47);return <span key={p.id} className="stand seat-stand" style={{left: seat.left, top: seat.top}}>
    <button type="button" className={`seat ${p.out ? 'out' : ''}`} onClick={() => onSeat?.(p.id)}><Avatar name={p.name} index={p.index}/><span><b>{p.name}</b><em>{money(p.amount)}</em></span></button>
   </span>;})}
  </div></div>
 </div>;
}
