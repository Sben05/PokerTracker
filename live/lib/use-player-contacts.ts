'use client';
import {useEffect,useState} from 'react';
import {collection,onSnapshot} from 'firebase/firestore';
import {database} from './firebase-network';
export function usePlayerContacts(editor:boolean){
 const [contacts,setContacts]=useState<Record<string,any>>({}),[ready,setReady]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setContacts({});setReady(false);setError('');if(!editor)return;return onSnapshot(collection(database,'playerContacts'),snapshot=>{setContacts(Object.fromEntries(snapshot.docs.map(d=>[d.id,d.data()])));setReady(true);},()=>{setError('Could not load private email addresses. Reconnect before editing profiles.');});},[editor]);
 return {contacts,ready,error};
}
