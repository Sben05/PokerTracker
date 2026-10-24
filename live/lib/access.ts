import { env } from 'cloudflare:workers';
const encoder=new TextEncoder();
const encode=(data:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(data))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function key(){if(!env.SESSION_SECRET)throw Error('Editor access is not configured.');return crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function isEditor(request:Request){try{
 const bearer=request.headers.get('authorization');
 const token=bearer?.startsWith('Bearer ')?bearer.slice(7):request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('pokerbank_editor='))?.slice(17);
 if(!token)return false;const [expires,signature]=token.split('.');if(!signature||Number(expires)<Date.now())return false;
 const bytes=Uint8Array.from(atob(signature.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
 return await crypto.subtle.verify('HMAC',await key(),bytes,encoder.encode(expires));
 }catch{return false;}}
export async function unlock(passcode:string){
 if(!env.EDIT_PASSCODE||!env.SESSION_SECRET)throw Error('Editor access is not configured.');
 const secretKey=await key();const expected=await crypto.subtle.sign('HMAC',secretKey,encoder.encode(env.EDIT_PASSCODE));
 if(!await crypto.subtle.verify('HMAC',secretKey,expected,encoder.encode(passcode)))return null;
 const expires=String(Date.now()+30*24*60*60*1000),signature=encode(await crypto.subtle.sign('HMAC',secretKey,encoder.encode(expires)));
 return `${expires}.${signature}`;
}
