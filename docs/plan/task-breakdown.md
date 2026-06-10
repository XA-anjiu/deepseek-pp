# Task Breakdown

## Confirmed Task Definition

DeepSeek++ will add first-class multilingual support, with English as the first additional runtime language. The first English release includes both user-facing extension UI and model-facing behavior: prompt augmentation, tool descriptors/result summaries, inline-agent continuation prompts, builtin Skill descriptions/instructions, context menus, manifest text, sidepanel UI, content-script injected UI, pet lines, and visible runtime errors/progress.

Locale selection should support `auto | zh-CN | en`. `auto` resolves from browser language and falls back to `zh-CN`. User-authored data such as memories, presets, custom skills, imported skills, MCP configs, automation prompts, scenario labels, commands, URLs, and WebDAV snapshots must never be translated or mutated.

## Overview

- **Total Phases**: 5
- **Total Tasks**: 16
- **Estimated Total Effort**: XL
- **Tracking Mode**: GITHUB_STANDARD

## S.U.P.E.R Design Constraints

- **S (Single Purpose)**: Locale resolution, resource lookup, React integration, content/background usage, and model-facing prompt selection must be separate modules or helpers.
- **U (Unidirectional Flow)**: UI/content/background/model builders consume a shared locale port. Locale resources must not import UI, background, or content implementation files.
- **P (Ports over Implementation)**: Locale keys and resources must be typed. English and Chinese resources must pass parity tests. Cross-module I/O remains serializable.
- **E (Environment-Agnostic)**: Locale resolution must work in sidepanel, background, content script, Chrome, Edge, and Firefox builds without assuming one global DOM or one browser-only API.
- **R (Replaceable Parts)**: Adding a third language should primarily mean adding a resource object and locale messages, not editing every UI surface.

## Testing and Governance Constraints

- Feature work must add or update automated tests.
- Locale resource parity and resolver behavior are mandatory tests.
- Model-facing text changes must update prompt-freeze coverage or the equivalent deterministic guard.
- Public documentation must stay user-facing and not expose internal API/protocol details.
- Stable i18n invariants discovered during implementation should be recorded in the resolved native memory surface after execution.

## Phase 1: I18n Foundation

**Goal**: Establish the single localization port and browser packaging foundation before touching feature surfaces.

**Prerequisite**: Phase 1 analysis complete; scope includes English model behavior.

**S.U.P.E.R Focus**: P, U, R

| # | Task | Priority | Effort | Depends On | Lane | S.U.P.E.R | Test Expectation | Memory Impact | Acceptance Criteria |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| T1.1 | Create typed locale contract, `zh-CN` and `en` resource roots, translator helpers, interpolation, fallback behavior, and resource parity tests. | P0 | M | - | A | P, R | Add unit tests for locale resolution, fallback, interpolation, and key parity. | Record durable i18n contract if final shape changes future work. | `zh-CN` and `en` resources compile; missing keys fail tests; fallback is explicit and observable. |
| T1.2 | Add runtime locale resolution and preference persistence for `auto | zh-CN | en`, with React and non-React accessors. | P0 | M | T1.1 | A | U, E, R | Add unit tests for preference normalization and browser-language resolution. | Record storage key and resolution order if stable. | Sidepanel, content script, and background can request the same resolved locale without duplicating logic. |
| T1.3 | Add extension manifest localization assets and WXT manifest wiring for name, description, and action title. | P1 | S | T1.1 | B | P, E | Add static validation for `_locales` messages and run affected browser build check when feasible. | None unless WXT packaging gotcha emerges. | Chrome/Edge/Firefox manifest generation keeps existing permissions/settings and uses locale message keys where supported. |

### Parallel Lanes

| Lane | Tasks | Combined Effort | Merge Risk | Key Files |
|:--|:--|:--|:--|:--|
| A | T1.1, T1.2 | M+M | Medium | `core/i18n/**`, `tests/i18n*.test.ts` |
| B | T1.3 | S | Low after T1.1 key names settle | `wxt.config.ts`, `public/_locales/**` or WXT-supported locale asset path |

## Phase 2: User-Facing Runtime UI

**Goal**: Migrate static extension UI and injected host-page UI to the shared i18n port.

