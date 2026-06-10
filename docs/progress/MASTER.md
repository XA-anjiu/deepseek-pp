# Multilingual English Runtime Support — Progress Tracker

> **Task**: Add first-class multilingual support to DeepSeek++, with English covering both user-facing UI and model-facing runtime behavior.
> **Started**: 2026-06-10
> **Last Updated**: 2026-06-10
> **Mode**: GITHUB_STANDARD
> **Repo**: zhu1090093659/deepseek-pp

## GitHub Resources

- **All Issues**: `gh issue list -R zhu1090093659/deepseek-pp --label "spec-driven" --state all`
- **Current Spec Issues**: `gh issue list -R zhu1090093659/deepseek-pp --milestone "Phase 2: User-Facing Runtime UI" --state open`
- **Project Board**: unavailable in current `gh` auth scope; mode is `GITHUB_STANDARD`.

## References

- [Project Overview](../analysis/project-overview.md)
- [Module Inventory](../analysis/module-inventory.md)
- [Risk Assessment](../analysis/risk-assessment.md)
- [Task Breakdown](../plan/task-breakdown.md)
- [Dependency Graph](../plan/dependency-graph.md)
- [Milestones](../plan/milestones.md)

## Milestones

| Phase | Name | Milestone URL | Open | Closed | Total |
|:--|:--|:--|--:|--:|--:|
| 1 | I18n Foundation | https://github.com/zhu1090093659/deepseek-pp/milestone/26 | 0 | 3 | 3 |
| 2 | User-Facing Runtime UI | https://github.com/zhu1090093659/deepseek-pp/milestone/27 | 0 | 4 | 4 |
| 3 | Model-Facing English Behavior | https://github.com/zhu1090093659/deepseek-pp/milestone/28 | 0 | 4 | 4 |
| 4 | Data, Sync, and Cross-Browser Compatibility | https://github.com/zhu1090093659/deepseek-pp/milestone/29 | 0 | 2 | 2 |
| 5 | QA, Documentation, and Release Readiness | https://github.com/zhu1090093659/deepseek-pp/milestone/30 | 0 | 3 | 3 |

## Issue Mapping

| Task ID | Issue | Title | Status |
|:--|:--|:--|:--|
| T1.1 | #134 | Create typed locale contract and resources | closed |
| T1.2 | #135 | Add locale resolution, preference storage, and accessors | closed |
| T1.3 | #136 | Wire manifest localization assets | closed |
| T2.1 | #137 | Migrate sidepanel shell and shared UI | closed |
| T2.2 | #138 | Migrate Settings, Memory, Preset, Skill, and GitHub import pages | closed |
| T2.3 | #139 | Migrate MCP, Tools, Automation, Chat, and Capabilities pages | closed |
| T2.4 | #140 | Migrate content and background user-facing surfaces | closed |
| T3.1 | #141 | Localize prompt augmentation and tool-call guidance | closed |
| T3.2 | #142 | Localize local tool descriptors and result summaries | closed |
| T3.3 | #143 | Add English builtin Skill behavior | closed |
| T3.4 | #144 | Localize continuation, automation, and inline-agent model prompts | closed |
| T4.1 | #145 | Guard persisted data and sync from translation | closed |
| T4.2 | #146 | Verify cross-browser locale lifecycle behavior | closed |
| T5.1 | #147 | Add i18n coverage audit | closed |
| T5.2 | #148 | Update public docs and store-facing text | closed |
| T5.3 | #149 | Run final validation chain | closed |

## Quick Status Commands

```bash
# Phase progress
gh api repos/zhu1090093659/deepseek-pp/milestones \
  --jq '.[] | select(.number >= 26 and .number <= 30) | "\(.title): \(.open_issues) open, \(.closed_issues) closed"'

# Open tasks for the active phase
gh issue list -R zhu1090093659/deepseek-pp \
  --milestone "Phase 1: I18n Foundation" \
  --state open \
  --json number,title

# All current i18n spec tasks
gh issue list -R zhu1090093659/deepseek-pp \
  --label "spec-driven" \
  --state all \
  --json number,title,state,milestone
```

