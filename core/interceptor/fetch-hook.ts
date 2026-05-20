import { DEEPSEEK_API_URL, PRESET_REINJECTION_INTERVAL, TOOL_CALLS_BLOCK_REGEX } from '../constants';
import type { Memory, ModelType, SystemPromptPreset, ToolCall } from '../types';
import { buildAugmentedPrompt } from '../memory/injector';
import { parseSkillCommand } from '../skill/parser';
import { extractTextFromParsed, isStreamFinishedFromParsed, parseSSEChunk, parseSSEData } from './sse-parser';
import { extractToolCalls, replaceToolCallsWithSummary, stripToolCalls } from './tool-parser';

const API_PATH = new URL(DEEPSEEK_API_URL).pathname;
const HISTORY_PATH = '/api/v0/chat/history_messages';

interface HookState {
  memories: Memory[];
  skills: Array<{ name: string; instructions: string; memoryEnabled: boolean }>;
  activePreset: SystemPromptPreset | null;
  modelType: ModelType;
  messageCount: number;
  onToolCall: (call: ToolCall) => void;
  onResponseComplete: (fullText: string) => void;
  onMemoriesUsed: (ids: number[]) => void;
}

let hookState: HookState = {
  memories: [],
  skills: [],
  activePreset: null,
  modelType: null,
  messageCount: 0,
  onToolCall: () => {},
  onResponseComplete: () => {},
  onMemoriesUsed: () => {},
};

export function updateHookState(partial: Partial<HookState>) {
  hookState = { ...hookState, ...partial };
}

export function installFetchHook() {
  hookFetch();
  hookXHR();
  hookIndexedDB();
}

function hookFetch() {
  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes(HISTORY_PATH)) {
      return interceptHistoryResponse(originalFetch.call(this, input, init));
    }

    if (!isChatCompletionURL(url) || !init?.body) {
      return originalFetch.call(this, input, init);
    }

    const modified = modifyRequestBody(init.body as string);
    if (!modified) return originalFetch.call(this, input, init);

    init = { ...init, body: modified };
    return interceptFetchResponse(originalFetch.call(this, input, init));
  };
}

function hookXHR() {
  const xhrUrls = new WeakMap<XMLHttpRequest, string>();
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
    xhrUrls.set(this, typeof url === 'string' ? url : url.href);
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const url = xhrUrls.get(this);
    if (url && isChatCompletionURL(url) && typeof body === 'string') {
      const modified = modifyRequestBody(body);
      if (modified) {
        setupXHRResponseInterceptor(this);
        return origSend.call(this, modified);
      }
    }
    if (url && url.includes(HISTORY_PATH)) {
      setupXHRHistoryInterceptor(this);
    }
    return origSend.call(this, body);
  };
}

function isChatCompletionURL(url: string): boolean {
  return url.includes(API_PATH);
}

function modifyRequestBody(bodyStr: string): string | null {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyStr);
  } catch {
    return null;
  }

  const originalPrompt = (body.prompt as string) || '';
  if (!originalPrompt) return null;

  const thinkingEnabled = body.thinking_enabled === true;
  const isFirstMessage = body.parent_message_id === null || body.parent_message_id === undefined;

  if (isFirstMessage) {
    hookState.messageCount = 0;
  }
  hookState.messageCount++;

  const shouldInjectPreset =
    hookState.activePreset &&
    (isFirstMessage || hookState.messageCount % PRESET_REINJECTION_INTERVAL === 0);

  const presetPrefix = shouldInjectPreset
    ? hookState.activePreset!.content + '\n\n---\n\n'
    : '';

  if (hookState.modelType) {
    body.model_type = hookState.modelType;
  }

  const invocation = parseSkillCommand(originalPrompt);
  if (invocation) {
    const resolved = resolveSkills(invocation.skillName, invocation.args);
    if (resolved) {
      let prompt = resolved.combinedPrompt;
      const anyMemoryEnabled = resolved.memoryEnabled;

      if (anyMemoryEnabled) {
        const { augmented } = buildAugmentedPrompt(prompt, hookState.memories, { thinkingEnabled });
        prompt = augmented;
      } else if (hookState.memories.length > 0) {
        const { augmented } = buildAugmentedPrompt(prompt, hookState.memories, {
          thinkingEnabled,
          identityOnly: true,
        });
        prompt = augmented;
      }

      body.prompt = presetPrefix + prompt;
      return JSON.stringify(body);
    }
  }

  const { augmented, usedMemoryIds } = buildAugmentedPrompt(originalPrompt, hookState.memories, {
    thinkingEnabled,
  });
  body.prompt = presetPrefix + augmented;

  if (usedMemoryIds.length > 0) {
    hookState.onMemoriesUsed(usedMemoryIds);
  }

  return JSON.stringify(body);
}