**Prerequisite**: Phase 1 complete.

**S.U.P.E.R Focus**: S, U, P, R

| # | Task | Priority | Effort | Depends On | Lane | S.U.P.E.R | Test Expectation | Memory Impact | Acceptance Criteria |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| T2.1 | Migrate sidepanel shell, navigation, loading states, shared form/card controls, and shared aria/title text. | P0 | M | T1.2 | A | U, P, R | Add/adjust React or pure rendering tests where practical; otherwise locale key parity plus compile. | None. | Navigation and shared controls render English under `en` and Chinese under `zh-CN`. |
| T2.2 | Migrate Settings, Memory, Preset, Skill, and GitHub Skill import pages without translating user-authored data. | P0 | L | T2.1 | A | S, P, R | Add targeted tests for locale strings and non-translation boundaries where pure helpers exist. | Record non-translation invariant if not already in progress docs. | Feature pages use locale keys for static copy; stored values remain untouched. |
| T2.3 | Migrate MCP, Tools, Automation, Chat, Capabilities pages and runtime status/error text surfaced in sidepanel. | P0 | L | T2.1 | B | S, P, R | Add targeted tests for status helpers and deterministic locale selection; update existing smoke assertions. | None. | Tool/MCP/automation UI shows English static copy and keeps external tool/server names unchanged. |
| T2.4 | Migrate content/background user-facing surfaces: context menus, export menu/toasts/progress, tool blocks, Agent step labels, permission prompts, Python labels, token speed titles, and pet lines. | P0 | L | T1.2 | C | S, U, P, R | Add unit tests for text helpers where extractable; update smoke assertions that expect Chinese labels. | Record any content-script i18n helper pattern if durable. | Injected DeepSeek page UI and context menus resolve language consistently with the chosen locale. |

### Parallel Lanes

| Lane | Tasks | Combined Effort | Merge Risk | Key Files |
|:--|:--|:--|:--|:--|
| A | T2.1, T2.2 | M+L | Medium | `entrypoints/sidepanel/App.tsx`, shared components, Settings/Memory/Preset/Skill pages |
| B | T2.3 | L | Medium | MCP/Tools/Automation/Chat/Capabilities pages |
| C | T2.4 | L | High | `entrypoints/content.ts`, `entrypoints/background.ts`, `core/pet/lines.ts` |

## Phase 3: Model-Facing English Behavior

**Goal**: Make model-facing behavior locale-aware so English runtime mode produces English instructions, tool contracts, summaries, and builtin Skill behavior.

**Prerequisite**: Phase 1 complete; Phase 2 can proceed in parallel for independent UI files, but final validation depends on both.

**S.U.P.E.R Focus**: P, E, R

| # | Task | Priority | Effort | Depends On | Lane | S.U.P.E.R | Test Expectation | Memory Impact | Acceptance Criteria |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| T3.1 | Make prompt augmentation and web/search/tool-call guidance locale-aware, including prompt-freeze updates for both Chinese and English variants. | P0 | M | T1.2 | A | P, R | Update prompt-freeze fixtures and add unit tests for locale-specific prompt output. | Record prompt-freeze/i18n invariant if stable. | English mode emits English model instructions while preserving executable XML format rules. |
| T3.2 | Localize local tool descriptors, schema descriptions, result summaries, and runtime parse/unsupported-tool errors. | P0 | M | T1.2 | B | P, R | Update memory/web tool tests for English and Chinese summaries/descriptors. | None. | Tool descriptors and model-visible result summaries match resolved locale without changing tool names or schemas. |
| T3.3 | Add English variants for builtin Skill descriptions/instructions and select display/model text by locale. | P0 | L | T1.2 | C | P, R | Add tests for builtin skill lookup, locale selection, and no mutation of custom/remote skills. | Record builtin skill localization boundary if stable. | Builtin skills have English descriptions/instructions in English mode; custom and remote skills remain as authored/imported. |
| T3.4 | Localize background chat/tool-loop continuation prompts, automation model prompts, inline-agent continuation/nudge/finalization prompts, and max-step termination messages. | P0 | M | T1.2 | D | P, E, R | Add/update unit tests for inline-agent prompt builders and background-extracted helpers where feasible. | None. | English mode uses English continuation/nudge/finalization behavior without breaking loop control tags. |

