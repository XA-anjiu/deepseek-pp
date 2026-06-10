import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILTIN_SKILLS, getLocalizedBuiltinSkills } from '../core/skill/builtin';
import { getAllSkills } from '../core/skill/registry';
import type { Skill } from '../core/types';

const SKILL_STORAGE_KEY = 'deepseek_pp_skills';

let storage: Record<string, unknown>;

function findSkill(skills: Skill[], name: string): Skill {
  const skill = skills.find((item) => item.name === name);
  if (!skill) throw new Error(`Missing skill: ${name}`);
  return skill;
}

beforeEach(() => {
  storage = {};
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          storage = { ...storage, ...values };
        }),
        remove: vi.fn(async (key: string) => {
          delete storage[key];
        }),
      },
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('builtin skill localization', () => {
  it('selects English builtin display and model instructions without changing names', () => {
    const skills = getLocalizedBuiltinSkills('en');
    const shell = findSkill(skills, 'shell');
    const memory = findSkill(skills, 'memory');

    expect(shell.source).toBe('builtin');
    expect(shell.name).toBe('shell');
    expect(shell.description).toContain('Local command-line assistant');
    expect(shell.instructions).toContain('You are executing local shell commands');
    expect(shell.instructions).toContain('<shell_exec>{"command":"..."}</shell_exec>');
    expect(shell.instructions).not.toContain('你正在通过');

    expect(memory.name).toBe('memory');
    expect(memory.description).toContain('Memory management');
    expect(memory.instructions).toContain('The user is asking to manage memories');
    expect(memory.instructions).toContain('"name":"memory_update"');
    expect(memory.instructions).toContain('"description":"Update an existing memory"');
  });

  it('keeps Chinese builtin skills as the default resource', () => {
    const skills = getLocalizedBuiltinSkills('zh-CN');
    const shell = findSkill(skills, 'shell');
    const memory = findSkill(skills, 'memory');

    expect(shell.description).toContain('本地命令行助手');
    expect(shell.instructions).toContain('你正在通过 DeepSeek++ Shell MCP 执行本地命令');
    expect(memory.instructions).toContain('"description":"更新已有记忆"');
  });

  it('does not mutate the canonical default builtin skill objects', () => {
    const canonicalShell = findSkill(BUILTIN_SKILLS, 'shell');
    const englishShell = findSkill(getLocalizedBuiltinSkills('en'), 'shell');

    expect(canonicalShell.description).toContain('本地命令行助手');
    expect(englishShell.description).toContain('Local command-line assistant');
  });

  it('leaves OfficeCLI official skills out of builtin translation scope', () => {
    const english = findSkill(getLocalizedBuiltinSkills('en'), 'officecli-styles');
    const chinese = findSkill(getLocalizedBuiltinSkills('zh-CN'), 'officecli-styles');

    expect(english.source).toBe('official');
    expect(english.description).toBe(chinese.description);
    expect(english.instructions).toBe(chinese.instructions);
  });

  it('keeps custom and remote skills exactly as authored while localizing builtins', async () => {
    storage[SKILL_STORAGE_KEY] = [
      {
        name: 'custom-note',
        description: '自定义描述',
        instructions: '保持我的原始指令',
        source: 'custom',
        memoryEnabled: false,
        enabled: true,
      },
      {
        name: 'remote-skill',
        description: 'Remote original description',
        instructions: 'Remote original instructions',
        source: 'remote',
        memoryEnabled: false,
        enabled: false,
      },
    ];

    const skills = await getAllSkills({ includeDisabled: true, locale: 'en' });
    const shell = findSkill(skills, 'shell');
    const custom = findSkill(skills, 'custom-note');
    const remote = findSkill(skills, 'remote-skill');

    expect(shell.description).toContain('Local command-line assistant');
    expect(custom.description).toBe('自定义描述');
    expect(custom.instructions).toBe('保持我的原始指令');
    expect(remote.description).toBe('Remote original description');
    expect(remote.instructions).toBe('Remote original instructions');
    expect(remote.enabled).toBe(false);
  });
});
