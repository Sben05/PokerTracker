// Daily unpaid-balance reminders. Run by .github/workflows/payment-reminders.yml.
// Env: FELT_CLUB_PASSCODE (editor passcode), EMAILJS_PRIVATE_KEY (optional), DRY_RUN=1 to print instead of send.
import {readFileSync} from 'node:fs';
import {paymentReminders,SITE} from '../lib/notifications.mjs';
import {emailHtml} from '../lib/email-html.mjs';
import {EMAILJS,SENDER_NAME} from '../lib/emailjs-config.mjs';

const config=JSON.parse(readFileSync(new URL('../lib/firebase-config.json',import.meta.url),'utf8'));
const BASE=`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
const dry=process.env.DRY_RUN==='1',passcode=process.env.FELT_CLUB_PASSCODE;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date());

const decode=v=>'mapValue'in v?Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,decode(x)])):'arrayValue'in v?(v.arrayValue.values||[]).map(decode):'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'booleanValue'in v?v.booleanValue:'nullValue'in v?null:Object.values(v)[0];
const encode=v=>typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{stringValue:String(v)};

async function firestore(path,token,options={}){
 const response=await fetch(BASE+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
 if(response.status===404)return null;
 if(!response.ok)throw new Error(`Firestore ${path} failed: ${response.status} ${await response.text()}`);
 return response.json();
}
async function signIn(){
 const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:config.editorEmail,password:passcode,returnSecureToken:true})});
 const result=await response.json();
 if(!response.ok)throw new Error(`Editor sign-in failed: ${result.error?.message||response.status}`);
 return result.idToken;
}
async function send(to,subject,body){
 const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{method:'POST',headers:{'Content-Type':'application/json',Origin:SITE},body:JSON.stringify({service_id:EMAILJS.serviceId,template_id:EMAILJS.templateId,user_id:EMAILJS.publicKey,...(process.env.EMAILJS_PRIVATE_KEY?{accessToken:process.env.EMAILJS_PRIVATE_KEY}:{}),template_params:{to_email:to,subject,message:body,html:emailHtml(subject,body),from_name:SENDER_NAME}})});
 if(!response.ok)throw new Error(`EmailJS ${response.status}: ${await response.text()}`);
}

const ledger=decode((await firestore('/ledgers/house')).fields.ledger);
const reminders=paymentReminders(ledger);
console.log(`${today}: ${reminders.length} player(s) owe money.`);
if(!reminders.length)process.exit(0);
if(!passcode){if(dry){for(const r of reminders)console.log(`\n--- ${r.subject}\n${r.body}`);process.exit(0);}throw new Error('FELT_CLUB_PASSCODE is not set.');}

const token=await signIn();
if(!dry&&await firestore(`/reminderLog/${today}`,token)){console.log('Reminders already sent today.');process.exit(0);}
const contacts=Object.fromEntries(((await firestore('/playerContacts?pageSize=300',token))?.documents||[]).map(d=>[d.name.split('/').pop(),decode({mapValue:{fields:d.fields}})]));
const sent=[];let failed=0;
for(const r of reminders){
 const c=contacts[r.playerId];
 if(!c?.email||c.enabled===false){console.log(`skip ${r.playerId}: no email`);continue;}
 if(dry){console.log(`\n--- to ${c.email}: ${r.subject}\n${r.body}`);continue;}
 try{await send(c.email,r.subject,r.body);sent.push(r.playerId);console.log(`sent ${r.subject} -> ${c.email}`);}
 catch(error){failed++;console.error(`failed ${r.playerId}: ${error.message}`);}
 await new Promise(resolve=>setTimeout(resolve,1100));
}
if(!dry)await firestore(`/reminderLog/${today}`,token,{method:'PATCH',body:JSON.stringify({fields:{sentAt:encode(new Date().toISOString()),count:encode(sent.length),players:encode(sent)}})});
if(failed)process.exit(1);
