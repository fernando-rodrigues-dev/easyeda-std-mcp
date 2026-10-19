import http from 'node:http';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PORT,token} from './config.mjs';
export const NAME='easyeda-std-local-bridge-v1';
const ACTIONS=new Set(['ping','snapshot','get_source','get_shape','new_schematic','add_component','set_component','add_wire','add_label','add_junction','add_text','add_power','move','rotate','delete','apply_source','pcb_place','pcb_set_side','pcb_track','pcb_outline','pcb_hole','pcb_text','pcb_single_sided','pcb_apply_source','pcb_clone']);
export function createBridge(secret,{commandTimeout=20000}={}) {
  const sessions=new Map(), jobs=new Map(), completed=new Map();
  function authorized(req) {
    const incoming=Buffer.from(req.headers.authorization||''), expected=Buffer.from('Bearer '+secret);
    return incoming.length===expected.length&&timingSafeEqual(incoming,expected);
  }
  function bodyAuthorized(value) {
    const incoming=Buffer.from(typeof value==='string'?value:''),expected=Buffer.from(secret);
    return incoming.length===expected.length&&timingSafeEqual(incoming,expected);
  }
  function originAllowed(origin) {
    return !origin||origin==='null'||/^https:\/\/([a-z0-9-]+\.)?easyeda\.com$/.test(origin);
  }
  function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
  async function body(req) {
    let size=0,chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>20*1024*1024)throw Error('Payload excede 20 MB.');chunks.push(chunk);}
    return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
  }
  function available() {
    return [...sessions.values()].filter(s=>Date.now()-s.last_seen<10000).map(s=>({client_id:s.client_id,edition:s.edition,last_seen:new Date(s.last_seen).toISOString()}));
  }
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(!originAllowed(origin))return send(res,403,{error:'Origem não permitida.'});
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    res.setHeader('Access-Control-Allow-Methods','POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network','true');
    const host=req.headers.host||'';
    if(!/^127\.0\.0\.1:\d+$/.test(host))return send(res,403,{error:'Host inválido.'});
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.url==='/health'&&req.method==='GET')return send(res,200,{name:NAME});
    const bridgeRoute=req.url==='/bridge/poll'||req.url==='/bridge/result';
    if(!bridgeRoute&&!authorized(req))return send(res,401,{error:'Token inválido.'});
    try {
      if(req.url==='/status'&&req.method==='GET')return send(res,200,{name:NAME,sessions:available()});
      if(req.method!=='POST')return send(res,405,{error:'Método não permitido.'});
      const input=await body(req);
      if(bridgeRoute&&!authorized(req)&&!bodyAuthorized(input.token))return send(res,401,{error:'Token inválido.'});
      if(req.url==='/bridge/poll') {
        if(typeof input.client_id!=='string'||input.client_id.length>120||input.edition!=='Standard')throw Error('Sessão STD inválida.');
        let s=sessions.get(input.client_id);
        if(!s){s={client_id:input.client_id,edition:'Standard',queue:[],last_seen:Date.now()};sessions.set(s.client_id,s);}
        s.last_seen=Date.now();
        let command;
        while(s.queue.length&&!command){const j=jobs.get(s.queue.shift());if(j&&j.expires_at>Date.now()){j.delivered=true;command={id:j.id,action:j.action,params:j.params,expected_source:j.expected_source,expected_document:j.expected_document,expires_at:j.expires_at};}}
        return send(res,200,{command:command||null});
      }
      if(req.url==='/bridge/result') {
        const j=jobs.get(input.id);
        if(!j){if(completed.get(input.id)===input.client_id)return send(res,200,{ok:true});return send(res,410,{error:'Comando encerrado.'});}
        if(j.client_id!==input.client_id||!j.delivered)return send(res,403,{error:'Sessão do resultado não corresponde ao comando.'});
        clearTimeout(j.timer);jobs.delete(j.id);completed.set(j.id,j.client_id);
        if(completed.size>200)completed.delete(completed.keys().next().value);
        send(j.response,200,input.error?{error:input.error}:{result:input.result});
        return send(res,200,{ok:true});
      }
      if(req.url==='/command') {
        if(!ACTIONS.has(input.action))return send(res,400,{error:'Operação não permitida.'});
        const clients=available();
        let id=input.client_id;
        if(!id&&clients.length===1)id=clients[0].client_id;
        if(!id) return send(res,409,{error:clients.length?'Há vários editores conectados. Informe session_id.':'EasyEDA não está conectado. Execute Conectar-MCP.js em Avançado > Executar Script.'});
        if(!clients.some(s=>s.client_id===id))return send(res,409,{error:'Sessão desconectada. Reconecte o script no EasyEDA.'});
        const j={id:randomUUID(),client_id:id,action:input.action,params:input.params||{},expected_source:input.expected_source,expected_document:input.expected_document,response:res,expires_at:Date.now()+commandTimeout,delivered:false};
        j.timer=setTimeout(()=>{
          jobs.delete(j.id);
          send(res,504,{error:j.delivered?'O editor não confirmou o resultado. Uma alteração pode ter ocorrido: leia o esquema antes de repetir.':'Comando expirou sem execução. Reconecte o editor.'});
        },commandTimeout);
        jobs.set(j.id,j);sessions.get(id).queue.push(j.id);return;
      }
      return send(res,404,{error:'Rota não encontrada.'});
    } catch(e){send(res,400,{error:String(e.message||e)});}
  });
  server.on('close',()=>{for(const j of jobs.values()){clearTimeout(j.timer);if(!j.response.writableEnded)send(j.response,503,{error:'Ponte encerrada.'});}});
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const server=createBridge(token());
  server.on('error',e=>{if(e.code!=='EADDRINUSE')console.error(e.message);process.exit(e.code==='EADDRINUSE'?0:1);});
  server.listen(PORT,'127.0.0.1',()=>console.error('EasyEDA STD: ponte local pronta em 127.0.0.1:'+PORT));
}
