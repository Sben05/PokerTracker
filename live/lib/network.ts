import {firebaseFetch,subscribeLedger} from './firebase-network';
export const usesRealtimeDatabase=true;
export {subscribeLedger};
// Firebase Authentication stores and refreshes its own editor session.
export function setEditorToken(_token:string|null){}
export const apiFetch=firebaseFetch;
