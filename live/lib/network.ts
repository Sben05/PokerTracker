// The same app runs on Sites and on the existing GitHub Pages address.
const backend='https://pokerbank-house-ledger.blithehake22.chatgpt.site';
const tokenKey='pokerbank.editor-token';
export function setEditorToken(token:string|null){if(token)localStorage.setItem(tokenKey,token);else localStorage.removeItem(tokenKey);}
export function apiFetch(path:string,options:RequestInit={}){
 const origin=typeof window!=='undefined'&&window.location.hostname==='sben05.github.io'?backend:'';
 const headers=new Headers(options.headers);
 const token=typeof window!=='undefined'?localStorage.getItem(tokenKey):null;
 if(token)headers.set('Authorization',`Bearer ${token}`);
 return fetch(origin+path,{...options,headers});
}
