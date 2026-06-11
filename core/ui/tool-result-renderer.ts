import type { ToolCardResult } from '../types';
import type { ArtifactOutput } from '../artifact';
import { runBrowserSandbox } from '../sandbox';
import type { SandboxApprovalOutput, SandboxExecutionResult } from '../sandbox';

export type ToolResultRenderer = (input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}) => boolean;

const renderers: ToolResultRenderer[] = [];

export function registerToolResultRenderer(renderer: ToolResultRenderer): void {
  if (!renderers.includes(renderer)) renderers.push(renderer);
}

export function renderToolResultWithRegistry(input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}): boolean {
  for (const renderer of renderers) {
    if (renderer(input)) return true;
  }
  return false;
}

export function registerDefaultToolResultRenderers(): void {
  registerToolResultRenderer(renderArtifactResult);
  registerToolResultRenderer(renderSandboxApprovalResult);
  registerToolResultRenderer(renderSkillDraftResult);
  registerToolResultRenderer(renderMemoryImportPreviewResult);
}

function renderSandboxApprovalResult(input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}): boolean {
  const approval = getSandboxApprovalOutput(input.result.output);
  if (!approval) return false;

  const wrapper = createResultPanel('dpp-sandbox-result');
  const meta = document.createElement('div');
  meta.className = 'dpp-result-meta';
  meta.textContent = `${approval.language} · ${approval.timeoutMs}ms`;
  const code = document.createElement('pre');
  code.className = 'dpp-result-code';
  code.textContent = approval.code;
  const output = document.createElement('pre');
  output.className = 'dpp-result-output';
  output.hidden = true;
  const button = createSmallButton('Run after review');
  button.addEventListener('click', () => {
    void runApprovedSandbox(approval, input.sendMessage, button, output);
  });
  wrapper.append(meta, code, button, output);
  input.target.appendChild(wrapper);
  ensureResultStyles();
  return true;
}

async function runApprovedSandbox(
  approval: SandboxApprovalOutput,
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>,
  button: HTMLButtonElement,
  output: HTMLPreElement,
): Promise<void> {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Running...';
  output.hidden = false;
  output.textContent = '';

  try {
    const result = approval.language === 'python'
      ? await sendMessage<ToolCardResult>({
        type: 'RUN_APPROVED_SANDBOX',
        payload: {
          language: approval.language,
          code: approval.code,
          input: approval.input,
          timeoutMs: approval.timeoutMs,
        },
      })
      : await runBrowserSandbox({
        language: approval.language,
        code: approval.code,
        userInput: approval.input,
        timeoutMs: approval.timeoutMs,
      });
    output.textContent = formatSandboxResult(result);
    button.textContent = 'Run again';
  } catch (error) {
    output.textContent = error instanceof Error ? error.message : String(error);
    button.textContent = 'Failed';
  } finally {
    button.disabled = false;
    setTimeout(() => {
      if (button.textContent === 'Failed') button.textContent = previous;
    }, 2000);
  }
}

function renderSkillDraftResult(input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}): boolean {
  const draft = getSkillDraftOutput(input.result.output);
  if (!draft) return false;

  const wrapper = createResultPanel('dpp-skill-draft-result');
  const meta = document.createElement('div');
  meta.className = 'dpp-result-meta';
  meta.textContent = `/${draft.draft.name} · ${draft.draft.memoryEnabled ? 'memory on' : 'memory off'}`;
  const description = document.createElement('div');
  description.className = 'dpp-result-text';
  description.textContent = draft.draft.description;
  const button = createSmallButton('Save Skill');
  button.addEventListener('click', () => {
    void saveSkillDraft(draft.draft, input.sendMessage, button);
  });
  wrapper.append(meta, description, button);
  input.target.appendChild(wrapper);
  ensureResultStyles();
  return true;
}

async function saveSkillDraft(
  draft: unknown,
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>,
  button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Saving...';
  try {
    const result = await sendMessage<{ ok?: boolean; error?: string }>({
      type: 'SAVE_SKILL',
      payload: draft,
    });
    if (result?.ok === false) throw new Error(result.error || 'Save failed');
    button.textContent = 'Saved';
  } catch (error) {
    button.textContent = error instanceof Error ? error.message : 'Save failed';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = previous;
    }, 2000);
  }
}

