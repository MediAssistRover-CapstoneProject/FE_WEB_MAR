import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateNavigationPending, navigationPendingScopes, navigationScopeBlock, navigationStorageKey } from '../src/features/robotOperations/navigationScope.js';

const scope={robotId:'robot-a',mapId:'map-a'};
const receipt={...scope,busy:false,requestActive:false,sessionState:'CLOSED',snapshotAgeMs:100,receivedAt:10000};

test('changing robot or map waits for the request and navigation session to finish',()=>{
  for(const sessionState of ['WAITING_FOR_PI','LOCALIZING','READY','UNKNOWN'])assert.ok(navigationScopeBlock(scope,{...receipt,sessionState},11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,requestActive:true},11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,activeJobId:'external-job'},11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,busy:true},11000));
  for(const sessionState of ['NONE','CLOSED','EXPIRED'])assert.equal(navigationScopeBlock(scope,{...receipt,sessionState},11000),'');
});

test('a missing, stale or different-console receipt cannot authorize leaving monitoring',()=>{
  assert.ok(navigationScopeBlock(scope,null,11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,robotId:'robot-b'},11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,mapId:'map-b'},11000));
  assert.ok(navigationScopeBlock(scope,{...receipt,snapshotAgeMs:null},11000));
  assert.ok(navigationScopeBlock(scope,receipt,15001));
  assert.equal(navigationScopeBlock(null,null,11000),'');
});

const robotId='11111111-1111-4111-8111-111111111111',mapId='22222222-2222-4222-8222-222222222222';
const key='33333333-3333-4333-8333-333333333333';
function memory(entries=[]){const rows=new Map(entries);return {get length(){return rows.size;},key:i=>[...rows.keys()][i],getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)};}

test('pending receipts are isolated per API, account, robot and map',()=>{
  const base=navigationStorageKey('api',{accountId:'admin'}),scoped=navigationStorageKey('api',{accountId:'admin'},{robotId,mapId});
  const pending={key,body:{robotId,mapId},done:false};
  const storage=memory([[base,JSON.stringify(pending)]]);
  migrateNavigationPending(storage,base,scoped,{robotId:'another',mapId});
  assert.equal(storage.getItem(scoped),null);
  assert.ok(storage.getItem(base));
  migrateNavigationPending(storage,base,scoped,{robotId,mapId});
  assert.equal(storage.getItem(base),null);
  assert.deepEqual(JSON.parse(storage.getItem(scoped)),pending);
  assert.deepEqual(navigationPendingScopes(storage,base),[{key,robotId,mapId}]);
  assert.deepEqual(navigationPendingScopes(storage,navigationStorageKey('api',{accountId:'other-admin'})),[]);
  assert.deepEqual(navigationPendingScopes(storage,navigationStorageKey('other-api',{accountId:'admin'})),[]);
  assert.notEqual(scoped,navigationStorageKey('api',{accountId:'admin'},{robotId,mapId:'other-map'}));
});

test('migration preserves an unresolved scoped receipt and resumes legacy only over completed state',()=>{
  const base='navigation',scoped='navigation:scope',pending={key,body:{robotId,mapId},done:false};
  const other={...pending,key:'44444444-4444-4444-8444-444444444444'};
  const storage=memory([[base,JSON.stringify(pending)],[scoped,JSON.stringify(other)]]);
  migrateNavigationPending(storage,base,scoped,{robotId,mapId});
  assert.deepEqual(JSON.parse(storage.getItem(scoped)),other);
  storage.setItem(scoped,JSON.stringify({...other,done:true}));
  migrateNavigationPending(storage,base,scoped,{robotId,mapId});
  assert.deepEqual(JSON.parse(storage.getItem(scoped)),pending);
  storage.setItem(base,'bad-json');
  assert.equal(navigationPendingScopes(storage,base).length,1);
  storage.setItem(scoped,JSON.stringify({...pending,done:true}));
  assert.deepEqual(navigationPendingScopes(storage,base),[]);
});
