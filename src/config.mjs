import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = process.env.EASYEDA_MCP_DATA || path.join(ROOT, 'data');
// The installed STD client CSP explicitly permits this local extension port.
export const PORT = Number(process.env.EASYEDA_MCP_PORT || 3579);
export const BASE = `http://127.0.0.1:${PORT}`;
export function token() {
  fs.mkdirSync(DATA, {recursive:true});
  const file = path.join(DATA, 'bridge-token.txt');
  try { fs.writeFileSync(file, randomBytes(32).toString('hex'), {flag:'wx',mode:0o600}); }
  catch(e) { if(e.code!=='EEXIST')throw e; }
  return fs.readFileSync(file,'utf8').trim();
}
