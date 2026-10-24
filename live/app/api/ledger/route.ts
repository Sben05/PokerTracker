import { env } from 'cloudflare:workers';
import {cors,validOrigin,preflight} from '../../../lib/cors';
import {isEditor} from '../../../lib/access';
import {makeStore} from '../../../lib/engine.mjs';
import {applyCommand,CommandError} from '../../../lib/commands.mjs';
export const dynamic='force-dynamic';
const json=(request:Request,body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...cors(request)}});
export const OPTIONS=preflight;
function db(){if(!env.DB)throw Error('The table database is unavailable.');return env.DB;}
async function snapshot(){
 const row=await db().prepare('SELECT data,revision,updated_at FROM ledgers WHERE id = ?').bind('house').first<{data:string,revision:number,updated_at:string}>();
 return {ledger:row?JSON.parse(row.data):makeStore(),revision:row?.revision||0,updatedAt:row?.updated_at||null};
}
// Reads are public. Every write requires a server-verified editor cookie.
export async function GET(request:Request){try{return json(request,await snapshot());}catch{return json(request,{error:'Could not load your table. Please retry.'},503);}}
export async function POST(request:Request){
 try{
  if(!validOrigin(request))return json(request,{error:'This action must come from your table.'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json(request,{error:'Expected a JSON action.'},415);
  if(!await isEditor(request))return json(request,{error:'Unlock editing with the table passcode.'},401);
  const raw=await request.text();if(raw.length>2_000_000)return json(request,{error:'This backup is too large.'},413);
  const command=JSON.parse(raw);
  if(typeof command.id!=='string'||command.id.length>100||!command.id)return json(request,{error:'Missing action ID.'},400);
  await db().prepare('INSERT OR IGNORE INTO ledgers (id,data,revision,updated_at) VALUES (?,?,0,?)').bind('house',JSON.stringify(makeStore()),new Date().toISOString()).run();
  for(let attempt=0;attempt<8;attempt++){
   const seen=await db().prepare('SELECT id FROM operations WHERE id = ?').bind(command.id).first();
   if(seen)return json(request,await snapshot());
   const current=await snapshot();let next;try{next=applyCommand(current.ledger,command);}catch(error){return json(request,{error:error instanceof Error?error.message:'Invalid action.'},422);}const at=new Date().toISOString();
   const result=await db().batch([
    db().prepare('UPDATE ledgers SET data=?,revision=revision+1,last_command_id=?,updated_at=? WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM operations WHERE id=?)').bind(JSON.stringify(next),command.id,at,'house',current.revision,command.id),
    db().prepare('INSERT OR IGNORE INTO operations (id,created_at) SELECT ?,? WHERE EXISTS (SELECT 1 FROM ledgers WHERE id=? AND revision=? AND last_command_id=?)').bind(command.id,at,'house',current.revision+1,command.id),
   ]);
   if(result[0].meta.changes)return json(request,await snapshot());
  }
  return json(request,{error:'Another update arrived at the same time. Retrying shortly.'},409);
 }catch(error){if(error instanceof CommandError)return json(request,{error:error.message},422);if(error instanceof SyntaxError)return json(request,{error:'Invalid JSON.'},400);return json(request,{error:'Could not save yet. Your action will retry automatically.'},503);}
}
