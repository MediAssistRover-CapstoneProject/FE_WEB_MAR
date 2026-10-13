// Mechanical JSX localization. Only display values are wrapped; route keys,
// events, state, API payloads, and form values are deliberately left unchanged.
import {parseAst} from 'rolldown/parseAst';
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {relative,dirname} from 'node:path';
const files=[];function list(dir){for(const f of readdirSync(dir,{withFileTypes:true})){const p=dir+'/'+f.name;if(f.isDirectory())list(p);else if(/\.(jsx|js)$/.test(p)&&!p.includes('/i18n/'))files.push(p);}}list('src');
const literals=new Set();
function cleanJsxText(value){const lines=value.split(/\r\n|\n|\r/);let last=0;lines.forEach((line,i)=>{if(/[^ \t]/.test(line))last=i;});let result='';lines.forEach((line,i)=>{let text=line.replace(/\t/g,' ');if(i)text=text.replace(/^ +/,'');if(i!==lines.length-1)text=text.replace(/ +$/,'');if(text){if(i!==last)text+=' ';result+=text;}});return result;}
for(const file of files){const source=readFileSync(file,'utf8');let ast;try{ast=parseAst(source,{lang:file.endsWith('jsx')?'jsx':'js'},file);}catch(e){console.error(file,e.message);process.exitCode=1;continue;}
  const edits=[];const wrap=node=>{if(!node||node.type==='JSXEmptyExpression')return;const text=source.slice(node.start,node.end);if(text.startsWith('vi('))return;edits.push([node.start,node.start,'vi('],[node.end,node.end,')']);};
  function visit(node,parent){if(!node||typeof node!=='object')return;
    if(node.type==='Literal'&&typeof node.value==='string'&&/[A-Za-z]/.test(node.value)&&node.value.length<350&&!/[{};]|https?:|\.\//.test(node.value))literals.add(node.value);
    if(node.type==='JSXText'&&node.value.trim()){const value=cleanJsxText(node.value);literals.add(value.trim());edits.push([node.start,node.end,'{vi('+JSON.stringify(value)+')}']);}
    if(node.type==='JSXExpressionContainer'&&parent?.type==='JSXElement')wrap(node.expression);
    if(node.type==='JSXAttribute'&&['placeholder','title','alt','aria-label'].includes(node.name?.name)&&node.value){if(node.value.type==='Literal'){edits.push([node.value.start,node.value.end,'{vi('+JSON.stringify(node.value.value)+')}']);}else if(node.value.type==='JSXExpressionContainer')wrap(node.value.expression);}
    if(node.type==='JSXElement'&&node.openingElement.name?.name==='option'&&!node.openingElement.attributes.some(a=>a.name?.name==='value')){const parts=node.children.filter(n=>n.type==='JSXText'&&n.value.trim()||n.type==='JSXExpressionContainer');if(parts.length===1){const p=parts[0];const value=p.type==='JSXText'?JSON.stringify(p.value.trim()):source.slice(p.expression.start,p.expression.end);edits.push([node.openingElement.end-1,node.openingElement.end-1,' value={'+value+'}']);}}
    for(const [k,v]of Object.entries(node)){if(['start','end','loc','comments','raw'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>visit(x,node));else if(v&&typeof v==='object')visit(v,node);}
  }visit(ast,null);
  if(process.argv.includes('--write')&&file.endsWith('.jsx')&&edits.length&&!source.includes("import { vi }")){
    let result=source;for(const [a,b,value]of edits.sort((a,b)=>b[0]-a[0]||b[1]-a[1]))result=result.slice(0,a)+value+result.slice(b);
    let path=relative(dirname(file),'src/i18n/vi.js').replaceAll('\\','/');if(!path.startsWith('.'))path='./'+path;
    writeFileSync(file,"import { vi } from '"+path+"';\n"+result);console.log('Localized render boundary:',file);
  }
}
mkdirSync('.workstation-build',{recursive:true});writeFileSync('.workstation-build/ui-literals.json',JSON.stringify([...literals].sort(),null,2));console.log('Literal inventory:',literals.size);
