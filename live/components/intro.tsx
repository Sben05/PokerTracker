import {useEffect, useRef, useState} from 'react';

const HAND = ['10', 'J', 'Q', 'K', 'A'];

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
  const leave = setTimeout(() => setLeaving(true), 3100), done = setTimeout(end, 3900);
  const skip = () => { setLeaving(true); clearTimeout(done); setTimeout(end, 650); };
  window.addEventListener('keydown', skip, {once: true});
  return () => { clearTimeout(leave); clearTimeout(done); window.removeEventListener('keydown', skip); };
 }, []);
 return <div className={`intro ${leaving ? 'leaving' : ''}`} role="presentation" onClick={() => { setLeaving(true); setTimeout(onDone, 650); }}>
  <div className="intro-felt"/>
  <div className="intro-hand" aria-hidden="true">
   {HAND.map((rank, i) => <div className="intro-card" key={rank} style={{'--i': i, '--fan': i - 2} as React.CSSProperties}>
    <div className="intro-card-deal"><div className="intro-card-inner">
     <div className="intro-card-back"><span>♣</span></div>
     <div className="intro-card-face"><b>{rank}<i>♣</i></b><span>♣</span><b className="flip">{rank}<i>♣</i></b></div>
    </div></div>
   </div>)}
  </div>
  <div className="intro-mark">
   <h1>OpenStax</h1>
   <p>Poker</p>
  </div>
  <span className="intro-skip">Click to enter</span>
 </div>;
}
