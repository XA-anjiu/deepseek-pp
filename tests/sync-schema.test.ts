import { describe, expect, it } from 'vitest';
import {
  parseValidatedArray,
  validateImportedMemory,
  validatePreset,
  validateStoredMemory,
} from '../core/sync/schema';

const validMemory = {
  syncId: 'sync-1',
  type: 'topic',
  name: 'Memory',
  content: 'Useful fact',
  description: 'Memory',
  tags: ['test'],
  pinned: false,
  createdAt: 1,
  updatedAt: 1,
  accessCount: 0,
  lastAccessedAt: 1,
};

describe('sync schema validators', () => {
  it('validates stored memories and imported memory payloads', () => {
    expect(validateStoredMemory(validMemory).syncId).toBe('sync-1');
    expect(validateImportedMemory(validMemory)).toEqual({
      syncId: 'sync-1',
      type: 'topic',
      name: 'Memory',
      content: 'Useful fact',
      description: 'Memory',
      tags: ['test'],
      pinned: false,
    });
  });

  it('rejects malformed array items with path context', () => {
    expect(() => parseValidatedArray('memories.json', JSON.stringify([validMemory, { ...validMemory, tags: [1] }]), validateStoredMemory))
      .toThrow('memories.json[1].tags');
  });

  it('rejects invalid presets before storage writes', () => {
    expect(() => validatePreset({ id: 'p1', name: 'Preset' }, 'presets[0]'))
      .toThrow('presets[0].content');
  });
});

