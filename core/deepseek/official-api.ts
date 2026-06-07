import type { ModelType } from '../types';
import { parseSSEChunk, parseSSEData } from '../interceptor/sse-parser';

export const DEEPSEEK_OFFICIAL_API_URL = 'https://api.deepseek.com/chat/completions';
const DEFAULT_MODEL = 'deepseek-v4-flash';
const EXPERT_MODEL = 'deepseek-v4-pro';

export interface OfficialDeepSeekMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface OfficialDeepSeekTurn {
  assistantText: string;
  finished: boolean;
}

export interface OfficialDeepSeekCallbacks {
  onTextChunk?(text: string, fullText: string): void;
  onFinished?(): void;
}

export interface SubmitOfficialDeepSeekInput {
  apiKey: string;
  modelType: ModelType;
  messages: OfficialDeepSeekMessage[];
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

export class DeepSeekOfficialApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepSeekOfficialApiError';
  }
}

export async function submitOfficialDeepSeekStreaming(
  input: SubmitOfficialDeepSeekInput,
  callbacks: OfficialDeepSeekCallbacks,
  signal?: AbortSignal,
): Promise<OfficialDeepSeekTurn> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(input.endpoint ?? DEEPSEEK_OFFICIAL_API_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify(createOfficialDeepSeekRequestBody(input)),
  });

  if (!response.ok) {
    throw new DeepSeekOfficialApiError(await readOfficialApiFailure(response));
  }

  if (!response.body) {
    throw new DeepSeekOfficialApiError('DeepSeek official API response did not include a stream body.');
  }

  return readOfficialApiStream(response, callbacks);
}

export function createOfficialDeepSeekRequestBody(input: Pick<SubmitOfficialDeepSeekInput, 'modelType' | 'messages'>) {
  const expert = input.modelType === 'expert';
  return {
    model: expert ? EXPERT_MODEL : DEFAULT_MODEL,
    messages: input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    stream: true,
    thinking: {
      type: expert ? 'enabled' : 'disabled',
    },
    ...(expert ? { reasoning_effort: 'high' } : {}),
  };
}

async function readOfficialApiStream(
  response: Response,
  callbacks: OfficialDeepSeekCallbacks,
): Promise<OfficialDeepSeekTurn> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const turn: OfficialDeepSeekTurn = { assistantText: '', finished: false };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const boundary = buffer.lastIndexOf('\n\n');
    if (boundary === -1) continue;

    const complete = buffer.slice(0, boundary + 2);
    buffer = buffer.slice(boundary + 2);
    consumeOfficialApiSse(complete, turn, callbacks);
  }

  if (buffer.trim()) {
    consumeOfficialApiSse(buffer, turn, callbacks);
  }

  callbacks.onFinished?.();
  return turn;
}

function consumeOfficialApiSse(
  text: string,
  turn: OfficialDeepSeekTurn,
  callbacks: OfficialDeepSeekCallbacks,
) {
  const events = parseSSEChunk(text);
  for (const event of events) {
    if (event.data === '[DONE]') {
      turn.finished = true;
      continue;
    }

    const parsed = parseSSEData(event.data);
    const newText = extractOfficialApiDeltaText(parsed);
    if (newText) {
      turn.assistantText += newText;
      callbacks.onTextChunk?.(newText, turn.assistantText);
    }

    if (isOfficialApiFinished(parsed)) {
      turn.finished = true;
    }
  }
}

function extractOfficialApiDeltaText(parsed: unknown): string {
  if (!parsed || typeof parsed !== 'object') return '';
  const choices = (parsed as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return '';

  return choices
    .map((choice) => {
      if (!choice || typeof choice !== 'object') return '';
      const delta = (choice as { delta?: unknown }).delta;
      if (!delta || typeof delta !== 'object') return '';
      const content = (delta as { content?: unknown }).content;
      return typeof content === 'string' ? content : '';
    })
    .join('');
}

function isOfficialApiFinished(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const choices = (parsed as { choices?: unknown }).choices;
  return Array.isArray(choices) && choices.some((choice) =>
    choice &&
    typeof choice === 'object' &&
    typeof (choice as { finish_reason?: unknown }).finish_reason === 'string'
  );
}

async function readOfficialApiFailure(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return `DeepSeek official API failed with HTTP ${response.status}.`;

  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message ?? parsed?.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  } catch {}

  return text;
}
