import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config.mjs';
import {status,command,snapshot,mutate,revision,saveSource} from './client.mjs';
import {shapeId,withoutObjects} from './source.mjs';
import {registerPCBTools} from './pcb-tools.mjs';
const packageVersion=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
const server=new McpServer({name:'easyeda-std',version:packageVersion});
const pos=z.number().finite().min(-100000).max(100000);
const safeText=z.string().max(1000).refine(s=>!/[~`]|\^\^|#@\$|[\r\n]/.test(s),'Sem separadores reservados do STD.');
const session={session_id:z.string().optional().describe('ID retornado por easyeda_status; obrigatório se houver vários editores conectados.')};
const edit={...session,expected_revision:z.string().length(64).describe('Revisão SHA-256 retornada pela leitura ou pela última alteração. Leia novamente se mudou.')};
const ids=z.array(z.string().regex(/^gge[a-zA-Z0-9_-]+$/)).min(1).max(100);
const rot=z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]);
function tool(name,description,schema,readOnly,fn,destructive=false) {
  server.registerTool(name,{description,inputSchema:schema,annotations:{readOnlyHint:readOnly,destructiveHint:destructive,idempotentHint:readOnly,openWorldHint:name==='easyeda_add_component'}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify(await fn(args),null,2)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:String(e.message||e)}]};}
  });
}
tool('easyeda_status','Verifica a ponte local e as sessões EasyEDA Standard. Não modifica documentos.',{},true,status);
tool('easyeda_read_schematic','Lê o esquema ativo, componentes, referências, valores, pinos com coordenadas de conexão, fios e revisão. Unidade: pixel STD (10 mil), x para direita, y para baixo.',session,true,async a=>{const s=await snapshot(a.session_id);if(String(s.source.head.docType)!=='1')throw Error('A aba ativa não é um esquema. Use easyeda_read_pcb.');return {document_id:s.document_id,revision:s.revision,...s.summary,selected_ids:s.selected_ids};});
tool('easyeda_get_source','Lê o fonte da folha ativa em formato STD comprimido, JSON expandido ou SVG.',{...session,format:z.enum(['compress','json','svg']).default('compress')},true,async a=>({source:await command('get_source',{format:a.format},a.session_id)}));
tool('easyeda_get_shape','Lê detalhes de um objeto pelo ID retornado pela leitura.',{...session,id:z.string()},true,a=>command('get_shape',{id:a.id},a.session_id));
tool('easyeda_search_components','Busca nomes na biblioteca local comum do STD 6.5.51. Para peças específicas, use o UUID STD copiado da biblioteca; IDs Pro não são compatíveis.',{query:z.string().default(''),limit:z.number().int().min(1).max(100).default(30)},true,async a=>{
  const all=JSON.parse(fs.readFileSync(path.join(ROOT,'assets','builtin-titles.json'),'utf8'));
  const hits=all.filter(t=>t.toLowerCase().includes(a.query.toLowerCase()));return {total:hits.length,components:hits.slice(0,a.limit).map(title=>({title,from:'EasyEDALibs'}))};
});
tool('easyeda_new_schematic','Abre uma nova folha de esquema no editor, sem gravar na nuvem. Não substitui a folha atual.',{...session,title:safeText.default('Esquema MCP')},false,async a=>{
  await command('new_schematic',{title:a.title,marker:'mcp-'+crypto.randomUUID()},a.session_id);const s=await snapshot(a.session_id);return {revision:s.revision,document_id:s.document_id,summary:s.summary};
});
tool('easyeda_add_component','Insere um símbolo nativo do STD pelo título da biblioteca comum ou UUID STD. x/y são a posição absoluta da origem do símbolo no canvas. Retorna ID e pinos. Pode carregar a peça da biblioteca EasyEDA.',{...edit,title:z.string().min(1),uuid:z.string().optional(),x:pos,y:pos,rotation:rot.default(0),reference:safeText.optional(),value:safeText.optional()},false,async a=>{
  const inserted=await mutate('add_component',a,a);
  const component=inserted.component;
  // STD imports libraries using their stored origin as an offset. Normalize
  // that native behavior so all MCP tools share absolute canvas coordinates.
  if(component.x===a.x&&component.y===a.y)return inserted;
  const placed=await mutate('move',{ids:[component.id],dx:a.x-component.x,dy:a.y-component.y},{...a,expected_revision:inserted.revision});
  return {...placed,backup_file:inserted.backup_file,additional_backup_files:[placed.backup_file],added_ids:inserted.added_ids,component:placed.summary.components.find(c=>c.id===component.id)};
});
tool('easyeda_set_component','Altera referência e valor de um componente existente.',{...edit,id:z.string(),reference:safeText.optional(),value:safeText.optional()},false,a=>{if(a.reference===undefined&&a.value===undefined)throw Error('Informe reference ou value.');return mutate('set_component',a,a);});
tool('easyeda_add_wire','Adiciona fio ortogonal. Use as coordenadas exatas dos pinos; inclua pontos intermediários para curvas. net cria um rótulo elétrico no início do fio.',{...edit,points:z.array(z.object({x:pos,y:pos})).min(2).max(200),net:safeText.optional()},false,a=>mutate('add_wire',a,a));
tool('easyeda_connect_pins','Conecta dois pinos por número ou nome. Cria rota ortogonal entre as coordenadas reais. Não detecta obstáculos nem cruzamentos com outras redes.',{...edit,from_component:z.string(),from_pin:z.string(),to_component:z.string(),to_pin:z.string(),route:z.enum(['horizontal_first','vertical_first']).default('horizontal_first'),net:safeText.optional()},false,async a=>{
  const s=await snapshot(a.session_id);
  function pin(c,p){const part=s.summary.components.find(x=>x.id===c||x.reference===c);if(!part)throw Error('Componente não encontrado: '+c);const byNumber=part.pins.filter(x=>x.number===p);const found=byNumber.length?byNumber:part.pins.filter(x=>x.name===p);if(found.length!==1)throw Error('Pino não encontrado ou ambíguo: '+c+'.'+p);return {x:found[0].x,y:found[0].y};}
  const from=pin(a.from_component,a.from_pin),to=pin(a.to_component,a.to_pin),points=[from];
  if(from.x!==to.x&&from.y!==to.y)points.push(a.route==='horizontal_first'?{x:to.x,y:from.y}:{x:from.x,y:to.y});
  points.push(to);return mutate('add_wire',{points,net:a.net},a);
});
tool('easyeda_add_net_label','Adiciona um rótulo elétrico, como PWM_IN, no ponto de conexão.',{...edit,name:safeText,x:pos,y:pos,rotation:rot.default(0)},false,a=>mutate('add_label',a,a));
tool('easyeda_add_power','Insere flag GND, VCC ou porta de rede no ponto indicado.',{...edit,kind:z.enum(['gnd','vcc','port']),name:safeText.optional(),x:pos,y:pos,rotation:rot.default(0)},false,a=>mutate('add_power',a,a));
tool('easyeda_add_junction','Marca uma junção elétrica em uma conexão real de fios. O STD remove pontos isolados; crie primeiro os fios que se encontram nesse ponto.',{...edit,x:pos,y:pos},false,async a=>{
  const result=await mutate('add_junction',a,a);
  const junction=result.summary.junctions.find(j=>j.x===a.x&&j.y===a.y);
  if(!junction)throw Error('O EasyEDA não preservou a junção. Crie primeiro uma ramificação ou cruzamento de fios nesse ponto. Cópia anterior: '+result.backup_file);
  return {...result,added_ids:[junction.id]};
});
tool('easyeda_add_text','Adiciona uma anotação ou título de bloco.',{...edit,text:safeText,x:pos,y:pos,size:z.number().min(3).max(72).default(9)},false,a=>mutate('add_text',a,a));
tool('easyeda_move_objects','Move os objetos por dx e dy. Inclua os fios necessários na seleção: mover apenas o componente pode deixar conexões antigas.',{...edit,ids,dx:pos,dy:pos},false,a=>mutate('move',a,a));
tool('easyeda_rotate_objects','Gira os objetos pelos graus indicados. Releia os pinos e confira os fios depois.',{...edit,ids,degrees:rot},false,a=>mutate('rotate',a,a));
tool('easyeda_delete_objects','Remove somente os IDs especificados de componentes, fios, rótulos, flags, junções e textos, com cópia local prévia. IDs de filhos de símbolos não são aceitos.',{...edit,ids},false,async a=>{
  const before=await snapshot(a.session_id);
  if(before.revision!==a.expected_revision)throw Error('A revisão mudou. Leia o esquema novamente antes de editar.');
  const replacement=withoutObjects(before.source,a.ids);
  // The installed STD delete command depends on UI selection/focus. Applying
  // an exact filtered source works independently of focus and keeps the guard.
  const result=await mutate('apply_source',{source:replacement},a);
  const after=await snapshot(a.session_id);
  if(after.source.shape.some(s=>a.ids.includes(shapeId(s))))throw Error('O EasyEDA não confirmou a remoção. Cópia anterior: '+result.backup_file);
  return {...result,removed_ids:a.ids};
},true);
tool('easyeda_apply_source','Substitui a folha ativa por um objeto de fonte comprimido STD, com revisão e cópia anterior. Use apenas quando o usuário pedir substituição ou restauração.',{...edit,source:z.object({head:z.union([z.string(),z.record(z.string(),z.unknown())]),canvas:z.string(),shape:z.array(z.string())}).passthrough()},false,a=>mutate('apply_source',{source:a.source},a),true);
tool('easyeda_export_schematic','Salva uma cópia JSON local, reabrível no STD. Retorna o caminho do arquivo.',session,true,async a=>{const s=await snapshot(a.session_id);return {file:saveSource(s.source,'export'),revision:s.revision};});
registerPCBTools(tool,{session,edit,safeText,pos,rot});
await server.connect(new StdioServerTransport());
