import type { ChatSurface } from '../../../core/types';

export interface ChatLauncherController {
  stop(): void;
}

const STYLE_ID = 'dpp-chat-launcher-css';
const BUTTON_ID = 'dpp-chat-launcher-button';
const WINDOW_ID = 'dpp-floating-chat-window';
const CHAT_ENABLED_STORAGE_KEY = 'deepseek_pp_chat_enabled';
const CHAT_SURFACE_STORAGE_KEY = 'deepseek_pp_chat_surface';
const SIDE_PANEL_PATH = 'sidepanel.html?surface=floating-chat';

let dragState: { isDragging: boolean; startX: number; startY: number; startRight: number; startBottom: number; } | null = null;

interface ChatLauncherState {
  enabled: boolean;
  surface: ChatSurface;
}

type HostTheme = 'light' | 'dark';

export function startChatLauncher(): ChatLauncherController {
  injectStyles();
  const button = ensureButton();
  let mouseDownTimer: ReturnType<typeof setTimeout> | null = null;
  let isLongPress = false;
  let startX = 0;
  let startY = 0;
  let startRight = 0;
  let startBottom = 0;

  const onMouseDown = (e: MouseEvent) => {
    isLongPress = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = button.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    mouseDownTimer = setTimeout(() => { isLongPress = true; button.style.cursor = 'grabbing'; }, 100);
  };

  const onMouseUp = () => {
    if (mouseDownTimer) { clearTimeout(mouseDownTimer); mouseDownTimer = null; }
    if (!isLongPress) { toggleFloatingWindow(); }
    isLongPress = false;
    button.style.cursor = 'pointer';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isLongPress) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    const newRight = Math.max(0, startRight - deltaX);
    const newBottom = Math.max(0, startBottom - deltaY);
    const maxRight = window.innerWidth - button.offsetWidth;
    const maxBottom = window.innerHeight - button.offsetHeight;
    button.style.right = `${Math.min(newRight, maxRight)}px`;
    button.style.bottom = `${Math.min(newBottom, maxBottom)}px`;
    button.style.top = 'auto';
  };

  button.addEventListener('mousedown', onMouseDown);
  button.addEventListener('mouseup', onMouseUp);
  document.addEventListener('mousemove', onMouseMove);

  let disposed = false;
  const themeObserver = new MutationObserver(syncWindowTheme);
  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return;
    if (CHAT_ENABLED_STORAGE_KEY in changes || CHAT_SURFACE_STORAGE_KEY in changes) { void renderFromStorage(); }
  };
  const renderFromStorage = async () => {
    const state = await getState();
    if (disposed) return;
    renderLauncher(state);
  };
  chrome.storage?.onChanged?.addListener(onStorageChanged);
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-dpp-theme'] });
  void renderFromStorage();
  return {
    stop() {
      disposed = true;
      button.removeEventListener('mousedown', onMouseDown);
      button.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      chrome.storage?.onChanged?.removeListener(onStorageChanged);
      themeObserver.disconnect();
      removeButton();
      removeWindow();
    },
  };
}

async function getState(): Promise<ChatLauncherState> {
  try {
    const data = await chrome.storage.local.get([CHAT_ENABLED_STORAGE_KEY, CHAT_SURFACE_STORAGE_KEY]) as Record<string, unknown>;
    return { enabled: data[CHAT_ENABLED_STORAGE_KEY] === true, surface: data[CHAT_SURFACE_STORAGE_KEY] === 'floating' ? 'floating' : 'sidepanel' };
  } catch { return { enabled: false, surface: 'sidepanel' }; }
}

function renderLauncher(state: ChatLauncherState): void {
  const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (!button) return;
  if (!state.enabled || state.surface !== 'floating') { button.style.display = 'none'; removeWindow(); return; }
  button.style.display = '';
  button.classList.add('dpp-chat-launcher--floating');
  button.title = 'Open DS++ Chat';
  button.setAttribute('aria-label', 'Open DS++ Chat');
}

