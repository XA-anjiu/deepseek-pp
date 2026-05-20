import { TOOL_CALLS_BLOCK_REGEX, INVOKE_REGEX, PARAMETER_REGEX } from '../constants';
import type { ToolCall } from '../types';

export function extractToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const blockRegex = new RegExp(TOOL_CALLS_BLOCK_REGEX.source, 'g');
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(text)) !== null) {
    const blockContent = blockMatch[0];
    const invokeRegex = new RegExp(INVOKE_REGEX.source, 'g');
    let invokeMatch: RegExpExecArray | null;

    while ((invokeMatch = invokeRegex.exec(blockContent)) !== null) {
      const name = invokeMatch[1];
      const invokeContent = invokeMatch[2];
      const payload: Record<string, unknown> = {};
      const paramRegex = new RegExp(PARAMETER_REGEX.source, 'g');
      let paramMatch: RegExpExecArray | null;

      while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
        const paramName = paramMatch[1];
        const isString = paramMatch[2] === 'true';
        const value = paramMatch[3];
        if (isString) {
          payload[paramName] = value;
        } else {
          try {
            payload[paramName] = JSON.parse(value);
          } catch {
            payload[paramName] = value;
          }
        }
      }

      calls.push({ name, payload, raw: blockMatch[0] });
    }
  }

  return calls;
}

export function stripToolCalls(text: string): string {
  const regex = new RegExp(TOOL_CALLS_BLOCK_REGEX.source, 'g');
  return text.replace(regex, '').trim();
}

export function replaceToolCallsWithSummary(text: string): string {
  const regex = new RegExp(TOOL_CALLS_BLOCK_REGEX.source, 'g');
  return text.replace(regex, (match) => {
    const calls = extractToolCalls(match);
    if (calls.length === 0) return '';
    const lines = calls.map(call => {
      const name = call.name;
      const detail = call.payload.name || call.payload.content || call.payload.id || '';
      return `• ${formatToolName(name)}${detail ? '：' + detail : ''}`;
    });
    return '\n\n---\n🔧 已执行工具（' + calls.length + '次）\n' + lines.join('\n') + '\n---';
  });
}

function formatToolName(name: string): string {
  switch (name) {
    case 'memory_save': return '保存记忆';
    case 'memory_update': return '更新记忆';
    case 'memory_delete': return '删除记忆';
    default: return name;
  }
}
