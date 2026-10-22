export function validTreeView(value){
 return !!value&&Number.isFinite(value.zoom)&&value.zoom>=.2&&value.zoom<=1.5&&['left','top'].every(k=>Number.isFinite(value[k])&&value[k]>=0&&value[k]<=10000000);
}
