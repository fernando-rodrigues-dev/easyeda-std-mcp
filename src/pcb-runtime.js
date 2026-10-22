/* EasyEDA STD PCB format: public getSource/applySource/moveObjs/rotate APIs. */
(function(root){
 'use strict';
 var MM=.254;
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function attrs(s){var a=(s||'').split('`'),v={};for(var i=0;i+1<a.length;i+=2)v[a[i]]=a[i+1];return v;}
 function points(s){var a=(s||'').trim().split(/[ ,]+/).map(Number),p=[];if(!s)return p;for(var i=0;i+1<a.length;i+=2)p.push({x:a[i],y:a[i+1]});return p;}
 function pos(x,y){return {x:Number(x),y:Number(y),x_mm:Number(x)*MM,y_mm:Number(y)*MM};}
 function shapeId(s){var a=s.split('#@$')[0].split('~'),ix={LIB:6,TRACK:5,PAD:12,VIA:6,HOLE:4,TEXT:13,ARC:6,COPPERAREA:7,SOLIDREGION:5,RECT:6,CIRCLE:6,DIMENSION:3};return a[ix[a[0]]];}
 function requirePCB(s){if(!s.head||String(typeof s.head==='string'?s.head.split('~')[0]:s.head.docType)!=='3')throw Error('A aba ativa não é uma PCB STD.');}
 function summary(s){
  requirePCB(s);
  var r={document_type:'pcb',unit:'10mil',mm_per_unit:MM,head:s.head,canvas:s.canvas,layers:s.layers||[],components:[],pads:[],tracks:[],vias:[],holes:[],texts:[],copper_areas:[],solid_regions:[],counts:{},nets:[],single_sided:!!(s.head.c_para&&s.head.c_para.MCP_SingleSided==='true')};
  function pad(raw,parent){var a=raw.split('~');return Object.assign({id:a[12],shape:a[1],width:Number(a[4]),height:Number(a[5]),width_mm:Number(a[4])*MM,height_mm:Number(a[5])*MM,layer:a[6],net:a[7],number:a[8],hole_radius:Number(a[9]||0),hole_diameter_mm:2*Number(a[9]||0)*MM,points:points(a[10]),rotation:Number(a[11]||0),hole_length:Number(a[13]||0),hole_points:points(a[14]),plated:a[15]||'',parent_id:parent&&parent.id,reference:parent&&parent.reference},pos(a[2],a[3]));}
  function track(raw,parent){var a=raw.split('~');return {id:a[5],width:Number(a[1]),width_mm:Number(a[1])*MM,layer:a[2],net:a[3],points:points(a[4]),parent_id:parent&&parent.id};}
  function text(raw,parent){var a=raw.split('~');return Object.assign({id:a[13],type:a[1],text:a[10],layer:a[7],rotation:Number(a[5]||0),parent_id:parent&&parent.id},pos(a[2],a[3]));}
  s.shape.forEach(function(raw){var chunks=raw.split('#@$'),a=chunks[0].split('~'),kind=a[0];r.counts[kind]=(r.counts[kind]||0)+1;
   if(kind==='LIB'){
    var c=Object.assign({id:a[6],rotation:Number(a[4]||0),layer:a[7]||'1',locked:a[10]==='1',attributes:attrs(a[3]),pads:[],pins:[]},pos(a[1],a[2]));
    chunks.slice(1).forEach(function(raw){if(raw.startsWith('TEXT~')){var t=text(raw,c);if(t.type==='P')c.reference=t.text;if(t.type==='N')c.value=t.text;}});
    if(!c.value)c.value=c.attributes.Value||c.attributes.name||c.attributes['Manufacturer Part']||c.attributes.package||'';
    chunks.slice(1).forEach(function(raw){if(raw.startsWith('PAD~')){var p=pad(raw,c);c.pads.push(p);r.pads.push(p);}else if(raw.startsWith('TRACK~'))r.tracks.push(track(raw,c));else if(raw.startsWith('TEXT~'))r.texts.push(text(raw,c));else if(raw.startsWith('HOLE~')){var h=raw.split('~');r.holes.push(Object.assign({id:h[4],diameter:Number(h[3]),diameter_mm:Number(h[3])*MM,parent_id:c.id,reference:c.reference},pos(h[1],h[2])));}});
    r.components.push(c);
   }else if(kind==='PAD')r.pads.push(pad(raw));
   else if(kind==='TRACK')r.tracks.push(track(raw));
   else if(kind==='TEXT')r.texts.push(text(raw));
   else if(kind==='VIA')r.vias.push(Object.assign({id:a[6],diameter:Number(a[3]),net:a[4],hole_radius:Number(a[5])},pos(a[1],a[2])));
   else if(kind==='HOLE')r.holes.push(Object.assign({id:a[4],diameter:Number(a[3]),diameter_mm:Number(a[3])*MM},pos(a[1],a[2])));
   else if(kind==='COPPERAREA')r.copper_areas.push({id:a[7],layer:a[2],net:a[3],points:points(a[4]),clearance:Number(a[5]),filled:a[6],zone:a[10]});
   else if(kind==='SOLIDREGION')r.solid_regions.push({id:a[5],layer:a[1],net:a[2],points:points(a[3]),type:a[4]});
  });
  r.nets=Array.from(new Set(r.pads.concat(r.tracks).map(function(p){return p.net;}).filter(Boolean))).sort();return r;
 }
 function netSignature(s){return summary(s).pads.map(function(p){return [p.parent_id||'',p.id,p.number,p.net].join('|');}).sort().join('\n');}
 function checkNetIdentity(a,b){if(netSignature(a)!==netSignature(b))throw Error('A edição alteraria os pads ou redes importados do esquema.');}
 function checkSingleSide(s){var r=summary(s);if(!r.single_sided)return;if(r.vias.length)throw Error('PCB face simples não pode usar vias.');if(r.tracks.some(function(t){return t.layer==='1';})||r.pads.some(function(p){return p.layer==='1';})||r.copper_areas.some(function(p){return p.layer==='1';})||r.solid_regions.some(function(p){return p.layer==='1'&&p.type==='solid';}))throw Error('Há cobre/SMD na face superior. Mova os SMD para BottomLayer antes de configurar face simples.');}
 function ptsMM(p){if(!Array.isArray(p)||p.length<2)throw Error('Informe pelo menos dois pontos.');return p.map(function(q){if(!Number.isFinite(q.x)||!Number.isFinite(q.y))throw Error('Coordenadas inválidas.');return {x:q.x/MM,y:q.y/MM};});}
 function format(p){return p.map(function(p){return Number(p.x.toFixed(6))+' '+Number(p.y.toFixed(6));}).join(' ');}
 function uid(){return 'ggePCB'+Date.now()+Math.floor(Math.random()*1000000);}
 function numeric(v,lo,hi,label){if(!Number.isFinite(v)||v<lo||v>hi)throw Error(label+' inválido.');return v;}
 async function handle(action,p,ctx){
  var before=ctx.read(),s=clone(before),r=summary(s),added=[];
  if(action==='pcb_add_footprint'){
   var oldIds=r.components.map(function(c){return c.id;}),oldDoc=ctx.documentId(),spec={shapeType:'FOOTPRINT',x:p.x_mm/MM,y:p.y_mm/MM,rotation:0};
   if(p.reference&&r.components.some(function(c){return c.reference===p.reference;}))throw Error('A referencia ja existe na PCB.');
   if(p.uuid){spec.uuid=p.uuid;spec.from='system';spec.title=p.title;}else {spec.shapeType='pcblib';spec.from='GeneralPackages';spec.title=p.title;}
   var made=ctx.api('createShape',spec);if(made&&typeof made.then==='function')await made;
   var inserted=[];
   for(var fpw=0;fpw<100;fpw++){
    if(ctx.documentId()!==oldDoc)throw Error('A aba ativa mudou durante a insercao. Confira o editor antes de repetir.');
    s=ctx.read();r=summary(s);inserted=r.components.filter(function(c){return oldIds.indexOf(c.id)<0;});
    if(inserted.length)break;await new Promise(function(resolve){setTimeout(resolve,100);});
   }
   if(inserted.length!==1)throw Error('A biblioteca nao retornou exatamente um footprint. Confira a PCB antes de repetir.');
   var part=inserted[0];
   try {
    if(p.through_hole_only&&(!part.pads.length||part.pads.some(function(q){return q.layer!=='11'||q.hole_radius<=0;})))throw Error('O footprint nao e exclusivamente PTH.');
    var guarded=clone(s);if(p.single_sided)guarded.head.c_para=Object.assign({},guarded.head.c_para,{MCP_SingleSided:'true'});checkSingleSide(guarded);
   }catch(libraryError){ctx.apply(before);throw Error(libraryError.message+' A PCB anterior foi restaurada.');}
   if(p.rotation)ctx.api('rotate',{ids:[part.id],degree:(360-p.rotation)%360});
   part=summary(ctx.read()).components.find(function(c){return c.id===part.id;});
   ctx.api('moveObjs',{objs:[part.id],addX:p.x_mm/MM-part.x,addY:p.y_mm/MM-part.y});
   s=ctx.read();
   var index=s.shape.findIndex(function(raw){return raw.startsWith('LIB~')&&raw.split('#@$')[0].split('~')[6]===part.id;});
   var chunks=s.shape[index].split('#@$');
   chunks=chunks.map(function(raw){var f=raw.split('~');if(f[0]==='TEXT'&&f[1]==='P'&&p.reference!==undefined)f[10]=p.reference;if(f[0]==='TEXT'&&f[1]==='N'&&p.value!==undefined)f[10]=p.value;return f.join('~');});
   if(p.reference!==undefined||p.value!==undefined){s.shape[index]=chunks.join('#@$');ctx.apply(s);}
   s=ctx.read();var existing=summary(s).pads.filter(function(q){return q.parent_id!==part.id;}).map(function(q){return [q.parent_id,q.id,q.number,q.net].join('|');}).sort().join('\n');
   if(existing!==netSignature(before))throw Error('A insercao alterou pads ou redes preexistentes.');
   checkSingleSide(s);return {source:s,added_ids:[part.id],component:summary(s).components.find(function(c){return c.id===part.id;})};
  }
  if(action==='pcb_clone'){
   requirePCB(s);checkSingleSide(s);var oldDoc='';
   if(root.document){var tabs=root.document.querySelectorAll('#sub-tabbar > div .tabbar-tab.active');for(var ti=0;ti<tabs.length;ti++)if(tabs[ti].getClientRects().length){oldDoc=tabs[ti].getAttribute('uuid')||'';break;}if(!oldDoc){var one=root.document.querySelector('#tabbar .tabbar-tab.single-tab.active');oldDoc=one?one.getAttribute('tabid')||'':'';}}
   if(s.head&&typeof s.head==='object'){s.head=clone(s.head);s.head.c_para=Object.assign({},s.head.c_para||{},{Title:((s.head.c_para||{}).Title||'PCB')+' - copy'});}
   ctx.api('applySource',{source:s,createNew:true});var active=null,newDoc='';
   for(var wait=0;wait<60;wait++){await new Promise(function(resolve){setTimeout(resolve,100);});active=ctx.read();newDoc='';if(root.document){var tabs2=root.document.querySelectorAll('#sub-tabbar > div .tabbar-tab.active');for(var tj=0;tj<tabs2.length;tj++)if(tabs2[tj].getClientRects().length){newDoc=tabs2[tj].getAttribute('uuid')||'';break;}if(!newDoc){var one2=root.document.querySelector('#tabbar .tabbar-tab.single-tab.active');newDoc=one2?one2.getAttribute('tabid')||'':'';}}
    if(newDoc&&newDoc!==oldDoc)break;}
   if(!newDoc||newDoc===oldDoc)throw Error('O EasyEDA não confirmou a abertura da cópia em uma nova aba. A PCB original não foi substituída.');
   checkNetIdentity(before,active);checkSingleSide(active);return {source:active,document_id:newDoc,added_ids:[]};
  }
  if(action==='pcb_place'){
   var refs=new Set();p.placements.forEach(function(q){var c=r.components.find(function(c){return c.id===q.component||c.reference===q.component;});if(!c)throw Error('Footprint não encontrado: '+q.component);if(refs.has(c.id))throw Error('Footprint repetido na lista.');refs.add(c.id);if(c.locked)throw Error('Footprint bloqueado: '+c.reference);numeric(q.x_mm,-25400,25400,'x');numeric(q.y_mm,-25400,25400,'y');});
   for(var q of p.placements){r=summary(ctx.read());var c=r.components.find(function(c){return c.id===q.component||c.reference===q.component;});if(q.rotation!==undefined){var delta=(q.rotation-c.rotation+360)%360;if(delta)ctx.api('rotate',{ids:[c.id],degree:delta});}r=summary(ctx.read());c=r.components.find(function(c){return c.id===q.component||c.reference===q.component;});ctx.api('moveObjs',{objs:[c.id],addX:q.x_mm/MM-c.x,addY:q.y_mm/MM-c.y});}
   s=ctx.read();checkNetIdentity(before,s);return {source:s};
  }
  if(action==='pcb_set_side'){
   var c=r.components.find(function(c){return c.id===p.component||c.reference===p.component;});if(!c)throw Error('Footprint não encontrado.');
   // Use the public native FOOTPRINT JSON cache, preserving pad IDs/nets.
   ctx.api('updateShape',{shapeType:'FOOTPRINT',jsonCache:{gId:c.id,layerid:p.side==='bottom'?'2':'1'}});
   s=ctx.read();checkNetIdentity(before,s);var changed=summary(s).components.find(function(d){return d.id===c.id;});
   if(changed.layer!==(p.side==='bottom'?'2':'1'))throw Error('O editor não confirmou a mudança de face. Leia a PCB antes de repetir.');
   return {source:s};
  }
  if(action==='pcb_track'){
   if(r.nets.indexOf(p.net)<0)throw Error('Rede inexistente na PCB: '+p.net);
   if(r.single_sided&&p.layer!=='2')throw Error('Face simples: use apenas BottomLayer.');
   var v=ptsMM(p.points);for(var i=1;i<v.length;i++)if(v[i].x===v[i-1].x&&v[i].y===v[i-1].y)throw Error('Pontos repetidos.');
   var k=uid();s.shape.push('TRACK~'+numeric(p.width_mm,.1,30,'Largura')/MM+'~'+p.layer+'~'+p.net+'~'+format(v)+'~'+k+'~0');added.push(k);
  }else if(action==='pcb_outline'){
   var v=ptsMM(p.points);if(v.length<3)throw Error('Contorno precisa de três vértices.');if(v[0].x!==v.at(-1).x||v[0].y!==v.at(-1).y)v.push(v[0]);
   if(!p.replace_existing&&r.tracks.some(function(t){return t.layer==='10'&&!t.parent_id;}))throw Error('Já existe contorno; informe replace_existing para substituir.');
   if(p.replace_existing)s.shape=s.shape.filter(function(raw){var a=raw.split('~');return !(a[0]==='TRACK'&&a[2]==='10');});
   var k=uid();s.shape.push('TRACK~'+.15/MM+'~10~~'+format(v)+'~'+k+'~0');added.push(k);
  }else if(action==='pcb_hole'){
   var k=uid();s.shape.push('HOLE~'+p.x_mm/MM+'~'+p.y_mm/MM+'~'+numeric(p.diameter_mm,.3,20,'Diâmetro')/MM+'~'+k+'~0');added.push(k);
  }else if(action==='pcb_text'){
   var k=uid();ctx.api('createShape',{shapeType:'TEXT',jsonCache:{gId:k,type:'L',x:p.x_mm/MM,y:p.y_mm/MM,strokeWidth:.15/MM,rotation:0,mirror:'none',layerid:p.layer,net:'',fontSize:p.height_mm/MM,text:p.text,display:''}});s=ctx.read();checkNetIdentity(before,s);return {source:s,added_ids:[k]};
  }else if(action==='pcb_single_sided'){
   if(typeof s.head==='string')throw Error('Converta o cabeçalho para objeto STD antes de configurar face simples.');
   s.head.c_para=Object.assign({},s.head.c_para,{MCP_SingleSided:'true',MCP_CopperLayers:'BottomLayer'});
   s.layers=(s.layers||[]).map(function(row){var a=row.split('~');a[4]=a[0]==='2'?'true':'false';return a.join('~');});checkSingleSide(s);
  }else if(action==='pcb_apply_source'){
   s=clone(p.source);requirePCB(s);checkNetIdentity(before,s);checkSingleSide(s);
  }else throw Error('Operação PCB desconhecida: '+action);
  checkNetIdentity(before,s);checkSingleSide(s);s=ctx.apply(s);checkNetIdentity(before,s);checkSingleSide(s);return {source:s,added_ids:added};
 }
 root.EasyEDAStdPCB={summary:summary,shapeId:shapeId,requirePCB:requirePCB,netSignature:netSignature,checkNetIdentity:checkNetIdentity,checkSingleSide:checkSingleSide,handle:handle};
}(typeof window==='undefined'?globalThis:window));
