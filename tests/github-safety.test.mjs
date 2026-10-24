import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeGitHubSync} from '../github-sync.mjs';
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
globalThis.confirm=()=>true;
const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
test('refuses public repositories without writing financial records',async()=>{
 let writes=0;
 globalThis.fetch=async(_url,opts)=>{if(opts.method==='PUT')writes++;return response({private:false});};
 const sync=makeGitHubSync({readLedger:()=>({sessions:[]})});
 await assert.rejects(sync.connect({user:'owner',repository:'public',accessToken:'synthetic'}),/public/);
 assert.equal(writes,0);
});
test('rechecks privacy and pauses on stale remote SHA',async()=>{
 let privateRepo=true,writes=0,conflict=false;
 globalThis.fetch=async(url,opts)=>{
  if(!url.includes('/contents/'))return response({private:privateRepo});
  if(opts.method==='GET')return response({type:'file',sha:'old',content:btoa('{"sessions":[]}')});
  writes++;return conflict?response({message:'Conflict'},409):response({content:{sha:'new'}});
 };
 const sync=makeGitHubSync({readLedger:()=>({sessions:[]}),applyLedger:()=>{}});
 await sync.connect({user:'owner',repository:'private',accessToken:'synthetic'});
 privateRepo=false;
 await assert.rejects(sync.push(true),/remain private/);
 assert.equal(writes,0);assert.equal(sync.view().paused,true);
 privateRepo=true;
 await sync.connect({user:'owner',repository:'private',accessToken:'synthetic'});
 conflict=true;
 await assert.rejects(sync.push(true),/409/);
 assert.equal(sync.view().dirty,true);assert.equal(sync.view().paused,true);
});
