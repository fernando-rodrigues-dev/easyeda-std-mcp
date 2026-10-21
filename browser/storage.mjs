const DATABASE='easyeda-std-webmcp';
const STORE='sources';
const PREFIX='indexeddb://easyeda-std-webmcp/';
let database;

function open() {
  if(!database)database=new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB){reject(Error('IndexedDB indisponível; nenhuma edição foi iniciada.'));return;}
    const req=indexedDB.open(DATABASE,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    req.onblocked=()=>reject(Error('Armazenamento bloqueado por outra aba.'));
  });
  return database;
}

async function transaction(mode,operation) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    let request;
    try{request=operation(tx.objectStore(STORE));}catch(e){tx.abort();reject(e);return;}
    tx.oncomplete=()=>resolve(request.result);
    tx.onabort=tx.onerror=()=>reject(tx.error||Error('Não foi possível gravar o backup. Nenhuma edição foi iniciada.'));
  });
}

export async function saveSource(source,label='backup') {
  const row={id:crypto.randomUUID(),label,created_at:new Date().toISOString(),source:JSON.parse(JSON.stringify(source))};
  // Wait for the durable transaction, not just the request, before editing.
  await transaction('readwrite',store=>store.add(row));
  const file=PREFIX+row.id;
  if(label==='export')download(row);
  return file;
}

export async function listBackups(limit=20) {
  const rows=await transaction('readonly',store=>store.getAll());
  return rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,limit).map(({source,id,...meta})=>({file:PREFIX+id,...meta}));
}

export async function downloadBackup(file) {
  if(typeof file!=='string'||!file.startsWith(PREFIX))throw Error('Identificador de backup inválido.');
  const row=await transaction('readonly',store=>store.get(file.slice(PREFIX.length)));
  if(!row)throw Error('Backup não encontrado neste navegador.');
  download(row);
  return {file,download_requested:true};
}

function download(row) {
  const blob=new Blob([JSON.stringify(row.source,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='easyeda-'+row.label+'-'+row.id+'.json';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
