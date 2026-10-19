import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createBridge} from '../src/bridge.mjs';
async function fixture(t,timeout=1500) {
  const server=createBridge('test-secret',{commandTimeout:timeout});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base='http://127.0.0.1:'+server.address().port;
  async function req(route,input,extra={}){const r=await fetch(base+route,{method:input?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer test-secret',...extra},body:input?JSON.stringify(input):undefined});return {status:r.status,value:await r.json()};}
  return {req};
}
test('requires token, rejects arbitrary web origins, rejects unknown actions',async t=>{
  const {req}=await fixture(t);
  assert.equal((await req('/status',undefined,{Authorization:'Bearer wrong'})).status,401);
  assert.equal((await req('/status',undefined,{Origin:'https://evil.example'})).status,403);
  assert.equal((await req('/command',{action:'eval',params:{code:'anything'}})).status,400);
});
test('handles an authenticated editor round-trip and idempotent result delivery',async t=>{
  const {req}=await fixture(t);await req('/bridge/poll',{client_id:'editor1',edition:'Standard'});
  const pending=req('/command',{client_id:'editor1',action:'snapshot'});
  let command;
  for(let i=0;i<20&&!command;i++){await new Promise(r=>setTimeout(r,10));command=(await req('/bridge/poll',{client_id:'editor1',edition:'Standard'})).value.command;}
  assert.equal(command.action,'snapshot');
  assert.equal((await req('/bridge/result',{client_id:'wrong',id:command.id,result:{}})).status,403);
  const result={client_id:'editor1',id:command.id,result:{source:{head:{docType:'1'},shape:[]}}};
  assert.equal((await req('/bridge/result',result)).status,200);
  assert.deepEqual((await pending).value.result,result.result);
  assert.equal((await req('/bridge/result',result)).status,200);
});
test('requires explicit target if two editors are connected',async t=>{
  const {req}=await fixture(t);
  for(const client_id of ['editor1','editor2'])await req('/bridge/poll',{client_id,edition:'Standard'});
  const response=await req('/command',{action:'snapshot'});assert.equal(response.status,409);assert.match(response.value.error,/vários/);
});
test('supports the STD safelisted request format without removing authentication',async t=>{
  const {req}=await fixture(t);
  const plain={'Content-Type':'text/plain;charset=UTF-8',Authorization:'',Origin:'https://easyeda.com'};
  assert.equal((await req('/bridge/poll',{client_id:'std-client',edition:'Standard'},plain)).status,401);
  assert.equal((await req('/bridge/poll',{client_id:'std-client',edition:'Standard',token:'wrong'},plain)).status,401);
  assert.equal((await req('/bridge/poll',{client_id:'std-client',edition:'Standard',token:'test-secret'},plain)).status,200);
  assert.equal((await req('/command',{action:'delete',token:'test-secret'},plain)).status,401);
});
test('expired queued writes are never sent to editor later',async t=>{
  const {req}=await fixture(t,50);await req('/bridge/poll',{client_id:'editor1',edition:'Standard'});
  const response=await req('/command',{action:'delete',params:{ids:['gge1']}});
  assert.equal(response.status,504);
  assert.equal((await req('/bridge/poll',{client_id:'editor1',edition:'Standard'})).value.command,null);
});
