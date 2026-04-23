import CodeSnippet from '../models/CodeSnippet.js';
import vm from 'vm';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// ─── PYTHON TRACER ───────────────────────────────────────────────────────────
const PYTHON_TRACER_TEMPLATE = `
import sys, json

_trace = []
_MAX_STEPS = 120
_code_file = CODE_FILE_PLACEHOLDER

def _tracer(frame, event, arg):
    if len(_trace) >= _MAX_STEPS:
        sys.settrace(None)
        return None
    if event == 'line' and frame.f_code.co_filename == _code_file:
        snap = {}
        for k, v in frame.f_locals.items():
            if k.startswith('_'):
                continue
            try:
                if isinstance(v, (int, float, bool, str)):
                    snap[k] = v
                elif isinstance(v, (list, tuple)):
                    snap[k] = list(v)[:20]
                elif isinstance(v, dict):
                    snap[k] = {str(kk): str(vv) for kk, vv in list(v.items())[:10]}
                else:
                    snap[k] = str(v)
            except Exception:
                pass
        _trace.append({'line': frame.f_lineno, 'vars': snap})
    return _tracer

sys.settrace(_tracer)
try:
    with open(_code_file, 'r', encoding='utf-8') as _f:
        _src = _f.read()
    _code_obj = compile(_src, _code_file, 'exec')
    exec(_code_obj, {})
except SystemExit:
    pass
except Exception as e:
    _trace.append({'line': 0, 'vars': {}, 'error': str(e)})
sys.settrace(None)
print(json.dumps(_trace))
`;

