import type {
  GitHubSkillSource,
  Memory,
  MemoryType,
  NewMemory,
  Skill,
  SkillSource,
  SystemPromptPreset,
} from '../types';

const MEMORY_TYPES: readonly MemoryType[] = ['user', 'feedback', 'topic', 'reference'];
const SKILL_SOURCES: readonly SkillSource[] = ['builtin', 'official', 'custom', 'remote'];

export function parseValidatedArray<T>(
  file: string,
  content: string,
  validate: (value: unknown, path: string) => T,
): T[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`云端 ${file} 不是有效 JSON，已停止下载`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`云端 ${file} 格式错误，应为数组，已停止下载`);
  }

  return parsed.map((item, index) => validate(item, `${file}[${index}]`));
}

export function validateStoredMemory(value: unknown, path = 'memory'): Omit<Memory, 'id'> {
  const object = objectValue(value, path);
  return {
    syncId: requiredString(object.syncId, `${path}.syncId`),
    type: enumValue(object.type, MEMORY_TYPES, `${path}.type`),
    name: requiredString(object.name, `${path}.name`),
    content: requiredString(object.content, `${path}.content`),
    description: requiredString(object.description, `${path}.description`),
    tags: stringArray(object.tags, `${path}.tags`),
    pinned: requiredBoolean(object.pinned, `${path}.pinned`),
    createdAt: requiredFiniteNumber(object.createdAt, `${path}.createdAt`),
    updatedAt: requiredFiniteNumber(object.updatedAt, `${path}.updatedAt`),
    accessCount: requiredFiniteNumber(object.accessCount, `${path}.accessCount`),
    lastAccessedAt: requiredFiniteNumber(object.lastAccessedAt, `${path}.lastAccessedAt`),
  };
}

export function validateImportedMemory(value: unknown, path = 'memory'): NewMemory {
  const stored = validateStoredMemory(value, path);
  return {
    syncId: stored.syncId,
    type: stored.type,
    name: stored.name,
    content: stored.content,
    description: stored.description,
    tags: stored.tags,
    pinned: stored.pinned,
  };
}

export function validateSkill(value: unknown, path = 'skill'): Skill {
  const object = objectValue(value, path);
  const source = enumValue(object.source, SKILL_SOURCES, `${path}.source`);
  return {
    name: requiredString(object.name, `${path}.name`),
    description: requiredString(object.description, `${path}.description`),
    instructions: requiredString(object.instructions, `${path}.instructions`),
    source,
    memoryEnabled: requiredBoolean(object.memoryEnabled, `${path}.memoryEnabled`),
    ...(object.enabled === undefined ? {} : { enabled: requiredBoolean(object.enabled, `${path}.enabled`) }),
    ...(object.metadata === undefined ? {} : { metadata: stringRecord(object.metadata, `${path}.metadata`) }),
    ...(object.remote === undefined ? {} : { remote: object.remote as Skill['remote'] }),
  };
}

export function validateGitHubSkillSource(value: unknown, path = 'skillSource'): GitHubSkillSource {
  const object = objectValue(value, path);
  if (object.provider !== 'github') throw new Error(`${path}.provider must be github`);
  return {
    id: requiredString(object.id, `${path}.id`),
    provider: 'github',
    url: requiredString(object.url, `${path}.url`),
    owner: requiredString(object.owner, `${path}.owner`),
    repo: requiredString(object.repo, `${path}.repo`),
    repository: requiredString(object.repository, `${path}.repository`),
    ref: requiredString(object.ref, `${path}.ref`),
    rootPath: requiredString(object.rootPath, `${path}.rootPath`),
    commitSha: requiredString(object.commitSha, `${path}.commitSha`),
    defaultBranch: requiredString(object.defaultBranch, `${path}.defaultBranch`),
    repoUrl: requiredString(object.repoUrl, `${path}.repoUrl`),
    skillPaths: stringArray(object.skillPaths, `${path}.skillPaths`),
    importedSkillNames: stringArray(object.importedSkillNames, `${path}.importedSkillNames`),
    importedAt: requiredFiniteNumber(object.importedAt, `${path}.importedAt`),
    updatedAt: requiredFiniteNumber(object.updatedAt, `${path}.updatedAt`),
    ...(object.lastCheckedAt === undefined ? {} : { lastCheckedAt: requiredFiniteNumber(object.lastCheckedAt, `${path}.lastCheckedAt`) }),
    ...(object.licenseName === undefined ? {} : { licenseName: requiredString(object.licenseName, `${path}.licenseName`) }),
    ...(object.licenseSpdxId === undefined ? {} : { licenseSpdxId: requiredString(object.licenseSpdxId, `${path}.licenseSpdxId`) }),
    ...(object.packageVersion === undefined ? {} : { packageVersion: requiredString(object.packageVersion, `${path}.packageVersion`) }),
    ...(object.description === undefined ? {} : { description: requiredString(object.description, `${path}.description`) }),
  };
}

export function validatePreset(value: unknown, path = 'preset'): SystemPromptPreset {
  const object = objectValue(value, path);
  return {
    id: requiredString(object.id, `${path}.id`),
    name: requiredString(object.name, `${path}.name`),
    content: requiredString(object.content, `${path}.content`),
    createdAt: requiredFiniteNumber(object.createdAt, `${path}.createdAt`),
    updatedAt: requiredFiniteNumber(object.updatedAt, `${path}.updatedAt`),
  };
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path} must be a boolean`);
  return value;
}

function requiredFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${path} must be a string array`);
  }
  return [...value];
}

function stringRecord(value: unknown, path: string): Record<string, string> {
  const object = objectValue(value, path);
  const entries = Object.entries(object);
  if (!entries.every(([, item]) => typeof item === 'string')) {
    throw new Error(`${path} must be a string record`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${path} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

