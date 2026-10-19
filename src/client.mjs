import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {BASE,ROOT,DATA,token} from './config.mjs';
import {NAME} from './bridge.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const headers=()=>({'Content-Type':'application/json',Authorization:'Bearer '+token()});
export async function ensureBridge() {
  async function health(){try{const r=await fetch(BASE+'/health',{signal:AbortSignal.timeout(1000)});const v=await r.json();if(v.name!==NAME)throw Error('A porta local está ocupada por outro serviço.');return true;}catch(e){if(e.message.includes('outro serviço'))throw e;return false;}}
  if(await health())return;
  fs.mkdirSync(DATA,{recursive:true});
  const log=fs.openSync(path.join(DATA,'bridge.log'),'a');
  const child=spawn(process.execPath,[path.join(ROOT,'src','bridge.mjs')],{cwd:ROOT,detached:true,windowsHide:true,stdio:['ignore',log,log],env:process.env});
  child.unref();fs.closeSync(log);
  for(let n=0;n<40;n++){await sleep(100);if(await health())return;}
  throw Error('Não foi possível iniciar a ponte local. Veja data/bridge.log.');
}
export async function status(){await ensureBridge();return request('/status');}
async function request(route,body) {
  const res=await fetch(BASE+route,{method:body?'POST':'GET',headers:headers(),body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000)});
  const payload=await res.json();
  if(payload.error)throw Error(payload.error);
  if(!res.ok)throw Error('Falha HTTP '+res.status);
  return payload;
}
export async function command(action,params={},session_id,expected_source,expected_document) {
  await ensureBridge();
  const value=await request('/command',{action,params,client_id:session_id,expected_source,expected_document});
  return value.result;
}
export function revision(source,document_id=''){return createHash('sha256').update(JSON.stringify([document_id,source])).digest('hex');}
export async function snapshot(session_id){const s=await command('snapshot',{},session_id);return {...s,revision:revision(s.source,s.document_id)};}
export function saveSource(source,label='backup') {
  const dir=path.join(DATA,label==='export'?'exports':'backups');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,Date.now()+'-'+randomUUID()+'.json');
  fs.writeFileSync(file,JSON.stringify(source,null,2),'utf8');return file;
}
export async function mutate(action,params,{session_id,expected_revision}) {
  const before=await snapshot(session_id);
  if(before.revision!==expected_revision)throw Error('A revisão mudou. Leia o esquema novamente antes de editar.');
  const backup=saveSource(before.source);
  try {
    const result=await command(action,params,session_id,JSON.stringify(before.source),before.document_id);
    const after=await snapshot(session_id);
    return {backup_file:backup,revision:after.revision,summary:after.summary,added_ids:result.added_ids,component:result.component};
  } catch(e){throw Error(e.message+' Cópia anterior: '+backup);}
}