async function traceWithPython(code) {
  const tmpDir = os.tmpdir();
  const ts = Date.now();
  const codeFile = path.join(tmpDir, `vca_code_${ts}.py`);
  const runnerFile = path.join(tmpDir, `vca_runner_${ts}.py`);

  // Use forward slashes / raw string for Python path
  const pyPath = codeFile.replace(/\\/g, '/');
  const runner = PYTHON_TRACER_TEMPLATE.replace('CODE_FILE_PLACEHOLDER', JSON.stringify(pyPath));

  try {
    await fs.writeFile(codeFile, code, 'utf8');
    await fs.writeFile(runnerFile, runner, 'utf8');

    const pythonCmds = ['python', 'python3', 'py'];
    let output = null;
    let lastErr = null;

    for (const cmd of pythonCmds) {
      try {
        const { stdout, stderr } = await execAsync(`${cmd} "${runnerFile}"`, { timeout: 10000 });
        output = stdout.trim();
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (output === null) throw new Error('Python not found or error: ' + (lastErr?.stderr || lastErr?.message));
    console.log('[Python raw output first 200]:', output.trim().slice(0, 200));
    const jsonStart = output.indexOf('[');  // FIRST '[' = start of JSON array
    if (jsonStart === -1) throw new Error('No JSON trace from Python. output: ' + output.slice(0, 200));
    return JSON.parse(output.slice(jsonStart));

  } finally {
    try { await fs.unlink(codeFile); } catch (_) {}
    try { await fs.unlink(runnerFile); } catch (_) {}
  }
}

function buildStepsFromTrace(rawTrace, codeLines) {
  const steps = [];
  let prevVars = {};

  for (const entry of rawTrace) {
    if (!entry || entry.line === undefined) continue;

    const lineIdx = entry.line - 1;
    const lineText = (codeLines[lineIdx] || '').trim();
    if (!lineText || lineText.startsWith('#')) continue;

    const currentVars = entry.vars || {};
    let explanation = `Line ${entry.line}: ${lineText}`;
    let changedKey = null;

    for (const [k, v] of Object.entries(currentVars)) {
      // Skip function/class objects
      if (typeof v === 'string' && v.startsWith('<')) continue;
      const prev = prevVars[k];
      if (JSON.stringify(prev) !== JSON.stringify(v)) {
        changedKey = k;
        const displayVal = Array.isArray(v) ? `[${v.join(', ')}]` : String(v);
        explanation = prev === undefined
          ? `Declared "${k}" = ${displayVal}`
          : `Updated "${k}" → ${displayVal}`;
        break;
      }
    }

    if (!changedKey) {
      if (lineText.match(/^if\s+|^elif\s+/)) explanation = `🔀 Condition: ${lineText}`;
      else if (lineText.match(/^for\s+|^while\s+/)) explanation = `🔁 Loop: ${lineText}`;
      else if (lineText.match(/^return\s/)) explanation = `↩ Return: ${lineText.replace(/^return\s+/, '')}`;
      else if (lineText.match(/^def\s+/)) {
        const fn = lineText.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1] || '';
        explanation = `📦 Function defined: ${fn}`;
      }
      else if (lineText.match(/^print\s*\(/)) explanation = `🖨 ${lineText}`;
      else if (entry.error) explanation = `❌ Error: ${entry.error}`;
    }

    prevVars = { ...currentVars };

    // Build variable list — filter out objects/functions
    const variables = Object.entries(currentVars)
      .filter(([, val]) => {
        if (typeof val === 'string' && val.startsWith('<')) return false; // function/obj
        return true;
      })
      .map(([id, val]) => ({
        id,
        label: id,
        type: Array.isArray(val) ? 'array' : 'variable',
        value: Array.isArray(val) ? val.map(String) : String(val),
        highlights: id === changedKey ? (Array.isArray(val) ? [] : []) : []
      }));

    steps.push({
      stepIndex: steps.length,
      explanation,
      activeLine: entry.line,
      variables
    });
  }

  return steps;
}

// ─── JAVASCRIPT INSTRUMENTATION ───────────────────────────────────────────────
const jsBuiltins = new Set(['log','Date','Math','JSON','parseInt','parseFloat','isNaN','isFinite','Array','Object','String','Number','Boolean','RegExp','Map','Set','Promise','console','setTimeout','setInterval','clearTimeout','clearInterval','__trace__','__logs__','__safeCopy','try','catch','finally','for','while','if','else','function','var','let','const','return','class','constructor','this','new','typeof','undefined','null','true','false','continue','break','switch','case','default']);

function instrumentJS(code) {
  let src = code
    .replace(/\bconst\s+/g, 'var ')
    .replace(/\blet\s+/g, 'var ');

  const lines = src.split('\n');
  
  // Find all plausible variable identifiers in the code
  const allIds = [...src.matchAll(/[a-zA-Z_$][a-zA-Z0-9_$]*/g)]
    .map(m => m[0])
    .filter(id => !jsBuiltins.has(id));
  
  const uniqueVars = Array.from(new Set(allIds));
  const snapObjStr = uniqueVars.map(v => `'${v}': (typeof ${v} !== 'undefined' ? __safeCopy(${v}) : '__undef__')`).join(', ');
  
  const out = [];
  let depth = 0;
  const classDepths = new Set();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t || t.startsWith('//')) { out.push(raw); continue; }

    const openMatch = t.match(/\{/g);
    const closeMatch = t.match(/\}/g);
    const ob = openMatch ? openMatch.length : 0;
    const cb = closeMatch ? closeMatch.length : 0;

    if (t.match(/\bclass\b/) && t.includes('{')) {
      classDepths.add(depth + 1);
    }

    const lineContextDepth = depth;
    depth += ob;
    depth -= cb;

    if (cb > 0) {
      Array.from(classDepths).forEach(d => {
        if (depth < d) classDepths.delete(d);
      });
    }

    out.push(raw);

    const isClassBlock = classDepths.has(lineContextDepth);
    const openedClass = classDepths.has(depth) && ob > 0;
    
    if (isClassBlock || openedClass || t === '{' || t === '}' || t === '};' || t === ');') {
      continue;
    }

    if (!t.startsWith('if') && !t.startsWith('for') && !t.startsWith('while')) {
      // Dynamic locals snapshot injection
      out.push(`try { __trace__.push({ lineNum: ${i + 1}, text: ${JSON.stringify(t)}, snap: { ${snapObjStr} }, customLog: (typeof __lastLog !== 'undefined' ? __safeCopy(__lastLog) : null) }); __lastLog = null; } catch(__e) {}`);
    } else {
      out.push(`try { __trace__.push({ lineNum: ${i + 1}, text: ${JSON.stringify(t)}, snap: null, customLog: null }); } catch(__e) {}`);
    }
  }
  return out.join('\n');
}

function buildSandbox() {
  const logs = [];
  const sandbox = {
    __trace__: [], __logs__: logs, __lastLog: null,
    __safeCopy: (v) => {
        if (typeof v === 'function') return '[Function]';
        if (v === '__undef__' || v === undefined) return '__undef__';
        if (typeof v !== 'object' || v === null) return v;
        try { return JSON.parse(JSON.stringify(v)); } catch(e) { return String(v); }
    },
    Date, Math, JSON, parseInt, parseFloat, isNaN, isFinite,
    Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
    console: {
      log: (...a) => logs.push(a.map(String).join(' ')),
      clear: () => {}, error: (...a) => logs.push('ERR: ' + a.join(' ')),
      warn: (...a) => logs.push('WARN: ' + a.join(' ')),
    },
    setTimeout: (fn) => { try { fn(); } catch (_) {} },
    setInterval: (fn) => { try { fn(); } catch (_) {} },
    clearTimeout: () => {}, clearInterval: () => {},
  };
  sandbox.log = (data) => { 
    try { sandbox.__lastLog = data; } catch(e) {} 
  };
  return sandbox;
}

