import type { BackgroundConfig, Memory, ModelType, Skill, SystemPromptPreset, ToolCall } from '../core/types';
import { DSML } from '../core/constants';
import type { ToolCardResult } from '../core/ui/tool-card';

const TOOL_BLOCK_ID = 'dpp-tool-block';
const TOOL_BLOCK_STYLE_ID = 'dpp-tool-block-css';

interface ToolExecution {
  name: string;
  result: ToolCardResult;
}

let toolExecutions: ToolExecution[] = [];
let toolBlockEl: HTMLElement | null = null;

export default defineContentScript({
  matches: ['*://chat.deepseek.com/*'],
  runAt: 'document_start',
  async main() {

    await new Promise((r) => {
      if (document.readyState === 'complete' || document.readyState === 'interactive') r(undefined);
      else document.addEventListener('DOMContentLoaded', () => r(undefined), { once: true });
    });

    const [memories, skills, activePreset, modelType] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'GET_MEMORIES' }),
      chrome.runtime.sendMessage({ type: 'GET_SKILLS' }),
      chrome.runtime.sendMessage({ type: 'GET_ACTIVE_PRESET' }),
      chrome.runtime.sendMessage({ type: 'GET_MODEL_TYPE' }),
    ]);

    syncToMainWorld(memories ?? [], skills ?? [], activePreset, modelType);

    window.addEventListener('message', async (event) => {
      if (event.data?.source !== 'deepseek-pp-main') return;

      switch (event.data.type) {
        case 'TOOL_CALL': {
          const call = event.data.data as ToolCall;
          const result = await executeToolCall(call);
          toolExecutions.push({ name: call.name, result });
          renderToolBlock();
          break;
        }
        case 'MEMORIES_USED': {
          const ids = event.data.ids as number[];
          await chrome.runtime.sendMessage({ type: 'TOUCH_MEMORIES', payload: { ids } });
          break;
        }
        case 'RESPONSE_COMPLETE': {
          if (toolExecutions.length > 0) {
            collapseToolBlock();
            toolExecutions = [];
            toolBlockEl = null;
          }
          break;
        }
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_BACKGROUND' }).then((cfg: BackgroundConfig | null) => {
      applyBackground(cfg);
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATED') {
        syncToMainWorld(message.memories, message.skills, message.activePreset, message.modelType);
      } else if (message.type === 'BACKGROUND_UPDATED') {
        applyBackground(message.config as BackgroundConfig | null);
      }
    });
  },
});

function syncToMainWorld(memories: Memory[], skills: Skill[], activePreset: SystemPromptPreset | null, modelType: ModelType) {
  window.postMessage({
    source: 'deepseek-pp-content',
    type: 'SYNC_STATE',
    memories,
    skills,
    activePreset,
    modelType,
  });
}

async function executeToolCall(call: ToolCall): Promise<ToolCardResult> {
  try {
    if (call.name === 'memory_save') {
      const payload = call.payload as {
        type?: string;
        name?: string;
        content?: string;
        tags?: string[];
      };
      await chrome.runtime.sendMessage({
        type: 'SAVE_MEMORY',
        payload: {
          type: payload.type || 'topic',
          name: payload.name || 'unnamed',
          content: payload.content || '',
          description: payload.name || '',
          tags: payload.tags || [],
          pinned: false,
        },
      });
      return { ok: true, summary: '已保存', detail: payload.name || '' };
    }

    if (call.name === 'memory_update') {
      const payload = call.payload as {
        id?: number;
        type?: string;
        name?: string;
        content?: string;
        tags?: string[];
      };
      const id = Number(payload.id);
      if (!id) return { ok: false, summary: '无效 ID' };
      const existing = await chrome.runtime.sendMessage({ type: 'GET_MEMORY_BY_ID', payload: { id } });
      if (!existing) return { ok: false, summary: '未找到记忆', detail: `ID ${id} 不存在` };
      await chrome.runtime.sendMessage({
        type: 'UPDATE_MEMORY',
        payload: {
          ...existing,
          type: payload.type || existing.type,
          name: payload.name || existing.name,
          content: payload.content || existing.content,
          description: payload.name || existing.description,
          tags: payload.tags || existing.tags,
        },
      });
      return { ok: true, summary: '已更新', detail: payload.name || existing.name };
    }

    if (call.name === 'memory_delete') {
      const payload = call.payload as { id?: number };
      const id = Number(payload.id);
      if (!id) return { ok: false, summary: '无效 ID' };
      await chrome.runtime.sendMessage({ type: 'DELETE_MEMORY', payload: { id } });
      return { ok: true, summary: '已删除', detail: `#${id}` };
    }

    return { ok: true, summary: '已识别' };
  } catch (err) {
    return { ok: false, summary: '执行失败', detail: err instanceof Error ? err.message : String(err) };
  }
}

// --- Tool execution collapsible block (matches official "已思考" style) ---

