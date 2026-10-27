import {initializeApp,getApps} from 'firebase/app';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,browserLocalPersistence,setPersistence} from 'firebase/auth';
import {getFirestore,doc,getDocFromServer,onSnapshot,runTransaction} from 'firebase/firestore';
import {applyCommand} from './commands.mjs';
import {makeStore} from './engine.mjs';
import {notificationEvents,normalizePlayerEmail} from './notifications.mjs';
import {deliverQueuedEmails} from './email-delivery';
import config from './firebase-config.json';

const app=getApps()[0]||initializeApp(config);
export const auth=getAuth(app),database=getFirestore(app),EDITOR_UID=config.editorUid;
const ledgerRef=doc(database,'ledgers','house');
const authReady=new Promise<void>(resolve=>{const stop=onAuthStateChanged(auth,()=>{stop();resolve();});});
const snapshot=(data:any)=>({ledger:data?.ledger||makeStore(),revision:data?.revision||0,updatedAt:data?.updatedAt||null});
const result=(body:any,status=200)=>Response.json(body,{status});
export function subscribeLedger(onData:(value:any,fromCache:boolean)=>void,onError:()=>void){
 return onSnapshot(ledgerRef,{includeMetadataChanges:true},value=>onData(snapshot(value.data()),value.metadata.fromCache),()=>onError());
}
export async function firebaseFetch(path:string,options:RequestInit={}){
 await authReady;
 const method=options.method||'GET';
 if(path==='/api/access'){
  if(method==='GET')return result({editor:auth.currentUser?.uid===config.editorUid});
  if(method==='DELETE'){await signOut(auth);return result({editor:false});}
  try{
   const {passcode}=JSON.parse(String(options.body));
   await setPersistence(auth,browserLocalPersistence);
   const login=await signInWithEmailAndPassword(auth,config.editorEmail,passcode);
   if(login.user.uid!==config.editorUid){await signOut(auth);return result({error:'This account cannot edit this table.'},403);}
   return result({editor:true});
  }catch(error:any){return result({error:error.code==='auth/too-many-requests'?'Too many attempts. Please try again shortly.':error.code==='auth/network-request-failed'?'Could not connect. Please retry.':'That passcode isn’t right. Try again.'},401);}
 }
 if(path==='/api/ledger'){
  if(method==='GET'){const value=await getDocFromServer(ledgerRef);return result(snapshot(value.data()));}
  if(auth.currentUser?.uid!==config.editorUid)return result({error:'Unlock editing with the table passcode.'},401);
  const command=JSON.parse(String(options.body));
  if(typeof command.id!=='string'||! /^[A-Za-z0-9_:.-]{1,100}$/.test(command.id))return result({error:'Missing action ID.'},400);
  const operationRef=doc(database,'operations',command.id);
  try{
   const saved=await runTransaction(database,async transaction=>{
    const [operation,current]=await Promise.all([transaction.get(operationRef),transaction.get(ledgerRef)]);
    const previous=snapshot(current.data());if(operation.exists()||previous.ledger.players.some((p:any)=>p.id===command.id)||previous.ledger.sessions.some((s:any)=>s.id===command.id||s.entries.some((e:any)=>e.id===command.id)))return previous;
    let next;try{next=applyCommand(previous.ledger,command);}catch(error:any){throw Object.assign(new Error(error.message),{invalidCommand:true});}
    const events=notificationEvents(previous.ledger,next,command);
    const profile=['add-player','edit-player'].includes(command.type)&&command.payload.email!==undefined;
    const profileId=command.type==='add-player'?command.id:command.payload.playerId;
    const contacts=await Promise.all(events.map(async event=>({event,contact:(await transaction.get(doc(database,'playerContacts',event.playerId))).data()})));
    if(profile){const email=normalizePlayerEmail(command.payload.email);transaction.set(doc(database,'playerContacts',profileId),{email,enabled:!!email&&command.payload.emailEnabled!==false,updatedAt:new Date().toISOString()});}
    for(const {event,contact:oldContact} of contacts){
     const contact=profile&&event.playerId===profileId?{email:normalizePlayerEmail(command.payload.email),enabled:command.payload.emailEnabled!==false}:oldContact;
     if(!contact?.email||!contact.enabled)continue;
     transaction.set(doc(database,'emailNotifications',`${command.id}_${event.playerId}`),{...event,to:contact.email,operationId:command.id,status:'pending',createdAt:new Date().toISOString()});
    }
    const value={ledger:next,revision:previous.revision+1,updatedAt:new Date().toISOString(),lastCommandId:command.id};
    transaction.set(ledgerRef,value);
    transaction.set(operationRef,{type:command.type,createdAt:value.updatedAt,revision:value.revision});
    return value;
   });
   void deliverQueuedEmails().catch(()=>{});
   return result(saved);
  }catch(error:any){if(error.invalidCommand)return result({error:error.message},422);if(error.code==='permission-denied')return result({error:'Editing access has expired. Unlock the table again.'},401);throw error;}
 }
 return result({error:'Not found.'},404);
}
