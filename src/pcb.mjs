import engine from './pcb-engine.mjs';
export const MM=.254;
export const pcbSummary=source=>JSON.parse(JSON.stringify(engine.summary(source)));
export function requirePCB(source){engine.requirePCB(source);}
export function enforceCopperNetNames(source){const next=pcbSummary(source),nets=new Set(next.pads.map(p=>p.net).filter(Boolean)),copper=o=>['1','2'].includes(o.layer)||(Number(o.layer)>=21&&Number(o.layer)<=52);for(const obj of [...next.tracks.filter(copper),...next.copper_areas,...next.solid_regions.filter(a=>a.type==='solid'&&copper(a))])if(!obj.net||!nets.has(obj.net))throw Error('Cobre com rede inexistente nos pads importados: '+(obj.net||'(sem rede)'));}
export function origin(source){return {x:Number(source.head.x||0),y:Number(source.head.y||0)};}
export function realSummary(source){const r=pcbSummary(source),o=origin(source);r.origin_canvas=o;r.coordinates='mm relativos à origem da PCB; x direita, y abaixo';for(const c of [...r.components,...r.pads,...r.holes,...r.vias,...r.texts]){c.x_mm=(c.x-o.x)*MM;c.y_mm=(c.y-o.y)*MM;}for(const c of r.components)for(const p of c.pads){p.x_mm=(p.x-o.x)*MM;p.y_mm=(p.y-o.y)*MM;}for(const t of r.tracks)t.points_mm=t.points.map(p=>({x:(p.x-o.x)*MM,y:(p.y-o.y)*MM}));return r;}
export function toRuntimeMM(source,p){const o=origin(source);return {x:p.x+o.x*MM,y:p.y+o.y*MM};}
export function toRuntimePlacement(source,p){const r=pcbSummary(source),c=r.components.find(c=>c.id===p.component||c.reference===p.component);if(!c)throw Error('Footprint não encontrado: '+p.component);if(c.locked)throw Error('Footprint bloqueado: '+p.component);const o=origin(source);return {...p,x_mm:p.x_mm+o.x*MM,y_mm:p.y_mm+o.y*MM,...(p.rotation===undefined?{}:{rotation:((2*c.rotation-p.rotation)%360+360)%360})};} // STD rotate degrees and stored LIB angles have opposite signs.
export function resolvePad(r,component,pad){const cs=r.components.filter(c=>c.id===component||c.reference===component);if(cs.length!==1)throw Error('Footprint não encontrado ou ambíguo: '+component);const ps=cs[0].pads.filter(p=>p.id===pad||p.number===pad);if(ps.length!==1)throw Error('Pad não encontrado ou número repetido: '+component+'.'+pad+'. Use o ID físico do pad.');return ps[0];}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,n=dx*dx+dy*dy;if(!n)return dist(p,a);const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/n));return dist(p,{x:a.x+t*dx,y:a.y+t*dy});}
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function intersects(a,b,c,d){const ca=cross(a,b,c),da=cross(a,b,d),ac=cross(c,d,a),bc=cross(c,d,b);if(ca*da<0&&ac*bc<0)return true;const on=(p,q,r)=>Math.abs(cross(q,r,p))<1e-8&&p.x>=Math.min(q.x,r.x)-1e-8&&p.x<=Math.max(q.x,r.x)+1e-8&&p.y>=Math.min(q.y,r.y)-1e-8&&p.y<=Math.max(q.y,r.y)+1e-8;return on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d);}
export function segmentDistance(a,b,c,d){return intersects(a,b,c,d)?0:Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));}
export function padDistance(a,b,p){
 const rad=(p.rotation||0)*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad),local=q=>({x:(q.x-p.x)*cos+(q.y-p.y)*sin,y:-(q.x-p.x)*sin+(q.y-p.y)*cos});a=local(a);b=local(b);
 const w=p.width/2,h=p.height/2;
 if(p.shape==='ELLIPSE'&&Math.abs(w-h)<1e-5)return Math.max(0,pointSegment({x:0,y:0},a,b)-w);
 if(p.shape==='OVAL'){const radius=Math.min(w,h),horizontal=w>h,delta=Math.max(w,h)-radius,c=horizontal?{x:-delta,y:0}:{x:0,y:-delta},d=horizontal?{x:delta,y:0}:{x:0,y:delta};return Math.max(0,segmentDistance(a,b,c,d)-radius);}
 // Rectangular bound is deliberately conservative for oval ellipses/polygons.
 const inside=q=>Math.abs(q.x)<=w&&Math.abs(q.y)<=h;if(inside(a)||inside(b))return 0;
 const box=[{x:-w,y:-h},{x:w,y:-h},{x:w,y:h},{x:-w,y:h},{x:-w,y:-h}];return Math.min(...box.slice(1).map((q,i)=>segmentDistance(a,b,box[i],q)));
}
const onLayer=(p,layer)=>p.layer===layer||p.layer==='11';
export function validateTrack(source,{points,net,width_mm,layer='2',clearance_mm=.25},ignoreId){
 const r=pcbSummary(source);if(!r.nets.includes(net))throw Error('Rede inexistente: '+net);if(r.single_sided&&layer!=='2')throw Error('Face simples: somente BottomLayer.');
 // STD serializes pad centres to 0.001 canvas units (0.000254 mm).
 // Allow 1 micron solely for accumulated coordinate/width rounding at equality.
 const ps=points.map(p=>({x:p.x/MM,y:p.y/MM})),radius=width_mm/2/MM,clearance=clearance_mm/MM,tolerance=.001/MM,errors=[];
 for(let i=1;i<ps.length;i++){
  const a=ps[i-1],b=ps[i];if(dist(a,b)<1e-8)throw Error('Pontos consecutivos repetidos.');
  for(const p of r.pads)if(onLayer(p,layer)&&p.net!==net&&padDistance(a,b,p)<radius+clearance-tolerance)errors.push({kind:'pad',id:p.id,reference:p.reference,pad:p.number,net:p.net});
  for(const t of r.tracks)if(t.layer===layer&&t.id!==ignoreId&&t.net!==net)for(let j=1;j<t.points.length;j++)if(segmentDistance(a,b,t.points[j-1],t.points[j])<radius+t.width/2+clearance-tolerance)errors.push({kind:'track',id:t.id,net:t.net});
  for(const h of r.holes)if(pointSegment(h,a,b)<h.diameter/2+radius+clearance-tolerance)errors.push({kind:'hole',id:h.id});
  // Areas and solid polygons are checked against their conservative bounds.
  for(const area of [...r.copper_areas,...r.solid_regions])if(area.layer===layer&&area.net!==net&&area.points.length){const xs=area.points.map(p=>p.x),ys=area.points.map(p=>p.y),p={x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2,width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),shape:'RECT',rotation:0};if(padDistance(a,b,p)<radius+clearance)errors.push({kind:'area',id:area.id,net:area.net});}
 }
 return [...new Map(errors.map(e=>[e.kind+e.id,e])).values()];
}
export function enforceTrack(source,p){const e=validateTrack(source,p);if(e.length)throw Error('Trilha invade cobre/pad/furo de outra rede ou a folga: '+JSON.stringify(e.slice(0,10)));}
// Only explicit assembly metadata may connect islands without copper. Document
// graphics alone never count as conductors; the physical wires remain mandatory.
export function wireBridges(source){
 const r=pcbSummary(source),bridges=[],issues=[],seen=new Set(),pads=new Map(r.pads.map(p=>[p.id,p])),holes=new Map(r.holes.map(h=>[h.id,h]));
 const markers=r.texts.filter(t=>t.text?.startsWith('MCP_WIRE;'));
 const counts=new Map();for(const t of markers){const name=t.text.split(';')[1];counts.set(name,(counts.get(name)||0)+1);}
 for(const t of markers){
  const a=t.text.split(';'),[,name,fromId,toId,net,holeAId,holeBId]=a,direct=a.length===5,from=pads.get(fromId),to=pads.get(toId),holeA=direct?undefined:holes.get(holeAId),holeB=direct?undefined:holes.get(holeBId);
  let reason;if((a.length!==5&&a.length!==7)||t.layer!=='12'||!/^W[1-9]\d*$/.test(name))reason='formato/camada inválidos';
  else if(counts.get(name)!==1||seen.has(name))reason='nome repetido';
  else if(!from||!to||fromId===toId||from.layer!=='11'||to.layer!=='11'||!from.hole_radius||!to.hole_radius)reason='extremos PTH inválidos';
  else if(!net||from.net!==net||to.net!==net)reason='redes dos extremos diferentes';
  else if(!direct&&(!holeA||!holeB||holeAId===holeBId||holeA.parent_id||holeB.parent_id))reason='furos de passagem inválidos';
  if(reason){issues.push({kind:'wire_metadata',id:t.id,name,reason});continue;}
  seen.add(name);bridges.push({name,net,from:{id:from.id,reference:from.reference,pad:from.number},to:{id:to.id,reference:to.reference,pad:to.number},...(direct?{connection:'wire soldered directly between PTH pads'}:{holeA:{id:holeA.id,x:holeA.x,y:holeA.y,diameter_mm:holeA.diameter_mm},holeB:{id:holeB.id,x:holeB.x,y:holeB.y,diameter_mm:holeB.diameter_mm}}),assembly_required:true});
 }
 return {bridges,issues};
}
export function checkLayout(source,clearance_mm=.25){
 const r=pcbSummary(source),issues=[];for(const t of r.tracks.filter(t=>['1','2'].includes(t.layer)))issues.push(...validateTrack(source,{points:t.points.map(p=>({x:p.x*MM,y:p.y*MM})),net:t.net,width_mm:t.width_mm,layer:t.layer,clearance_mm},t.id).map(e=>({track:t.id,...e})));
 const objects=[...r.pads.filter(p=>p.net).map(p=>({...p,type:'pad'})),...r.tracks.filter(t=>t.net&&['1','2'].includes(t.layer)).map(t=>({...t,type:'track'}))],parents=objects.map((_,i)=>i),root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;},union=(a,b)=>{a=root(a);b=root(b);if(a!==b)parents[b]=a;};
 for(let i=0;i<objects.length;i++)for(let j=i+1;j<objects.length;j++){
  const a=objects[i],b=objects[j];if(a.net!==b.net||(!onLayer(a,b.layer)&&!onLayer(b,a.layer)))continue;let connected=false;
  if(a.type==='pad'&&b.type==='track')connected=b.points.slice(1).some((q,k)=>padDistance(b.points[k],q,a)<=b.width/2+1e-6);
  if(a.type==='track'&&b.type==='pad')connected=a.points.slice(1).some((q,k)=>padDistance(a.points[k],q,b)<=a.width/2+1e-6);
  if(a.type==='track'&&b.type==='track')connected=a.points.slice(1).some((q,k)=>b.points.slice(1).some((s,n)=>segmentDistance(a.points[k],q,b.points[n],s)<=(a.width+b.width)/2+1e-6));
  if(a.type==='pad'&&b.type==='pad')connected=dist(a,b)<1e-6;
  if(connected)union(i,j);
 }
 const unrouted=()=>{const groups=new Map();objects.forEach((o,i)=>{if(o.type!=='pad')return;if(!groups.has(o.net))groups.set(o.net,new Map());const g=groups.get(o.net),rt=root(i);if(!g.has(rt))g.set(rt,[]);g.get(rt).push({reference:o.reference,pad:o.number,id:o.id});});return [...groups].filter(([,g])=>g.size>1).map(([net,g])=>({net,islands:g.size,pad_groups:[...g.values()]}));};
 const copper_unrouted_nets=unrouted(),wires=wireBridges(source),indices=new Map(objects.map((o,i)=>[o.id,i]));issues.push(...wires.issues);
 for(const w of wires.bridges)union(indices.get(w.from.id),indices.get(w.to.id));
 return {single_sided:r.single_sided,components:r.components.length,pads:r.pads.length,copperTracks:r.tracks.filter(t=>['1','2'].includes(t.layer)).length,topCopperTracks:r.tracks.filter(t=>t.layer==='1').length,topSmdPads:r.pads.filter(p=>p.layer==='1').length,vias:r.vias.length,clearance_mm,issues,copper_unrouted_nets,wire_bridges:wires.bridges,unrouted_nets:unrouted(),method:'Conferência geométrica conservadora de trilhas contra pads/trilhas/furos/áreas. Continuidade por cobre e pontes de fio explicitamente documentadas, que precisam ser montadas. Não substitui DRC nativo, ensaio térmico, inspeção mecânica ou medição de peças.'};
}
