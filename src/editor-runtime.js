/* EasyEDA Standard 6.5.51. Uses the public api() entry point only. */
(function (root) {
  'use strict';
  function copy(x) { return JSON.parse(JSON.stringify(x)); }
  function unpack(x) {
    if (typeof x === 'string') x = JSON.parse(x);
    if (!x || !x.head || !Array.isArray(x.shape)) throw new Error('Abra um esquema ou PCB no EasyEDA STD.');
    return copy(x);
  }
  function docType(source) {
    return String(typeof source.head === 'string' ? source.head.split('~')[0] : source.head.docType);
  }
  function requireSchematic(source) {
    if (docType(source) !== '1') throw new Error('A folha ativa não é um esquema STD. Use as ferramentas PCB para esta aba.');
  }
  function summary(source) {
    if(docType(source)==='3'&&root.EasyEDAStdPCB)return root.EasyEDAStdPCB.summary(source);
    requireSchematic(source);
    var result = {head:source.head, canvas:source.canvas, components:[], wires:[], labels:[], power_flags:[], junctions:[], counts:{}};
    source.shape.forEach(function (shape) {
      var sections=shape.split('#@$'), fields=sections[0].split('~'), kind=fields[0];
      result.counts[kind]=(result.counts[kind]||0)+1;
      if(kind==='LIB') {
        var component={id:fields[6], x:Number(fields[1]), y:Number(fields[2]), rotation:Number(fields[4]||0), attributes:{}, pins:[]};
        var attrs=(fields[3]||'').split('`');
        for(var a=0;a+1<attrs.length;a+=2)component.attributes[attrs[a]]=attrs[a+1];
        sections.slice(1).forEach(function(child){
          var f=child.split('~');
          if(f[0]==='T'&&f[1]==='P')component.reference=f[12];
          if(f[0]==='T'&&f[1]==='N')component.value=f[12];
          if(f[0]==='P') {
            var segments=child.split('^^'), conf=segments[0].split('~'), dot=segments[1].split('~');
            var name=(segments[3]||'').split('~'), number=(segments[4]||'').split('~');
            component.pins.push({id:conf[7],number:number[4]||conf[3],name:name[4]||'',x:Number(dot[0]),y:Number(dot[1]),electrical_type:conf[2]});
          }
        });
        result.components.push(component);
      } else if(kind==='W') {
        var nums=fields[1].trim().split(/\s+/).map(Number), points=[];
        for(var i=0;i<nums.length;i+=2)points.push({x:nums[i],y:nums[i+1]});
        result.wires.push({id:fields[6],points:points});
      } else if(kind==='N')result.labels.push({id:fields[6],name:fields[5],x:Number(fields[1]),y:Number(fields[2])});
      else if(kind==='F') {
        var flagSections=shape.split('^^'), flagHeader=flagSections[0].split('~'), flagDot=flagSections[1].split('~'), mark=flagSections[2].split('~');
        result.power_flags.push({id:flagHeader[5],kind:flagHeader[1],name:mark[0],x:Number(flagDot[0]),y:Number(flagDot[1])});
      } else if(kind==='J')result.junctions.push({id:fields[5],x:Number(fields[1]),y:Number(fields[2])});
    });
    return result;
  }
  function shapeId(shape) {
    if(/^(TRACK|PAD|VIA|HOLE|TEXT|ARC|COPPERAREA|SOLIDREGION|RECT|CIRCLE|DIMENSION)~/.test(shape)&&root.EasyEDAStdPCB)return root.EasyEDAStdPCB.shapeId(shape);
    var f=shape.split('#@$')[0].split('^^')[0].split('~'), indices={LIB:6,W:6,N:6,F:5,J:5,T:15};
    return indices[f[0]]===undefined?undefined:f[indices[f[0]]];
  }
  function findId(source,id) {
    return source.shape.find(function(s){return shapeId(s)===id;});
  }
  function componentProperties(source, id, reference, value) {
    var index=source.shape.findIndex(function(s){return s.startsWith('LIB~')&&s.split('#@$')[0].split('~')[6]===id;});
    if(index<0)throw new Error('Componente não encontrado: '+id);
    var parts=source.shape[index].split('#@$'), foundRef=false, foundValue=false;
    for(var i=1;i<parts.length;i++) {
      var f=parts[i].split('~');
      if(f[0]==='T'&&f[1]==='P'&&reference!==undefined){f[12]=reference;foundRef=true;parts[i]=f.join('~');}
      if(f[0]==='T'&&f[1]==='N'&&value!==undefined){f[12]=value;foundValue=true;parts[i]=f.join('~');}
    }
    if(reference!==undefined&&!foundRef)throw new Error('O símbolo não contém texto de referência.');
    if(value!==undefined&&!foundValue)throw new Error('O símbolo não contém texto de valor.');
    if(value!==undefined) {
      var h=parts[0].split('~'), attrs=h[3].split('`'), alias='name';
      var aliasAt=-1,valueAt=-1;
      for(var key=0;key+1<attrs.length;key+=2)if(attrs[key]==='nameAlias')aliasAt=key;
      if(aliasAt>=0)alias=attrs[aliasAt+1];
      for(var key2=0;key2+1<attrs.length;key2+=2)if(attrs[key2]===alias)valueAt=key2;
      if(valueAt>=0)attrs[valueAt+1]=value;
      h[3]=attrs.join('`');parts[0]=h.join('~');
    }
    source.shape[index]=parts.join('#@$');
    return source;
  }
  function validatePoints(points) {
    if(!Array.isArray(points)||points.length<2)throw new Error('Um fio precisa de pelo menos dois pontos.');
    points.forEach(function(p,i){
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('Coordenadas inválidas.');
      if(i&&p.x!==points[i-1].x&&p.y!==points[i-1].y)throw new Error('Use apenas segmentos horizontais ou verticais.');
      if(i&&p.x===points[i-1].x&&p.y===points[i-1].y)throw new Error('Pontos consecutivos repetidos.');
    });
  }
  function createHandler(api) {
    function documentId() {
      if(!root.document)return 'test-document';
      var sub=root.document.querySelectorAll('#sub-tabbar > div .tabbar-tab.active');
      for(var i=0;i<sub.length;i++)if(sub[i].getClientRects().length)return sub[i].getAttribute('uuid')||'';
      var single=root.document.querySelector('#tabbar .tabbar-tab.single-tab.active');
      return single?single.getAttribute('tabid')||'':'';
    }
    function supported(s){if(docType(s)!=='1'&&!(docType(s)==='3'&&root.EasyEDAStdPCB))throw Error('A aba ativa não é um esquema ou PCB STD.');}
    function read(){var s=unpack(api('getSource',{type:'compress'}));supported(s);return s;}
    function apply(source){supported(source);api('applySource',{source:source,createNew:false});return read();}
    function id(){return 'gge'+Date.now()+Math.floor(Math.random()*1000000);}
    function clean(value) {
      if(typeof value!=='string'||/[~`]|\^\^|#@\$|[\r\n]/.test(value))throw new Error('Texto contém separadores reservados do formato STD.');
      return value;
    }
    return async function handle(command) {
      var p=command.params||{}, action=command.action;
      if(action==='ping')return {edition:'Standard',runtime_version:'2.1.0',pcb_available:!!root.EasyEDAStdPCB,api_available:typeof api==='function'};
      if(action==='open_document'||action==='new_pcb') {
        var incoming=action==='open_document'?unpack(p.source):{
          head:{docType:'3',editorVersion:'6.5.60',x:'0',y:'0',c_para:{Title:clean(p.title)}},
          canvas:'CA~1000~1000~#000000~yes~#FFFFFF~10~1000~1000~line~0.5~mm~1~45~~0.5~0~0~0~yes',
          shape:[],layers:['1~TopLayer~#FF0000~true~true~true~','2~BottomLayer~#0000FF~true~false~true~','3~TopSilkLayer~#FFCC00~true~false~true~','4~BottomSilkLayer~#66CC33~true~false~true~','7~TopSolderMaskLayer~#800080~true~false~true~0.3','8~BottomSolderMaskLayer~#AA00FF~true~false~true~0.3','9~Ratlines~#6464FF~true~false~true~','10~BoardOutLine~#FF00FF~true~false~true~','11~Multi-Layer~#C0C0C0~true~false~true~','12~Document~#FFFFFF~true~false~true~'],
          objects:['All~true~false','Component~true~true','Prefix~true~true','Name~true~false','Track~true~true','Pad~true~true','Via~true~true','Hole~true~true','Copper_Area~true~true','Text~true~true'],
          BBox:{x:0,y:0,width:0,height:0},preference:{hideFootprints:'',hideNets:''},
          DRCRULE:{Default:{trackWidth:1.968504,clearance:1.377953,viaHoleDiameter:2.4,viaHoleD:1.2},isRealtime:false,isDrcOnRoutingOrPlaceVia:false},netColors:{}
        };
        supported(incoming);
        var previousDocument=documentId(),wanted=summary(incoming);
        api('applySource',{source:incoming,createNew:true});
        for(var ow=0;ow<120;ow++) {
          await new Promise(function(resolve){setTimeout(resolve,100);});
          try {
            var opened=read(),openedId=documentId();
            if(root.document&&(!openedId||openedId===previousDocument))continue;
            if(docType(opened)!==docType(incoming))continue;
            var actual=summary(opened);
            if(actual.components.length!==wanted.components.length)continue;
            if(docType(incoming)==='3') {
              if(actual.pads.length!==wanted.pads.length||actual.tracks.length!==wanted.tracks.length||actual.vias.length!==wanted.vias.length)continue;
              var matches=wanted.pads.every(function(q){return actual.pads.some(function(v){return v.reference===q.reference&&v.number===q.number&&v.net===q.net&&Math.abs(v.x-q.x)<.01&&Math.abs(v.y-q.y)<.01;});});
              if(!matches)continue;
            }
            return {source:opened,document_id:openedId,added_ids:[]};
          }catch(readError){} // A new iframe can return an empty source while loading.
        }
        throw Error('O editor nao confirmou o novo documento completo. Confira a nova aba antes de repetir; a aba anterior nao foi substituida.');
      }
      if(action==='new_schematic') {
        var marker=p.marker;
        var blank={head:{docType:'1',editorVersion:'6.5.51',c_para:{Title:clean(p.title),MCP_DocumentId:marker}},canvas:'CA~1200~1200~#FFFFFF~yes~#CCCCCC~10~1200~1200~line~10~pixel~5~0~0',shape:[]};
        api('applySource',{source:blank,createNew:true});
        for(var wait=0;wait<50;wait++) {
          await new Promise(function(resolve){setTimeout(resolve,100);});
          try {var active=read();if(JSON.stringify(active.head).includes(marker))return {source:active};}catch(e){}
        }
        throw new Error('Não foi possível confirmar a abertura da nova folha; verifique o editor antes de repetir.');
      }
      var source=read();
      if(action==='snapshot')return {source:source,document_id:documentId(),summary:summary(source),selected_ids:api('getSelectedIds')||[]};
      if(action==='get_source')return p.format==='compress'?source:copy(api('getSource',{type:p.format}));
      if(action==='get_shape')return copy(api('getShape',{id:p.id})||null);
      if(command.expected_source!==JSON.stringify(source))throw new Error('A folha mudou desde a leitura. Leia o esquema novamente antes de editar.');
      if(command.expected_document!==undefined&&command.expected_document!==documentId())throw new Error('A folha ativa foi trocada. Leia o esquema novamente antes de editar.');
      if(action.startsWith('pcb_')){if(!root.EasyEDAStdPCB)throw Error('Atualize a extensão para habilitar PCB.');return root.EasyEDAStdPCB.handle(action,p,{api:api,read:read,apply:apply,documentId:documentId});}
      if(['add_component','set_component','add_wire','add_label','add_junction','add_text','add_power'].includes(action))requireSchematic(source);
      ['reference','value','net','name','text'].forEach(function(field){if(p[field]!==undefined)clean(p[field]);});
      if(p.reference!==undefined&&summary(source).components.some(function(c){return c.reference===p.reference&&c.id!==p.id;}))throw new Error('A referência já existe na folha: '+p.reference);
      if(action==='add_component') {
        var before=summary(source).components.map(function(c){return c.id;});
        var spec={shapeType:'schlib',x:p.x,y:p.y,rotation:0};
        if(p.uuid){spec.uuid=p.uuid;spec.from='system';spec.title=p.title||p.uuid;}
        else {spec.from='EasyEDALibs';spec.title=p.title;}
        var outcome=api('createShape',spec);
        if(outcome&&typeof outcome.then==='function')await outcome;
        var added;
        for(var tries=0;tries<50;tries++) {
          if(command.expected_document!==undefined&&command.expected_document!==documentId())throw new Error('A folha ativa mudou durante a inserção. Confira o editor antes de repetir.');
          source=read();
          added=summary(source).components.filter(function(c){return before.indexOf(c.id)<0;});
          if(added.length)break;
          await new Promise(function(resolve){setTimeout(resolve,100);});
        }
        if(!added||added.length!==1)throw new Error('A inserção não retornou exatamente um componente. Verifique o editor antes de repetir.');
        var componentId=added[0].id;
        if(p.rotation)api('rotate',{ids:[componentId],degree:p.rotation});
        source=read();
        if(p.reference!==undefined||p.value!==undefined) {
          if(p.reference!==undefined)clean(p.reference);
          if(p.value!==undefined)clean(p.value);
          source=apply(componentProperties(source,componentId,p.reference,p.value));
        }
        return {source:source,added_ids:[componentId],component:summary(source).components.find(function(c){return c.id===componentId;})};
      }
      if(action==='set_component') {
        if(p.reference!==undefined)clean(p.reference);
        if(p.value!==undefined)clean(p.value);
        source=apply(componentProperties(source,p.id,p.reference,p.value));
      } else if(action==='add_wire') {
        validatePoints(p.points);
        var wireId=id(), coords=p.points.map(function(point){return point.x+' '+point.y;}).join(' ');
        source.shape.push('W~'+coords+'~#008800~1~0~none~'+wireId+'~0');
        if(p.net)source.shape.push('N~'+p.points[0].x+'~'+p.points[0].y+'~0~#000080~'+clean(p.net)+'~'+id()+'~start~'+(p.points[0].x+2)+'~'+(p.points[0].y-2)+'~~7pt~0');
        source=apply(source);
        return {source:source,added_ids:[wireId]};
      } else if(action==='add_label') {
        var labelId=id();
        source.shape.push('N~'+p.x+'~'+p.y+'~'+p.rotation+'~#000080~'+clean(p.name)+'~'+labelId+'~start~'+(p.x+2)+'~'+(p.y-2)+'~~7pt~0');
        source=apply(source);return {source:source,added_ids:[labelId]};
      } else if(action==='add_junction') {
        var junctionId=id();source.shape.push('J~'+p.x+'~'+p.y+'~2.5~#CC0000~'+junctionId+'~0');
        source=apply(source);return {source:source,added_ids:[junctionId]};
      } else if(action==='add_text') {
        var textId=id();source.shape.push('T~L~'+p.x+'~'+p.y+'~0~#000080~~'+p.size+'pt~normal~normal~~comment~'+clean(p.text)+'~1~start~'+textId+'~0');
        source=apply(source);return {source:source,added_ids:[textId]};
      } else if(action==='add_power') {
        var kind=p.kind==='gnd'?'netLabel_gnD':p.kind==='vcc'?'netLabel_VCC':'netLabel_netPort';
        var jsonBefore=api('getSource',{type:'json'}), idsBefore=Object.keys(jsonBefore.netflag||{});
        api('createShape',{shapeType:kind,x:p.x,y:p.y,rotation:p.rotation});
        var jsonAfter=api('getSource',{type:'json'});
        var newIds=Object.keys(jsonAfter.netflag||{}).filter(function(k){return idsBefore.indexOf(k)<0;});
        if(newIds.length!==1)throw new Error('Não foi possível identificar a flag inserida.');
        if(p.name)api('updateShape',{shapeType:'netflag',jsonCache:{gId:newIds[0],mark:{netFlagString:clean(p.name)}}});
        source=read();return {source:source,added_ids:newIds};
      } else if(action==='move') {
        p.ids.forEach(function(k){if(!findId(source,k))throw new Error('ID não encontrado: '+k);});
        api('moveObjs',{objs:p.ids,addX:p.dx,addY:p.dy});source=read();
      } else if(action==='rotate') {
        p.ids.forEach(function(k){if(!findId(source,k))throw new Error('ID não encontrado: '+k);});
        api('rotate',{ids:p.ids,degree:p.degrees});source=read();
      } else if(action==='delete') {
        p.ids.forEach(function(k){if(!findId(source,k))throw new Error('ID não encontrado: '+k);});
        source.shape=source.shape.filter(function(s){return p.ids.indexOf(shapeId(s))<0;});source=apply(source);
        if(p.ids.some(function(k){return findId(source,k);}))throw new Error('O EasyEDA não confirmou a remoção.');
      } else if(action==='apply_source') {
        var replacement=unpack(p.source);requireSchematic(source);requireSchematic(replacement);source=apply(replacement);
      } else throw new Error('Operação não permitida: '+action);
      return {source:source};
    };
  }
  root.EasyEDAStdRuntime={createHandler:createHandler,summary:summary,requireSchematic:requireSchematic,validatePoints:validatePoints};
}(typeof window==='undefined'?globalThis:window));
