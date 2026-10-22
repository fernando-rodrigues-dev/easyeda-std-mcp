import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
function environment(){
 let source={head:{docType:'1'},canvas:'CA',shape:[]},active='old',pending=null,reads=0;const calls=[];
 const document={querySelectorAll:()=>[{getClientRects:()=>[1],getAttribute:()=>active}],querySelector:()=>null};
 const c=vm.createContext({document,setTimeout:fn=>fn()});
 for(const f of ['editor-runtime.js','pcb-runtime.js'])vm.runInContext(fs.readFileSync(new URL('src/'+f,root),'utf8'),c);
 const handler=c.EasyEDAStdRuntime.createHandler((action,p)=>{
  calls.push({action,p});
  if(action==='getSelectedIds')return [];
  if(action==='getSource'){
   if(pending&&++reads===1)return '';
   if(pending&&reads===2)return JSON.stringify(source);
   if(pending&&reads>=3){source=pending;pending=null;active='new';}
   return JSON.stringify(source);
  }
  if(action==='applySource'){pending=structuredClone(p.source);reads=0;}
 });
 return {handler,calls,current:()=>source};
}
test('opening a PCB waits through an empty iframe and an unchanged old document',async()=>{
 const e=environment();const r=await e.handler({action:'new_pcb',params:{title:'Native board'}});
 assert.equal(r.document_id,'new');assert.equal(r.source.head.docType,'3');
 assert.equal(r.source.DRCRULE.Default.clearance,1.377953);
 assert.equal(e.calls.filter(c=>c.action==='applySource').length,1);
 assert.equal(e.calls.find(c=>c.action==='applySource').p.createNew,true);
});
test('opening prepared source rejects unrelated document types before any write',async()=>{
 const e=environment();await assert.rejects(e.handler({action:'open_document',params:{source:{head:{docType:'4'},canvas:'CA',shape:[]}}}),/não é um esquema ou PCB/);
 assert.equal(e.calls.some(c=>c.action==='applySource'),false);
});
test('a prepared schematic opens as a new document without a revision for the old sheet',async()=>{
 const e=environment();const r=await e.handler({action:'open_document',params:{source:{head:{docType:'1'},canvas:'CA',shape:['T~L~10~10~0~#000080~~9pt~normal~normal~~comment~Imported~1~start~gge10~0']}}});
 assert.equal(r.document_id,'new');assert.equal(e.current().shape.length,1);
});

function footprintEnvironment({smd=false}={}){
 let source={head:{docType:'3',c_para:{}},canvas:'CA',shape:['LIB~10~10~package`TEST`~0~0~ggeOld~1~0#@$TEXT~P~10~8~.5~0~none~3~~5~J1~~~ggeRefOld~0#@$PAD~ELLIPSE~10~10~6~6~11~GND~1~1.5~~0~ggePadOld~0~~Y~0']};const calls=[];
 const c=vm.createContext({setTimeout:fn=>fn()});
 for(const f of ['editor-runtime.js','pcb-runtime.js'])vm.runInContext(fs.readFileSync(new URL('src/'+f,root),'utf8'),c);
 const handler=c.EasyEDAStdRuntime.createHandler((action,p)=>{
  calls.push({action,p});
  if(action==='getSelectedIds')return [];
  if(action==='getSource')return JSON.stringify(source);
  if(action==='applySource')source=structuredClone(p.source);
  if(action==='createShape')source.shape.push('LIB~100~100~package`NATIVE`~0~0~ggeNew~1~0#@$TEXT~P~100~90~.5~0~none~3~~5~U?~~~ggeRefNew~0#@$TEXT~N~100~80~.5~0~none~3~~5~TEST~~~ggeValue~0#@$PAD~ELLIPSE~100~100~6~6~'+(smd?'1':'11')+'~~1~'+(smd?'0':'1.5')+'~~0~ggePadNew~0~~Y~0');
 });return {handler,calls,current:()=>source};
}
test('native footprint insertion preserves existing pad nets and assigns reference and value',async()=>{
 const e=footprintEnvironment(),before=JSON.stringify(e.current());
 const r=await e.handler({action:'pcb_add_footprint',params:{title:'TEST',x_mm:25.4,y_mm:25.4,reference:'J2',value:'PTH',through_hole_only:true},expected_source:before});
 assert.equal(r.component.reference,'J2');assert.equal(r.component.value,'PTH');assert.equal(r.component.pads[0].layer,'11');
 assert.equal(r.source.shape[0],JSON.parse(before).shape[0]);
 assert.equal(e.calls.find(c=>c.action==='createShape').p.from,'GeneralPackages');
});
test('PTH-only or single-sided insertion rolls back an incompatible library footprint',async()=>{
 for(const guards of [{through_hole_only:true},{single_sided:true}]){
  const e=footprintEnvironment({smd:true}),before=JSON.stringify(e.current());
  await assert.rejects(e.handler({action:'pcb_add_footprint',params:{title:'SMD',x_mm:25.4,y_mm:25.4,...guards},expected_source:before}),/restaurada/);
  assert.equal(JSON.stringify(e.current()),before);
 }
});
test('duplicate footprint references are rejected before library insertion',async()=>{
 const e=footprintEnvironment();await assert.rejects(e.handler({action:'pcb_add_footprint',params:{title:'TEST',x_mm:25.4,y_mm:25.4,reference:'J1'},expected_source:JSON.stringify(e.current())}),/referencia ja existe/);
 assert.equal(e.calls.some(c=>c.action==='createShape'),false);
});
