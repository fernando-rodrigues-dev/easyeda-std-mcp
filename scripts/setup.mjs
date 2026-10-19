import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ROOT,DATA,BASE,token} from '../src/config.mjs';
fs.mkdirSync(path.join(ROOT,'extension'),{recursive:true});
const runtime=fs.readFileSync(path.join(ROOT,'src','editor-runtime.js'),'utf8');
const connection=fs.readFileSync(path.join(ROOT,'src','editor-connection.js'),'utf8').replace('__LOCAL_CONFIG__',JSON.stringify({base:BASE,token:token()}));
const pcb=fs.readFileSync(path.join(ROOT,'src','pcb-runtime.js'),'utf8');
const source=runtime+'\n'+pcb+'\n'+connection;
fs.writeFileSync(path.join(ROOT,'Conectar-MCP.js'),source);
fs.writeFileSync(path.join(ROOT,'extension','main.js'),source);
fs.writeFileSync(path.join(ROOT,'extension','manifest.json'),JSON.stringify({name:'EasyEDA STD MCP',description:'Ponte local para esquemas e layout PCB pelo chat.',version:'2.1.0',icons:{default:'icon.svg'},scripts:['main.js']},null,2));
fs.writeFileSync(path.join(ROOT,'extension','icon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#167d88"/><path d="M4 16h6l2-6 4 12 4-12 2 6h6" fill="none" stroke="white" stroke-width="2"/></svg>');
const entry='\n[mcp_servers.easyeda_std]\ncommand = '+JSON.stringify(process.execPath)+'\nargs = ['+JSON.stringify(path.join(ROOT,'src','server.mjs'))+']\ncwd = '+JSON.stringify(ROOT)+'\nstartup_timeout_sec = 15\ntool_timeout_sec = 60\nenabled = true\n';
fs.writeFileSync(path.join(ROOT,'config-codex.toml'),entry);
const generic={mcpServers:{easyeda_std:{command:process.execPath,args:[path.join(ROOT,'src','server.mjs')],cwd:ROOT}}};
fs.writeFileSync(path.join(ROOT,'mcp.json'),JSON.stringify(generic,null,2));
if(process.argv.includes('--register')) {
  const configRoot=process.env.CODEX_HOME||path.join(os.homedir(),'.codex');
  fs.mkdirSync(configRoot,{recursive:true});
  const file=path.join(configRoot,'config.toml'),old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
  if(/^\[mcp_servers\.easyeda_std(?:\]|\.)/m.test(old)) {
    console.log('easyeda_std já configurado; configuração existente preservada.');
  } else {
    fs.mkdirSync(DATA,{recursive:true});
    if(old)fs.writeFileSync(path.join(DATA,'config-codex-before-'+Date.now()+'.toml'),old,{mode:0o600});
    fs.writeFileSync(file,old+(old.endsWith('\n')?'':'\n')+entry,'utf8');
    console.log('MCP easyeda_std registrado na configuração local.');
  }
}
console.log('Script de conexão e extensão gerados. O token permanece nos arquivos locais.');
