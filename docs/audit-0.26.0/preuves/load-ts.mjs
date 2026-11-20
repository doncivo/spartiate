import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const require = spec => {
    if (!spec.startsWith('.')) return createRequire(filename)(spec);
    const stem = path.resolve(path.dirname(filename), spec);
    const found = [stem + '.ts', path.join(stem, 'index.ts'), stem].find(f => fs.existsSync(f) && fs.statSync(f).isFile());
    if (!found) throw new Error('Module absent : ' + spec);
    return load(found);
  };
  vm.runInThisContext('(function(require,module,exports){' + code + '\n})', { filename })(require, module, module.exports);
  return module.exports;
}

export { load };
