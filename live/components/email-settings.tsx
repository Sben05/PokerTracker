'use client';
import {useEffect,useState} from 'react';
import {collection,doc,limit,onSnapshot,orderBy,query} from 'firebase/firestore';
import {database} from '../lib/firebase-network';
import {DEFAULT_EMAILJS,SENDER_NAME,deliverQueuedEmails,retryEmail,sendEmail,validConfig} from '../lib/email-delivery';
import {SENDER_EMAIL} from '../lib/emailjs-config.mjs';

export function EmailSettings({editor,unlock}:{editor:boolean,unlock:()=>void}){
 const [config,setConfig]=useState<any>(null),[messages,setMessages]=useState<any[]>([]),[testTo,setTestTo]=useState(SENDER_EMAIL),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{setConfig(null);setMessages([]);if(!editor)return;
  const stop=onSnapshot(doc(database,'notificationSettings','emailjs'),d=>{setConfig(d.data()||{});},()=>setError('Could not load email settings.'));
  const stopMessages=onSnapshot(query(collection(database,'emailNotifications'),orderBy('createdAt','desc'),limit(25)),s=>setMessages(s.docs.map(d=>({id:d.id,...d.data()}))),()=>{});
  return()=>{stop();stopMessages();};},[editor]);
 const active=validConfig(config)?config:DEFAULT_EMAILJS;
 const run=async(label:string,task:()=>Promise<unknown>,ok:string)=>{setBusy(label);setError('');setNotice('');try{await task();setNotice(ok);}catch(e:any){setError(e?.message||'Something went wrong.');}finally{setBusy('');}};
 const queued=messages.filter(m=>m.status==='pending').length;
 if(!editor)return <section className="box"><h2>Email</h2><div className="box-body"><button className="link" onClick={unlock}>Log in to edit</button> to manage email.</div></section>;
 return <section className="box">
  <h2>Email</h2>
  <div className="box-body">
   <p>Sent from {SENDER_NAME} &lt;{SENDER_EMAIL}&gt; when a game closes, and when you click Remind on Settlements.</p>
   <form className="btn-row" onSubmit={e=>{e.preventDefault();void run('test',()=>sendEmail(active,testTo.trim(),`${SENDER_NAME}: Test email`,`Hi,\n\nThis is a test from ${SENDER_NAME}.\n\nDetails: https://pokertracker-cfb7b.web.app/\n\n${SENDER_NAME}`),`Test sent to ${testTo.trim()}.`);}}>
    <label>Test to <input type="email" value={testTo} onChange={e=>setTestTo(e.target.value)} required/></label>
    <button className="btn" disabled={!!busy}>{busy==='test'?'Sending...':'Send test'}</button>
    {queued>0&&<button type="button" className="btn" disabled={!!busy} onClick={()=>void run('flush',deliverQueuedEmails,'Queue sent.')}>Send {queued} queued</button>}
   </form>
   {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </div>
  <div className="scroll"><table><thead><tr><th>Subject</th><th>To</th><th>Date</th><th>Status</th></tr></thead><tbody>
   {messages.length?messages.map(m=><tr key={m.id}><td>{m.subject?.replace(/^(Felt Club Poker OS|OpenStax Poker):\s*/,'')}{m.error&&m.status!=='sent'&&<><br/><small className="negative">{m.error}</small></>}</td><td>{m.to}</td><td>{new Date(m.createdAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</td><td>{m.status==='pending'?'Queued':m.status==='sent'?'Sent':m.status==='sending'?'Sending':m.status==='canceled'?'Canceled':<>Failed <button className="link" onClick={()=>void run('retry',()=>retryEmail(m.id),'Retrying.')}>retry</button></>}</td></tr>)
   :<tr><td className="empty" colSpan={4}>No emails sent yet.</td></tr>}
  </tbody></table></div>
 </section>;
}
