import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ROOT} from '../src/config.mjs';
const sourceCode=fs.readFileSync(ROOT+'/src/editor-runtime.js','utf8');
function fixture(type='1') {
  const resistor='LIB~200~140~package`R0805`nameAlias`Value`Value`10k`~0~0~gge1#@$T~P~200~120~0~#000080~~9pt~normal~normal~~comment~R1~1~start~gge2#@$T~N~200~130~0~#000080~~9pt~normal~normal~~comment~10k~1~start~gge3#@$P~show~0~1~180~140~180~gge4^^180~140^^M 180 140 h 10~#800^^0~180~140~0~LEFT~end~~7pt^^1~180~140~0~1~start~~7pt^^0~0~0^^0~#@$P~show~0~2~240~140~0~gge5^^240~140^^M 240 140 h -10~#800^^0~240~140~0~RIGHT~start~~7pt^^1~240~140~0~2~end~~7pt^^0~0~0^^0~';
  return {head:{docType:type,c_para:{Title:'Teste'}},canvas:'CA~1200~1200~#FFFFFF~yes~#CCCCCC~10~1200~1200~line~10~pixel~5~0~0',shape:[resistor]};
}
function environment(initial=fixture()) {
  let current=structuredClone(initial), calls=[];
  const context=vm.createContext({setTimeout,console});vm.runInContext(sourceCode,context);
  const handler=context.EasyEDAStdRuntime.createHandler((action,p)=>{
    calls.push({action,p});
    if(action==='getSource')return JSON.stringify(current);
    if(action==='getSelectedIds')return ['gge1'];
    if(action==='applySource')current=structuredClone(p.source);
  });
  return {handler,calls,current:()=>current,runtime:context.EasyEDAStdRuntime};
}
test('reads pin connection dots, reference and value from documented STD format',async()=>{
  const env=environment();const result=await env.handler({action:'snapshot'});
  const c=result.summary.components[0];
  assert.equal(c.id,'gge1');assert.equal(c.reference,'R1');assert.equal(c.value,'10k');
  assert.deepEqual(JSON.parse(JSON.stringify(c.pins.map(p=>[p.number,p.x,p.y]))),[['1',180,140],['2',240,140]]);
});
test('refuses PCB before any modification',async()=>{
  const env=environment(fixture('3'));
  await assert.rejects(env.handler({action:'delete',params:{ids:['gge1']},expected_source:JSON.stringify(env.current())}),/não é um esquema/);
  assert.equal(env.calls.some(c=>c.action==='delete'),false);
});
test('refuses stale source when user changed the active sheet',async()=>{
  const env=environment();
  await assert.rejects(env.handler({action:'add_wire',params:{points:[{x:180,y:140},{x:240,y:140}]},expected_source:'{}'}),/folha mudou/);
  assert.equal(env.calls.some(c=>c.action==='applySource'),false);
});
test('refuses a different active tab even when the two sheets have identical sources',async()=>{
  const env=environment();
  await assert.rejects(env.handler({action:'add_text',params:{x:0,y:0,size:9,text:'Test'},expected_source:JSON.stringify(env.current()),expected_document:'another-document'}),/folha ativa foi trocada/);
  assert.equal(env.calls.some(c=>c.action==='applySource'),false);
});
test('rejects diagonal routes and reserved text before applying source',async()=>{
  const env=environment();
  await assert.rejects(env.handler({action:'add_wire',params:{points:[{x:0,y:0},{x:10,y:10}]},expected_source:JSON.stringify(env.current())}),/horizontais/);
  await assert.rejects(env.handler({action:'add_text',params:{x:100,y:100,size:9,text:'bad~text'},expected_source:JSON.stringify(env.current())}),/separadores/);
  assert.equal(env.calls.some(c=>c.action==='applySource'),false);
});
test('creates electrical wires and labels, retains existing symbols',async()=>{
  const env=environment();
  const r=await env.handler({action:'add_wire',params:{points:[{x:180,y:140},{x:180,y:200},{x:300,y:200}],net:'VOUT'},expected_source:JSON.stringify(env.current())});
  assert.ok(r.added_ids[0].startsWith('gge'));assert.equal(env.current().shape.length,3);
  const report=env.runtime.summary(env.current());
  assert.equal(report.components.length,1);assert.equal(report.wires.length,1);assert.equal(report.labels[0].name,'VOUT');
});
test('updates both visible value and underlying library attribute',async()=>{
  const env=environment();
  await env.handler({action:'set_component',params:{id:'gge1',reference:'R2',value:'4.7k'},expected_source:JSON.stringify(env.current())});
  const c=env.runtime.summary(env.current()).components[0];
  assert.equal(c.reference,'R2');assert.equal(c.value,'4.7k');assert.equal(c.attributes.Value,'4.7k');
});
test('new sheet creates a separate editor instead of replacing the active one',async()=>{
  const env=environment();
  await env.handler({action:'new_schematic',params:{title:'Novo',marker:'test-marker'}});
  const applied=env.calls.find(c=>c.action==='applySource');assert.equal(applied.p.createNew,true);assert.equal(env.current().shape.length,0);
});

test('removes an exact top-level object without relying on editor focus or selection',async()=>{
  const env=environment();
  const prior=JSON.stringify(env.current());
  await assert.rejects(env.handler({action:'delete',params:{ids:['gge2']},expected_source:prior}),/ID não encontrado/);
  assert.equal(env.calls.some(c=>c.action==='applySource'),false);
  await env.handler({action:'delete',params:{ids:['gge1']},expected_source:prior});
  assert.equal(env.current().shape.length,0);
  assert.equal(env.calls.some(c=>c.action==='delete'),false);
});
