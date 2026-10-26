import {useEffect, useRef, useState} from 'react';

const HAND = ['10', 'J', 'Q', 'K', 'A'];
const STACKS = [{side: 'l', colors: ['#b3262b', '#1c1c1f', '#1f6b43', '#b3262b', '#e9e4d4']}, {side: 'r', colors: ['#2f4f9a', '#b3262b', '#1c1c1f', '#e9e4d4']}];
// Fixed values so the dust looks scattered but never changes between renders.
const DUST = Array.from({length: 26}, (_, i) => ({x: (i * 37 + 11) % 100, s: 2 + (i * 7) % 4, d: 5 + (i * 3) % 5, delay: (i * 0.37) % 4, dx: ((i * 53) % 80) - 40}));

export function shouldPlayIntro() {
 if (typeof window === 'undefined') return false;
 try {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 } catch { return false; }
}

export function Intro({onDone}: {onDone: () => void}) {
 const [leaving, setLeaving] = useState(false);
 const finish = useRef(onDone);
 finish.current = onDone;
 useEffect(() => {
  const end = () => finish.current();
  const leave = setTimeout(() => setLeaving(true), 3500), done = setTimeout(end, 4300);
  const skip = () => { setLeaving(true); clearTimeout(done); setTimeout(end, 650); };
  window.addEventListener('keydown', skip, {once: true});
  return () => { clearTimeout(leave); clearTimeout(done); window.removeEventListener('keydown', skip); };
 }, []);
 return <div className={`intro ${leaving ? 'leaving' : ''}`} role="presentation" onClick={() => { setLeaving(true); setTimeout(onDone, 650); }}>
  <div className="intro-felt"/>
  <div className="intro-light"/>
  <div className="intro-dust" aria-hidden="true">{DUST.map((d, i) => <i key={i} style={{'--x': d.x, '--s': `${d.s}px`, '--d': `${d.d}s`, '--delay': `${d.delay}s`, '--dx': `${d.dx}px`} as React.CSSProperties}/>)}</div>
  <div className="intro-hand" aria-hidden="true">
   {STACKS.map(stack => <div className={`intro-stack ${stack.side}`} key={stack.side}>{stack.colors.map((color, i) => <i key={i} style={{'--c': color, '--n': i, '--t': stack.side === 'l' ? 0 : 1} as React.CSSProperties}/>)}</div>)}
   {HAND.map((rank, i) => <div className="intro-card" key={rank} style={{'--i': i, '--fan': i - 2} as React.CSSProperties}>
    <div className="intro-card-deal"><div className="intro-card-inner">
     <div className="intro-card-back"><span>♣</span></div>
     <div className="intro-card-face"><b>{rank}<i>♣</i></b><span>♣</span><b className="flip">{rank}<i>♣</i></b></div>
    </div></div>
   </div>)}
  </div>
  <div className="intro-beam"/>
  <span className="intro-skip">Click to enter</span>
  <span className="intro-bar"/>
 </div>;
}
