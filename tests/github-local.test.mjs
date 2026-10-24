import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeGitHubSync} from '../github-sync.mjs';

const response=(data,status=200)=>({ok:status<400,status,json:async()=>data});
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
function fixture({confirm=true,conflict=false}={}) {
  const local={version:1,players:[],sessions:[{id:'tonight'}]};
  const remote={version:1,players:[],sessions:[{id:'older'}]};
  const writes=[];let imports=0;
  globalThis.confirm=()=>confirm;
  globalThis.fetch=async(url,opts)=>{
    if(!url.includes('/contents/'))return response({private:true});
    if(opts.method==='GET')return url.endsWith('.csv')?response({},404):response({type:'file',sha:'remote-sha',content:btoa(JSON.stringify(remote))});
    writes.push({url,body:JSON.parse(opts.body)});
    return conflict?response({message:'Conflict'},409):response({content:{sha:'saved-sha'}});
  };
  const sync=makeGitHubSync({readLedger:()=>local,readCSV:()=>'Session,Amount\r\nTonight,160.00',applyLedger:()=>imports++});
  return {sync,local,writes,imports:()=>imports};
}
const credentials={user:'owner',repository:'private',accessToken:'synthetic',direction:'local'};
test('offline saves are tracked and explicitly reported as local only',()=>{
  const {sync,writes}=fixture();sync.onLocalSave();
  assert.equal(sync.view().dirty,true);assert.equal(sync.view().connected,false);
  assert.match(sync.view().status,/device only/);assert.equal(writes.length,0);
});
test('reconnect uploads local game to JSON and CSV using the remote SHA',async()=>{
  const {sync,local,writes,imports}=fixture();
  await sync.connect(credentials);
  assert.equal(imports(),0);assert.equal(writes.length,2);
  assert.equal(writes[0].body.sha,'remote-sha');
  assert.deepEqual(JSON.parse(Buffer.from(writes[0].body.content,'base64').toString()),local);
  assert.match(writes[1].url,/pokerbank-ledger.csv$/);
  assert.equal(sync.view().dirty,false);assert.equal(sync.view().connected,true);
});
test('canceling local upload preserves both ledgers',async()=>{
  const {sync,writes,imports}=fixture({confirm:false});
  await sync.connect(credentials);
  assert.equal(writes.length,0);assert.equal(imports(),0);assert.equal(sync.view().connected,false);
});
test('remote conflict during local upload pauses without replacing local data',async()=>{
  const {sync,imports}=fixture({conflict:true});
  await assert.rejects(sync.connect(credentials),/409/);
  assert.equal(imports(),0);assert.equal(sync.view().dirty,true);assert.equal(sync.view().paused,true);
});
test('connected local edits automatically update both files',async()=>{
  const {sync,local,writes}=fixture();await sync.connect(credentials);
  local.sessions.push({id:'rebuy'});sync.onLocalSave();
  await new Promise(resolve=>setTimeout(resolve,1850));
  assert.equal(writes.length,4);
  assert.deepEqual(JSON.parse(Buffer.from(writes[2].body.content,'base64').toString()),local);
  assert.equal(sync.view().dirty,false);sync.disconnect();
});
