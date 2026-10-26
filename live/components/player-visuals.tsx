import {Play, Circle, CircleAlert, Banknote, Coins} from 'lucide-react';

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

export type Seat = {id: string, name: string, index: number, text: string, tone?: 'up' | 'down' | '', out?: boolean};

// Spots on the rail in front of the eight chairs of table-scene.jpg, clockwise from the top, as % of the image.
const SLOTS = [[50, 28.5], [73.5, 31], [84.5, 47], [74, 63.5], [50, 65.5], [26, 63.5], [15.5, 47], [26.5, 31]];
const spot = (i: number, n: number) => {
 if (n <= SLOTS.length) return SLOTS[Math.round(i * SLOTS.length / n) % SLOTS.length];
 const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
 return [50 + Math.cos(angle) * 35, 47 + Math.sin(angle) * 19];
};

// The photographed room and table; each recorded player is placed on the rail in front of a chair.
export function PokerTable({seats, label, onSeat, children}: {seats: Seat[], label: string, onSeat?: (id: string) => void, children?: React.ReactNode}) {
 return <div className="scene-box" role="img" aria-label={label}>
  <div className="scene">
   <img src="/table-scene.jpg" alt="" draggable={false}/>
   {seats.map((p, i) => {const [x, y] = spot(i, seats.length);
    return <button type="button" key={p.id} className={`seat ${p.out ? 'out' : ''}`} style={{left: `${x}%`, top: `${y}%`}} onClick={() => onSeat?.(p.id)}>
     <Avatar name={p.name} index={p.index}/><span><b>{p.name}</b><em className={p.tone || ''}>{p.text}</em></span>
    </button>;})}
   {children && <div className="scene-cta">{children}</div>}
  </div>
 </div>;
}
