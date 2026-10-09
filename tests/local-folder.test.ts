import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseLocalFolder,type LocalDirectoryHandle,type LocalFileHandle} from '../survey/localFolder';
function file(name:string):LocalFileHandle{
 return {kind:'file',name,async getFile(){return new File(['synthetic'],name,{lastModified:1000});}};
}
function directory(name:string,entries:Array<LocalDirectoryHandle|LocalFileHandle>):LocalDirectoryHandle{
 return {kind:'directory',name,async *values(){yield* entries;}};
}
test('folder selection requests read-only access and reads supported nested files, not unrelated contents',async()=>{
 const forbidden:LocalFileHandle={kind:'file',name:'private.txt',async getFile(){throw new Error('Must not read');}};
 const root=directory('survey',[file('photo.JPG'),file('points.csv'),file('plan.dxf'),forbidden,directory('nested',[file('ortho.tif'),file('mission.kmz')]),directory('__MACOSX',[file('junk.jpg')]),file('.hidden.jpg')]);
 const files=await chooseLocalFolder(async options=>{assert.deepEqual(options,{mode:'read',id:'measuremap-local-photos'});return root;});
 assert.deepEqual(files?.map(f=>f.name),['photo.JPG','points.csv','plan.dxf','ortho.tif','mission.kmz']);
 assert.ok(files?.every(f=>f.lastModified===1000));
});
test('cancel does not read a folder or initiate an alternate picker',async()=>{
 assert.equal(await chooseLocalFolder(async()=>{throw new DOMException('cancelled','AbortError');}),null);
});
test('permission and file read failures propagate, never yielding a partial import',async()=>{
 await assert.rejects(chooseLocalFolder(async()=>{throw new DOMException('denied','NotAllowedError');}),{name:'NotAllowedError'});
 await assert.rejects(chooseLocalFolder(async()=>directory('survey',[file('ok.jpg'),{kind:'file',name:'missing.jpg',async getFile(){throw new Error('unreadable');}}])),/unreadable/);
});
test('no supported files yields an empty result',async()=>{
 assert.deepEqual(await chooseLocalFolder(async()=>directory('empty',[])),[]);
});
