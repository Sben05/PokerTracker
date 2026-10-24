/* Optional private GitHub repository persistence.
 * Browser holds its fine-grained token ONLY in memory; never persists the token.
 * Refuses public data repositories and never force-overwrites stale GitHub SHAs.
 */
export function makeGitHubSync({readLedger,readCSV,applyLedger,onUpdate}) {
  let token='', owner='', repo='', sha=null, connected=false, busy=false, paused=false, dirty=false, revision=0, timer=0;
  let status='Disconnected · local device only';
  try{let p=JSON.parse(localStorage.getItem('pokerbank.github.options')||'{}');owner=p.owner||'';repo=p.repo||'';}catch{}
  const view=()=>({owner,repo,connected,busy,paused,dirty,status});
  const notify=s=>{status=s;onUpdate?.();};
  const endpoint=(filename="pokerbank-data.json")=>`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(filename)}`;
  async function request(method,url,body){const r=await fetch(url,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});if(r.status===404&&method==='GET')return {missing:true};const payload=await r.json().catch(()=>({message:r.statusText}));if(!r.ok){const err=new Error(`GitHub ${r.status}: ${payload.message||'Request failed'}`);err.status=r.status;throw err;}return payload;}
  function b64(s){const bytes=new TextEncoder().encode(s);let text='';for(let i=0;i<bytes.length;i+=16000)text+=String.fromCharCode(...bytes.slice(i,i+16000));return btoa(text);}
  function unb64(s){return new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g,'')),c=>c.charCodeAt(0)));}
  async function connect({user,repository,accessToken}){
    if(!/^[a-z\d-]{1,39}$/i.test(user)||!/^[\w.-]{1,100}$/.test(repository))throw Error('Enter a valid GitHub owner and repository name.');
    if(!accessToken)throw Error('Enter the fine-grained token. Tokens are never retained after refresh.');
    if(busy)throw Error('Wait for the current save before reconnecting.');clearTimeout(timer);token=accessToken;owner=user;repo=repository;connected=false;paused=false;sha=null;notify('Checking private GitHub repository…');
    try{
      const metadata=await request('GET',`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
      if(metadata.missing)throw Error('Repository not found or token lacks permission. Create and authorize a PRIVATE repository.');
      if(metadata.private!==true)throw Error('Refusing to sync financial records to a public GitHub repository. Use a private data repository.');
      const file=await request('GET',endpoint());
      localStorage.setItem('pokerbank.github.options',JSON.stringify({owner,repo}));
      if(file.missing){if(!confirm('Private repository found with no ledger. Create pokerbank-data.json there using your current local ledger?')){notify('Not connected · initialization canceled');return;}connected=true;dirty=true;revision++;sha=null;notify('Initializing private ledger…');await push(true);}
      else {if(file.type!=='file'||typeof file.content!=='string')throw Error('The remote ledger is not an ordinary JSON file.');const parsed=JSON.parse(unb64(file.content));if(!confirm(`Remote ledger contains ${parsed.sessions?.length??'?'} sessions. Import it and REPLACE the records on this device? Cancel to keep your current data.`)){notify('Not connected · local data preserved');return;}applyLedger(parsed);sha=file.sha;connected=true;paused=false;dirty=false;notify('Connected · GitHub backup up to date');}
    }catch(e){connected=false;paused=true;notify('GitHub connection failed: '+e.message);throw e;}
  }
  function onLocalSave(){if(!connected||paused)return;revision++;dirty=true;notify('Unsynced local changes');clearTimeout(timer);timer=setTimeout(()=>push().catch(()=>{}),1700);}
  async function push(force=false){if(!connected||paused||busy||(!dirty&&!force))return;busy=true;notify('Saving to private GitHub…');const rev=revision;
    try{const metadata=await request('GET',`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);if(metadata.private!==true)throw Error('Repository must remain private. No financial records were sent.');const json=JSON.stringify(readLedger(),null,2);const csv=readCSV?.();const result=await request('PUT',endpoint(),{message:'PokerBank: save private poker ledger',content:b64(json),...(sha?{sha}:{})});sha=result.content.sha;
      if(typeof csv==='string'){const remoteCSV=await request('GET',endpoint('pokerbank-ledger.csv'));await request('PUT',endpoint('pokerbank-ledger.csv'),{message:'PokerBank: refresh Excel-compatible transaction ledger',content:b64(csv),...(remoteCSV.missing?{}:{sha:remoteCSV.sha})});}
      dirty=revision!==rev;notify(dirty?'Changes queued for next save':'Private GitHub JSON + Excel-compatible CSV updated');}
    catch(e){paused=true;dirty=true;notify(`Sync paused: ${e.status===409?'remote changed on another device':e.message}. Local data remains intact.`);throw e;}
    finally{busy=false;if(dirty&&!paused)setTimeout(()=>push().catch(()=>{}),450);}
  }
  async function pull(){if(!connected)return;if(busy)throw Error('Wait for the current save before loading remote data.');if(!confirm('Replace all current local data with your private GitHub ledger? Download a backup first if this device has unsynced changes.'))return;
    try{const file=await request('GET',endpoint());if(file.missing)throw Error('Remote ledger file not found.');applyLedger(JSON.parse(unb64(file.content)));sha=file.sha;dirty=false;paused=false;revision++;notify('Private GitHub ledger loaded');}catch(e){notify('GitHub load failed: '+e.message);throw e;}
  }
  function disconnect(){if(busy)throw Error('Wait for the current save before disconnecting.');clearTimeout(timer);token='';sha=null;connected=false;paused=false;dirty=false;notify('Disconnected · local data still saved');}
  return {view,connect,onLocalSave,push,pull,disconnect};
}
