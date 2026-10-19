import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {ROOT} from '../src/config.mjs';
const client=new Client({name:'easyeda-protocol-test',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[ROOT+'/src/server.mjs'],cwd:ROOT,stderr:'pipe'}));
try{
 const list=await client.listTools();assert.equal(list.tools.length,33);
 for(const name of ['easyeda_status','easyeda_connect_pins','easyeda_read_pcb','easyeda_pcb_duplicate_active','easyeda_pcb_apply_source'])assert.ok(list.tools.some(t=>t.name===name),name);
 const result=await client.callTool({name:'easyeda_search_components',arguments:{query:'R_0805',limit:5}});
 assert.ok(!result.isError);const data=JSON.parse(result.content[0].text);assert.equal(data.total,2);
 console.log(JSON.stringify({protocol:'OK',tools:list.tools.length,library_search:'OK'}));
}finally{await client.close();}
