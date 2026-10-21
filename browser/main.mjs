import {z} from 'zod';
import builtinTitles from '../assets/builtin-titles.json';
import {registerTools} from '../src/tools.mjs';
import {configure} from './client.mjs';
import {listBackups,downloadBackup} from './storage.mjs';

const registry=document.modelContext;
if(!registry||typeof registry.registerTool!=='function')throw Error('Este navegador não oferece WebMCP. Use um navegador cloud compatível ou o modo MCP local.');
if(window.EasyEDAStdMCP)throw Error('Desconecte o script/extensão MCP local antes de ativar WebMCP.');
if(window.EasyEDAStdWebMCP)window.EasyEDAStdWebMCP.stop();
configure(typeof api==='function'?api:undefined);
const controller=new AbortController(),names=[];
let queue=Promise.resolve(),stopped=false;
const registrations=[];
const button=api('createToolbarButton',{title:'EasyEDA WebMCP',text:'WebMCP: conectando',fordoctype:'all'});
function label(text){if(button&&button.text)button.text(text);}

function tool(name,description,shape,readOnly,fn,destructive=false) {
  // The browser schema helps the agent; Zod still validates every actual call.
  const schema=z.strictObject(shape);
  const inputSchema=z.toJSONSchema(schema,{io:'input'});
  const execute=input=>{
    const run=queue.then(async()=>{
      try{
        if(stopped)throw Error('Esta conexão WebMCP foi encerrada.');
        const args=schema.parse(input??{});
        const result=await fn(args);
        return {content:[{type:'text',text:JSON.stringify(result,null,2)}]};
      }catch(e){return {isError:true,content:[{type:'text',text:String(e.message||e)}]};}
    });
    // Serialize whole tool calls; two edits must never share a stale snapshot.
    queue=run.catch(()=>{});
    return run;
  };
  const registration=registry.registerTool({name,description,inputSchema,annotations:{readOnlyHint:readOnly,destructiveHint:destructive,untrustedContentHint:true},execute},{signal:controller.signal});
  names.push(name);registrations.push(Promise.resolve(registration));
}

function stop(){stopped=true;controller.abort();if(typeof registry.unregisterTool==='function')for(const name of names)registry.unregisterTool(name);label('WebMCP: desconectado');}
try {
  registerTools((name,description,...args)=>{
    if(name==='easyeda_status')description='Verifica a conexão WebMCP desta aba e a API EasyEDA Standard. Não exige servidor local.';
    if(name.startsWith('easyeda_export_'))description='Guarda uma cópia JSON no IndexedDB e solicita o download pelo navegador. Não salva na conta EasyEDA.';
    tool(name,description,...args);
  },{builtinTitles});
  tool('easyeda_list_backups','Lista backups e exportações deste navegador. Não retorna o conteúdo dos circuitos.',{limit:z.number().int().min(1).max(100).default(20)},true,async a=>({backups:await listBackups(a.limit)}));
  tool('easyeda_download_backup','Solicita o download de um backup JSON pelo identificador retornado por uma edição ou easyeda_list_backups.',{file:z.string().min(1)},true,a=>downloadBackup(a.file));
}catch(e){stop();throw e;}
const ready=Promise.all(registrations).then(()=>{
  if(!stopped)label('WebMCP: conectado ('+names.length+')');
  return {connected:!stopped,tools:names.length};
}).catch(e=>{stop();console.error('EasyEDA WebMCP:',e.message);throw e;});
window.EasyEDAStdWebMCP={ready,stop,status:()=>({connected:!stopped,tools:names.length})};
