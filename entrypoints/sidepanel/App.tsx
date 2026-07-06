import { lazy, Suspense, useEffect, useState } from 'react';
import type { LocaleMessageKey } from '../../core/i18n';
import { getChatEnabled } from '../../core/chat/store';
import WhatsNewPanel from './components/WhatsNewPanel';
import { SkeletonList } from './components/settings/primitives';
import { useI18n } from './i18n';
import { setPendingText } from './pending-text';

type Tab = 'chat' | 'library' | 'projects' | 'capabilities' | 'appearance' | 'usage' | 'settings';
type SurfaceMode = 'sidepanel' | 'quick-panel' | 'floating-chat';

const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CapabilitiesPage = lazy(() => import('./pages/CapabilitiesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AppearancePage = lazy(() => import('./pages/AppearancePage'));
const UsagePage = lazy(() => import('./pages/UsagePage'));

const ALL_TABS: { key: Tab; labelKey: LocaleMessageKey; icon: string }[] = [
  { key: 'chat', labelKey: 'app.tabs.chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { key: 'capabilities', labelKey: 'app.tabs.capabilities', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { key: 'library', labelKey: 'app.tabs.library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5s3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18s-3.332.477-4.5 1.253' },
  { key: 'projects', labelKey: 'app.tabs.projects', icon: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z' },
  { key: 'appearance', labelKey: 'app.tabs.appearance', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { key: 'usage', labelKey: 'app.tabs.usage', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { key: 'settings', labelKey: 'app.tabs.settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

const QUICK_PANEL_TABS = ALL_TABS.filter((tab) => tab.key !== 'chat');

export default function App() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('chat');
  const [chatEnabled, setChatEnabledState] = useState<boolean | null>(null);
  const surfaceMode = getSurfaceMode();
  const isQuickPanel = surfaceMode === 'quick-panel';
  const chatOnly = surfaceMode === 'floating-chat' || surfaceMode === 'sidepanel';
  const tabs = isQuickPanel ? QUICK_PANEL_TABS : ALL_TABS;

  useEffect(() => {
    getChatEnabled().then(setChatEnabledState);
    const handler = (changes: Record<string, chrome.storage.StorageChange>) => {
      if ('deepseek_pp_chat_enabled' in changes) {
        setChatEnabledState(changes.deepseek_pp_chat_enabled.newValue === true);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  useEffect(() => {
    if (isQuickPanel && tab === 'chat') {
      setTab('settings');
    }
  }, [isQuickPanel, tab]);

  useEffect(() => {
    if (!chatOnly && chatEnabled === false && tab === 'chat') {
      setTab('library');
    }
  }, [chatEnabled, tab, chatOnly]);

  useEffect(() => {
    chrome.storage.local.get('pendingChatText').then((data) => {
      const text = data.pendingChatText as string | undefined;
      if (text) {
        chrome.storage.local.remove('pendingChatText').catch(() => {});
        setPendingText(text);
        setTab('chat');
      }
    });
  }, []);

  useEffect(() => {
    const handler = (msg: { type: string; text?: string }) => {
      if (msg.type === 'OPEN_CHAT_WITH_TEXT' && typeof msg.text === 'string') {
        chrome.storage.local.remove('pendingChatText').catch(() => {});
        setPendingText(msg.text);
        setTab('chat');
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return (
    <div className={`ds-app-shell${surfaceMode === 'quick-panel' ? ' ds-app-shell-quick' : ''}${chatOnly ? ' ds-app-shell-floating-chat' : ''}`}>
      {!chatOnly && <nav className="side-tabs" aria-label={t('app.sideNavLabel')}>
        {isQuickPanel && (
          <div className="quick-panel-brand">
            <span className="quick-panel-brand-subtitle">DS++</span>
          </div>
        )}
        {tabs.filter((tabConfig) =>
          chatEnabled !== false || tabConfig.key !== 'chat'
        ).map((tabConfig) => {
          const label = t(tabConfig.labelKey);
          return (
            <button
              key={tabConfig.key}
              type="button"
              onClick={() => setTab(tabConfig.key)}
              className={`side-tab${tab === tabConfig.key ? ' side-tab-active' : ''}`}
              aria-current={tab === tabConfig.key ? 'page' : undefined}
              title={label}
            >
              <svg className="side-tab-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={tabConfig.icon} />
              </svg>
              <span className="side-tab-label">{label}</span>
              {tab === tabConfig.key && <span className="side-tab-indicator" />}
            </button>
          );
        })}
      </nav>}
      <main className="ds-app-main">
        {!chatOnly && <WhatsNewPanel />}
        <Suspense fallback={<div className="p-4"><SkeletonList rows={3} /></div>}>
          {(chatOnly || tab === 'chat') && <ChatPage />}
          {!chatOnly && tab === 'library' && <LibraryPage />}
          {!chatOnly && tab === 'projects' && <ProjectsPage />}
          {!chatOnly && tab === 'capabilities' && <CapabilitiesPage />}
          {!chatOnly && tab === 'appearance' && <AppearancePage />}
          {!chatOnly && tab === 'usage' && <UsagePage />}
          {!chatOnly && tab === 'settings' && <SettingsPage />}
        </Suspense>
      </main>
    </div>
  );
}

function getSurfaceMode(): SurfaceMode {
  if (typeof window === 'undefined') return 'sidepanel';
  const surface = new URLSearchParams(window.location.search).get('surface');
  if (surface === 'quick-panel') return 'quick-panel';
  if (surface === 'floating-chat') return 'floating-chat';
  return 'sidepanel';
}