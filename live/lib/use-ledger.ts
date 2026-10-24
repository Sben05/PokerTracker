'use client';
import {apiFetch,subscribeLedger} from './network';
import {useCallback,useEffect,useRef,useState} from 'react';
import {makeStore,uid} from './engine.mjs';
import {applyCommand} from './commands.mjs';
export type Ledger=any;
export type Command={id:string,type:string,payload:any};
const PREFIX='pokerbank.live.action.';
function queued():Command[]{return Object.keys(localStorage).filter(k=>k.startsWith(PREFIX)).map(k=>{try{return JSON.parse(localStorage.getItem(k)!);}catch{return null;}}).filter(Boolean).sort((a,b)=>(a.queuedAt||0)-(b.queuedAt||0));}
function project(base:Ledger,pending:Command[]){return pending.reduce((data,command)=>{
 if(data.players.some((p:any)=>p.id===command.id)||data.sessions.some((s:any)=>s.id===command.id||s.entries.some((e:any)=>e.id===command.id)))return data;
 try{return applyCommand(data,command);}catch{return data;}
},base);}
export function useLedger(){
 const [data,setData]=useState<Ledger>(makeStore()),[ready,setReady]=useState(false),[online,setOnline]=useState(true),[pending,setPending]=useState(0),[saving,setSaving]=useState(false),[updatedAt,setUpdatedAt]=useState<string|null>(null),[error,setError]=useState('');
 const base=useRef<Ledger>(makeStore()),revision=useRef(-1),busy=useRef(false),alive=useRef(true),view=useRef<Ledger>(makeStore());
 const refresh=useCallback(()=>{const q=queued();view.current=project(base.current,q);setData(view.current);setPending(q.length);},[]);
 const accept=useCallback((snapshot:any)=>{if(snapshot.revision<revision.current)return;revision.current=snapshot.revision;base.current=snapshot.ledger;setUpdatedAt(snapshot.updatedAt);localStorage.setItem('pokerbank.live.cache',JSON.stringify(snapshot));refresh();},[refresh]);
 const flush=useCallback(async()=>{
  if(busy.current)return;busy.current=true;
  try{
   let command=queued()[0];
   while(command&&alive.current){
    setSaving(true);
    const response=await apiFetch('/api/ledger',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command)});
    const result:any=await response.json();
    if(!response.ok){
     if(response.status===401){window.dispatchEvent(new Event('pokerbank:unlock'));break;}
     if([400,413,415,422].includes(response.status)){
      localStorage.setItem(`pokerbank.live.rejected.${command.id}`,JSON.stringify({...command,error:result.error}));
      localStorage.removeItem(PREFIX+command.id);setError(result.error||'An action needs your attention.');refresh();command=queued()[0];continue;
     }
     throw Error(result.error||'Connection interrupted.');
    }
    localStorage.removeItem(PREFIX+command.id);accept(result);setOnline(true);command=queued()[0];
   }
  }catch{setOnline(false);refresh();}finally{busy.current=false;setSaving(false);}
 },[accept,refresh]);
 const dispatch=useCallback((type:string,payload:any)=>{
  const command={id:uid(),type,payload,queuedAt:Date.now()};
  // Validate before closing a form, then persist the action before sending it.
  applyCommand(view.current,command);
  localStorage.setItem(PREFIX+command.id,JSON.stringify(command));refresh();void flush();return command.id;
 },[flush,refresh]);
 useEffect(()=>{
  alive.current=true;
  try{const cached=JSON.parse(localStorage.getItem('pokerbank.live.cache')||'null');if(cached){base.current=cached.ledger;setUpdatedAt(cached.updatedAt);}refresh();}catch{setError('Local storage is unavailable. Keep this tab open until your changes are saved.');}
  const poll=async()=>{if(document.hidden||busy.current)return;try{const response=await apiFetch('/api/ledger',{cache:'no-store'});if(!response.ok)throw Error();const snapshot=await response.json();if(alive.current){accept(snapshot);setOnline(true);setReady(true);void flush();}}catch{if(alive.current){setOnline(false);setReady(true);}}};
  void poll();const stopSubscription=subscribeLedger((snapshot,fromCache)=>{if(alive.current){accept(snapshot);setOnline(!fromCache);setReady(true);if(!fromCache)void flush();}},()=>{if(alive.current){setOnline(false);setReady(true);}});const timer=setInterval(()=>{void flush();},2000);
  const onStorage=(event:StorageEvent)=>{if(event.key?.startsWith(PREFIX)){refresh();void flush();}};
  const reconnect=()=>{void poll();void flush();};
  const disconnect=()=>setOnline(false);window.addEventListener('offline',disconnect);window.addEventListener('storage',onStorage);window.addEventListener('online',reconnect);document.addEventListener('visibilitychange',reconnect);
  return()=>{alive.current=false;stopSubscription();clearInterval(timer);window.removeEventListener('offline',disconnect);window.removeEventListener('storage',onStorage);window.removeEventListener('online',reconnect);document.removeEventListener('visibilitychange',reconnect);};
 },[accept,flush,refresh]);
 return {data,ready,online,pending,saving,updatedAt,error,clearError:()=>setError(''),dispatch,retry:flush};
}
