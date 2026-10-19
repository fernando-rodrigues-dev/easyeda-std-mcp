/* Appended to editor-runtime.js by setup. CONFIG is generated locally. */
(function(api,config) {
  'use strict';
  if(window.EasyEDAStdMCP)window.EasyEDAStdMCP.stop();
  var clientId='std-'+Date.now()+'-'+Math.random().toString(16).slice(2), stopped=false;
  var handler=window.EasyEDAStdRuntime.createHandler(api);
  var pendingResult=null, lastError=null, announced=false, errorShown=false;
  var button=api('createToolbarButton',{title:'MCP: conectando',text:'MCP: conectando',fordoctype:'all'});
  function status(text){if(button&&button.text)button.text(text);}
  function request(route,body) {
    return new Promise(function(resolve,reject) {
      var xhr=new XMLHttpRequest();
      xhr.open('POST',config.base+route,true);
      xhr.timeout=7000;
      // STD rewrites CORS allow-headers. A safelisted content type avoids that
      // preflight; authenticate the bridge request with a token in its body.
      xhr.setRequestHeader('Content-Type','text/plain;charset=UTF-8');
      xhr.onload=function(){try{var value=JSON.parse(xhr.responseText);if(xhr.status>=400)reject(new Error(value.error||('HTTP '+xhr.status)));else resolve(value);}catch(e){reject(e);}};
      xhr.onerror=function(){reject(new Error('Não foi possível conectar ao MCP local.'));};
      xhr.ontimeout=xhr.onerror;
      xhr.send(JSON.stringify(Object.assign({},body,{token:config.token})));
    });
  }
  async function loop() {
    while(!stopped) {
      try {
        if(pendingResult){await request('/bridge/result',pendingResult);pendingResult=null;}
        var response=await request('/bridge/poll',{client_id:clientId,edition:'Standard',location:location.origin});
        lastError=null;status('MCP conectado');
        if(!announced){announced=true;if(typeof $!=='undefined'&&$.messager)$.messager.show({title:'EasyEDA STD MCP',msg:'MCP conectado: esquemas e PCB disponíveis.',timeout:5000});}
        if(response.command) {
          var command=response.command;
          if(command.expires_at<Date.now())continue;
          try {pendingResult={client_id:clientId,id:command.id,result:await handler(command)};}
          catch(e){pendingResult={client_id:clientId,id:command.id,error:String(e.message||e)};}
        }
      } catch(e){lastError=String(e.message||e);status('MCP desconectado');if(!errorShown){errorShown=true;if(typeof $!=='undefined'&&$.messager)$.messager.show({title:'EasyEDA STD MCP',msg:lastError,timeout:10000});}}
      await new Promise(function(resolve){setTimeout(resolve,lastError?2000:300);});
    }
  }
  window.EasyEDAStdMCP={stop:function(){stopped=true;},clientId:clientId,status:function(){return {client_id:clientId,stopped:stopped,error:lastError};}};
  loop();
  console.info('EasyEDA STD MCP: ponte iniciada em '+config.base);
}(api,__LOCAL_CONFIG__));
