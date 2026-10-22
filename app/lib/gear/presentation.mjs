export function itemIcon(path,quality){
 if(!path)return '';
 const normal=path.replace('/hq/','/');
 const asset=quality==='HQ'?normal.replace(/\/([^/]+\.tex)$/,'/hq/$1'):normal;
 return 'https://v2.xivapi.com/api/asset?format=png&path='+encodeURIComponent(asset);
}
