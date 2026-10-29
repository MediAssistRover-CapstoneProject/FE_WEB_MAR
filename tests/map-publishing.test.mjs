import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchMaps,dispatchEndpoints,endpointDraftDirty } from '../src/features/facility/mapPublishing.js';
const map={mapId:'m',floorId:'f',widthM:10,heightM:10,originXM:0,originYM:0,originYawRad:0};
const point={endpointId:'e',mapId:'m',endpointCode:'E',endpointName:'Point',endpointType:'WAYPOINT',xM:2,yM:3,yawRad:0,active:true,accessible:true,publicVisible:false};
test('dispatch requires an ACTIVE map and points scoped to that map; public visibility is independent',()=>{
  assert.deepEqual(dispatchMaps([{...map,status:'DRAFT'},{...map,mapId:'active',status:'ACTIVE'},{...map,mapId:'old',status:'INACTIVE'}]).map(m=>m.mapId),['active']);
  assert.deepEqual(dispatchEndpoints([point,{...point,endpointId:'wrong',mapId:'other'},{...point,endpointId:'disabled',active:false},{...point,endpointId:'inaccessible',accessible:false}],'m'),[point]);
});
test('unsaved changes block publishing; pristine and saved drafts are allowed',()=>{
  assert.equal(endpointDraftDirty({endpointCode:'',endpointName:'',xM:'',yM:''},map,[],[],[]),false);
  assert.equal(endpointDraftDirty(point,map,[point],[],[]),false);
  assert.equal(endpointDraftDirty({...point,xM:'2'},map,[point],[],[]),false);
  assert.equal(endpointDraftDirty({...point,yawRad:1},map,[point],[],[]),true);
  assert.equal(endpointDraftDirty({...point,endpointId:undefined},map,[point],[],[]),true);
});
