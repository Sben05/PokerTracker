/* Private online JSON persistence. Keys are supplied by the operator, never shipped. */
import {validateImported} from './engine.mjs';
const CONNECTION='pokerbank.jsonbin.connection';
const CHECKPOINT='pokerbank.jsonbin.checkpoint';
const OPTIONS='pokerbank.jsonbin.options';
const encode=value=>JSON.stringify(value);
const clone=value=>JSON.parse(encode(value));
export function makeJSONBinSync({readLedger,applyLedger,onUpdate}) {
  let binId='',key='',connected=false,busy=false,paused=false,dirty=false,remembered=false;
  let status='Local device only · connect online JSON in Settings',base=null,revision=0,timer;
  try{binId=JSON.parse(localStorage.getItem(OPTIONS)||'{}').binId||'';remembered=!!localStorage.getItem(CONNECTION);}catch{}
  const view=()=>({binId,connected,busy,paused,dirty,remembered,status});
  const notify=message=>{status=message;onUpdate?.();};
  const remember=enabled=>{
    if(enabled)localStorage.setItem(CONNECTION,encode({binId,accessKey:key}));
    else localStorage.removeItem(CONNECTION);
    remembered=enabled;
  };
  const checkpoint=ledger=>localStorage.setItem(CHECKPOINT,encode({binId,ledger:encode(ledger)}));
  const localIsSaved=()=>{
    try{const last=JSON.parse(localStorage.getItem(CHECKPOINT)||'null');return last?.binId===binId&&last.ledger===encode(readLedger());}catch{return false;}
  };
  async function request(method,record){
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),20000);
    try{
      const response=await fetch(`https://api.jsonbin.io/v3/b/${binId}${method==='GET'?'/latest':''}`,{
        method,signal:abort.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
        headers:{'X-Access-Key':key,'X-Bin-Meta':'true',...(record?{'Content-Type':'application/json'}:{})},
        body:record?encode(record):undefined
      });
      if(!response.ok)throw Error(({401:'Access key rejected. Reconnect with a valid key.',403:'Access denied. Check private-bin Read and Update permissions.',404:'Bin not found. Check the Bin ID.',413:'JSON is too large for your JSONBin plan.',429:'JSONBin request allowance exceeded. Local records are still saved.'})[response.status]||`JSONBin request failed (${response.status}).`);
      const result=await response.json();
      if(result.metadata?.private!==true)throw Error('Use a PRIVATE bin. Sync has stopped to protect your records.');
      if(!result.record||typeof result.record!=='object'||Array.isArray(result.record))throw Error('Unexpected online JSON format.');
      return result.record;
    }finally{clearTimeout(timeout);}
  }
  const queue=()=>{clearTimeout(timer);timer=setTimeout(()=>push().catch(()=>{}),1700);};
  const pause=message=>{paused=true;dirty=true;notify(message);};
  async function write(){
    const remote=await request('GET');
    if(encode(remote)!==base)throw Error('Online records changed on another device. Export a backup, then Load online before continuing.');
    const record=clone(readLedger()),sentRevision=revision;
    validateImported(record);
    if(new TextEncoder().encode(encode(record)).length>100000)throw Error('Ledger exceeds the 100 KB free-bin limit. Export a backup before changing storage.');
    const saved=await request('PUT',record);
    if(encode(saved)!==encode(record))throw Error('The server did not confirm the expected JSON. Load online to check it.');
    base=encode(saved);checkpoint(saved);dirty=revision!==sentRevision;
    notify(dirty?'Saved · newer edits queued':'Online JSON saved · up to date');
  }
  async function connect({id,accessKey,rememberOnDevice=false,restoring=false}){
    if(busy)throw Error('Wait for the current save or connection.');
    if(!/^[a-f\d]{24}$/i.test(id||''))throw Error('Enter the 24-character Bin ID from JSONBin.');
    if(!accessKey?.trim())throw Error('Enter an access key with Read and Update permission. Do not use your master key.');
    clearTimeout(timer);binId=id;key=accessKey.trim();connected=false;paused=false;busy=true;
    const startingRevision=revision;notify('Connecting to private online JSON…');
    try{
      const record=await request('GET');
      if(revision!==startingRevision)throw Error('Local records changed while connecting. Connect again when you finish editing.');
      base=encode(record);
      if((Object.keys(record).length===0||(Object.keys(record).length===1&&record.pokerbank==='uninitialized'))){
        if(restoring)throw Error('Online JSON is empty. Reconnect manually to initialize it.');
        if(!confirm('Save the current ledger on this device to this empty PRIVATE JSONBin record?')){notify('Connection canceled · local records preserved');return;}
        connected=true;dirty=true;await write();
      }else{
        validateImported(record);
        const same=encode(record)===encode(readLedger());
        if(restoring&&!same&&!localIsSaved()){
          connected=true;pause('Sync paused · local and online records differ. Export a backup, then use Load online.');return;
        }
        if(!restoring&&!same&&!confirm(`Load online records (${record.sessions.length} sessions) and replace this device’s ledger? Cancel to keep local records. Export a backup first if needed.`)){
          notify('Connection canceled · local records preserved');return;
        }
        if(!same)applyLedger(clone(record));
        connected=true;dirty=false;checkpoint(record);notify('Connected · online JSON up to date');
      }
      localStorage.setItem(OPTIONS,encode({binId}));remember(rememberOnDevice);
    }catch(error){connected=false;pause('Connection failed: '+error.message);throw error;}
    finally{busy=false;onUpdate?.();if(connected&&dirty&&!paused)queue();}
  }
  async function restore(){
    let saved;try{saved=JSON.parse(localStorage.getItem(CONNECTION)||'null');}catch{notify('Saved connection is invalid. Reconnect in Settings.');return;}
    if(saved)await connect({id:saved.binId,accessKey:saved.accessKey,rememberOnDevice:true,restoring:true});
  }
  function onLocalSave(){
    revision++;dirty=true;
    if(!connected||paused)return;
    if(!busy)notify('Saved on this device · online save pending');
    queue();
  }
  async function push(force=false){
    if(!connected||paused||busy||(!dirty&&!force))return;
    clearTimeout(timer);busy=true;notify('Saving private online JSON…');
    try{await write();}catch(error){pause('Sync paused: '+error.message);throw error;}
    finally{busy=false;onUpdate?.();if(dirty&&!paused)queue();}
  }
  async function pull(){
    if(!connected)return;
    if(busy)throw Error('Wait for the current save or connection.');
    if(!confirm('Replace this device’s ledger with the online JSON? Export a backup first if you have unsaved local edits.'))return;
    clearTimeout(timer);busy=true;const startingRevision=revision;notify('Loading private online JSON…');
    try{
      const record=await request('GET');validateImported(record);
      if(revision!==startingRevision)throw Error('Local records changed during loading. Finish editing and try again.');
      applyLedger(clone(record));base=encode(record);checkpoint(record);dirty=false;paused=false;notify('Latest online JSON loaded');
    }catch(error){pause('Load paused: '+error.message);throw error;}
    finally{busy=false;onUpdate?.();}
  }
  function disconnect(){
    if(busy)throw Error('Wait for the current save or connection.');
    remember(false);localStorage.removeItem(CHECKPOINT);clearTimeout(timer);
    key='';base=null;connected=false;paused=false;notify('Disconnected · local ledger preserved');
  }
  return {view,connect,restore,onLocalSave,push,pull,disconnect};
}
