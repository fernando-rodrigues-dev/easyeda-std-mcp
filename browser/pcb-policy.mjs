export {ensureSingleSided} from '../src/pcb-policy-validation.mjs';
const KEY='easyeda-std-webmcp:pcb-policies';
function read(){return JSON.parse(localStorage.getItem(KEY)||'{}');}
export function isSingleSided(id,source){return read()[id]?.single_sided===true||source.shape.some(s=>s.startsWith('TEXT~')&&s.split('~')[10]==='MCP: FACE SIMPLES / COBRE INFERIOR');}
export function setSingleSided(id){const all=read();all[id]={single_sided:true,copper_layer:'2',updated:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(all));}
