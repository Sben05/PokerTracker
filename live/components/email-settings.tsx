'use client';
import {useEffect,useState} from 'react';
import {collection,doc,limit,onSnapshot,orderBy,query} from 'firebase/firestore';
import {Mail,Send,RotateCcw,Check,LockKeyhole,Trophy,AlarmClock} from 'lucide-react';
import {database} from '../lib/firebase-network';
import {DEFAULT_EMAILJS,SENDER_NAME,deliverQueuedEmails,retryEmail,sendEmail,validConfig} from '../lib/email-delivery';

const SENDER='feltclubpokeros@gmail.com';

export function EmailSettings({editor,unlock}:{editor:boolean,unlock:()=>void}){
 const [config,setConfig]=useState<any>(null),[messages,setMessages]=useState<any[]>([]),[testTo,setTestTo]=useState(SENDER),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setConfig(null);setMessages([]);if(!editor)return;
  const stop=onSnapshot(doc(database,'notificationSettings','emailjs'),d=>{setConfig(d.data()||{});},()=>setError('Could not load email settings.'));
  const stopMessages=onSnapshot(query(collection(database,'emailNotifications'),orderBy('createdAt','desc'),limit(25)),s=>setMessages(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
  return()=>{stop();stopMessages();};},[editor]);
 const active=validConfig(config)?config:DEFAULT_EMAILJS,connected=true;
 const run=async(label:string,task:()=>Promise<unknown>,ok:string)=>{setBusy(label);setError('');setNotice('');try{await task();setNotice(ok);}catch(e:any){setError(e?.message||'Something went wrong.');}finally{setBusy('');}};
 const queued=messages.filter(m=>m.status==='pending').length;
 if(!editor)return <section className="panel email-settings"><div className="panel-heading"><h2>Email</h2><Mail size={19}/></div><div className="email-settings-body email-locked"><LockKeyhole size={18}/><span>Unlock editing to manage email.</span><button className="button secondary" onClick={unlock}>Unlock</button></div></section>;
 return <section className="panel email-settings">
  <div className="panel-heading"><h2>Email</h2><span className={`status-pill ${connected?'green':'neutral'}`}><i/>{connected?'Sending on':'Not set up'}</span></div>
  <div className="email-settings-body">
   <div className="sender-card"><span className="sender-icon"><Mail size={18}/></span><div><b>{SENDER_NAME}</b><small>{SENDER}</small></div></div>

   <div className="email-rules"><div><Trophy size={16}/><span><b>Game results</b><small>When a game closes: buy-ins, cash-out, and who to pay.</small></span></div><div><AlarmClock size={16}/><span><b>Morning reminder</b><small>9am daily to anyone who still owes.</small></span></div></div>
   <form className="test-form" onSubmit={e=>{e.preventDefault();if(!connected){setError('Save your EmailJS IDs first.');return;}void run('test',()=>sendEmail(active,testTo.trim(),`${SENDER_NAME}: Test email`,`Hi,\n\nThis is a test from ${SENDER_NAME}.\n\nDetails: https://pokertracker-cfb7b.web.app/\n\n${SENDER_NAME}`),`Test sent to ${testTo.trim()}. Check the inbox (and spam, the first time).`);}}>
    <label>Send a test to<input type="email" value={testTo} onChange={e=>setTestTo(e.target.value)} required/></label>
    <button className="button secondary" disabled={!!busy||!connected}><Send size={14}/>{busy==='test'?'Sending…':'Send test'}</button>
   </form>
   {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="form-notice" role="status"><Check size={14}/>{notice}</p>}

   <div className="email-log-head"><h3>Recent emails</h3>{queued>0&&connected&&<button className="text-button" disabled={!!busy} onClick={()=>void run('flush',deliverQueuedEmails,'Queue sent.')}><Send size={13}/>Send {queued} queued</button>}</div>
   {messages.length?<div className="email-history">{messages.map(m=><div key={m.id}><span><b>{m.subject?.replace(/^Felt Club Poker OS:\s*/,'')}</b><small>{m.to} · {new Date(m.createdAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</small>{m.error&&m.status!=='sent'&&<small className="negative">{m.error}</small>}</span><span className="email-status">{m.status==='failed'&&<button className="icon-button" title="Retry" aria-label="Retry" onClick={()=>void run('retry',()=>retryEmail(m.id),'Retrying.')}><RotateCcw size={13}/></button>}<span className={`status-pill ${m.status==='sent'?'green':m.status==='failed'?'unpaid':'neutral'}`}>{m.status==='pending'?'Queued':m.status==='sent'?'Sent':m.status==='sending'?'Sending':m.status==='canceled'?'Canceled':'Failed'}</span></span></div>)}</div>:<p className="fine-print">Nothing sent yet. Add player emails on the Players page.</p>}
  </div>
 </section>;
}
