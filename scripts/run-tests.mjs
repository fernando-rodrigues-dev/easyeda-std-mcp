import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=fs.readdirSync(path.join(root,'test')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join(root,'test',name));
if(!tests.length)throw Error('Nenhum arquivo de teste encontrado.');
// Pass concrete paths: Node 20 on Windows does not expand the shell wildcard.
const result=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
process.exitCode=result.status??1;
