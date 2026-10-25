import {ArrowUpRight, ArrowRight, Plus, Spade, CheckCheck, Club, Coins, Wallet, Users, Layers, Radio, Crown, ChevronRight} from 'lucide-react';
import {ledgerAnalytics, gameDate} from '../lib/analytics.mjs';
import {money, signedMoney, participants, stats} from '../lib/engine.mjs';
import {Avatar, PlayerCard, Standings} from './player-visuals';

const day = (s: any, opts: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'}) => { const at = gameDate(s); return at ? new Date(at).toLocaleDateString('en-US', opts) : 'Undated'; };
const linkProps = (href: string, go: () => void) => ({href, onClick: (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(); }});

export function Dashboard({data, onGame, onNew, onGames, onPlayers}: {data: any, onGame: (id: string, tab?: 'game' | 'settlements') => void, onNew: () => void, onGames: () => void, onPlayers: () => void}) {
 const a = ledgerAnalytics(data), recent = [...data.sessions].reverse(), chart = recent.slice(0, 12).reverse(), maximum = Math.max(1, ...chart.map((s: any) => stats(s).totalIn));
 const live = recent.find((s: any) => s.status === 'open');
 const name = (id: string) => id === '__bank__' ? 'Bank' : data.players.find((p: any) => p.id === id)?.name || 'Unknown';
 const ranked = a.profiles.filter((p: any) => p.games).sort((x: any, y: any) => y.net - x.net);
 const leader = ranked[0];
 const indexOf = (id: string) => data.players.findIndex((p: any) => p.id === id);
 return <>
 <section className="console-hero">
  <div className="console-hero-copy">
   <div className="hero-ornament" aria-hidden="true"><i/><Club size={26} strokeWidth={1.1}/><i/></div>
   <h1 className="wordmark">Felt Club<span>Poker OS</span></h1>
   <div className="hero-actions">
    <button className="button gold" onClick={onNew}><Plus size={17}/>New game</button>
    <button className="button glass" onClick={onGames}><Layers size={16}/>All games</button>
   </div>
  </div>
  {live ? <a className="live-card" {...linkProps(`/games/${encodeURIComponent(live.id)}`, () => onGame(live.id))}>
   <span className="live-tag"><Radio size={13}/>Live</span>
   <h2>{live.title}</h2>
   <div className="live-figures">
    <span><Users size={15}/>{participants(live).length}</span>
    <span><Coins size={15}/>{money(stats(live).totalIn)}</span>
   </div>
   <span className="live-open">Open table<ArrowRight size={15}/></span>
  </a> : leader && <div className="live-card idle">
   <span className="live-tag"><Crown size={13}/>Top of the club</span>
   <h2>{leader.name}</h2>
   <div className="live-figures"><span className="positive">{signedMoney(leader.net)}</span><span><Layers size={15}/>{leader.games}</span></div>
  </div>}
 </section>

 <div className="console-stats">
  {[{icon: Coins, label: 'Total action', value: money(a.volume)},
    {icon: Layers, label: 'Games played', value: data.sessions.length, tag: a.open ? `${a.open} live` : ''},
    {icon: Users, label: 'Players', value: data.players.length},
    {icon: Wallet, label: 'Unpaid', value: money(a.outstanding), warn: a.outstanding > 0}].map(c =>
   <div className={c.warn ? 'stat outstanding' : 'stat'} key={c.label}><c.icon className="stat-icon" size={22} strokeWidth={1.4}/><span>{c.label}</span><strong>{c.value}</strong>{c.tag && <em className="stat-tag">{c.tag}</em>}</div>)}
 </div>

 <div className="console-grid">
  <section className="panel standings-panel">
   <div className="panel-heading"><h2>Standings</h2><span className="chart-key"><i className="up"/>Up<i className="down"/>Down</span></div>
   {ranked.length ? <Standings profiles={a.profiles} onPlayer={onPlayers}/> : <div className="dashboard-empty"><Crown size={26}/><p>Standings appear after the first game closes.</p></div>}
  </section>
  <section className="panel volume-panel">
   <div className="panel-heading"><h2>Buy-ins by night</h2><span className="chart-key"><i/>Closed<i className="open"/>Live</span></div>
   {chart.length ? <div className="volume-chart" role="img" aria-label={chart.map((g: any) => `${g.title}: ${money(stats(g).totalIn)}`).join('; ')}>{chart.map((g: any) => <button key={g.id} onClick={() => onGame(g.id)} title={`${g.title}: ${money(stats(g).totalIn)}`}><span className="bar-value">{money(stats(g).totalIn)}</span><span className={`volume-bar ${g.status === 'open' ? 'is-open' : ''}`} style={{height: `${Math.max(3, stats(g).totalIn / maximum * 140)}px`}}/><small>{day(g)}</small></button>)}</div>
    : <div className="dashboard-empty"><Spade size={26}/><button className="text-button" onClick={onNew}>Start the first game<Plus size={15}/></button></div>}
  </section>
 </div>

 {ranked.length > 0 && <section className="form-section">
  <div className="section-toolbar"><h2>Player form</h2><button className="text-button" onClick={onPlayers}>All players<ArrowRight size={15}/></button></div>
  <div className="player-tiles">{ranked.slice(0, 6).map((p: any) => <PlayerCard key={p.id} profile={p} index={indexOf(p.id)}/>)}</div>
 </section>}

 <section className="panel unpaid-panel">
  <div className="panel-heading"><h2>Unpaid {a.unpaid.length > 0 && <span className="count">{a.unpaid.length}</span>}</h2><Wallet size={18}/></div>
  {a.needsReview.length > 0 && <div className="review-games"><b>Chip counts need review</b>{a.needsReview.map((g: any) => <button key={g.id} className="text-button" onClick={() => onGame(g.id, 'settlements')}>{g.title}<ArrowRight size={14}/></button>)}</div>}
  {a.unpaid.length ? <div className="owe-list">{a.unpaid.map((r: any) => <a className="owe-row" key={`${r.game.id}-${r.id}`} {...linkProps(`/games/${encodeURIComponent(r.game.id)}/settlements`, () => onGame(r.game.id, 'settlements'))}>
   <Avatar name={name(r.id)} index={indexOf(r.id)}/>
   <span className="owe-who"><b>{name(r.id)}</b><small>{r.game.title}</small></span>
   <span className={`status-pill ${r.pending ? 'neutral' : 'unpaid'}`}>{r.pending ? `${money(r.pending)} pending` : 'Not paid'}</span>
   <strong className="negative">{money(r.amount)}</strong>
   <ChevronRight size={16}/>
  </a>)}</div>
  : <div className="paid-clear"><CheckCheck size={20}/><b>Everyone’s square.</b></div>}
 </section>

 <section className="session-section">
  <div className="section-toolbar"><h2>Recent games</h2><button className="text-button" onClick={onGames}>All games<ArrowRight size={15}/></button></div>
  <div className="session-grid">{recent.slice(0, 4).map((g: any) => <a className="session-preview" key={g.id} {...linkProps(`/games/${encodeURIComponent(g.id)}`, () => onGame(g.id))}>
   <div><span className={`status-pill ${g.status === 'open' ? 'live' : 'neutral'}`}><i/>{g.status === 'open' ? 'Live' : 'Closed'}</span><ArrowUpRight size={17}/></div>
   <h3>{g.title}</h3>
   <footer><span><Users size={13}/>{participants(g).length}</span><span>{day(g, {month: 'short', day: 'numeric', year: 'numeric'})}</span><b>{money(stats(g).totalIn)}</b></footer>
  </a>)}</div>
 </section>
 </>;
}
