import { DEFAULT_LOCALE, translate, type SupportedLocale } from '../i18n';
import type { JsonValue, ToolCall, ToolDescriptor, ToolProviderIdentity, ToolResult } from '../tool/types';
import type { SandboxApprovalOutput, SandboxLanguage, SandboxRunRequest } from './types';

export const SANDBOX_TOOL_PROVIDER: ToolProviderIdentity = {
  kind: 'local',
  id: 'sandbox',
  displayName: 'Browser Sandbox',
  transport: 'in_process',
};

export const SANDBOX_TOOL_NAMES = ['sandbox_run'] as const;
export type SandboxToolName = typeof SANDBOX_TOOL_NAMES[number];

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_CODE_BYTES = 30_000;

export function isSandboxToolName(name: string): name is SandboxToolName {
  return (SANDBOX_TOOL_NAMES as readonly string[]).includes(name);
}

export function createSandboxToolDescriptors(locale: SupportedLocale = DEFAULT_LOCALE): ToolDescriptor[] {
  return [{
    id: 'local:sandbox:sandbox_run',
    provider: SANDBOX_TOOL_PROVIDER,
    name: 'sandbox_run',
    invocationName: 'sandbox_run',
    title: translate(locale, 'tool.sandbox.runTitle'),
    description: translate(locale, 'tool.sandbox.runDescription'),
    inputSchema: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          enum: ['javascript', 'typescript', 'python'],
          description: translate(locale, 'tool.sandbox.languageDescription'),
        },
        code: { type: 'string', description: translate(locale, 'tool.sandbox.codeDescription') },
        input: { type: 'string', description: translate(locale, 'tool.sandbox.inputDescription') },
        timeoutMs: { type: 'integer', description: translate(locale, 'tool.sandbox.timeoutDescription') },
      },
      required: ['language', 'code'],
      additionalProperties: false,
    },
    execution: { mode: 'auto', enabled: true, risk: 'high', maxResultBytes: 4096 },
  }];
}

export async function executeSandboxToolCall(
  call: ToolCall,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<ToolResult> {
  if (!isSandboxToolName(call.name)) {
    return {
      ok: false,
      name: call.name,
      provider: call.provider ?? SANDBOX_TOOL_PROVIDER,
      summary: translate(locale, 'tool.runtime.unknownTool'),
      error: {
        code: 'sandbox_tool_unsupported',
        message: `Unsupported sandbox tool: ${call.name}`,
        retryable: false,
      },
    };
  }

  try {
    const request = normalizeSandboxRunRequest(call.payload);
    const output: SandboxApprovalOutput = {
      kind: 'sandbox_approval',
      requestId: createRequestId(),
      ...request,
    };
    return {
      ok: true,
      name: call.name,
      provider: call.provider ?? SANDBOX_TOOL_PROVIDER,
      summary: translate(locale, 'tool.sandbox.approvalRequired'),
      detail: translate(locale, 'tool.sandbox.approvalDetail'),
      output: output as unknown as JsonValue,
    };
  } catch (error) {
    return {
      ok: false,
      name: call.name,
      provider: call.provider ?? SANDBOX_TOOL_PROVIDER,
      summary: translate(locale, 'tool.sandbox.invalidRequest'),
      detail: error instanceof Error ? error.message : String(error),
      error: {
        code: 'sandbox_invalid_request',
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    };
  }
}

export function normalizeSandboxRunRequest(value: unknown): SandboxRunRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('sandbox payload must be an object');
  }
  const payload = value as Record<string, unknown>;
  const language = normalizeLanguage(payload.language);
  const code = requiredString(payload.code, 'code');
  if (new TextEncoder().encode(code).length > MAX_CODE_BYTES) {
    throw new Error(`code is too large; max ${MAX_CODE_BYTES} bytes`);
  }
  return {
    language,
    code,
    input: typeof payload.input === 'string' ? payload.input : undefined,
    timeoutMs: clampTimeout(payload.timeoutMs),
  };
}

function normalizeLanguage(value: unknown): SandboxLanguage {
  if (value === 'javascript' || value === 'typescript' || value === 'python') return value;
  throw new Error('language must be javascript, typescript, or python');
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function clampTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(15_000, Math.max(1_000, Math.floor(value)));
}

function createRequestId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `sandbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
