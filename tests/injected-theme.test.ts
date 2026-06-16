import { afterEach, describe, expect, it } from 'vitest';
import { injectInjectedThemeStyles } from '../core/ui/injected-theme';

describe('injected UI theme styles', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('defines high-contrast variables for DeepSeek dark theme and system dark mode', () => {
    injectInjectedThemeStyles();

    const style = document.getElementById('dpp-injected-theme-css');
    expect(style?.textContent).toContain('--dpp-ui-text: #F5F5F5;');
    expect(style?.textContent).toContain('body.dpp-theme-dark');
    expect(style?.textContent).toContain('@media (prefers-color-scheme: dark)');
    expect(style?.textContent).toContain('body:not(.dpp-theme-light)');
  });

  it('injects the shared theme stylesheet once', () => {
    injectInjectedThemeStyles();
    injectInjectedThemeStyles();

    expect(document.querySelectorAll('#dpp-injected-theme-css')).toHaveLength(1);
  });
});
