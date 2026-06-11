import type { SandboxExecutionResult, SandboxLanguage } from './types';

const WORKER_OUTPUT_LIMIT = 12_000;

export function canRunBrowserSandbox(language: SandboxLanguage): boolean {
  return (language === 'javascript' || language === 'typescript') &&
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined';
}

export function runBrowserSandbox(input: {
  language: SandboxLanguage;
  code: string;
  userInput?: string;
  timeoutMs: number;
}): Promise<SandboxExecutionResult> {
  if (!canRunBrowserSandbox(input.language)) {
    return Promise.resolve({
      ok: false,
      stdout: '',
      stderr: '',
      durationMs: 0,
      truncated: false,
      error: `${input.language} sandbox is not available in this browser context`,
    });
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const workerUrl = URL.createObjectURL(new Blob([createWorkerSource()], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const timeout = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        ok: false,
        stdout: '',
        stderr: 'Sandbox execution timed out.',
        durationMs: Date.now() - startedAt,
        truncated: false,
        error: 'sandbox_timeout',
      });
    }, input.timeoutMs);

    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      const result = normalizeWorkerResult(event.data);
      resolve({
        ...result,
        durationMs: Date.now() - startedAt,
      });
    };
    worker.onerror = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      resolve({
        ok: false,
        stdout: '',
        stderr: event.message,
        durationMs: Date.now() - startedAt,
        truncated: false,
        error: 'sandbox_worker_error',
      });
    };

    worker.postMessage({
      code: input.language === 'typescript' ? stripTypeScriptSyntax(input.code) : input.code,
      input: input.userInput ?? '',
      outputLimit: WORKER_OUTPUT_LIMIT,
    });
  });
}

function normalizeWorkerResult(value: unknown): Omit<SandboxExecutionResult, 'durationMs'> {
  if (!value || typeof value !== 'object') {
    return {
      ok: false,
      stdout: '',
      stderr: 'Invalid sandbox worker result.',
      truncated: false,
      error: 'sandbox_invalid_result',
    };
  }
  const result = value as Partial<SandboxExecutionResult>;
  return {
    ok: result.ok === true,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    result: typeof result.result === 'string' ? result.result : undefined,
    truncated: result.truncated === true,
    error: typeof result.error === 'string' ? result.error : undefined,
  };
}

function stripTypeScriptSyntax(code: string): string {
  return code
    .replace(/^\s*(?:type|interface)\s+[A-Za-z0-9_$]+[\s\S]*?^\s*}\s*;?\s*$/gm, '')
    .replace(/\s+as\s+[A-Za-z0-9_$<>{}[\]|&,\s.]+/g, '')
    .replace(/:\s*[A-Za-z0-9_$<>{}[\]|&,\s.]+(?=\s*[,)=;])/g, '');
}

function createWorkerSource(): string {
  return `
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
self.onmessage = async (event) => {
  const { code, input, outputLimit } = event.data || {};
  const logs = [];
  let truncated = false;
  const push = (level, values) => {
    const line = '[' + level + '] ' + values.map(formatValue).join(' ');
    logs.push(line);
  };
  const consoleProxy = {
    log: (...values) => push('log', values),
    info: (...values) => push('info', values),
    warn: (...values) => push('warn', values),
    error: (...values) => push('error', values),
  };
  try {
    const fn = new AsyncFunction('input', 'console', '"use strict";\\n' + String(code));
    const result = await fn(input, consoleProxy);
    const stdout = limitText(logs.join('\\n'), outputLimit);
    self.postMessage({ ok: true, stdout: stdout.text, stderr: '', result: formatValue(result), truncated: stdout.truncated });
  } catch (error) {
    const stdout = limitText(logs.join('\\n'), outputLimit);
    self.postMessage({
      ok: false,
      stdout: stdout.text,
      stderr: error && error.stack ? String(error.stack) : String(error),
      truncated: stdout.truncated,
      error: 'sandbox_exception',
    });
  }
};
function formatValue(value) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}
function limitText(text, limit) {
  if (text.length <= limit) return { text, truncated: false };
  return { text: text.slice(0, limit) + '\\n...[truncated]', truncated: true };
}
`;
}
