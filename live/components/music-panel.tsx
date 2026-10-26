'use client';
import {useState,type FormEvent} from 'react';
export function MusicPanel({music,session,editor,unlock}:{music:any,session:any,editor:boolean,unlock:()=>void}){
 const [track,setTrack]=useState(''),[invite,setInvite]=useState(''),[search,setSearch]=useState(''),[results,setResults]=useState<any[]>([]),[searching,setSearching]=useState(false);
 const current=music.room?.playing,live=music.room?.recording&&Date.now()-Date.parse(music.room.heartbeat)<45000;
 const canControl=editor&&music.connected&&live;
 const canQueue=live;
 function exportHistory(){const cell=(v:string)=>'"'+String(v).replace(/"/g,'""')+'"';const rows=[['Played at','Song','Artist','Album','Spotify URL'],...music.plays.slice().reverse().map((p:any)=>[p.playedAt,p.track.name,p.track.artists,p.track.album,p.track.url])];const url=URL.createObjectURL(new Blob([rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='openstax-poker-songs.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function findTracks(event:FormEvent){event.preventDefault();if(!search.trim()||!music.connected)return;setSearching(true);try{setResults(await music.search(search));}finally{setSearching(false);}}
 return <><div className="columns"><div>
  <section className="box"><h2>Now playing</h2><div className="box-body">
   <div className="now-playing">{current?.artwork?<a href={current.url} target="_blank" rel="noreferrer"><img src={current.artwork} alt={`${current.album} album art`}/></a>:<span className="music-art">No art</span>}<div><b>{current?.name||'Nothing playing'}</b><br/>{current?.artists||''}{current?.url&&<><br/><a href={current.url} target="_blank" rel="noreferrer">Open in Spotify</a></>}<p className="meta" style={{marginTop:6}}>DJ: {live?`${music.room.hostName} (${music.room.device||'Spotify'})`:'none'}</p></div></div>
   <div className="btn-row" style={{margin:'8px 0'}}><button className="btn" disabled={!canControl||music.busy} onClick={()=>music.request('previous')}>&lt;&lt; Prev</button><button className="btn" disabled={!canControl||music.busy} onClick={()=>music.request(music.room?.isPlaying?'pause':'play')}>{music.room?.isPlaying?'Pause':'Play'}</button><button className="btn" disabled={!canControl||music.busy} onClick={()=>music.request('next')}>Next &gt;&gt;</button></div>
   {!music.connected?<button className="btn" onClick={music.login} disabled={music.busy}>Sign in with Spotify</button>:<p>Signed in as {music.profile.display_name||music.profile.id}. <button className="link" onClick={music.logout}>Disconnect</button></p>}
   {music.connected&&!editor&&<p><button className="link" onClick={unlock}>Log in to edit</button> to be the DJ or control playback.</p>}
   {music.connected&&editor&&(music.isHost&&music.room?.recording?<button className="btn" onClick={music.stop}>Stop being DJ</button>:<button className="btn" disabled={!session||music.busy||live} onClick={music.start}>Be the DJ (use my Spotify)</button>)}
   {music.error&&<div className="alert" role="alert" style={{marginTop:8}}><span>{music.error}</span><button className="btn small" aria-label="Dismiss music error" onClick={music.clearError}>X</button></div>}
  </div></section>
  <section className="box"><div className="box-title"><h2>Songs played ({music.plays.length})</h2><button className="link" disabled={!music.plays.length} onClick={exportHistory}>Export CSV</button></div><div className="scroll"><table><thead><tr><th className="num">#</th><th>Song</th><th>Artist</th><th>Time</th></tr></thead><tbody>{music.plays.length?music.plays.map((play:any,i:number)=><tr key={play.id}><td className="num">{music.plays.length-i}</td><td><a href={play.track.url} target="_blank" rel="noreferrer">{play.track.name}</a></td><td>{play.track.artists}</td><td>{new Date(play.playedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</td></tr>):<tr><td className="empty" colSpan={4}>No songs yet.</td></tr>}</tbody></table></div></section>
 </div><div>
  <section className="box"><h2>Queue a song</h2><div className="box-body">
   {music.connected?<form className="btn-row" onSubmit={findTracks} style={{marginBottom:8}}><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Song or artist" aria-label="Search Spotify"/><button className="btn" type="submit" disabled={searching}>{searching?'...':'Search'}</button></form>:<p className="meta">Sign in with Spotify to search.</p>}
   {results.length>0&&<table style={{marginBottom:8}}><tbody>{results.map((song:any)=><tr key={song.id}><td>{song.artwork&&<img className="song-art" src={song.artwork} alt=""/>} {song.name}<br/><small>{song.artists}</small></td><td className="act"><button className="btn small" disabled={!canQueue||music.busy} onClick={()=>{void music.request('queue',song.uri);setResults(results.filter(item=>item.id!==song.id));}}>Queue</button></td></tr>)}</tbody></table>}
   <form onSubmit={e=>{e.preventDefault();void music.request('queue',track);setTrack('');}}><div className="field"><span>Spotify link</span><input value={track} onChange={e=>setTrack(e.target.value)} placeholder="https://open.spotify.com/track/..." required/></div><button className="btn" disabled={!canQueue||music.busy}>Queue</button>{!live&&<span className="meta"> No DJ connected.</span>}</form>
  </div></section>
  <section className="box"><h2>Spotify Jam</h2><div className="box-body">
   {music.room?.jamUrl?<p><a href={music.room.jamUrl} target="_blank" rel="noreferrer">Join the Jam</a></p>:<p className="meta">No Jam link saved.</p>}
   {editor&&<form onSubmit={e=>{e.preventDefault();void music.saveJam(invite);}}><div className="field"><span>Jam link</span><input value={invite} onChange={e=>setInvite(e.target.value)} placeholder={music.room?.jamUrl||''}/></div><button className="btn" disabled={!music.room||music.busy}>Save</button></form>}
  </div></section>
  {music.requests.length>0&&<section className="box"><h2>Requests ({music.requests.length})</h2><table><tbody>{music.requests.map((request:any)=><tr key={request.id}><td>{request.action==='queue'?'Queue song':request.action}</td><td>{request.by}</td><td>{request.status}{request.error&&<><br/><small className="negative">{request.error}</small></>}</td></tr>)}</tbody></table></section>}
 </div></div>
 <p className="meta">Music provided by Spotify.</p></>;
}
