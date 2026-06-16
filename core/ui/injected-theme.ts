const STYLE_ID = 'dpp-injected-theme-css';

export function injectInjectedThemeStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
body {
  --dpp-ui-surface: #FFFFFF;
  --dpp-ui-surface-muted: #F7F8FA;
  --dpp-ui-surface-hover: #EFF1F4;
  --dpp-ui-text: #1D1D1F;
  --dpp-ui-text-muted: #6B7280;
  --dpp-ui-text-subtle: #9CA3AF;
  --dpp-ui-border: #E5E7EB;
  --dpp-ui-border-muted: #EEF0F2;
  --dpp-ui-accent: #4D6BFE;
  --dpp-ui-accent-strong: #3151D3;
  --dpp-ui-accent-soft: #EEF1FF;
  --dpp-ui-accent-panel: rgba(77, 107, 254, 0.06);
  --dpp-ui-code-bg: rgba(15, 23, 42, 0.06);
  --dpp-ui-danger-panel: rgba(239, 68, 68, 0.08);
  --dpp-ui-success: #10B981;
  --dpp-ui-error: #EF4444;
  --dpp-ui-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  --dpp-ui-panel-shadow: -14px 0 40px rgba(15, 23, 42, 0.14);
}

body.dpp-theme-dark {
  --dpp-ui-surface: #1F1F1F;
  --dpp-ui-surface-muted: #262626;
  --dpp-ui-surface-hover: #2E2E2E;
  --dpp-ui-text: #F5F5F5;
  --dpp-ui-text-muted: #D4D4D8;
  --dpp-ui-text-subtle: #AEB4BC;
  --dpp-ui-border: #3A3A3A;
  --dpp-ui-border-muted: #2E2E2E;
  --dpp-ui-accent: #A8B5FF;
  --dpp-ui-accent-strong: #C4CCFF;
  --dpp-ui-accent-soft: rgba(124, 145, 255, 0.18);
  --dpp-ui-accent-panel: rgba(125, 150, 255, 0.12);
  --dpp-ui-code-bg: rgba(255, 255, 255, 0.08);
  --dpp-ui-danger-panel: rgba(248, 113, 113, 0.14);
  --dpp-ui-success: #34D399;
  --dpp-ui-error: #F87171;
  --dpp-ui-shadow: none;
  --dpp-ui-panel-shadow: -14px 0 40px rgba(0, 0, 0, 0.32);
}

@media (prefers-color-scheme: dark) {
  body:not(.dpp-theme-light) {
    --dpp-ui-surface: #1F1F1F;
    --dpp-ui-surface-muted: #262626;
    --dpp-ui-surface-hover: #2E2E2E;
    --dpp-ui-text: #F5F5F5;
    --dpp-ui-text-muted: #D4D4D8;
    --dpp-ui-text-subtle: #AEB4BC;
    --dpp-ui-border: #3A3A3A;
    --dpp-ui-border-muted: #2E2E2E;
    --dpp-ui-accent: #A8B5FF;
    --dpp-ui-accent-strong: #C4CCFF;
    --dpp-ui-accent-soft: rgba(124, 145, 255, 0.18);
    --dpp-ui-accent-panel: rgba(125, 150, 255, 0.12);
    --dpp-ui-code-bg: rgba(255, 255, 255, 0.08);
    --dpp-ui-danger-panel: rgba(248, 113, 113, 0.14);
    --dpp-ui-success: #34D399;
    --dpp-ui-error: #F87171;
    --dpp-ui-shadow: none;
    --dpp-ui-panel-shadow: -14px 0 40px rgba(0, 0, 0, 0.32);
  }
}
`;
  document.head.appendChild(style);
}
