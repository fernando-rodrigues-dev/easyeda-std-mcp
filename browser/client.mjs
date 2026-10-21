import {saveSource} from './storage.mjs';
export {saveSource};
let handler,sessionId;

export function configure(api) {
  if(typeof api!=='function')throw Error('Execute este script em Avançado > Extensões > Executar script no EasyEDA Standard.');
  handler=window.EasyEDAStdRuntime.createHandler(api);
  sessionId='webmcp-'+crypto.randomUUID();
}
function checkSession(id){if(!handler)throw Error('WebMCP não inicializado.');if(id&&id!==sessionId)throw Error('Sessão de outra aba. Execute easyeda_status novamente.');}
export async function status(){checkSession();return {transport:'webmcp',connected:true,storage:'IndexedDB neste navegador',sessions:[{client_id:sessionId,edition:'Standard'}],...await handler({action:'ping'})};}
export async function command(action,params={},session_id,expected_source,expected_document){checkSession(session_id);return handler({action,params,expected_source,expected_document});}
export async function revision(source,document_id='') {
  const bytes=new TextEncoder().encode(JSON.stringify([document_id,source]));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function snapshot(session_id){const s=await command('snapshot',{},session_id);return {...s,revision:await revision(s.source,s.document_id)};}
export async function mutate(action,params,{session_id,expected_revision}) {
  const before=await snapshot(session_id);
  if(before.revision!==expected_revision)throw Error('A revisão mudou. Leia o esquema novamente antes de editar.');
  const backup=await saveSource(before.source);
  try {
    const result=await command(action,params,session_id,JSON.stringify(before.source),before.document_id);
    const after=await snapshot(session_id);
    return {backup_file:backup,revision:after.revision,summary:after.summary,added_ids:result.added_ids,component:result.component};
  }catch(e){throw Error(e.message+' Cópia anterior: '+backup);}
}
