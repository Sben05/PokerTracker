export const SPOTIFY_CLIENT_ID='4eff1a4b6672499e8fcadc99f9638adc';
export const SPOTIFY_REDIRECT='https://pokertracker-cfb7b.web.app/';
const TOKEN_KEY='pokerbank.spotify.tokens',LOGIN_KEY='pokerbank.spotify.login';
const scopes='user-read-private user-read-playback-state user-modify-playback-state user-read-recently-played';
let refreshing=null,completing=null,blockedUntil=0;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(48)),n=>n.toString(16).padStart(2,'0')).join('');
export async function loginSpotify(){
 const verifier=random(),state=random();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
 sessionStorage.setItem(LOGIN_KEY,JSON.stringify({verifier,state,at:Date.now()}));
 location.assign('https://accounts.spotify.com/authorize?'+new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,response_type:'code',redirect_uri:SPOTIFY_REDIRECT,scope:scopes,state,code_challenge_method:'S256',code_challenge:challenge}));
}
function tokens(){try{return JSON.parse(sessionStorage.getItem(TOKEN_KEY)||'null');}catch{return null;}}
function saveTokens(value,old={}){const next={...old,...value,expiresAt:Date.now()+(value.expires_in||3600)*1000};sessionStorage.setItem(TOKEN_KEY,JSON.stringify(next));return next;}
export function logoutSpotify(){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(LOGIN_KEY);}
export async function finishSpotifyLogin(){
 if(completing)return completing;
 completing=(async()=>{const params=new URLSearchParams(location.search);if(!params.has('code')&&!params.has('error'))return !!tokens();
  const pending=JSON.parse(sessionStorage.getItem(LOGIN_KEY)||'null');const code=params.get('code'),state=params.get('state'),error=params.get('error');
  history.replaceState({},'',location.pathname+location.hash);
  if(!pending||pending.state!==state||Date.now()-pending.at>600000){sessionStorage.removeItem(LOGIN_KEY);throw Error('Spotify sign-in expired or could not be verified. Please start again.');}
  sessionStorage.removeItem(LOGIN_KEY);if(error)throw Error(error==='access_denied'?'Spotify sign-in was canceled.':'Spotify sign-in failed. Please retry.');
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,grant_type:'authorization_code',code:code||'',redirect_uri:SPOTIFY_REDIRECT,code_verifier:pending.verifier})});
  const value=await response.json();if(!response.ok)throw Error('Spotify could not complete sign-in. Check the app’s registered redirect URL.');saveTokens(value);return true;
 })();return completing;
}
async function accessToken(){
 let value=tokens();if(!value)throw Error('Sign in with Spotify first.');
 if(value.expiresAt>Date.now()+60000)return value.access_token;
 if(!refreshing)refreshing=(async()=>{const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:SPOTIFY_CLIENT_ID,grant_type:'refresh_token',refresh_token:value.refresh_token})});const next=await response.json();if(!response.ok){logoutSpotify();throw Error('Your Spotify session expired. Sign in again.');}return saveTokens(next,value).access_token;})().finally(()=>{refreshing=null;});
 return refreshing;
}
export async function spotifyRequest(path,method='GET',body,again=true){
 if(Date.now()<blockedUntil)throw Error('Spotify is limiting requests. Please wait before trying again.');
 if(!path.startsWith('/'))throw Error('Invalid Spotify request.');
 const token=await accessToken();
 const headers={Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})};
 const response=await fetch('https://api.spotify.com/v1'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
 if(response.status===401&&again){const value=tokens();if(value){value.expiresAt=0;sessionStorage.setItem(TOKEN_KEY,JSON.stringify(value));}return spotifyRequest(path,method,body,false);}
 if(response.status===429){blockedUntil=Date.now()+Math.max(30,Number(response.headers.get('Retry-After'))||60)*1000;throw Error('Spotify is limiting requests. Playback will retry after the cooldown.');}
 if(response.status===204)return null;
 const value=await response.json().catch(()=>null);
 if(!response.ok){if(response.status===403)throw Error('Spotify denied access. Check Premium and add this Spotify account in the app’s User Management.');if(response.status===404)throw Error('No active Spotify device. Start playing in Spotify, then try again.');throw Error(value?.error?.message||'Spotify is unavailable. Try again shortly.');}
 return value;
}
export function compactTrack(track){return track?.id?{id:track.id,name:track.name||'Untitled',artists:(track.artists||[]).map(a=>a.name).join(', '),album:track.album?.name||'',artwork:track.album?.images?.at(-1)?.url||'',url:track.external_urls?.spotify||`https://open.spotify.com/track/${track.id}`,uri:track.uri||`spotify:track:${track.id}`,duration:track.duration_ms||0}:null;}
export function trackUri(value){const text=String(value).trim();if(/^spotify:track:[a-zA-Z0-9]{22}$/.test(text))return text;try{const url=new URL(text);const match=url.pathname.match(/^\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]{22})/);if(url.hostname==='open.spotify.com'&&match)return `spotify:track:${match[1]}`;}catch{}throw Error('Paste a Spotify track link or track URI.');}
export function jamUrl(value){if(!value)return '';try{const url=new URL(value);if(url.protocol==='https:'&&['open.spotify.com','spotify.link'].includes(url.hostname))return url.href;}catch{}throw Error('Use a Spotify Jam invite link from open.spotify.com or spotify.link.');}
