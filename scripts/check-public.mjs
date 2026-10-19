import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let paths;
try{paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true}).split('\0').filter(Boolean);}
catch{throw Error('Execute dentro de um checkout Git; a revisão deve examinar os arquivos rastreados.');}
if(!paths.length)throw Error('Nenhum arquivo rastreado. Prepare os arquivos no Git antes da revisão.');
const forbidden=/(^|\/)(data|node_modules|backups|exports)(\/|$)|(^|\/)(Conectar-MCP\.js|config-codex\.toml|mcp\.json|\.env(?:\..*)?)$|^extension\/main\.js$|\.(pem|key|p12|pfx|log|zip)$/i;
const patterns=[
 ['token de serviço',/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})\b/],
 ['chave privada',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['credencial literal',/\b(?:token|password|secret|api[_-]?key)\s*[=:]\s*["'][A-Za-z0-9_+\/=.-]{24,}["']/i],
 ['caminho de usuário',/(?:[A-Z]:[\\/]+Users[\\/]+[^\s\\/"'<>]+|\/(?:Users|home)\/[^\s/"'<>]+)/i],
];
const findings=[];
for(const rel of paths){
 if(forbidden.test(rel)){findings.push({file:rel,reason:'arquivo local/gerado proibido'});continue;}
 const bytes=fs.readFileSync(path.join(root,rel));
 if(bytes.includes(0)){findings.push({file:rel,reason:'binário requer revisão explícita'});continue;}
 const lines=bytes.toString('utf8').split(/\r?\n/);
 lines.forEach((line,i)=>{for(const [reason,re]of patterns)if(re.test(line))findings.push({file:rel,line:i+1,reason});});
}
if(findings.length){console.error(JSON.stringify({findings},null,2));process.exitCode=1;}
else console.log(`Revisão automática: ${paths.length} arquivos rastreados, nenhum padrão proibido encontrado.`);

