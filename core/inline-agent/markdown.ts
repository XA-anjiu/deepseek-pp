const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function renderInlineMarkdown(text: string): string {
  try {
    let html = escapeHtml(text);

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    });
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const decodedHref = decodeBasicEntities(href.trim());
      if (!isSafeHref(decodedHref)) return `${label} (${href})`;
      return `<a href="${escapeAttribute(decodedHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/\n/g, '<br>');

    return html;
  } catch {
    return escapeHtml(text).replace(/\n/g, '<br>');
  }
}

function isSafeHref(value: string): boolean {
  try {
    const url = new URL(value);
    return SAFE_LINK_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

