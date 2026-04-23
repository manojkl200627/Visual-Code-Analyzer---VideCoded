
const code = `class Student {
    constructor(id) {
        this.id = id;
    }
}
const s = new Student(1);`;

import vm from 'vm';

// Copied from analyzeController to test output directly
function instrumentJS(code) {
  let src = code.replace(/\bconst\s+/g, 'var ').replace(/\blet\s+/g, 'var ');
  const lines = src.split('\n');
  const out = [];
  let depth = 0; const classDepths = new Set();
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]; const t = raw.trim();
    if (!t || t.startsWith('//')) { out.push(raw); continue; }
    const ob = (t.match(/\{/g) || []).length; const cb = (t.match(/\}/g) || []).length;
    if (t.match(/\bclass\b/) && t.includes('{')) { classDepths.add(depth + 1); }
    const lineContextDepth = depth; depth += ob; depth -= cb;
    if (cb > 0) { Array.from(classDepths).forEach(d => { if (depth < d) classDepths.delete(d); }); }
    out.push(raw);
    const isClassBlock = classDepths.has(lineContextDepth);
    const openedClass = classDepths.has(depth) && ob > 0;
    if (isClassBlock || openedClass || t === '{' || t === '}' || t === '};' || t === ');') continue;
    const varMatch = t.match(/^var\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/);
    const assignMatch = !varMatch && t.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=[^=>]/);
    const vn = varMatch?.[1] || assignMatch?.[1];
    if (vn && !t.startsWith('if') && !t.startsWith('for') && !t.startsWith('while')) {
      out.push(`try { __trace__.push({ lineNum: ${i + 1}, text: ${JSON.stringify(t)}, varName: '${vn}', value: typeof ${vn} !== 'undefined' ? ${vn} : '__undef__' }); } catch(__e) {}`);
    } else {
      out.push(`try { __trace__.push({ lineNum: ${i + 1}, text: ${JSON.stringify(t)}, varName: null, value: null }); } catch(__e) {}`);
    }
  }
  return out.join('\n');
}

console.log(instrumentJS(code));
