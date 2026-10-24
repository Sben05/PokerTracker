import {cors,validOrigin,preflight} from '../../../lib/cors';
import {env} from 'cloudflare:workers';
import {isEditor,unlock} from '../../../lib/access';
export const dynamic='force-dynamic';
const json=(request:Request,value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...cors(request),...headers}});
export const OPTIONS=preflight;
export async function GET(request:Request){return json(request,{editor:await isEditor(request)});}
export async function POST(request:Request){
 if(!validOrigin(request))return json(request,{error:'Open your table to unlock editing.'},403);
 try{
  const {passcode}=await request.json() as {passcode:unknown};if(typeof passcode!=='string'||passcode.length>100)return json(request,{error:'Enter the editing passcode.'},400);
  if(!env.DB)return json(request,{error:'Could not unlock yet. Please retry.'},503);
  const ip=request.headers.get('cf-connecting-ip')||'local';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const bucket=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('')+':'+Math.floor(Date.now()/600000);
  await env.DB.prepare('INSERT INTO access_attempts (id,attempts) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1').bind(bucket).run();
  const attempt=await env.DB.prepare('SELECT attempts FROM access_attempts WHERE id=?').bind(bucket).first<{attempts:number}>();
  if((attempt?.attempts||0)>20)return json(request,{error:'Too many attempts. Please try again in ten minutes.'},429);
  const token=await unlock(passcode);if(!token)return json(request,{error:'That passcode isn’t right. Try again.'},401);
  return json(request,{editor:true,token},200,{'Set-Cookie':`pokerbank_editor=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000${new URL(request.url).protocol==='https:'?'; Secure':''}`});
 }catch{return json(request,{error:'Could not unlock editing. Please retry.'},503);}
}
export async function DELETE(request:Request){if(!validOrigin(request))return json(request,{error:'Not allowed.'},403);return json(request,{editor:false},200,{'Set-Cookie':'pokerbank_editor=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
