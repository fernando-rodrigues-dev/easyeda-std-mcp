import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeId,withoutObjects} from '../src/source.mjs';
const component='LIB~200~140~package`R0805`~0~0~gge1#@$T~P~200~120~0~#000080~~9pt~normal~normal~~comment~R1~1~start~gge2#@$P~show~0~1~180~140~180~gge3^^180~140';
const flag='F~part_netLabel_gnD~330~110~~gge4^^330~110^^GND~#000080~319~97~0~start~0~~9pt^^PL~330 120 330 110~#000~1~0~none~gge5';
const source={head:{docType:'1'},canvas:'original',shape:[component,flag,'W~100 100 200 100~#008800~1~0~none~gge6~0','T~L~100~100~0~#000080~~9pt~normal~normal~~comment~gge1~1~start~gge7~0']};
test('deletes only the requested top-level IDs and preserves other shapes and metadata',()=>{
  const result=withoutObjects(source,['gge1','gge4']);
  assert.deepEqual(result.shape,source.shape.slice(2));assert.deepEqual(result.head,source.head);assert.equal(result.canvas,'original');assert.equal(source.shape.length,4);
  assert.equal(shapeId(result.shape[1]),'gge7');
});
test('rejects nested component and flag IDs rather than silently deleting parents',()=>{
  for(const id of ['gge2','gge3','gge5','gge999'])assert.throws(()=>withoutObjects(source,[id]),/não encontrado/);
});
