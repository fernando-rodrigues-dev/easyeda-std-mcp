import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function buildWebMCP({write=true}={}) {
  const aliases=['client','pcb-engine','pcb-policy'];
  const result=await build({
    absWorkingDir:root,entryPoints:['browser/main.mjs'],bundle:true,platform:'browser',format:'iife',target:'chrome120',minify:true,legalComments:'none',write:false,
    banner:{js:'/* EasyEDA Standard WebMCP. Public code only: no credentials or circuit data. */\n'+['editor-runtime.js','pcb-runtime.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n')},
    plugins:[{name:'browser-adapters',setup(b){b.onResolve({filter:/^\.\/.*\.mjs$/},args=>{const resolved=path.resolve(args.resolveDir,args.path);for(const name of aliases)if(resolved===path.join(root,'src',name+'.mjs'))return {path:path.join(root,'browser',name+'.mjs')};});}}],
  });
  const source=result.outputFiles[0].text;
  if(write){
    fs.mkdirSync(path.join(root,'cloud'),{recursive:true});
    fs.writeFileSync(path.join(root,'cloud','Conectar-WebMCP.js'),source);
    fs.writeFileSync(path.join(root,'cloud','THIRD_PARTY_NOTICES.txt'),'Conectar-WebMCP.js includes Zod 4.6.5.\n\n'+fs.readFileSync(path.join(root,'node_modules','zod','LICENSE'),'utf8'));
  }
  return source;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const source=await buildWebMCP();console.log('Script cloud gerado sem tokens: '+Buffer.byteLength(source)+' bytes.');}