function ensureButton(): HTMLButtonElement {
  const existing = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (existing) return existing;
  if (!document.body) return null as unknown as HTMLButtonElement;
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.innerHTML = createChatIcon();
  document.body.appendChild(button);
  return button;
}

function removeButton(): void { document.getElementById(BUTTON_ID)?.remove(); }

function toggleFloatingWindow(): void {
  const existing = document.getElementById(WINDOW_ID);
  if (existing) { existing.remove(); return; }
  if (!document.body) return;
  const panel = document.createElement('section');
  panel.id = WINDOW_ID;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'DeepSeek++ Chat');
  applyWindowTheme(panel);
  panel.innerHTML = `<div class="dpp-floating-chat__header" data-dpp-drag-handle><span class="dpp-floating-chat__title">DS++ Chat</span><button class="dpp-floating-chat__close" type="button" data-dpp-floating-chat-close aria-label="Close">×</button></div><iframe class="dpp-floating-chat__frame" title="DS++ Chat" src="${chrome.runtime.getURL(`${SIDE_PANEL_PATH}&hostTheme=${getHostTheme()}`)}"></iframe>`;
  panel.querySelector('[data-dpp-floating-chat-close]')?.addEventListener('click', () => panel.remove());
  const dragHandle = panel.querySelector('[data-dpp-drag-handle]') as HTMLElement;
  if (dragHandle) { dragHandle.addEventListener('mousedown', (e) => startDrag(e, panel)); }
  document.body.appendChild(panel);
}