interface ResolvedSkills {
  combinedPrompt: string;
  memoryEnabled: boolean;
}

function wrapUserInput(instructions: string, userInput: string): string {
  return `${instructions}\n\n---\n\n以下是用户本次的输入，请根据上述指令处理：\n\n${userInput}`;
}

function resolveSkills(skillName: string, args: string): ResolvedSkills | null {
  const primarySkill = hookState.skills.find((s) => s.name === skillName);
  if (!primarySkill) return null;

  const secondInvocation = parseSkillCommand('/' + args);
  if (secondInvocation) {
    const secondSkill = hookState.skills.find((s) => s.name === secondInvocation.skillName);
    if (secondSkill) {
      const userArgs = secondInvocation.args;
      const combinedInstructions = primarySkill.instructions + '\n\n---\n\n' + secondSkill.instructions;
      return {
        combinedPrompt: userArgs
          ? wrapUserInput(combinedInstructions, userArgs)
          : combinedInstructions,
        memoryEnabled: primarySkill.memoryEnabled || secondSkill.memoryEnabled,
      };
    }
  }

  return {
    combinedPrompt: args
      ? wrapUserInput(primarySkill.instructions, args)
      : primarySkill.instructions,
    memoryEnabled: primarySkill.memoryEnabled,
  };
}

function notifyNewToolCalls(fullText: string, alreadyNotified: number): number {
  const calls = extractToolCalls(fullText);
  for (let i = alreadyNotified; i < calls.length; i++) {
    hookState.onToolCall(calls[i]);
  }
  return calls.length;
}

// --- SSE stream interception: strip DSML from text events ---

const DSML_OPEN = '<｜DSML｜tool_calls>';
const DSML_CLOSE = '</｜DSML｜tool_calls>';

class DSMLStreamFilter {
  private state: 'NORMAL' | 'SUPPRESSING' = 'NORMAL';
  private pendingText = '';
  private pendingBlocks: string[] = [];
  private encoder = new TextEncoder();

  processChunk(chunk: string, controller: ReadableStreamDefaultController<Uint8Array>) {
    const blocks = chunk.split('\n\n');

    for (const block of blocks) {
      if (!block.trim()) continue;

      const dataLine = block.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) {
        this.emit(controller, block);
        continue;
      }

      const parsed = parseSSEData(dataLine.slice(5).trim());
      if (!parsed) {
        this.emit(controller, block);
        continue;
      }

      const text = extractTextFromParsed(parsed);
      if (text === null) {
        // Non-text event (status updates, BATCH etc.) — always pass through
        this.emit(controller, block);
        continue;
      }

      // Text event — apply state machine
      if (this.state === 'SUPPRESSING') {
        this.pendingText += text;
        if (this.pendingText.includes(DSML_CLOSE)) {
          // DSML block ended
          this.state = 'NORMAL';
          this.pendingText = '';
        }
        // Drop this event
        continue;
      }

      // State: NORMAL
      this.pendingText += text;
      this.pendingBlocks.push(block);

      if (this.pendingText.includes(DSML_OPEN)) {
        // Confirmed DSML start — emit events for text before it, suppress the rest
        this.state = 'SUPPRESSING';
        this.emitBlocksBeforeDSML(controller);
        // Keep pendingText from DSML_OPEN onwards for close detection
        const idx = this.pendingText.indexOf(DSML_OPEN);
        this.pendingText = this.pendingText.slice(idx);
        this.pendingBlocks = [];
        continue;
      }

      // Check if end of pendingText could be the beginning of DSML_OPEN
      if (this.couldBePartialDSMLOpen(this.pendingText)) {
        // Keep buffering
        continue;
      }

      // Safe — flush all pending
      for (const b of this.pendingBlocks) {
        this.emit(controller, b);
      }
      this.pendingBlocks = [];
      this.pendingText = '';
    }
  }

  flush(controller: ReadableStreamDefaultController<Uint8Array>) {
    // Stream ended — flush any remaining buffered events (incomplete DSML prefix = not actually DSML)
    for (const b of this.pendingBlocks) {
      this.emit(controller, b);
    }
    this.pendingBlocks = [];
    this.pendingText = '';
  }

  private emit(controller: ReadableStreamDefaultController<Uint8Array>, block: string) {
    controller.enqueue(this.encoder.encode(block + '\n\n'));
  }

  private emitBlocksBeforeDSML(controller: ReadableStreamDefaultController<Uint8Array>) {
    // Figure out how many characters of text came before DSML_OPEN
    const idx = this.pendingText.indexOf(DSML_OPEN);
    let charsSeen = 0;

    for (const block of this.pendingBlocks) {
      const dataLine = block.split('\n').find(l => l.startsWith('data:'));
      if (!dataLine) {
        this.emit(controller, block);
        continue;
      }
      const parsed = parseSSEData(dataLine.slice(5).trim());
      const text = parsed ? extractTextFromParsed(parsed) : null;
      if (text === null) {
        this.emit(controller, block);
        continue;
      }
      if (charsSeen + text.length <= idx) {
        // This entire event is before DSML — emit it
        this.emit(controller, block);
        charsSeen += text.length;
      } else {
        // This event contains or is after the DSML start — drop it
        break;
      }
    }
  }

  private couldBePartialDSMLOpen(text: string): boolean {
    // Check if the end of text matches a prefix of DSML_OPEN
    const maxLen = Math.min(text.length, DSML_OPEN.length - 1);
    for (let len = maxLen; len > 0; len--) {
      if (DSML_OPEN.startsWith(text.slice(-len))) {
        return true;
      }
    }
    return false;
  }
}

