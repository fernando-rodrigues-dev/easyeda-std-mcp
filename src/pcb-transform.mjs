import {pcbSummary} from './pcb.mjs';
const format=n=>String(Number(Number(n).toFixed(6)));
const swapLayer=l=>({'1':'2','2':'1','3':'4','4':'3','5':'6','6':'5','7':'8','8':'7'})[l]||l;
function mirrorPoints(s,x){if(!s)return s;const a=s.trim().split(/[ ,]+/).map(Number);for(let i=0;i<a.length;i+=2)a[i]=2*x-a[i];return a.map(format).join(' ');}
function mirrorPath(s,x){
 if(!s)return s;const tokens=s.match(/[a-df-zA-DF-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[],counts={M:2,L:2,H:1,V:1,C:6,S:4,Q:4,T:2,A:7,Z:0},out=[];let i=0,cmd;
 while(i<tokens.length){if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];const c=cmd.toUpperCase(),n=counts[c];if(n===undefined)throw Error('Comando SVG não suportado: '+cmd);if(!n){out.push(cmd);continue;}const a=tokens.slice(i,i+n).map(Number);i+=n;if(a.length!==n||a.some(n=>!Number.isFinite(n)))throw Error('Caminho SVG inválido.');const rel=cmd!==c;
  if(c==='H')a[0]=rel?-a[0]:2*x-a[0];else if(c==='V'){}else if(c==='A'){a[2]=-a[2];a[4]=1-a[4];a[5]=rel?-a[5]:2*x-a[5];}else for(let j=0;j<a.length;j+=2)a[j]=rel?-a[j]:2*x-a[j];out.push(cmd,...a.map(format));if(c==='M')cmd=rel?'l':'L';
 }return out.join(' ');
}
export function flipFootprint(source,component,side){
 const result=structuredClone(source),r=pcbSummary(source),cs=r.components.filter(c=>c.id===component||c.reference===component);if(cs.length!==1)throw Error('Footprint não encontrado ou ambíguo.');const c=cs[0],wanted=side==='bottom'?'2':'1';if(c.layer===wanted)return result;
 const at=result.shape.findIndex(s=>s.startsWith('LIB~')&&s.split('#@$')[0].split('~')[6]===c.id),parts=result.shape[at].split('#@$'),h=parts[0].split('~');if(h[10]==='1')throw Error('Footprint bloqueado.');
 if(r.single_sided&&side!=='bottom')throw Error('Face simples: SMD deve permanecer no BottomLayer.');
 h[4]=format((360-Number(h[4]||0))%360);h[7]=wanted;
 const children=parts.slice(1).filter(s=>!s.startsWith('SVGNODE~')).map(raw=>{const a=raw.split('~'),k=a[0];
  if(k==='PAD'){a[2]=format(2*c.x-Number(a[2]));a[6]=swapLayer(a[6]);a[10]=mirrorPoints(a[10],c.x);a[11]=format((180-Number(a[11]||0)+360)%360);a[14]=mirrorPoints(a[14],c.x);}
  else if(k==='TRACK'){a[2]=swapLayer(a[2]);a[4]=mirrorPoints(a[4],c.x);}
  else if(k==='TEXT'){a[2]=format(2*c.x-Number(a[2]));a[5]=format((180-Number(a[5]||0)+360)%360);a[7]=swapLayer(a[7]);a[11]=mirrorPath(a[11],c.x);}
  else if(k==='ARC'){a[2]=swapLayer(a[2]);a[4]=mirrorPath(a[4],c.x);}
  else if(k==='CIRCLE'){a[1]=format(2*c.x-Number(a[1]));a[5]=swapLayer(a[5]);}
  else if(k==='RECT'){a[1]=format(2*c.x-Number(a[1])-Number(a[3]));a[5]=swapLayer(a[5]);}
  else if(k==='HOLE'||k==='VIA'){a[1]=format(2*c.x-Number(a[1]));}
  else if(k==='SOLIDREGION'){a[1]=swapLayer(a[1]);a[3]=mirrorPoints(a[3],c.x);}
  else if(k==='COPPERAREA')throw Error('Footprint com área de cobre interna: alterar a face pelo editor nativo.');
  else throw Error('Objeto do footprint não suportado para espelhamento: '+k);
  return a.join('~');
 });
 result.shape[at]=h.join('~')+'#@$'+children.join('#@$');delete result.BBox;return result;
}
