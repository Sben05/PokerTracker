'use client';
import {useEffect,useRef,useState} from 'react';
import {collection,doc,onSnapshot,query,where,orderBy,limit,runTransaction,setDoc,updateDoc,getDocs} from 'firebase/firestore';
import {database} from './firebase-network';
import {finishSpotifyLogin,loginSpotify,logoutSpotify,spotifyRequest,compactTrack,trackUri,jamUrl} from './spotify.mjs';
export function useMusic(sessionId:string|undefined,editor:boolean){
 const [profile,setProfile]=useState<any>(null),[room,setRoom]=useState<any>(null),[plays,setPlays]=useState<any[]>([]),[requests,setRequests]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[requestCycle,setRequestCycle]=useState(0);
 const hostId=useRef(''),latest=useRef<any>({room:null,plays:[],profile:null}),processing=useRef(false),lastRecent=useRef(0),lastObserved=useRef<any>(null);
 useEffect(()=>{const timer=setInterval(()=>setRequestCycle(n=>n+1),5000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{let id=sessionStorage.getItem('pokerbank.music.controller');if(!id){id=crypto.randomUUID();sessionStorage.setItem('pokerbank.music.controller',id);}hostId.current=id;
  let active=true;finishSpotifyLogin().then(connected=>connected?spotifyRequest('/me'):null).then(value=>{if(active)setProfile(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
 },[]);
 latest.current={room,plays,profile,sessionId};
 useEffect(()=>{setRoom(null);setPlays([]);setRequests([]);if(!sessionId)return;
  const base=doc(database,'musicRooms',sessionId);
  const stopRoom=onSnapshot(base,snapshot=>setRoom(snapshot.exists()?snapshot.data():null),e=>setError(e.message));
  const stopPlays=onSnapshot(collection(base,'plays'),snapshot=>setPlays(snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a:any,b:any)=>Date.parse(b.playedAt)-Date.parse(a.playedAt))),e=>setError(e.message));
  const stopRequests=onSnapshot(query(collection(base,'requests'),orderBy('createdAt','desc'),limit(50)),snapshot=>setRequests(snapshot.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
  return()=>{stopRoom();stopPlays();stopRequests();};
 },[sessionId]);
 const isHost=!!profile&&room?.hostId===hostId.current&&editor;
 async function start(){if(!sessionId)throw Error('Start a poker session first.');if(!editor)throw Error('Unlock the table with its password to manage music.');if(!profile)throw Error('Sign in with Spotify first.');
  const state=await spotifyRequest('/me/player');const devices=state?.device?[state.device]:(await spotifyRequest('/me/player/devices'))?.devices||[];const device=devices.find((item:any)=>item.is_active)||devices[0];if(!device?.id)throw Error('Open Spotify on a Premium device, start a song, then try again.');
  const ref=doc(database,'musicRooms',sessionId);await runTransaction(database,async tx=>{const current=(await tx.get(ref)).data();if(current?.recording&&current.hostId!==hostId.current&&Date.now()-Date.parse(current.heartbeat)<45000)throw Error(`${current.hostName} is already the DJ. Stop that controller first or wait for it to disconnect.`);tx.set(ref,{hostId:hostId.current,hostName:profile.display_name||profile.id,startedAt:current?.startedAt||new Date().toISOString(),heartbeat:new Date().toISOString(),recording:true,playing:current?.playing||null,device:device.name||'',deviceId:device.id,isPlaying:state?.is_playing||false,jamUrl:current?.jamUrl||''});});lastRecent.current=0;
 }
 async function record(track:any,at:string,source:string){if(!track||!sessionId)return;const timestamp=Date.parse(at);if(timestamp<Date.parse(latest.current.room?.startedAt||new Date().toISOString()))return;
  const match=latest.current.plays.find((p:any)=>p.track.id===track.id&&Math.abs(Date.parse(p.playedAt)-timestamp)<10000);
  const id=match?.id||`${timestamp}_${track.id}`;await setDoc(doc(database,'musicRooms',sessionId,'plays',id),{track,playedAt:at,source},{merge:true});
 }
 useEffect(()=>{if(!isHost||!sessionId||!room?.recording)return;let active=true,polling=false;const ref=doc(database,'musicRooms',sessionId);
  const poll=async()=>{if(polling||!active)return;polling=true;try{
   const state=await spotifyRequest('/me/player');if(!active)return;const track=compactTrack(state?.item);
   await updateDoc(ref,{heartbeat:new Date().toISOString(),playing:track,isPlaying:!!state?.is_playing,device:state?.device?.name||'',deviceId:state?.device?.id||latest.current.room?.deviceId||''});
   if(track&&state?.is_playing){const started=Date.now()-(state.progress_ms||0);if(!lastObserved.current||lastObserved.current.id!==track.id||Math.abs(lastObserved.current.started-started)>12000){lastObserved.current={id:track.id,started};await record(track,new Date(Math.max(started,Date.parse(latest.current.room.startedAt))).toISOString(),'observed');}}
   if(Date.now()-lastRecent.current>60000){lastRecent.current=Date.now();let path='/me/player/recently-played?limit=50&after='+Date.parse(latest.current.room.startedAt);for(let page=0;page<5&&path;page++){const recent=await spotifyRequest(path);for(const item of recent?.items||[])await record(compactTrack(item.track),item.played_at,'recent');path=recent?.next?.startsWith('https://api.spotify.com/v1/')?recent.next.slice('https://api.spotify.com/v1'.length):'';}}
  }catch(e:any){if(active)setError(e.message);}finally{polling=false;}};
  void poll();const timer=setInterval(poll,15000);const visible=()=>{if(!document.hidden)void poll();};document.addEventListener('visibilitychange',visible);return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',visible);};
 },[isHost,sessionId,room?.recording]);
 useEffect(()=>{if(!isHost||!room?.recording||!requests.some(r=>r.status==='pending')||!sessionId||processing.current)return;processing.current=true;let active=true;
  const process=async()=>{for(const request of requests.filter(r=>r.status==='pending').sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt))){if(!active||latest.current.sessionId!==sessionId||!latest.current.room?.recording||latest.current.room.hostId!==hostId.current)break;const ref=doc(database,'musicRooms',sessionId,'requests',request.id);try{
   // A request is claimed before a Spotify command; interrupted commands are never replayed blindly.
   const claimed=await runTransaction(database,async tx=>{const current=await tx.get(ref);if(current.data()?.status!=='pending')return false;tx.update(ref,{status:'processing'});return true;});if(!claimed)continue;
   if(Date.now()-Date.parse(request.createdAt)>120000)throw Error('Request expired. Submit it again.');
   const deviceQuery=latest.current.room?.deviceId?'&device_id='+encodeURIComponent(latest.current.room.deviceId):'';
   const action=request.action;const path=action==='queue'?'/me/player/queue?uri='+encodeURIComponent(request.uri)+deviceQuery:action==='next'?'/me/player/next?device_id='+encodeURIComponent(latest.current.room?.deviceId||''):action==='previous'?'/me/player/previous?device_id='+encodeURIComponent(latest.current.room?.deviceId||''):`/me/player/${action}?device_id=`+encodeURIComponent(latest.current.room?.deviceId||'');await spotifyRequest(path,['next','previous','queue'].includes(action)?'POST':'PUT');
   await updateDoc(ref,{status:'done',finishedAt:new Date().toISOString()});
  }catch(e:any){await updateDoc(ref,{status:'failed',error:String(e.message).slice(0,300),finishedAt:new Date().toISOString()}).catch(()=>{});if(active)setError(e.message);}}};
  void process().finally(()=>{processing.current=false;setRequestCycle(value=>value+1);});
 },[isHost,room?.recording,requests,sessionId,requestCycle]);
 async function request(action:string,value=''){if(!sessionId||!room?.recording||Date.now()-Date.parse(room.heartbeat)>45000)throw Error('The DJ needs to reconnect before controlling playback.');if(action!=='queue'&&(!editor||!profile))throw Error('Sign in with Spotify and unlock the table to control playback.');
  const id=crypto.randomUUID();await setDoc(doc(database,'musicRooms',sessionId,'requests',id),{action,uri:action==='queue'?trackUri(value):'',by:profile?.display_name||'Guest',createdAt:new Date().toISOString(),status:'pending'});
 }
 async function searchTracks(value:string){if(!profile)throw Error('Sign in with Spotify to search Spotify.');const result=await spotifyRequest('/search?type=track&limit=8&q='+encodeURIComponent(value.trim()));return (result?.tracks?.items||[]).map(compactTrack).filter(Boolean);}
 async function perform(fn:()=>Promise<any>){setBusy(true);setError('');try{await fn();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return {profile,room,plays,requests,error,busy,isHost,connected:!!profile,login:()=>perform(loginSpotify),logout:()=>perform(async()=>{if(isHost&&sessionId)await updateDoc(doc(database,'musicRooms',sessionId),{recording:false,heartbeat:new Date().toISOString()});logoutSpotify();setProfile(null);}),start:()=>perform(start),stop:()=>perform(async()=>{if(isHost&&sessionId)await updateDoc(doc(database,'musicRooms',sessionId),{recording:false,heartbeat:new Date().toISOString()});}),request:(action:string,value?:string)=>perform(()=>request(action,value)),search:searchTracks,saveJam:(value:string)=>perform(async()=>{if(!editor||!sessionId)throw Error('Unlock editing first.');if(!room)throw Error('Connect a DJ first.');await updateDoc(doc(database,'musicRooms',sessionId),{jamUrl:jamUrl(value)});}),clearError:()=>setError('')};
}
