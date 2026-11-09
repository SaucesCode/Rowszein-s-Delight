// Phase 0 only: inspect existing source and reproduce date formatting behavior.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../frontend/node_modules/typescript/lib/typescript.js';
import { getDateRange } from '../../frontend/src/lib/dateRanges.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = path.join(root, 'frontend/src');
const realDate = Date;
process.env.TZ = 'Asia/Manila';
function at(iso) {
  globalThis.Date = class extends realDate {
    constructor(...args) { super(...(args.length ? args : [iso])); }
    static now() { return new realDate(iso).getTime(); }
  };
}
at('2026-11-09T12:00:00+08:00');
const month = getDateRange('this_month');
at('2026-11-09T07:00:00+08:00');
const today = getDateRange('today');
globalThis.Date = realDate;
const files = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(p)) files.push(p);
  }
}
walk(src);
const graph = new Map();
const packages = new Set();
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const ast = ts.createSourceFile(f, content, ts.ScriptTarget.Latest, true);
  const refs = [];
  for (const statement of ast.statements) {
    if (!(ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) || !statement.moduleSpecifier) continue;
    const spec = statement.moduleSpecifier.text;
    if (!spec?.startsWith('.') && !spec?.startsWith('@/')) {
      if (spec) packages.add(spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]);
      continue;
    }
    const base = spec.startsWith('@/') ? path.join(src, spec.slice(2)) : path.resolve(path.dirname(f), spec);
    const resolved = [base, base+'.ts', base+'.tsx', base+'.css', path.join(base,'index.ts'), path.join(base,'index.tsx')].find(p=>files.includes(p));
    if (resolved) refs.push(resolved);
  }
  graph.set(f, refs);
}
const reachable = new Set();
function visit(file) { if (reachable.has(file)) return; reachable.add(file); for (const p of graph.get(file)||[]) visit(p); }
visit(path.join(src, 'main.tsx'));
const result = {
  date_probes: {month_expected_start:'2026-11-01',month_actual:month,today_expected:'2026-11-09',today_actual:today},
  source_files: files.length,
  not_reachable_from_main: files.filter(f=>!reachable.has(f)).map(f=>path.relative(root,f).replaceAll('\\','/')),
  imported_packages: [...packages].sort(),
  notes:'Import reachability is a removal candidate list, not proof every listed asset/type is unused. Date probes assert existing defects.'
};
if (month.date_from !== '2026-10-31' || today.date_from !== '2026-11-08') throw Error('Date behavior differs from audit expectation');
fs.writeFileSync(path.join(root,'docs/audit/evidence/frontend-probes.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
