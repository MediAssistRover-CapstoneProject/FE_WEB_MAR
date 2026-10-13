import {parseAst} from 'rolldown/parseAst';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const files=execFileSync('git',['ls-files','src/*.jsx','src/**/*.jsx'],{encoding:'utf8'}).trim().split('\n');
function clean(value){const lines=value.split(/\r\n|\n|\r/);let last=0;lines.forEach((line,i)=>{if(/[^ \t]/.test(line))last=i;});let result='';lines.forEach((line,i)=>{let text=line.replace(/\t/g,' ');if(i)text=text.replace(/^ +/,'');if(i!==lines.length-1)text=text.replace(/ +$/,'');if(text){if(i!==last)text+=' ';result+=text;}});return result;}
for(const file of files){let old;try{old=execFileSync('git',['show','HEAD:'+file],{encoding:'utf8'});}catch{continue;}const spaces=new Map(),ast=parseAst(old,{lang:'jsx'},file);
 const visit=n=>{if(!n||typeof n!=='object')return;if(n.type==='JSXText'&&n.value.trim()){const text=clean(n.value),key=n.value.replace(/\s+/g,' ').trim();if(text!==key)spaces.set(key,text);}for(const [k,v]of Object.entries(n)){if(['start','end','loc','comments'].includes(k))continue;if(Array.isArray(v))v.forEach(visit);else if(typeof v==='object')visit(v);}};visit(ast);
 let source=readFileSync(file,'utf8');for(const [key,value]of spaces)source=source.replaceAll('{vi('+JSON.stringify(key)+')}','{vi('+JSON.stringify(value)+')}');
 source=source.replaceAll('new Intl.DateTimeFormat(undefined,','new Intl.DateTimeFormat(\'vi-VN\',').replaceAll('.toLocaleString()','.toLocaleString(\'vi-VN\')');
 writeFileSync(file,source);
}
