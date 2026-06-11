export type SandboxLanguage = 'javascript' | 'typescript' | 'python';

export interface SandboxRunRequest {
  language: SandboxLanguage;
  code: string;
  input?: string;
  timeoutMs: number;
}

export interface SandboxApprovalOutput extends SandboxRunRequest {
  kind: 'sandbox_approval';
  requestId: string;
}

export interface SandboxExecutionResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  result?: string;
  durationMs: number;
  truncated: boolean;
  error?: string;
}