function serializeValue(v) {
  if (v === '__undef__' || v === undefined) return undefined;
  if (Array.isArray(v)) return v.map(i => String(i));
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return String(v);
}

function findArrayDiff(prev, curr) {
  const diffs = [];
  if (!prev || !curr) return diffs;
  for (let i = 0; i < Math.max(prev.length, curr.length); i++) {
    if (prev[i] !== curr[i]) diffs.push(i);
  }
  return diffs;
}

function buildJSSteps(traceArr, logs) {
  const steps = [];
  let prevVars = {};

  for (const entry of traceArr) {
    const { lineNum, text, snap, customLog } = entry;
    if (!text) continue;

    let currentVars = {};
    if (snap) {
        // Filter out undefs
        const validPairs = Object.entries(snap).filter(([, v]) => v !== '__undef__' && v !== undefined && v !== '[Function]');
        currentVars = Object.fromEntries(validPairs);
    } else {
        currentVars = { ...prevVars };
    }

    let changedKey = null;
    let explanation = `Line ${lineNum}: ${text}`;

    if (customLog) {
        if (customLog.action) {
            explanation = `⚡ ${customLog.action.toUpperCase()}: `;
            const parts = [];
            for (const [k, v] of Object.entries(customLog)) {
                if (k === 'action') continue;
                parts.push(`${k}=${Array.isArray(v) ? '[' + v.join(', ') + ']' : v}`);
            }
            explanation += parts.join(', ');
        } else {
            explanation = `📝 Log: ` + JSON.stringify(customLog);
        }
    } else if (snap) {
        for (const [k, v] of Object.entries(currentVars)) {
            const prev = prevVars[k];
            if (JSON.stringify(prev) !== JSON.stringify(v)) {
                changedKey = k;
                const displayVal = Array.isArray(v) ? `[${v.join(', ')}]` : serializeValue(v);
                explanation = prev === undefined
                ? `Declared "${k}" = ${displayVal}`
                : `Updated "${k}" → ${displayVal}`;
                break;
            }
        }
    }

    if (!changedKey) {
        if (text.match(/^if\s+|^else\s+|^elif\s+/)) explanation = `🔀 Condition: ${text}`;
        else if (text.match(/^for\s+|^while\s+/)) explanation = `🔁 Loop: ${text}`;
        else if (text.match(/^return\s/)) explanation = `↩ Return: ${text.replace(/^return\s+/, '')}`;
        else if (text.match(/^function\s+/)) {
            const fn = text.match(/^function\s+([a-zA-Z_][a-zA-Z0-9_]*)/)?.[1] || '';
            explanation = `📦 Function: ${fn}`;
        }
        else if (text.match(/^console\./)) explanation = `🖨 Output logged`;
    }

    prevVars = { ...currentVars };

    const variables = Object.entries(currentVars)
      .map(([id, val]) => {
        return {
          id, label: id,
          type: Array.isArray(val) ? 'array' : 'variable',
          value: serializeValue(val),
          highlights: changedKey === id && Array.isArray(val) && Array.isArray(prevVars[id])
            ? findArrayDiff(prevVars[id], val)
            : []
        };
      });

    steps.push({
      stepIndex: steps.length,
      explanation,
      activeLine: lineNum,
      variables,
    });
  }
  return steps;
}

// ─── MAIN CONTROLLER ─────────────────────────────────────────────────────────
export const analyzeCode = async (req, res) => {
  try {
    const { title, language, code } = req.body;
    const codeLines = code.split('\n');
    let steps = [];

    if (language === 'python') {
      // Run Python tracer
      const rawTrace = await traceWithPython(code);
      steps = buildStepsFromTrace(rawTrace, codeLines);
    } else {
      // Instrument JavaScript
      const instrumentedCode = instrumentJS(code);
      const sandbox = buildSandbox();
      let traceData = [];
      try {
        vm.runInNewContext(instrumentedCode, sandbox, { timeout: 3000 });
        traceData = sandbox.__trace__;
      } catch (err) {
        console.error('JS eval error:', err);
        traceData = sandbox ? sandbox.__trace__ : [];
        if (traceData.length === 0) {
          return res.status(400).json({ error: 'JS eval error: ' + err.message, instrumentedCode });
        }
      }
      steps = buildJSSteps(traceData, sandbox.__logs__);
    }

    if (steps.length === 0) {
      steps.push({ stepIndex: 0, explanation: 'No traceable statements found.', activeLine: 1, variables: [] });
    }

    const newSnippet = new CodeSnippet({ title: title || 'Code Snippet', language: language || 'javascript', code, steps });
    await newSnippet.save();
    res.status(201).json(newSnippet);

  } catch (error) {
    console.error('analyzeCode error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const snippets = await CodeSnippet.find().sort({ createdAt: -1 });
    res.status(200).json(snippets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
