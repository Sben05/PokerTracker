import assert from 'node:assert/strict';
import {makeGitHubSync} from '../github-sync.mjs';
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
globalThis.confirm=()=>true;
const files=new Map();
globalThis.fetch=async (url,opts)=>{
  const route=String(url);
  const body=opts.body?JSON.parse(opts.body):null;
  if(route.endsWith('/repos/owner/private'))return {ok:true,status:200,json:async()=>({private:true})};
  const filename=route.split('/').at(-1);
  if(opts.method==='GET'){
    if(!files.has(filename))return {ok:false,status:404,json:async()=>({message:'Not Found'})};
    const file=files.get(filename);
    return {ok:true,status:200,json:async()=>({sha:file.sha,content:file.content,type:'file'})};
  }
  if(opts.method==='PUT'){
    const old=files.get(filename);
    assert.equal(body.sha,old?.sha);
    files.set(filename,{sha:'sha'+(files.size+1)+(old?'b':''),content:body.content});
    return {ok:true,status:200,json:async()=>({content:{sha:files.get(filename).sha}})};
  }
  throw Error('Unhandled request: '+route);
};
let ledger={version:1,sessions:[],players:[]};
const sync=makeGitHubSync({readLedger:()=>ledger,readCSV:()=>`Session,Amount\r\nTest,20.00`,applyLedger:v=>ledger=v,onUpdate:()=>{}});
await sync.connect({user:'owner',repository:'private',accessToken:'testtoken'});
assert.ok(files.has('pokerbank-data.json'));
assert.ok(files.has('pokerbank-ledger.csv'));
assert.match(Buffer.from(files.get('pokerbank-ledger.csv').content,'base64').toString('utf8'),/Test,20.00/);
await sync.push(true);
assert.equal(sync.view().paused,false);
console.log('✓ Private GitHub JSON and Excel-compatible CSV are both created and updated');