async function interceptFetchResponse(responsePromise: Promise<Response>): Promise<Response> {
  const response = await responsePromise;
  if (!response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const filter = new DSMLStreamFilter();
  let fullText = '';
  let notifiedCount = 0;
  let completed = false;

  const finalizeIfNeeded = () => {
    if (completed) return;
    completed = true;
    notifiedCount = notifyNewToolCalls(fullText, notifiedCount);
    hookState.onResponseComplete(fullText);
  };

  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          filter.flush(controller);
          finalizeIfNeeded();
          controller.close();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        // Track full text for tool call detection
        const events = parseSSEChunk(chunk);
        for (const event of events) {
          const parsed = parseSSEData(event.data);
          if (!parsed) continue;
          const text = extractTextFromParsed(parsed);
          if (text) {
            fullText += text;
            notifiedCount = notifyNewToolCalls(fullText, notifiedCount);
          }
          if (!completed && isStreamFinishedFromParsed(parsed)) {
            finalizeIfNeeded();
          }
        }

        // Filter and pass to frontend
        filter.processChunk(chunk, controller);
      }
    },
  });

  return new Response(stream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function setupXHRResponseInterceptor(xhr: XMLHttpRequest) {
  let fullText = '';
  let lastLen = 0;
  let notifiedCount = 0;
  let completed = false;
  let filteredResponse = '';
  const filter = new DSMLStreamFilter();

  const finalizeIfNeeded = () => {
    if (completed) return;
    completed = true;
    notifiedCount = notifyNewToolCalls(fullText, notifiedCount);
    hookState.onResponseComplete(fullText);
  };

  const origResponseTextDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText') ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(XMLHttpRequest.prototype), 'responseText');

  // Create a fake controller that accumulates filtered text
  const fakeController = {
    enqueue(data: Uint8Array) {
      filteredResponse += new TextDecoder().decode(data);
    },
  } as unknown as ReadableStreamDefaultController<Uint8Array>;

  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 3 || xhr.readyState === 4) {
      const raw = origResponseTextDesc?.get?.call(xhr) || '';
      const newData = raw.slice(lastLen);
      lastLen = raw.length;
      if (newData) {
        // Track full text
        const events = parseSSEChunk(newData);
        for (const event of events) {
          const parsed = parseSSEData(event.data);
          if (!parsed) continue;
          const text = extractTextFromParsed(parsed);
          if (text) {
            fullText += text;
            notifiedCount = notifyNewToolCalls(fullText, notifiedCount);
          }
        }
        // Filter for frontend
        filter.processChunk(newData, fakeController);
      }
    }
    if (xhr.readyState === 4) {
      filter.flush(fakeController);
      finalizeIfNeeded();
    }
  });

  Object.defineProperty(xhr, 'responseText', {
    get() { return filteredResponse; },
  });
}

// --- History API interception: strip DSML from saved messages ---

