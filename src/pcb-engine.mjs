import fs from 'node:fs';
import vm from 'node:vm';
import {ROOT} from './config.mjs';
const context=vm.createContext({});vm.runInContext(fs.readFileSync(ROOT+'/src/pcb-runtime.js','utf8'),context);
export default context.EasyEDAStdPCB;
