# Risk Assessment

## S.U.P.E.R Architecture Health Summary

| Principle | Status | Key Findings | Transformation Priority |
|:--|:--|:--|:--|
| **S** Single Purpose | 🔴 | The two largest entrypoints, `entrypoints/content.ts` and `entrypoints/background.ts`, combine orchestration, UI rendering, behavior text, and error messages. | High |
| **U** Unidirectional Flow | 🟡 | The broad flow is healthy: UI/background/content consume `core/*`. The weakness is text flowing from implementation files directly to UI/model surfaces instead of through a locale port. | Medium |
| **P** Ports over Implementation | 🟡 | Tool descriptors and domain data are typed, but localized text has no key schema, completeness check, or serializable resource contract. | High |
| **E** Environment-Agnostic | 🟡 | Browser/platform assumptions are expected, but language defaults, `Accept-Language` headers, manifest text, and model prompts are hardcoded. | Medium |
| **R** Replaceable Parts | 🔴 | Replacing Chinese with English currently requires broad edits across React, DOM scripts, service worker, core tool descriptors, prompt builders, and tests. | High |

**Overall Health**: 2/5 principles healthy enough for the current product shape, but i18n needs refactoring first. The codebase is not in technical-debt-alert territory overall, but localization specifically is a structural gap.

### S.U.P.E.R Violation Hotspots

1. `entrypoints/content.ts` — inline Chinese text across export UI, tool cards, Agent traces, permissions, pet UI, and status labels.
2. `entrypoints/background.ts` — inline Chinese in context menus, errors, export progress, WebDAV handling, and chat continuation prompts.
3. `entrypoints/sidepanel/pages/*.tsx` — extensive inline Chinese across feature pages, including validation messages and status text.
4. `core/tool/memory.ts` and `core/tool/web-search.ts` — localized tool descriptors and result summaries embedded in model-facing runtime contracts.
5. `core/prompt/augmentation.ts`, `core/inline-agent/prompt.ts`, `core/skill/builtin.ts` — prompt and skill text are behavior-defining, so translation can change model outputs.
6. `wxt.config.ts` — manifest text is hardcoded and no `_locales` asset tree exists.

## Risk Matrix

| Risk | Impact | Likelihood | Severity | Mitigation |
|:--|:--|:--|:--|:--|
| Treating i18n as search-replace | High: regressions and inconsistent UI/model language | High | High | Add a typed i18n resource contract and migrate by surface. |
| Mixing UI translation with prompt/tool behavior changes | High: prompt freeze or tool-call behavior changes | High | High | Classify strings into UI, browser/manifest, model-facing, and external/user data before translating. |
| Missing runtime locale availability in content/background | Medium: UI works in sidepanel but injected UI stays Chinese | High | High | Provide a small non-React translator usable from content/background. |
| Manifest localization differs by browser target | Medium: build/package problems | Medium | Medium | Keep WXT manifest as source and add `_locales` only through the supported manifest fields. |
| Incomplete key coverage | Medium: mixed-language product | High | High | Add tests that assert key parity between `zh-CN` and `en`. |
| User-authored data accidentally translated | High: corrupt user memories, skills, presets, commands, URLs | Medium | High | Translation API only accepts static keys; never run translator over stored content. |
| Hidden dependency on Chinese text in tests/scripts | Medium: failing CI or stale smoke assertions | Medium | Medium | Update deterministic assertions and add explicit locale tests. |
| Browser language vs user preference ambiguity | Medium: surprising language selection | Medium | Medium | Define resolution order before implementation. Recommended: explicit setting > browser UI language > Chinese fallback. |

## High-Severity Risks

### No single text boundary

The project has no current text boundary. Any English implementation that edits strings in place will create a second source of truth and make future languages expensive. This should be handled as a structural fix: a typed locale resource table plus a tiny translator API used by React, content script, background and core display helpers.

### Model-facing text can change behavior

Tool descriptions, prompt augmentation, inline agent continuation prompts, and builtin skill instructions are not just UI copy. They influence whether DeepSeek emits executable XML tools and how the extension continues agentic loops. English support should not silently translate these as part of a UI-only pass. If included, they need tests and prompt-freeze awareness.

### Content script size and host-page fragility

`entrypoints/content.ts` is large and tightly coupled to host DOM behavior. A broad mechanical migration in this file has high regression risk. The safer structure is to introduce `core/i18n` first, then migrate small groups of DOM text helpers with targeted tests and manual smoke later.

## Technical Debt

- Inline Chinese copy is duplicated across UI, runtime summaries, tests, and docs.
- `entrypoints/background.ts` and `entrypoints/content.ts` are too large to make language behavior replaceable cheaply.
- Existing smoke scripts duplicate some runtime tool descriptors instead of importing one source.
- Prompt/tool text lacks a locale/freeze contract.
- No `_locales` directory or manifest message key strategy exists.

## Testing Risks

- Current Vitest setup is sufficient for pure i18n resolver/resource tests.
- There are no sidepanel render tests for locale-specific UI.
- `scripts/automation-contract-smoke.mjs` asserts Chinese labels in `App.tsx`; it must be updated once navigation labels are moved behind i18n.
- Network smoke scripts should not become locale acceptance gates.
- Full `ci:quality` is expensive and includes release packaging; targeted locale tests plus `npm run compile` should be the first validation layer during implementation.

## Project Governance Risks

- `AGENTS.md` is auto-generated from Claude project memory; direct edits may be overwritten by the sync script. If future-agent localization rules are needed, prefer updating the upstream Claude memory surface or explicitly recording the limitation in progress docs.
- Codex native memory is the resolved durable memory surface. Do not create a repo-local memory file unless the user explicitly asks.
- There is no active `docs/progress/MASTER.md`, so Phase 4 must create one for this run after plan confirmation.
- Existing memory says public README should not expose internal API/protocol details; any docs for English support should keep README public-facing and avoid implementation internals.

## Compatibility Concerns

- Chrome extension manifest i18n (`__MSG_key__` + `_locales`) has browser-specific packaging implications under WXT.
- Firefox MV3 build should keep its `browser_specific_settings` unchanged.
- Context menu titles and side panel action titles need translation at creation time; they will not update unless menus are recreated after locale changes.
- Tool result summaries shown in the page and sent back into model loops may shift if translated. This needs explicit scope control.
- User data stored in memories, skills, presets, scenarios, MCP configs, automation prompts, and WebDAV snapshots should remain unchanged.

## Recommended Phase 2 Decision Points

- **Locale selection**: explicit setting plus auto mode, or browser language only. Recommended first version: `auto | zh-CN | en`, with `auto` resolving browser language and falling back to `zh-CN`.
- **Scope for first English release**: recommended P0 scope is sidepanel UI, content-script injected UI, context menus, manifest title/description, pet lines, and user-facing runtime errors/progress. Defer model-facing prompt/skill instruction translation unless the user wants English model behavior too.
- **Testing policy**: add locale resource parity tests and resolver tests; update deterministic smoke assertions; run `npm run compile` and targeted `npm test`.
- **Governance**: record i18n invariants in `docs/progress/MASTER.md`; update native memory after execution if stable rules emerge.
