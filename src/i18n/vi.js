import { catalog } from './viCatalog.js';
import { backendMessages } from './backendLabels.js';
const combinedCatalog = { ...catalog, ...backendMessages };
const messages=new Map(Object.entries(combinedCatalog).map(([key,value])=>[key.toLowerCase(),value]));
// Translate display values only; do not change state, routes or API payloads.
export function vi(value){
  if(Array.isArray(value))return value.map(vi);
  if(typeof value!=='string')return value;
  value=value.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const key=value.trim(),translated=combinedCatalog[key]??messages.get(key.toLowerCase());
  if(translated!==undefined)return (value.match(/^\s*/)?.[0]||'')+translated+(value.match(/\s*$/)?.[0]||'');
  const patterns=[
    [/^Enter (.+)$/i,(_,field)=>'Nhập '+vi(field)],
    [/^May (\d+)$/i,(_,n)=>n+' tháng 5'],
    [/^(Delivery|Escort|Patrol) ([#A-Z0-9-]+)$/i,(_,name,id)=>vi(name)+' '+id],
    [/^(\d+) records$/i,(_,n)=>n+' bản ghi'],
    [/^(\d+[–-]\d+) of (\d+)$/i,(_,range,n)=>range+' trên '+n],
    [/^Level (\d+)$/i,(_,n)=>'Tầng '+n],
    [/^Loading (.+?)(?:…|\.{3})?$/i,(_,s)=>'Đang tải '+vi(s)+'…'],
    [/^Unable to load (.+?)\.$/i,(_,s)=>'Không thể tải '+vi(s)+'.'],
    [/^(\d+) (minutes?|hours?|days?) ago$/i,(_,n,u)=>n+' '+({minute:'phút',hour:'giờ',day:'ngày'}[u.toLowerCase().replace(/s$/,'')])+' trước'],
    [/^Room (\d+)$/i,(_,n)=>'Phòng '+n],
    [/^Floor (\d+)$/i,(_,n)=>'Tầng '+n],
    [/^Hospital Floor (\d+)$/i,(_,n)=>'Bệnh viện · tầng '+n],
    [/^Corner (\d+) ([XY])$/i,(_,n,axis)=>'Đỉnh '+n+' '+axis],
    [/^Edit (zone|endpoint) (.+)$/i,(_,t,name)=>'Sửa '+vi(t)+' '+name],
    [/^(Saved zones|Saved endpoints|Workflow definitions|Workflow templates)\s*·\s*(\d+)$/i,(_,t,n)=>vi(t)+' · '+n],
    [/^(\d+)% Battery$/i,(_,n)=>'Pin '+n+'%'],
    [/^(\d+) (steps|tasks|endpoints|zones|robots|missions|jobs|people|persons)$/i,(_,n,s)=>n+' '+vi(s)],
  ];
  for(const [pattern,replace]of patterns)if(pattern.test(key))return key.replace(pattern,replace);
  if(/\s[·→—|•]\s/.test(key))return key.split(/(\s[·→—|•]\s)/).map((part,i)=>i%2?part:vi(part)).join('');
  const decoration=key.match(/^([+←→▶✓●○]\s*)(.+)$/);if(decoration)return decoration[1]+vi(decoration[2]);
  const suffix=key.match(/^(.+?)(\s*[→↗▴›:]|\.{3}|…|\?)$/);if(suffix&&messages.has(suffix[1].toLowerCase()))return vi(suffix[1])+suffix[2];
  return value;
}
