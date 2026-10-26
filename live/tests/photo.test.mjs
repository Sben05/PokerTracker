import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,validateBackup} from '../lib/commands.mjs';
import {makeStore} from '../lib/engine.mjs';
import {playerProfiles} from '../lib/analytics.mjs';
let n=0;
const run=(d,type,payload={})=>applyCommand(d,{id:`p-${++n}`,type,payload});
const JPEG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
test('a profile photo can be added, replaced, removed and carried into backups and profiles',()=>{
 let d=run(makeStore(),'add-player',{name:'Alex',photo:JPEG});const id=d.players[0].id;
 assert.equal(d.players[0].photo,JPEG);assert.equal(playerProfiles(d)[0].photo,JPEG);
 d=run(d,'edit-player',{playerId:id,name:'Alex'});assert.equal(d.players[0].photo,JPEG);
 assert.equal(validateBackup(structuredClone(d)).players[0].photo,JPEG);
 d=run(d,'edit-player',{playerId:id,name:'Alex',photo:''});assert.equal('photo' in d.players[0],false);
});
test('photos must be small JPEGs',()=>{
 let d=run(makeStore(),'add-player',{name:'Alex'});const id=d.players[0].id;
 assert.throws(()=>run(d,'edit-player',{playerId:id,name:'Alex',photo:'data:image/png;base64,AAAA'}),/photo/);
 assert.throws(()=>run(d,'edit-player',{playerId:id,name:'Alex',photo:'javascript:alert(1)'}),/photo/);
 assert.throws(()=>run(d,'edit-player',{playerId:id,name:'Alex',photo:'data:image/jpeg;base64,'+'A'.repeat(61000)}),/photo/);
 const bad=structuredClone(d);bad.players[0].photo='<script>';assert.throws(()=>validateBackup(bad),/photo/);
});
