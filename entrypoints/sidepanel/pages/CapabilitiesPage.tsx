import { useState } from 'react';
import SkillPage from './SkillPage';
import McpPage from './McpPage';
import ToolsPage from './ToolsPage';
import { useI18n } from '../i18n';
import type { LocaleMessageKey } from '../../../core/i18n';

type SubTab = 'skill' | 'mcp' | 'tools';

const SUB_TABS: { key: SubTab; labelKey: LocaleMessageKey }[] = [
  { key: 'skill', labelKey: 'sidepanel.capabilitiesPage.tabs.skill' },
  { key: 'mcp', labelKey: 'sidepanel.capabilitiesPage.tabs.mcp' },
  { key: 'tools', labelKey: 'sidepanel.capabilitiesPage.tabs.tools' },
];

export default function CapabilitiesPage() {
  const [sub, setSub] = useState<SubTab>('skill');
  const { t } = useI18n();

  return (
    <div className="flex flex-col h-full">
      <nav className="sub-tabs" aria-label={t('sidepanel.capabilitiesPage.navLabel')}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSub(tab.key)}
            className={`sub-tab${sub === tab.key ? ' sub-tab-active' : ''}`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto">
        {sub === 'skill' && <SkillPage />}
        {sub === 'mcp' && <McpPage />}
        {sub === 'tools' && <ToolsPage />}
      </div>
    </div>
  );
}
