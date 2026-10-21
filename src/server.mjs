import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './config.mjs';
import {registerTools} from './tools.mjs';
const packageVersion=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version;
const builtinTitles=JSON.parse(fs.readFileSync(path.join(ROOT,'assets','builtin-titles.json'),'utf8'));
const server=new McpServer({name:'easyeda-std',version:packageVersion});
function tool(name,description,schema,readOnly,fn,destructive=false) {
  server.registerTool(name,{description,inputSchema:schema,annotations:{readOnlyHint:readOnly,destructiveHint:destructive,idempotentHint:readOnly,openWorldHint:name==='easyeda_add_component'}},async args=>{
    try{return {content:[{type:'text',text:JSON.stringify(await fn(args),null,2)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:String(e.message||e)}]};}
  });
}
registerTools(tool,{builtinTitles});
await server.connect(new StdioServerTransport());