## Phase Checklist

- [x] Phase 1: I18n Foundation (3/3 tasks) — [milestone](https://github.com/zhu1090093659/deepseek-pp/milestone/26)
- [x] Phase 2: User-Facing Runtime UI (4/4 tasks) — [milestone](https://github.com/zhu1090093659/deepseek-pp/milestone/27)
- [x] Phase 3: Model-Facing English Behavior (4/4 tasks) — [milestone](https://github.com/zhu1090093659/deepseek-pp/milestone/28)
- [x] Phase 4: Data, Sync, and Cross-Browser Compatibility (2/2 tasks) — [milestone](https://github.com/zhu1090093659/deepseek-pp/milestone/29)
- [x] Phase 5: QA, Documentation, and Release Readiness (3/3 tasks) — [milestone](https://github.com/zhu1090093659/deepseek-pp/milestone/30)

## Current Status

**Active Phase**: Complete
**Active Task**: None
**Blockers**: None

## Governance Status

**Shared instruction surface**: `AGENTS.md`, auto-generated from Claude project memory. Do not hand-edit for durable rules unless the sync source is also updated.
**Claude Code instruction surface**: no root `CLAUDE.md`; `.claude/settings.local.json` exists.
**Other platform rule surfaces**: `.codex/skills/` exists but has no project skill files; no Cursor/Windsurf/Cline rules found.
**Memory surface**: Codex native memory.
**Memory fallback path**: none. Do not create repo-local fallback memory unless explicitly selected.

## Execution Telemetry

Per-task telemetry should be written to the corresponding GitHub Issue as comments. Adaptive drift state lives in Milestone descriptions under the `adaptive` YAML block.

## Notes

- GitHub issue gate requires the issue-form sections as `###` headings: `Issue type`, `Summary`, `Expected outcome`, `Details / reproduction`, and `Environment`. Issues #134-#149 were updated to that format and reopened after the first auto-close.
- The repository already had an unrelated local deletion before this run: `audit-report-deepseek-pp-2026-06-05.html`. Do not revert it as part of i18n work.
- First English release explicitly includes model-facing behavior, not only UI copy.
- User-authored data must not be translated or mutated by locale changes.
- Locale preference storage key is `deepseek_pp_locale_preference`. Resolution order is explicit preference, then browser language in `auto` mode, then `zh-CN` fallback.
- WebExtension manifest localization uses `default_locale: 'en'`, `__MSG_extension_name__`, `__MSG_extension_description__`, and `__MSG_extension_action_title__`, with locale assets under `public/_locales/en/` and `public/_locales/zh_CN/`.
- Prompt freeze now covers both prompt-generating functions and the bilingual prompt resource blocks in `core/i18n/resources/en.ts` and `core/i18n/resources/zh-CN.ts`; update `scripts/prompt-freeze.mjs` hashes whenever model-facing prompt resources intentionally change.

## Next Steps

1. Review and stage the multilingual runtime support branch when ready.
2. Keep the unrelated local deletion `audit-report-deepseek-pp-2026-06-05.html` separate from this i18n work unless intentionally removed.

## Session Log

| Date | Session | Summary |
|:--|:--|:--|
| 2026-06-10 | Planning | Completed analysis, confirmed English model behavior in scope, created plan docs, created GitHub Milestones #26-#30 and Issues #134-#149, and initialized this progress tracker. |
| 2026-06-10 | Execution | Completed T1.1 / #134: added typed locale resources, translator helpers, interpolation, fallback metadata, array resources, parity tests, and compile validation. |
| 2026-06-10 | Execution | Completed T1.2 / #135: added locale preference normalization, browser-language resolution, storage accessors, sidepanel provider/hook, and validation. |
| 2026-06-10 | Execution | Completed T1.3 / #136: wired WebExtension manifest localization assets, updated validation scripts, built all browser targets, and passed manifest policy checks. |
| 2026-06-10 | Execution | Completed T2.1 / #137: migrated sidepanel shell navigation/loading and shared card/form/import controls to locale resources, preserved user-authored data display, and passed i18n tests, compile, verify:i18n, and Chrome build. |
| 2026-06-10 | Execution | Completed T2.2 / #138: migrated Settings, Memory, Preset, Skill, and GitHub import pages to locale resources, kept user-authored records and remote metadata untouched, and passed i18n tests, compile, and verify:i18n. |
| 2026-06-10 | Execution | Completed T2.3 / #139: migrated MCP, Tools, Automation, Chat, and Capabilities pages to locale resources, kept MCP names/tool descriptors/commands/user prompts untouched, and passed i18n tests, compile, verify:i18n, and hardcoded-Chinese page scan. |
| 2026-06-10 | Execution | Completed T2.4 / #140: migrated context menus, content export UI, permission banner, token speed title, tool blocks, inline-agent labels, pet lines, and background user-facing status text to locale resources; passed i18n tests, compile, verify:i18n, automation smoke, and MCP smoke. |
| 2026-06-10 | Execution | Completed T3.1 / #141: localized prompt augmentation, web-search guidance, Shell/Python hints, tool format reminders, memory empty text, and Skill user-input wrappers; prompt-freeze now hashes bilingual prompt resources, and request/i18n tests, prompt-freeze, compile, and verify:i18n passed. |
| 2026-06-10 | Execution | Completed T3.2 / #142: localized memory/web tool descriptors, schema descriptions, runtime summaries, validation errors, and unsupported-tool messages while preserving tool tags and schemas; passed memory/i18n tests, compile, verify:i18n, and hardcoded-Chinese core/tool scan. |
| 2026-06-10 | Execution | Completed T3.3 / #143: added English builtin Skill descriptions and model instructions, kept canonical default skills plus official/custom/remote Skill content unchanged, refreshed runtime state on locale changes, and passed skill-localization/request tests, compile, and verify:i18n. |
| 2026-06-10 | Execution | Completed T3.4 / #144: localized background/automation/inline-agent continuation, nudge, finalization, and max-step model prompts while keeping control tags stable; passed inline-agent/request/i18n tests, prompt-freeze, compile, verify:i18n, and MCP live mock. |
| 2026-06-10 | Execution | Completed T4.1 / #145: added persisted-data i18n boundary tests for custom/remote skills, presets, scenarios, automation prompts, MCP URLs/headers/secrets, and WebDAV sync validators; passed persisted-data/skill/sync tests, compile, and verify:i18n. |
| 2026-06-10 | Execution | Completed T4.2 / #146: extended verify:i18n with locale lifecycle/static checks, verified context-menu refresh and runtime state reload boundaries, and passed compile plus Chrome/Edge/Firefox builds and manifest policy checks. |
| 2026-06-10 | Execution | Completed T5.1 / #147: added hardcoded-Chinese i18n coverage audit, wired it into verify:i18n, localized the Skill popup hint, documented intentional exceptions, and passed i18n audit, i18n tests, and compile. |
| 2026-06-10 | Execution | Completed T5.2 / #148: updated README, README_EN, and Chrome Web Store copy for English/Simplified Chinese UI and model behavior, removed protocol-level store listing detail, and passed whitespace plus public-doc leakage checks. |
| 2026-06-10 | Execution | Completed T5.3 / #149: ran final validation chain: verify:i18n, prompt:freeze, compile, targeted i18n/runtime tests, full Vitest suite, Chrome/Edge/Firefox builds, manifest policy, automation smoke, MCP mock smoke, MCP smoke, whitespace checks, and final diff review. |
