export interface LocalFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}
export interface LocalDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<LocalFileHandle | LocalDirectoryHandle>;
}
export type DirectoryPicker = (options: {mode:'read';id:string}) => Promise<LocalDirectoryHandle>;
const supported = /\.(kml|kmz|csv|dxf|tif|tiff|zip|jpg|jpeg|png|webp|heic|heif)$/i;

/** Read once, recursively. No network, writes or persisted directory permissions. */
export async function chooseLocalFolder(picker: DirectoryPicker): Promise<File[] | null> {
  let root: LocalDirectoryHandle;
  try { root = await picker({mode:'read',id:'measuremap-local-photos'}); }
  catch (error) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return null;
    throw error;
  }
  const files:File[]=[];
  const pending=[root];
  while(pending.length){
    const directory=pending.pop()!;
    for await(const entry of directory.values()){
      if(entry.name.startsWith('.')||entry.name==='__MACOSX')continue;
      if(entry.kind==='directory')pending.push(entry);
      else if(supported.test(entry.name))files.push(await entry.getFile());
    }
  }
  return files;
}
