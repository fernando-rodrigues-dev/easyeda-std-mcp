// IDs of the top-level shapes created/read by this MCP. Child IDs in LIB/F
// deliberately do not count as independently removable objects.
const idFields={LIB:6,W:6,N:6,F:5,J:5,T:15,O:3,TRACK:5,PAD:12,VIA:6,HOLE:4,TEXT:13,ARC:6,COPPERAREA:7,SOLIDREGION:5,RECT:6,CIRCLE:6,DIMENSION:3};
export function shapeId(shape) {
  const fields=shape.split('#@$')[0].split('^^')[0].split('~');
  const index=idFields[fields[0]];
  return index===undefined ? undefined : fields[index];
}
export function withoutObjects(source,ids) {
  const wanted=new Set(ids), found=new Set();
  const shape=source.shape.filter(s=>{
    const id=shapeId(s);
    if(!wanted.has(id))return true;
    found.add(id);return false;
  });
  for(const id of wanted)if(!found.has(id))throw Error('ID de objeto não encontrado ou tipo não suportado para remoção: '+id);
  return {...source,shape};
}