function startDrag(e: MouseEvent, panel: HTMLElement): void {
  e.preventDefault();
  const rect = panel.getBoundingClientRect();
  dragState = { isDragging: true, startX: e.clientX, startY: e.clientY, startRight: window.innerWidth - rect.right, startBottom: window.innerHeight - rect.bottom };
  panel.classList.add('dpp-floating-chat--dragging');
  document.body.classList.add('dpp-floating-chat-dragging');
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(e: MouseEvent): void {
  if (!dragState?.isDragging) return;
  const panel = document.getElementById(WINDOW_ID);
  if (!panel) return;
  const deltaX = e.clientX - dragState.startX;
  const deltaY = e.clientY - dragState.startY;
  const newRight = Math.max(0, dragState.startRight - deltaX);
  const newBottom = Math.max(0, dragState.startBottom - deltaY);
  panel.style.right = `${Math.min(newRight, window.innerWidth - panel.offsetWidth)}px`;
  panel.style.bottom = `${Math.min(newBottom, window.innerHeight - panel.offsetHeight)}px`;
}

function stopDrag(): void {
  const panel = document.getElementById(WINDOW_ID);
  if (panel) { panel.classList.remove('dpp-floating-chat--dragging'); }
  document.body.classList.remove('dpp-floating-chat-dragging');
  dragState = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

function removeWindow(): void { document.getElementById(WINDOW_ID)?.remove(); }

function syncWindowTheme(): void {
  const panel = document.getElementById(WINDOW_ID);
  if (!panel) return;
  applyWindowTheme(panel);
  const frame = panel.querySelector<HTMLIFrameElement>('.dpp-floating-chat__frame');
  frame?.contentWindow?.postMessage({ type: 'DPP_QUICK_PANEL_THEME', hostTheme: getHostTheme(), panelTheme: 'minimal' }, '*');
}

function applyWindowTheme(panel: HTMLElement): void { const theme = getHostTheme(); panel.dataset.hostTheme = theme; panel.classList.toggle('dpp-floating-chat--dark', theme === 'dark'); }
function getHostTheme(): HostTheme { return document.body.classList.contains('dpp-theme-dark') || document.body.dataset.dppTheme === 'dark' ? 'dark' : 'light'; }
function createChatIcon(): string { return '<svg class="dpp-chat-launcher__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.75 5.75h14.5v9.5H8.3L4.75 18.5V5.75Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9.25h8M8 12h5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'; }

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  if (!document.head) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `#${BUTTON_ID} { position: fixed; top: max(18px, env(safe-area-inset-top)); right: 83px; z-index: 2147483646; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 999px; outline: none; background: transparent; color: #2c2c2c; cursor: pointer; } #${BUTTON_ID}:hover { color: #111; } body.dpp-theme-dark #${BUTTON_ID} { color: #fff; } #${BUTTON_ID}.dpp-chat-launcher--floating { position: fixed; top: auto; right: 22px; bottom: max(22px, env(safe-area-inset-bottom)); width: 36px; height: 36px; background: rgba(255,255,255,0.82); box-shadow: 0 14px 34px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.75); backdrop-filter: blur(18px) saturate(1.2); -webkit-backdrop-filter: blur(18px) saturate(1.2); cursor: pointer; transition: transform 0.1s ease; } body.dpp-theme-dark #${BUTTON_ID}.dpp-chat-launcher--floating { background: rgba(17,21,29,0.48); color: #e8ecff; box-shadow: 0 18px 46px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.08); } #${BUTTON_ID} .dpp-chat-launcher__icon { width: 21px; height: 21px; } #${BUTTON_ID}.dpp-chat-launcher--floating .dpp-chat-launcher__icon { width: 19px; height: 19px; } #${WINDOW_ID} { position: fixed; right: 22px; bottom: 80px; z-index: 2147483645; width: min(430px, calc(100vw - 28px)); height: min(720px, calc(100vh - 100px)); border: 1px solid rgba(0,0,0,0.08); border-radius: 18px; overflow: hidden; background: rgba(250,250,250,0.86); box-shadow: 0 24px 60px rgba(15,23,42,0.18); animation: dpp-floating-chat-in 170ms ease; display: flex; flex-direction: column; } #${WINDOW_ID}.dpp-floating-chat--dark { border-color: rgba(148,163,184,0.22); background: rgba(7,9,13,0.42); box-shadow: 0 28px 82px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.06); backdrop-filter: blur(30px) saturate(1.18); -webkit-backdrop-filter: blur(30px) saturate(1.18); } #${WINDOW_ID} .dpp-floating-chat__frame { width: 100%; flex: 1; min-height: 0; border: 0; background: transparent; } #${WINDOW_ID} .dpp-floating-chat__header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.95); border-bottom: 1px solid rgba(0,0,0,0.06); cursor: move; user-select: none; flex-shrink: 0; } #${WINDOW_ID}.dpp-floating-chat--dark .dpp-floating-chat__header { background: rgba(17,21,29,0.95); border-bottom-color: rgba(148,163,184,0.18); } #${WINDOW_ID} .dpp-floating-chat__title { font: 700 13px/1.4 'Inter', 'PingFang SC', -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; color: #4d6bfe; color: var(--dpp-floating-chat-title-color, #4d6bfe); } #${WINDOW_ID}.dpp-floating-chat--dark .dpp-floating-chat__title { color: #7b93ff; color: var(--dpp-floating-chat-title-color, #7b93ff); } #${WINDOW_ID} .dpp-floating-chat__close { width: 20px; height: 20px; border: 0; border-radius: 6px; background: transparent; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1; } #${WINDOW_ID} .dpp-floating-chat__close:hover { background: rgba(0,0,0,0.06); color: #374151; } #${WINDOW_ID}.dpp-floating-chat--dark .dpp-floating-chat__close { color: #9ca3af; } #${WINDOW_ID}.dpp-floating-chat--dark .dpp-floating-chat__close:hover { background: rgba(255,255,255,0.08); color: #e5e7eb; } #${WINDOW_ID}.dpp-floating-chat--dragging { transition: none !important; user-select: none; } #${WINDOW_ID}.dpp-floating-chat--dragging .dpp-floating-chat__frame { pointer-events: none; } body.dpp-floating-chat-dragging { cursor: move !important; } body.dpp-floating-chat-dragging * { cursor: move !important; } @keyframes dpp-floating-chat-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @media (max-width: 640px) { #${BUTTON_ID}.dpp-chat-launcher--sidepanel { right: 47px; top: max(81px, env(safe-area-inset-top)); } #${WINDOW_ID} { right: 14px; bottom: 74px; width: calc(100vw - 28px); height: min(680px, calc(100vh - 100px)); } } `;
  document.head.appendChild(style);
}