function renderMemoryImportPreviewResult(input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}): boolean {
  const preview = getMemoryImportPreviewOutput(input.result.output);
  if (!preview) return false;

  const wrapper = createResultPanel('dpp-memory-import-result');
  const meta = document.createElement('div');
  meta.className = 'dpp-result-meta';
  meta.textContent = `${preview.memories.length} memories · ${preview.duplicates} duplicates`;
  const list = document.createElement('div');
  list.className = 'dpp-result-text';
  list.textContent = preview.memories.slice(0, 5).map((memory) => `- ${memory.name}`).join('\n');
  const button = createSmallButton('Import memories');
  button.disabled = preview.memories.length === 0;
  button.addEventListener('click', () => {
    void importMemoryDrafts(preview.memories, input.sendMessage, button);
  });
  wrapper.append(meta, list, button);
  input.target.appendChild(wrapper);
  ensureResultStyles();
  return true;
}

async function importMemoryDrafts(
  memories: unknown[],
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>,
  button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Importing...';
  try {
    const result = await sendMessage<{ ok?: boolean; count?: number; error?: string }>({
      type: 'IMPORT_MEMORY_DRAFTS',
      payload: { memories },
    });
    if (result?.ok === false) throw new Error(result.error || 'Import failed');
    button.textContent = `Imported ${result?.count ?? memories.length}`;
  } catch (error) {
    button.textContent = error instanceof Error ? error.message : 'Import failed';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = previous;
    }, 2000);
  }
}

