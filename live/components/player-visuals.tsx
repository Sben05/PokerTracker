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

// Spots in front of the nine chairs of table.png, clockwise from the top center, as % of the image.
const SEATS = [[43, 18], [58, 18], [73, 23], [86, 44], [73, 71], [50, 76], [27, 71], [14, 44], [27, 23]];
const seatSpot = (i: number, n: number) => {
 if (n <= SEATS.length) return SEATS[Math.round(i * SEATS.length / n) % SEATS.length];
 const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
 return [50 + Math.cos(angle) * 33, 47 + Math.sin(angle) * 24];
};

// The photographed table; players, chips, cards and pot are placed on top of it.
export function PokerTable({seats, title, subtitle, total, totalLabel = 'In play', onSeat}: {seats: {id: string, name: string, index: number, amount: number, out?: boolean}[], title: string, subtitle?: string, total: number, totalLabel?: string, onSeat?: (id: string) => void}) {
 return <div className="table-stage" role="img" aria-label={`${title}${subtitle ? `, ${subtitle}` : ''}`}>
  <div className="table-photo">
   <img src="/table.png" alt="" draggable={false}/>
   {seats.length ? <>
    <div className="felt-cards">{CARDS.map(([r, s], i) => <span key={r + s} className={`card ${s === '♦' || s === '♥' ? 'red' : ''}`} style={{'--r': `${(i - 2) * 1.5}deg`} as React.CSSProperties}><b>{r}</b><i>{s}</i></span>)}</div>
    <span className="felt-pot"><ChipStack amount={total} seed={1}/><span><small>{totalLabel}</small><strong>{money(total)}</strong></span><ChipStack amount={total} seed={3}/></span>
    <span className="dealer" style={{left: '64%', top: '37%'}}>D</span>
   </> : <div className="felt-empty"><b>{title}</b>{subtitle && <small>{subtitle}</small>}</div>}
   {seats.map((p, i) => {const [x, y] = seatSpot(i, seats.length), cx = 50 + (x - 50) * .6, cy = 46 + (y - 46) * .68;return <span key={p.id}>
    <span className="seat-chips" style={{left: `${cx}%`, top: `${cy}%`}}><ChipStack amount={p.amount} seed={i}/></span>
    <button type="button" className={`seat ${p.out ? 'out' : ''}`} style={{left: `${x}%`, top: `${y}%`}} onClick={() => onSeat?.(p.id)}><Avatar name={p.name} index={p.index}/><span><b>{p.name}</b><em>{money(p.amount)}</em></span></button>
   </span>;})}
  </div>
 </div>;
}
