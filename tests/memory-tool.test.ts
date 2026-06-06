import { describe, expect, it } from 'vitest';
import { executeMemoryToolCall, type MemoryToolRuntime } from '../core/tool/memory';
import type { ToolCall } from '../core/tool/types';

function memorySaveCall(payload: Record<string, unknown>): ToolCall {
  return {
    name: 'memory_save',
    payload,
    raw: '<memory_save />',
  };
}

describe('memory tool validation', () => {
  it('does not persist invalid memory_save payloads', async () => {
    let saveCalls = 0;
    const runtime: MemoryToolRuntime = {
      async saveMemory() {
        saveCalls++;
        return { id: 1 };
      },
      async getMemoryById() {
        return null;
      },
      async updateMemory() {},
      async deleteMemory() {},
    };

    const result = await executeMemoryToolCall(runtime, memorySaveCall({
      type: 'topic',
      name: '',
      content: 'content',
      tags: [],
    }));

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('memory_invalid_payload');
    expect(saveCalls).toBe(0);
  });
});