### Parallel Lanes

| Lane | Tasks | Combined Effort | Merge Risk | Key Files |
|:--|:--|:--|:--|:--|
| A | T3.1 | M | Medium | `core/prompt/**`, prompt freeze scripts/fixtures |
| B | T3.2 | M | Medium | `core/tool/**`, `tests/memory-tool.test.ts` |
| C | T3.3 | L | Medium | `core/skill/builtin.ts`, `core/skill/registry.ts` |
| D | T3.4 | M | Medium | `entrypoints/background.ts`, `core/inline-agent/prompt.ts`, `core/automation/**` |

## Phase 4: Data, Sync, and Cross-Browser Compatibility

**Goal**: Ensure localization does not corrupt user data and works across supported browser targets.

**Prerequisite**: Phases 1-3 implemented enough to exercise runtime language paths.

**S.U.P.E.R Focus**: E, R, P

| # | Task | Priority | Effort | Depends On | Lane | S.U.P.E.R | Test Expectation | Memory Impact | Acceptance Criteria |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| T4.1 | Add non-translation guards around persisted user data and WebDAV sync boundaries. | P0 | M | T2.2, T3.3 | A | P, E | Add tests proving memories, custom skills, imported skills, presets, scenarios, MCP configs, automation prompts, URLs, and commands are not transformed by locale changes. | Record invariant if stable. | Switching locale changes static UI/model scaffolding only, never stored user content. |
| T4.2 | Verify locale behavior for Chrome, Edge, Firefox, context-menu refresh, content/background lifecycle, and settings changes. | P1 | M | T2.4, T3.4 | B | E, R | Run targeted build checks and add smoke/static checks for context-menu recreation and manifest locale assets. | Record browser-specific gotchas if discovered. | Existing multi-browser manifest differences remain intact and locale changes do not require extension reload except where browser APIs require it. |

### Parallel Lanes

| Lane | Tasks | Combined Effort | Merge Risk | Key Files |
|:--|:--|:--|:--|:--|
| A | T4.1 | M | Medium | storage/sync/skill tests |
| B | T4.2 | M | Low | `wxt.config.ts`, background/content lifecycle helpers, build scripts |

## Phase 5: QA, Documentation, and Release Readiness

**Goal**: Close the first English release with deterministic validation and public-facing docs.

**Prerequisite**: Phases 1-4 complete.

**S.U.P.E.R Focus**: P, E, R

| # | Task | Priority | Effort | Depends On | Lane | S.U.P.E.R | Test Expectation | Memory Impact | Acceptance Criteria |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| T5.1 | Add an i18n coverage audit that catches missing English keys and obvious hardcoded Chinese in English-targeted static surfaces, with allowlists for user data, docs, fixtures, and Chinese resources. | P0 | M | T2.4, T3.4 | A | P, R | Add script or Vitest coverage check and run it in targeted validation. | Record audit command if stable. | English-targeted static surfaces have automated coverage and intentional exceptions are explicit. |
| T5.2 | Update public-facing docs and Chrome Web Store text to mention English UI/model behavior support without exposing internal implementation details. | P1 | S | T5.1 | B | S, E | Docs-only validation: `git diff --check` and grep checks for implementation leakage. | None. | README/README_EN and store-facing docs describe user-visible multilingual support consistently. |
| T5.3 | Run final validation chain: targeted unit tests, `npm run compile`, affected builds, and the smallest relevant smoke checks. | P0 | M | T5.1, T5.2 | C | E, R | Run and record validation results; explain any skipped checks. | Record reusable command sequence if final. | The implementation passes deterministic tests and build checks required for the English runtime release. |

### Parallel Lanes

| Lane | Tasks | Combined Effort | Merge Risk | Key Files |
|:--|:--|:--|:--|:--|
| A | T5.1 | M | Medium | tests/scripts and locale resources |
| B | T5.2 | S | Low | `README.md`, `README_EN.md`, `docs/chrome-web-store/**` |
| C | T5.3 | M | Low | validation commands and generated build outputs |
