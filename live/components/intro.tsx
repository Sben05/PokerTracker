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
 const skip = useRef(() => {});
 finish.current = onDone;
 useEffect(() => {
  let exiting = false;
  const end = () => finish.current();
  let done: ReturnType<typeof setTimeout>;
  const leave = () => {
   if (exiting) return;
   exiting = true;
   setLeaving(true);
   done = setTimeout(end, 700);
  };
  skip.current = leave;
  const auto = setTimeout(leave, 4500);
  const keydown = (event: KeyboardEvent) => {
   if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return;
   event.preventDefault();
   leave();
  };
  window.addEventListener('keydown', keydown);
  return () => { clearTimeout(auto); clearTimeout(done); skip.current = () => {}; window.removeEventListener('keydown', keydown); };
 }, []);
 return <div className={`intro ${leaving ? 'leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to OpenStax Poker" onClick={() => skip.current()}>
  <div className="intro-camera">
   <div className="intro-scene">
    <div className="intro-bg" aria-hidden="true"/>
    <div className="intro-ambience" aria-hidden="true"/>
    <div className="intro-light" aria-hidden="true"/>
    <div className="intro-velvet" aria-hidden="true"/>
  <div className="intro-mark"><svg className="intro-crown" viewBox="0 0 80 40" aria-hidden="true"><path d="M12 12l14 12L40 5l14 19 14-12-7 22H19z"/><path d="M20 39h40M26 29h28"/><circle cx="12" cy="10" r="2"/><circle cx="40" cy="4" r="2"/><circle cx="68" cy="10" r="2"/></svg><h2>The table is yours</h2><span className="intro-title-rule" aria-hidden="true">◆</span></div>
    <div className="intro-hand" aria-hidden="true">
     {HAND.map((rank, i) => <div className="intro-card" key={rank} style={{'--i': i, '--fan': i - 2} as React.CSSProperties}>
      <div className="intro-card-turn"><div className="intro-card-back"><span>♣</span></div><div className="intro-card-face">
       <b>{rank}<i>♣</i></b><span>♣</span><b className="flip">{rank}<i>♣</i></b>
      </div></div>
     </div>)}
    </div>
   </div>
  </div>
  <div className="intro-gilding" aria-hidden="true">{['tl','tr','bl','br'].map(corner=><i className={corner} key={corner}/>)}</div>
  <div className="intro-gold-sweep" aria-hidden="true"/>

 </div>;
}
