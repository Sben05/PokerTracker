import {collection,doc,getDoc,getDocs,limit,query,runTransaction,setDoc,updateDoc,where} from 'firebase/firestore';
import {auth,database,EDITOR_UID} from './firebase-network';
import {emailHtml} from './email-html.mjs';
import {EMAILJS,SENDER_NAME} from './emailjs-config.mjs';

export {SENDER_NAME};
export type EmailJsConfig={serviceId:string,templateId:string,publicKey:string};
export const DEFAULT_EMAILJS:EmailJsConfig=EMAILJS;
const settingsRef=()=>doc(database,'notificationSettings','emailjs');
const ID=/^[A-Za-z0-9_-]{3,100}$/;
export const validConfig=(c:any):c is EmailJsConfig=>!!c&&ID.test(c.serviceId||'')&&ID.test(c.templateId||'')&&ID.test(c.publicKey||'');

class RetryLater extends Error {}

export async function sendEmail(config:EmailJsConfig,to:string,subject:string,body:string){
 const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_id:config.serviceId,template_id:config.templateId,user_id:config.publicKey,template_params:{to_email:to,subject,message:body,html:emailHtml(subject,body),from_name:SENDER_NAME}})});
 if(response.ok)return;
 const detail=(await response.text().catch(()=>'')).slice(0,200);
 if(response.status===429)throw new RetryLater(detail||'EmailJS rate limit reached.');
 throw new Error(detail||`EmailJS returned ${response.status}.`);
}

let running:Promise<void>|null=null;
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));

// Only the signed-in editor can read the queue, so delivery runs in the editor's browser.
export function deliverQueuedEmails(){
 if(auth.currentUser?.uid!==EDITOR_UID)return Promise.resolve();
 running??=drain().finally(()=>{running=null;});
 return running;
}

async function drain(){
 const saved=(await getDoc(settingsRef())).data();
 const config=validConfig(saved)?saved:DEFAULT_EMAILJS;
 for(let round=0;round<5;round++){
  const pending=await getDocs(query(collection(database,'emailNotifications'),where('status','==','pending'),limit(20)));
  if(pending.empty)return;
  for(const item of pending.docs.sort((a,b)=>String(a.data().createdAt).localeCompare(String(b.data().createdAt)))){
   const claimed=await runTransaction(database,async t=>{const fresh=await t.get(item.ref);if(fresh.data()?.status!=='pending')return null;t.update(item.ref,{status:'sending',attemptedAt:new Date().toISOString()});return fresh.data();}).catch(()=>null);
   if(!claimed)continue;
   try{
    await sendEmail(config,claimed.to,claimed.subject,claimed.body);
    await updateDoc(item.ref,{status:'sent',provider:'emailjs',finishedAt:new Date().toISOString(),error:''});
   }catch(error:any){
    if(error instanceof RetryLater){await updateDoc(item.ref,{status:'pending',error:'Waiting for EmailJS sending capacity.'});return;}
    await updateDoc(item.ref,{status:'failed',provider:'emailjs',finishedAt:new Date().toISOString(),error:String(error?.message||'Send failed.').slice(0,300)});
   }
   await pause(1100);
  }
 }
}

export async function saveEmailJsConfig(config:EmailJsConfig){
 await setDoc(settingsRef(),{...config,updatedAt:new Date().toISOString()});
}
export async function retryEmail(id:string){
 await updateDoc(doc(database,'emailNotifications',id),{status:'pending',error:''});
 return deliverQueuedEmails();
}
