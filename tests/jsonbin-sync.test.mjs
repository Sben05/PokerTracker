import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {makeJSONBinSync} from '../jsonbin-sync.mjs';
import {makeStore,makeSession} from '../engine.mjs';
const binId='0123456789abcdef01234567',accessKey='synthetic-access-key';
const connectionKey='pokerbank.jsonbin.connection';
const credentials={id:binId,accessKey};
let storage,local,remote,privateBin,calls,fail,confirmations,allow,intercept;
const copy=value=>structuredClone(value);
const ledger=title=>({...makeStore(),sessions:[makeSession(title,{mode:'decentralized'})]});
const make=()=>makeJSONBinSync({readLedger:()=>local,applyLedger:value=>{local=value;}});
const writes=()=>calls.filter(c=>c.method==='PUT');
beforeEach(()=>{
 storage=new Map();local=makeStore();remote=copy(local);privateBin=true;calls=[];fail=0;confirmations=0;allow=true;intercept=null;
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 globalThis.confirm=()=>{confirmations++;return allow;};
 globalThis.fetch=async(url,options)=>{
  calls.push({url,...options});
  assert.equal(options.headers['X-Access-Key'],accessKey);
  assert.equal(options.headers['X-Master-Key'],undefined);
  assert.ok(url.startsWith(`https://api.jsonbin.io/v3/b/${binId}`));
  if(fail)return {ok:false,status:fail};
  if(intercept)await intercept(options);
  if(options.method==='PUT'){remote=JSON.parse(options.body);assert.equal(options.headers['X-Bin-Versioning'],undefined);}
  return {ok:true,status:200,json:async()=>({record:copy(remote),metadata:{private:privateBin}})};
 };
});
test('initializes only an empty private bin, writes complete ledger, and keeps keys out of defaults',async()=>{
 remote={pokerbank:'uninitialized'};local=ledger('Synthetic table');const sync=make();await sync.connect(credentials);
 assert.equal(writes().length,1);assert.deepEqual(remote,local);assert.equal(storage.has(connectionKey),false);
 assert.equal(JSON.stringify(sync.view()).includes(accessKey),false);assert.equal(sync.view().dirty,false);
});
test('never writes to a public bin or one without privacy metadata',async()=>{
 privateBin=false;const sync=make();await assert.rejects(sync.connect(credentials),/PRIVATE/);assert.equal(writes().length,0);
 privateBin=undefined;await assert.rejects(sync.connect(credentials),/PRIVATE/);assert.equal(writes().length,0);
});
test('existing remote ledger requires confirmation before replacing local records',async()=>{
 remote=ledger('Remote');local=ledger('Local');const preserved=copy(local);allow=false;
 const sync=make();await sync.connect(credentials);assert.deepEqual(local,preserved);assert.equal(sync.view().connected,false);assert.equal(writes().length,0);
 allow=true;await sync.connect(credentials);assert.deepEqual(local,remote);assert.equal(writes().length,0);
});
test('remembers only by opt-in; reopens with newer online data and forgets credentials on disconnect',async()=>{
 const sync=make();await sync.connect({...credentials,rememberOnDevice:true});assert.ok(storage.has(connectionKey));
 remote=ledger('Newer online table');const reopened=make();await reopened.restore();assert.deepEqual(local,remote);assert.equal(confirmations,0);
 reopened.disconnect();assert.equal(storage.has(connectionKey),false);assert.deepEqual(local,remote);
});
test('reopen preserves unsaved local records and pauses instead of overwriting either copy',async()=>{
 await make().connect({...credentials,rememberOnDevice:true});local=ledger('Offline edits');remote=ledger('Other device');
 const reopened=make();await reopened.restore();assert.equal(reopened.view().paused,true);assert.equal(local.sessions[0].title,'Offline edits');
 await reopened.push(true);assert.equal(writes().length,0);await reopened.pull();assert.deepEqual(local,remote);assert.equal(reopened.view().paused,false);
});
test('checks remote changes and privacy again before every save',async()=>{
 const sync=make();await sync.connect(credentials);remote=ledger('Other device');local=ledger('Local edits');sync.onLocalSave();
 await assert.rejects(sync.push(true),/another device/);assert.equal(writes().length,0);assert.equal(sync.view().paused,true);
 sync.disconnect();remote=copy(local);await sync.connect(credentials);privateBin=false;
 await assert.rejects(sync.push(true),/PRIVATE/);assert.equal(writes().length,0);sync.disconnect();
});
test('network/quota failure pauses saves without touching the local ledger',async()=>{
 const sync=make();await sync.connect(credentials);local=ledger('Retain these edits');const preserved=copy(local);fail=429;
 await assert.rejects(sync.push(true),/allowance/);assert.deepEqual(local,preserved);assert.equal(sync.view().dirty,true);assert.equal(sync.view().paused,true);sync.disconnect();
});
test('refuses oversized records before upload',async()=>{
 const sync=make();await sync.connect(credentials);local=ledger('Large');local.sessions[0].notes='x'.repeat(100001);
 await assert.rejects(sync.push(true),/100 KB/);assert.equal(writes().length,0);sync.disconnect();
});
test('edits made during an upload remain dirty for the next save',async()=>{
 const sync=make();await sync.connect(credentials);local=ledger('First edit');sync.onLocalSave();let release,started;
 const waiting=new Promise(resolve=>{started=resolve;});
 intercept=async opts=>{if(opts.method==='PUT'){started();await new Promise(resolve=>{release=resolve;});}};
 const pushing=sync.push(true);await waiting;local=ledger('Second edit');sync.onLocalSave();release();await pushing;
 assert.equal(sync.view().dirty,true);assert.equal(remote.sessions[0].title,'First edit');sync.disconnect();
});
test('automatically saves local edits after debounce',async()=>{
 const sync=make();await sync.connect(credentials);local=ledger('Autosaved');sync.onLocalSave();
 await new Promise(resolve=>setTimeout(resolve,1900));assert.equal(writes().length,1);assert.deepEqual(local,remote);sync.disconnect();
});
test('rejects malformed records and invalid IDs without uploading or replacing data',async()=>{
 const sync=make();await assert.rejects(sync.connect({...credentials,id:'invalid'}),/Bin ID/);assert.equal(calls.length,0);
 remote={unrecognized:'record'};await assert.rejects(sync.connect(credentials),/Invalid PokerBank/);assert.deepEqual(local,makeStore());assert.equal(writes().length,0);
});