async function interceptHistoryResponse(responsePromise: Promise<Response>): Promise<Response> {
  const response = await responsePromise;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) return response;

  try {
    const json = await response.json();
    stripDSMLFromHistory(json);
    return new Response(JSON.stringify(json), {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  } catch {
    return response;
  }
}

function setupXHRHistoryInterceptor(xhr: XMLHttpRequest) {
  const origResponseTextDesc = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText') ||
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(XMLHttpRequest.prototype), 'responseText');

  let cachedFiltered: string | null = null;

  Object.defineProperty(xhr, 'responseText', {
    get() {
      const raw = origResponseTextDesc?.get?.call(xhr) || '';
      if (xhr.readyState < 4) return raw;
      if (cachedFiltered !== null) return cachedFiltered;
      try {
        const json = JSON.parse(raw);
        stripDSMLFromHistory(json);
        cachedFiltered = JSON.stringify(json);
      } catch {
        cachedFiltered = raw;
      }
      return cachedFiltered;
    },
  });

  // Also override response for XHR response getter
  Object.defineProperty(xhr, 'response', {
    get() {
      if (xhr.responseType === '' || xhr.responseType === 'text') {
        const raw = origResponseTextDesc?.get?.call(xhr) || '';
        if (xhr.readyState < 4) return raw;
        if (cachedFiltered !== null) return cachedFiltered;
        try {
          const json = JSON.parse(raw);
          stripDSMLFromHistory(json);
          cachedFiltered = JSON.stringify(json);
        } catch {
          cachedFiltered = raw;
        }
        return cachedFiltered;
      }
      return xhr.response;
    },
  });
}

function stripDSMLFromHistory(json: any) {
  if (!json || !json.data) return;
  const data = json.data.biz_data || json.data;
  const messages = data.chat_messages;
  if (!Array.isArray(messages)) return;

  for (const msg of messages) {
    if (typeof msg.content === 'string' && msg.content.includes('｜DSML｜')) {
      msg.content = replaceToolCallsWithSummary(msg.content);
    }
    if (msg.fragments && Array.isArray(msg.fragments)) {
      for (const frag of msg.fragments) {
        if (typeof frag.content === 'string' && frag.content.includes('｜DSML｜')) {
          if (frag.type === 'REQUEST' || frag.type === 'THINK') {
            frag.content = stripToolCalls(frag.content);
          } else {
            frag.content = replaceToolCallsWithSummary(frag.content);
          }
        }
      }
    }
  }
}

// --- IndexedDB interception: strip DSML from cached messages ---

function hookIndexedDB() {
  const origGet = IDBObjectStore.prototype.get;
  const origGetAll = IDBObjectStore.prototype.getAll;

  IDBObjectStore.prototype.get = function (...args) {
    const request = origGet.apply(this, args);
    if (this.name === 'history-message') {
      patchIDBRequest(request);
    }
    return request;
  };

  IDBObjectStore.prototype.getAll = function (...args) {
    const request = origGetAll.apply(this, args);
    if (this.name === 'history-message') {
      patchIDBRequest(request);
    }
    return request;
  };
}

function patchIDBRequest(request: IDBRequest) {
  const origResultDesc = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'result');
  if (!origResultDesc) return;

  let cleaned = false;

  Object.defineProperty(request, 'result', {
    get() {
      const result = origResultDesc.get!.call(this);
      if (result && !cleaned) {
        cleaned = true;
        stripDSMLFromIDBResult(result);
      }
      return result;
    },
  });
}

function stripDSMLFromIDBResult(result: any) {
  if (Array.isArray(result)) {
    for (const item of result) {
      stripSingleIDBRecord(item);
    }
  } else {
    stripSingleIDBRecord(result);
  }
}

function stripSingleIDBRecord(record: any) {
  if (!record || !record.data) return;
  const data = record.data;
  const messages = data.chat_messages;
  if (!Array.isArray(messages)) return;

  for (const msg of messages) {
    if (typeof msg.content === 'string' && msg.content.includes('｜DSML｜')) {
      msg.content = replaceToolCallsWithSummary(msg.content);
    }
    if (msg.fragments && Array.isArray(msg.fragments)) {
      for (const frag of msg.fragments) {
        if (typeof frag.content === 'string' && frag.content.includes('｜DSML｜')) {
          if (frag.type === 'REQUEST' || frag.type === 'THINK') {
            frag.content = stripToolCalls(frag.content);
          } else {
            frag.content = replaceToolCallsWithSummary(frag.content);
          }
        }
      }
    }
  }
}
