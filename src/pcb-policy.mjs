import fs from 'node:fs';
import path from 'node:path';
import {DATA} from './config.mjs';
const file=path.join(DATA,'pcb-policies.json');
function read(){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};}
export function isSingleSided(document_id,source){return read()[document_id]?.single_sided===true||source.shape.some(s=>s.startsWith('TEXT~')&&s.split('~')[10]==='MCP: FACE SIMPLES / COBRE INFERIOR');}
export function setSingleSided(document_id){fs.mkdirSync(DATA,{recursive:true});const all=read();all[document_id]={single_sided:true,copper_layer:'2',updated:new Date().toISOString()};fs.writeFileSync(file,JSON.stringify(all,null,2));}
export {ensureSingleSided} from './pcb-policy-validation.mjs';
