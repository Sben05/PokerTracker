import {Play, Circle, CircleAlert, Banknote, Coins} from 'lucide-react';
import {money, signedMoney} from '../lib/engine.mjs';

const tones = ['sage', 'clay', 'lilac', 'blue', 'sand', 'rose', 'teal'];
const initials = (name: string) => name.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase();

export function Avatar({name, index = 0, small = false, photo}: {name: string, index?: number, small?: boolean, photo?: string}) {
 if (photo) return <span className={`avatar photo ${small ? 'small' : ''}`}><img src={photo} alt={name}/></span>;
 return <span className={`avatar ${tones[Math.max(0, index) % tones.length]} ${small ? 'small' : ''}`}>{initials(name)}</span>;
}

export function Who({name, index, small = false, photo}: {name: string, index: number, small?: boolean, photo?: string}) {
 return <span className="who"><Avatar name={name} index={index} small={small} photo={photo}/><span>{name}</span></span>;
}

export function Method({method}: {method?: string}) {
 if (!method) return <span className="muted">—</span>;
 const badge = method === 'Venmo' ? <i aria-hidden="true" className="method-badge venmo">V</i> : method === 'Zelle' ? <i aria-hidden="true" className="method-badge zelle">Z</i> : method === 'Cash' ? <i aria-hidden="true" className="method-badge cash"><Banknote size={13}/></i> : method === 'Coins' ? <i aria-hidden="true" className="method-badge coins"><Coins size={13}/></i> : <i aria-hidden="true" className="method-badge other">·</i>;
 return <span className="method">{badge}{method}</span>;
}

export function Pill({kind, children}: {kind: 'open' | 'closed' | 'unsettled' | 'unpaid' | 'paid' | 'pending' | 'playing', children: React.ReactNode}) {
 const icon = kind === 'open' ? <Play size={12} fill="currentColor"/> : kind === 'closed' ? <Circle size={12}/> : kind === 'unsettled' ? <CircleAlert size={12}/> : kind === 'playing' ? <i className="dot"/> : null;
 return <span className={`pill ${kind}`}>{icon}{children}</span>;
}

export type Seat = {id: string, name: string, index: number, text: string, tone?: 'up' | 'down' | '', out?: boolean, photo?: string, bought: number, net: number | null};

// Spots on the rail in front of the eight chairs of table-scene.jpg, clockwise from the top, as % of the image.
const SLOTS = [[50, 28.5], [73.5, 31], [84.5, 47], [74, 63.5], [50, 65.5], [26, 63.5], [15.5, 47], [26.5, 31]];
// At most seven players are seated; anyone beyond that is rolled up into one "+N more" plate.
export const MAX_SEATED = 7;

// The photographed room and table; each recorded player sits on the rail in front of a chair.
export function PokerTable({seats, label, onSeat, onMore, children}: {seats: Seat[], label: string, onSeat?: (id: string) => void, onMore?: () => void, children?: React.ReactNode}) {
 const shown = seats.length > MAX_SEATED ? seats.slice(0, MAX_SEATED) : seats, rest = seats.slice(shown.length);
 const slots = shown.length + (rest.length ? 1 : 0);
 const at = (i: number) => SLOTS[Math.round(i * SLOTS.length / slots) % SLOTS.length];
 // The rest are summed as a net result once all have cashed out, otherwise as chips bought in.
 const settled = rest.every(p => p.net !== null), total = settled ? rest.reduce((n, p) => n + (p.net || 0), 0) : rest.reduce((n, p) => n + p.bought, 0);
 const tone = settled ? (total > 0 ? 'up' : total < 0 ? 'down' : '') : '';
 return <div className="scene-box" role="img" aria-label={label}>
  <div className="scene">
   <img src="/table-scene.jpg" alt="" draggable={false}/>
   {shown.map((p, i) => {const [x, y] = at(i);
    return <button type="button" key={p.id} className={`seat ${p.out ? 'out' : ''}`} style={{left: `${x}%`, top: `${y}%`}} onClick={() => onSeat?.(p.id)}>
     <Avatar name={p.name} index={p.index} photo={p.photo}/><span><b>{p.name}</b><em className={p.tone || ''}>{p.text}</em></span>
    </button>;})}
   {rest.length > 0 && (() => {const [x, y] = at(shown.length);
    return <button type="button" className="seat more" style={{left: `${x}%`, top: `${y}%`}} onClick={() => onMore?.()}>
     <span className="avatar more-count">+{rest.length}</span><span><b>more</b><em className={tone}>{settled ? signedMoney(total) : money(total)}</em></span>
    </button>;})()}
   {children && <div className="scene-cta">{children}</div>}
  </div>
 </div>;
}
