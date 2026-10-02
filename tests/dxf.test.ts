import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseDrawing,visibleDrawing,type DrawingDocument} from '../survey/dxf';
const pairs=(p:Array<string|number>)=>p.join('\n')+'\n';
const text=pairs([0,'SECTION',2,'TABLES',0,'TABLE',2,'LAYER',70,2,0,'LAYER',2,'red',70,0,62,1,0,'LAYER',2,'true',70,0,420,0x123456,62,7,0,'ENDTAB',0,'ENDSEC',0,'SECTION',2,'ENTITIES',
0,'LINE',5,'A',8,'red',10,696900,20,5353800,11,696901,21,5353801,
0,'POINT',5,'B',8,'red',62,5,10,696900,20,5353800,
0,'LINE',5,'C',8,'true',10,696900,20,5353800,11,696901,21,5353801,
0,'POINT',5,'D',8,'red',420,0xabcdef,62,256,10,696900,20,5353800,
0,'TEXT',5,'E',8,'red',62,7,10,696900,20,5353800,40,1,1,'test',
0,'POINT',5,'F',8,'red',62,0,10,696900,20,5353800,
0,'POINT',5,'G',8,'red',420,0,10,696900,20,5353800,
0,'ENDSEC',0,'EOF']);
test('DXF inherits layer colors and gives object ACI/TrueColor precedence for all geometry kinds',()=>{
 const d=parseDrawing(text,'colors.dxf','EPSG:25832');
 assert.deepEqual(d.features.map(f=>f.color),['#ff0000','#0000ff','#123456','#abcdef','var(--s-text)','#ff0000','#000000']);
 assert.equal(d.features[4].kind,'text');
});
test('multiple drawings retain independent layer visibility, CRS and removal',()=>{
 const a:DrawingDocument={...parseDrawing(text,'one.dxf','EPSG:25832'),id:'one',source:text,visible:true,hiddenLayers:[]};
 const b:DrawingDocument={...a,name:'two.dxf',id:'two',hiddenLayers:['red']};
 const docs=[a,b];assert.equal(visibleDrawing(docs)!.features.length,a.features.length+1);
 assert.equal(visibleDrawing([a,{...b,visible:false}])!.features.length,a.features.length);
 assert.equal(visibleDrawing(docs.filter(d=>d.id!=='one'))!.features.length,1);
 assert.equal(a.hiddenLayers.length,0);assert.equal(a.crs,'EPSG:25832');
 assert.equal(visibleDrawing([]),null);
});
if(process.env.DXF_TEST_SOURCE)test('user Munich DXF retains multiple inherited colors and all supported entities',()=>{
 const d=parseDrawing(readFileSync(process.env.DXF_TEST_SOURCE!,'utf8'),'munich.dxf','EPSG:25832');
 assert.equal(d.features.length,746);assert.equal(d.unsupported.length,0);
 const colors=new Set(d.features.map(f=>f.color));assert.equal(colors.size,25);for(const c of ['#ffb020','#ff4d4f','#22d3ee','#000000'])assert.ok(colors.has(c));
});