function injectToolBlockStyles() {
  if (document.getElementById(TOOL_BLOCK_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOOL_BLOCK_STYLE_ID;
  style.textContent = `
    .dpp-tool-block {
      margin-top: 8px;
    }
    .dpp-tool-block-header {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      user-select: none;
      color: rgb(97, 102, 107);
      font-size: 14px;
      line-height: 20px;
    }
    .dpp-tool-block-header:hover {
      color: rgb(60, 65, 70);
    }
    .dpp-tool-block-icon {
      width: 16px;
      height: 16px;
      color: #4d6bfe;
      flex-shrink: 0;
    }
    .dpp-tool-block-title {
      font-weight: 500;
      color: inherit;
    }
    .dpp-tool-block-chevron {
      width: 12px;
      height: 12px;
      color: inherit;
      transition: transform 0.2s ease;
      margin-left: 2px;
    }
    .dpp-tool-block[data-collapsed="true"] .dpp-tool-block-chevron {
      transform: rotate(-90deg);
    }
    .dpp-tool-block-body {
      overflow: hidden;
      transition: max-height 0.25s ease, opacity 0.2s ease;
      max-height: 500px;
      opacity: 1;
      padding-left: 20px;
      margin-top: 6px;
    }
    .dpp-tool-block[data-collapsed="true"] .dpp-tool-block-body {
      max-height: 0;
      opacity: 0;
      margin-top: 0;
    }
    .dpp-tool-block-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 3px 0;
      font-size: 13px;
      color: rgb(64, 65, 79);
      line-height: 1.5;
    }
    .dpp-tool-block-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4d6bfe;
      flex-shrink: 0;
      margin-top: 7px;
    }
    .dpp-tool-block-item-text {
      flex: 1;
    }
    .dpp-tool-block-item-name {
      font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
      font-size: 12px;
      color: #4d6bfe;
    }
    .dpp-tool-block-item-status {
      color: #10b981;
      margin-left: 6px;
    }
    .dpp-tool-block-item-status.error {
      color: #ef4444;
    }
    @media (prefers-color-scheme: dark) {
      .dpp-tool-block-header { color: rgb(155, 160, 165); }
      .dpp-tool-block-header:hover { color: rgb(200, 205, 210); }
      .dpp-tool-block-item { color: rgb(200, 200, 200); }
    }
  `;
  document.head.appendChild(style);
}

function renderToolBlock() {
  injectToolBlockStyles();

  if (!toolBlockEl) {
    toolBlockEl = document.createElement('div');
    toolBlockEl.id = TOOL_BLOCK_ID;
    toolBlockEl.className = 'dpp-tool-block';
    toolBlockEl.setAttribute('data-collapsed', 'false');

    toolBlockEl.innerHTML = `
      <div class="dpp-tool-block-header">
        <svg class="dpp-tool-block-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        <span class="dpp-tool-block-title"></span>
        <svg class="dpp-tool-block-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="dpp-tool-block-body"></div>
    `;

    toolBlockEl.querySelector('.dpp-tool-block-header')!.addEventListener('click', () => {
      const collapsed = toolBlockEl!.getAttribute('data-collapsed') === 'true';
      toolBlockEl!.setAttribute('data-collapsed', collapsed ? 'false' : 'true');
    });

    placeToolBlock(toolBlockEl);
  }

  // Update title
  const count = toolExecutions.length;
  const title = toolBlockEl.querySelector('.dpp-tool-block-title')!;
  title.textContent = `已执行工具（${count}次）`;

  // Update body with items
  const body = toolBlockEl.querySelector('.dpp-tool-block-body')!;
  body.innerHTML = '';
  for (const exec of toolExecutions) {
    const item = document.createElement('div');
    item.className = 'dpp-tool-block-item';
    item.innerHTML = `
      <div class="dpp-tool-block-dot"></div>
      <div class="dpp-tool-block-item-text">
        <span class="dpp-tool-block-item-name">${exec.name}</span>
        <span class="dpp-tool-block-item-status ${exec.result.ok ? '' : 'error'}">${exec.result.summary}${exec.result.detail ? ' · ' + exec.result.detail : ''}</span>
      </div>
    `;
    body.appendChild(item);
  }
}

function collapseToolBlock() {
  if (toolBlockEl) {
    setTimeout(() => {
      toolBlockEl?.setAttribute('data-collapsed', 'true');
    }, 1500);
  }
}

function placeToolBlock(block: HTMLElement) {
  // Find the last assistant message being streamed and place block after the response content
  const messages = document.querySelectorAll('.ds-message');
  if (messages.length === 0) return;

  const lastMsg = messages[messages.length - 1];
  const responseContent = lastMsg.querySelector('._74c0879') || lastMsg.querySelector('[class*="message"]');
  if (responseContent) {
    responseContent.appendChild(block);
  } else {
    lastMsg.appendChild(block);
  }
}

// --- Background image feature (unchanged) ---

function getToolbarBottom(): number {
  const root = document.getElementById('root');
  if (!root) return 0;

  function walk(el: Element): number {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (
      rect.top >= -2 && rect.top <= 5 &&
      rect.height > 30 && rect.height <= 80 &&
      rect.width > 300 &&
      (style.position === 'absolute' || style.position === 'sticky' || style.position === 'fixed')
    ) {
      return rect.bottom;
    }
    for (const child of el.children) {
      const result = walk(child);
      if (result > 0) return result;
    }
    return 0;
  }

  return walk(root);
}

function hasVisibleBackground(style: CSSStyleDeclaration): boolean {
  const bg = style.backgroundColor;
  const bgImg = style.backgroundImage;
  return (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') ||
         (bgImg !== 'none' && bgImg !== '');
}

function patchContainerBackgrounds() {
  if (!document.body.classList.contains('dpp-bg-active')) return;
  const root = document.getElementById('root');
  if (!root) return;

  const textarea = document.querySelector('textarea');
  if (!textarea) return;

  let inputBox: Element | null = null;
  let el: Element | null = textarea.parentElement;
  while (el && el !== root) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg === 'rgb(255, 255, 255)' || bg === 'rgb(249, 250, 251)') {
      inputBox = el;
      break;
    }
    el = el.parentElement;
  }

  if (!inputBox) return;

  el = inputBox.parentElement;
  while (el && el !== root && el !== document.body) {
    const style = getComputedStyle(el);
    if (hasVisibleBackground(style)) {
      (el as HTMLElement).setAttribute('data-dpp-transparent', '');
    }

    if (style.position === 'sticky') {
      for (const child of el.children) {
        if (child.contains(textarea)) continue;
        if (hasVisibleBackground(getComputedStyle(child))) {
          (child as HTMLElement).setAttribute('data-dpp-transparent', '');
        }
      }
    }

    el = el.parentElement;
  }
}

function removeBackground() {
  document.getElementById('dpp-bg')?.remove();
  document.getElementById('dpp-bg-style')?.remove();
  document.body.classList.remove('dpp-bg-active');
  document.body.style.removeProperty('--dpp-overlay-light');
  document.body.style.removeProperty('--dpp-overlay-dark');
  document.body.style.removeProperty('--dpp-blur');
}

function applyBackground(config: BackgroundConfig | null) {
  const imageUrl = config?.enabled
    ? (config.type === 'url' ? config.url : config.imageData) || null
    : null;

  if (!imageUrl) {
    removeBackground();
    return;
  }

  const existingBg = document.getElementById('dpp-bg');
  const existingStyle = document.getElementById('dpp-bg-style');

  document.body.classList.add('dpp-bg-active');

  const overlayAlpha = (1 - config!.opacity).toFixed(3);
  const blurPx = ((1 - config!.opacity) * 8).toFixed(1);
  document.body.style.setProperty('--dpp-overlay-light', `rgba(255, 255, 255, ${overlayAlpha})`);
  document.body.style.setProperty('--dpp-overlay-dark', `rgba(30, 30, 30, ${overlayAlpha})`);
  document.body.style.setProperty('--dpp-blur', `blur(${blurPx}px)`);

  const topOffset = getToolbarBottom();

  const bgDiv = existingBg || document.createElement('div');
  bgDiv.id = 'dpp-bg';
  Object.assign(bgDiv.style, {
    position: 'fixed',
    top: `${topOffset}px`,
    left: '0',
    right: '0',
    bottom: '0',
    zIndex: '-1',
    backgroundImage: `url("${imageUrl.replace(/[\\"]/g, '\\$&')}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    pointerEvents: 'none',
  });
  if (!existingBg) document.body.prepend(bgDiv);

  const styleEl = existingStyle || document.createElement('style');
  styleEl.id = 'dpp-bg-style';
  styleEl.textContent = `
    #dpp-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--dpp-overlay-light);
      backdrop-filter: var(--dpp-blur);
      -webkit-backdrop-filter: var(--dpp-blur);
      pointer-events: none;
    }

    body.dpp-bg-active,
    body.dpp-bg-active #root,
    body.dpp-bg-active #__next {
      background: transparent !important;
    }

    body.dpp-bg-active #root > div,
    body.dpp-bg-active #__next > div {
      background: transparent !important;
    }

    body.dpp-bg-active #root > div > div,
    body.dpp-bg-active #__next > div > div {
      background: transparent !important;
    }

    body.dpp-bg-active [data-dpp-transparent] {
      background: transparent !important;
    }

    @media (prefers-color-scheme: dark) {
      #dpp-bg::after {
        background: var(--dpp-overlay-dark);
      }
    }
  `;
  if (!existingStyle) document.head.appendChild(styleEl);

  patchContainerBackgrounds();

  // Re-patch on DOM changes
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('dpp-bg-active')) {
      patchContainerBackgrounds();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
