// Read-only contract extraction: stdout is the generated frontend snapshot.
// Match the running OpenAPI to checked-out BE controllers before accepting it.
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(process.argv[2] || '../../Be/BE_MAR');
const url = process.env.OPENAPI_URL || 'http://localhost:8080/v3/api-docs';
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(resolve(dir, e.name)) : resolve(dir, e.name)))).flat();
}
const source = new Map();
for (const file of await files(resolve(root, 'src/main/java/com/mediassistrover/backend/controller'))) {
  if (!file.endsWith('.java')) continue;
  const text = await readFile(file, 'utf8');
  const classIndex = text.indexOf('public class ');
  const header = text.slice(0, classIndex);
  const base = header.match(/@RequestMapping\(\s*"([^"]+)"/)?.[1] || '';
  const classAuth = header.match(/@PreAuthorize\("([^"]+)"\)/)?.[1] || '';
  const pattern = /@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^\n]*?)\))?([\s\S]*?)(?=@(?:Get|Post|Put|Patch|Delete)Mapping|$)/g;
  for (const m of text.slice(classIndex).matchAll(pattern)) {
    const path = base + (m[2]?.match(/"([^"]*)"/)?.[1] || '');
    const auth = m[3].match(/@PreAuthorize\("([^"]+)"\)/)?.[1] || classAuth;
    const roles = [...auth.matchAll(/'(ADMIN|STAFF)'/g)].map(x => x[1]);
    source.set(`${m[1].toUpperCase()} ${path}`, { roles, controller: file.split(/[\\/]/).at(-1) });
  }
}
const response = await fetch(url);
if (!response.ok) throw Error(`OpenAPI returned ${response.status}`);
const spec = await response.json();
const operations = {};
const excluded = [];
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, item] of Object.entries(methods)) {
    if (!item.operationId) continue;
    const key = `${method.toUpperCase()} ${path}`;
    const origin = source.get(key);
    if (!origin) throw Error(`Running OpenAPI does not match BE source: ${key}`);
    if (path.startsWith('/api/v1/pi/')) { excluded.push({ key, reason: 'DEVICE_ONLY' }); continue; }
    const success = Object.entries(item.responses || {}).find(([code]) => /^2/.test(code))?.[1];
    operations[key] = {
      method: method.toUpperCase(), path, roles: origin.roles,
      operationId: item.operationId, deprecated: item.deprecated || false,
      parameters: item.parameters || [], body: item.requestBody,
      response: success, summary: item.summary, description: item.description,
      public: path.startsWith('/api/v1/public/'),
    };
  }
}
const missing = [...source.keys()].filter(key => !key.includes('/pi/') && !operations[key]);
if (missing.length) throw Error(`Running BE is missing source operations: ${missing.join(', ')}`);
const referenced = new Set();
function refs(value) {
  if (!value || typeof value !== 'object') return;
  if (value.$ref?.startsWith('#/components/schemas/')) {
    const name = value.$ref.split('/').at(-1);
    if (!referenced.has(name)) { referenced.add(name); refs(spec.components.schemas[name]); }
  }
  Object.values(value).forEach(refs);
}
refs(operations);
const schemas = Object.fromEntries([...referenced].sort().map(name => [name, spec.components.schemas[name]]));
console.log(JSON.stringify({
  source: { repository: 'BE_MAR', branch: 'main', commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() },
  operations, schemas, excluded,
}, null, 2));