function renderArtifactResult(input: {
  target: HTMLElement;
  result: ToolCardResult;
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>;
}): boolean {
  const artifact = getArtifactOutput(input.result.output);
  if (!artifact) return false;

  const wrapper = document.createElement('div');
  wrapper.className = 'dpp-artifact-result';
  const meta = document.createElement('div');
  meta.className = 'dpp-artifact-meta';
  meta.textContent = `${artifact.filename} · ${formatBytes(artifact.sizeBytes)}${artifact.fileCount ? ` · ${artifact.fileCount} files` : ''}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dpp-artifact-download';
  button.textContent = 'Download';
  button.addEventListener('click', () => {
    void downloadArtifact(artifact, input.sendMessage, button);
  });
  wrapper.append(meta, button);
  input.target.appendChild(wrapper);
  ensureArtifactStyles();
  return true;
}

async function downloadArtifact(
  artifact: ArtifactOutput,
  sendMessage: <T = unknown>(message: unknown) => Promise<T | undefined>,
  button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Downloading...';
  try {
    const record = await sendMessage<{ ok?: boolean; artifact?: { filename: string; mimeType: string; content: string; kind: string } }>({
      type: 'GET_ARTIFACT',
      payload: { id: artifact.artifactId },
    });
    if (!record?.artifact) throw new Error('Artifact not found');
    const content = record.artifact.kind === 'bundle'
      ? base64ToBlob(record.artifact.content, record.artifact.mimeType)
      : new Blob([record.artifact.content], { type: record.artifact.mimeType });
    const url = URL.createObjectURL(content);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = record.artifact.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    button.textContent = 'Downloaded';
  } catch (error) {
    button.textContent = error instanceof Error ? error.message : 'Download failed';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = previous;
    }, 2000);
  }
}

function getArtifactOutput(value: unknown): ArtifactOutput | null {
  if (!value || typeof value !== 'object') return null;
  const output = value as ArtifactOutput;
  if (output.kind !== 'artifact') return null;
  if (typeof output.artifactId !== 'string' || typeof output.filename !== 'string') return null;
  if (typeof output.mimeType !== 'string' || typeof output.sizeBytes !== 'number') return null;
  return output;
}

function getSandboxApprovalOutput(value: unknown): SandboxApprovalOutput | null {
  if (!value || typeof value !== 'object') return null;
  const output = value as SandboxApprovalOutput;
  if (output.kind !== 'sandbox_approval') return null;
  if (output.language !== 'javascript' && output.language !== 'typescript' && output.language !== 'python') return null;
  if (typeof output.code !== 'string' || typeof output.timeoutMs !== 'number') return null;
  return output;
}

function getSkillDraftOutput(value: unknown): { kind: 'skill_draft'; draft: { name: string; description: string; instructions: string; memoryEnabled: boolean } } | null {
  if (!value || typeof value !== 'object') return null;
  const output = value as { kind?: unknown; draft?: unknown };
  if (output.kind !== 'skill_draft' || !output.draft || typeof output.draft !== 'object') return null;
  const draft = output.draft as { name?: unknown; description?: unknown; instructions?: unknown; memoryEnabled?: unknown };
  if (typeof draft.name !== 'string' || typeof draft.description !== 'string' || typeof draft.instructions !== 'string') return null;
  return value as { kind: 'skill_draft'; draft: { name: string; description: string; instructions: string; memoryEnabled: boolean } };
}

function getMemoryImportPreviewOutput(value: unknown): { kind: 'memory_import_preview'; memories: Array<{ name: string }>; duplicates: number; rejected: number } | null {
  if (!value || typeof value !== 'object') return null;
  const output = value as { kind?: unknown; memories?: unknown; duplicates?: unknown; rejected?: unknown };
  if (output.kind !== 'memory_import_preview' || !Array.isArray(output.memories)) return null;
  if (typeof output.duplicates !== 'number' || typeof output.rejected !== 'number') return null;
  return value as { kind: 'memory_import_preview'; memories: Array<{ name: string }>; duplicates: number; rejected: number };
}

function formatSandboxResult(result: unknown): string {
  const value = result && typeof result === 'object' ? result as Partial<SandboxExecutionResult & ToolCardResult> : {};
  const lines = [
    `ok: ${value.ok === true}`,
    value.summary ? `summary: ${value.summary}` : '',
    value.detail ? `detail: ${value.detail}` : '',
    value.stdout ? `stdout:\n${value.stdout}` : '',
    value.stderr ? `stderr:\n${value.stderr}` : '',
    value.result ? `result:\n${value.result}` : '',
    value.output ? `output:\n${typeof value.output === 'string' ? value.output : JSON.stringify(value.output, null, 2)}` : '',
    value.error ? `error: ${typeof value.error === 'string' ? value.error : JSON.stringify(value.error)}` : '',
  ];
  return lines.filter(Boolean).join('\n\n');
}

function createResultPanel(className: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = `dpp-rich-result ${className}`;
  return wrapper;
}

function createSmallButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dpp-result-action';
  button.textContent = text;
  return button;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ensureArtifactStyles(): void {
  ensureResultStyles();
}

function ensureResultStyles(): void {
  if (document.getElementById('dpp-artifact-result-css')) return;
  const style = document.createElement('style');
  style.id = 'dpp-artifact-result-css';
  style.textContent = `
.dpp-artifact-result,
.dpp-rich-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(77, 107, 254, 0.18);
  border-radius: 8px;
  background: rgba(77, 107, 254, 0.06);
}
.dpp-artifact-meta {
  min-width: 0;
  font-size: 12px;
  color: #1D1D1F;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dpp-rich-result {
  display: block;
}
.dpp-result-meta {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #1D1D1F;
}
.dpp-result-text {
  margin-top: 6px;
  white-space: pre-wrap;
  font-size: 12px;
  color: #3F3F46;
}
.dpp-result-code,
.dpp-result-output {
  margin: 8px 0 0;
  max-height: 160px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.05);
  color: #1D1D1F;
  font-size: 11px;
  line-height: 1.45;
  padding: 8px;
}
.dpp-result-action,
.dpp-artifact-download {
  border: 0;
  border-radius: 7px;
  background: #4D6BFE;
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 9px;
  cursor: pointer;
}
.dpp-result-action {
  margin-top: 8px;
}
.dpp-result-action:disabled,
.dpp-artifact-download:disabled {
  opacity: 0.65;
  cursor: default;
}
body.dpp-theme-dark .dpp-artifact-meta { color: #F5F5F5; }
body.dpp-theme-dark .dpp-result-meta { color: #F5F5F5; }
body.dpp-theme-dark .dpp-result-text { color: #D4D4D8; }
body.dpp-theme-dark .dpp-result-code,
body.dpp-theme-dark .dpp-result-output {
  color: #F5F5F5;
  background: rgba(255, 255, 255, 0.08);
}
`;
  document.head.appendChild(style);
}
