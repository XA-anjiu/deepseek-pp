# Module Inventory

| Module | Responsibility | Dependencies | Files | Lines | Complexity | S.U.P.E.R Score |
|:--|:--|:--|--:|--:|:--|:--|
| Extension config | Build target and manifest generation | WXT, package metadata | 2 | ~150 | Medium | S🟡 U🟢 P🟡 E🟡 R🟡 |
| Background service worker | Runtime orchestration, storage messages, context menus, chat loops, export and automation | Most `core/*`, Chrome APIs | 1 | ~1430 | Critical | S🔴 U🟡 P🟡 E🟡 R🔴 |
| Content script | DeepSeek page UI injection and inline rendering | DOM, Chrome runtime, core UI helpers | 1 | ~4390 | Critical | S🔴 U🟡 P🟡 E🟡 R🔴 |
| Sidepanel shell | React app shell, navigation, lazy page mounting | React, core stores | 24 | ~6300 | High | S🟡 U🟢 P🟡 E🟢 R🟡 |
| Sidepanel feature pages | Memory, MCP, tools, settings, automation, chat, skill UI | React, Chrome messaging, core types | 8 | ~4500 | High | S🟡 U🟡 P🟡 E🟢 R🟡 |
| Core domain stores | Memory, skill, preset, scenario, sync, theme, chat, background, pet state | Dexie/chrome.storage | ~16 | ~2200 | Medium | S🟢 U🟢 P🟡 E🟡 R🟡 |
| Tool runtime | Tool descriptors, parsing, execution and history | Memory, web, MCP providers | ~12 | ~1800 | High | S🟡 U🟢 P🟡 E🟡 R🟡 |
| MCP subsystem | Server config, discovery, transports, client, store | Chrome permissions, network/native transports | ~12 | ~2500 | High | S🟡 U🟢 P🟢 E🟡 R🟡 |
| Prompt and inline agent | Prompt augmentation, continuation/nudge/finalization, renderer | Tool descriptors, memories, DOM renderer | ~8 | ~1300 | High | S🟡 U🟢 P🟡 E🟡 R🟡 |
| Export subsystem | Conversation normalization, artifacts, download formats | DeepSeek transport, PDF/html/markdown builders | ~10 | ~1600 | Medium | S🟢 U🟢 P🟢 E🟡 R🟡 |
| Automation subsystem | Task persistence, scheduling, runner, message contracts | Chrome alarms, DeepSeek adapter, tool loop | ~8 | ~1600 | High | S🟡 U🟢 P🟢 E🟡 R🟡 |
| Skill subsystem | Builtin/official/custom/remote skills and GitHub import | GitHub API, registry, OfficeCLI library | ~8 plus markdown assets | large | High | S🟡 U🟢 P🟡 E🟡 R🟡 |
| Pet subsystem | Pet config, store, random status lines | Content script renderer | 3 | ~250 | Medium | S🟢 U🟢 P🟡 E🟢 R🟡 |
| Shell native host | Native messaging package and installer | Node, host manifest, local shell | 4 | ~1500 | High | S🟡 U🟢 P🟢 E🟡 R🟡 |
| Tests and smoke scripts | Unit tests and release/smoke verification | Vitest, Node scripts, browser build outputs | ~18 | ~2500 | Medium | S🟡 U🟢 P🟡 E🟡 R🟡 |

> S.U.P.E.R Score uses `S` Single Purpose, `U` Unidirectional Flow, `P` Ports over Implementation, `E` Environment-Agnostic, `R` Replaceable Parts.

## Module Details

### Extension Config

- **Path**: `wxt.config.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`
- **Responsibility**: Define build targets, manifest, scripts, dependency graph, and test entry.
- **Public API**: package scripts and WXT manifest factory.
- **Internal Dependencies**: `package.json` version, `core/browser/safe-wxt-browser.ts`.
- **External Dependencies**: WXT, Vite, TypeScript, Vitest, React, Dexie.
- **Transformation Notes**: English support likely needs manifest-level localization for `name`, `description`, and `action.default_title`. WXT manifest generation should remain the single manifest source instead of duplicating per-browser manifests.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Manifest generation and package metadata are clean, but localized manifest strings are not separated.
  - **U**: Compliant. Build config points into core but core does not depend on build config.
  - **P**: Partial. No typed locale contract for manifest messages.
  - **E**: Partial. Browser-specific branches are explicit, but language defaults are hardcoded.
  - **R**: Partial. Browser replacement is supported; locale replacement is not.

### Background Service Worker

- **Path**: `entrypoints/background.ts`
- **Responsibility**: Own extension-wide runtime orchestration.
- **Public API**: Chrome runtime message types, context menu actions, alarm handlers, chat stream broadcasts.
- **Internal Dependencies**: memory, skill, preset, model, theme, background, pet, sync, tool, MCP, automation, DeepSeek, export, prompt modules.
- **External Dependencies**: Chrome extension APIs, DeepSeek, WebDAV, GitHub, Bing.
- **Transformation Notes**: Contains user-facing Chinese strings for context menu labels, auth errors, export progress, WebDAV errors, and chat loop continuation prompts. Locale injection must avoid making the message router responsible for translation mechanics.
- **S.U.P.E.R Assessment**:
  - **S**: Violation. The file coordinates many unrelated runtime concerns.
  - **U**: Partial. It depends on core modules, but also embeds presentation text and prompt strings.
  - **P**: Partial. Message payloads are typed by convention, not a centralized serializable schema.
  - **E**: Partial. Browser API dependencies are expected; locale and search headers are hardcoded.
  - **R**: Violation. Swapping localization, context menu language, or prompt language currently requires edits inside this large orchestrator.

### Content Script

- **Path**: `entrypoints/content.ts`
- **Responsibility**: Inject DeepSeek page affordances and render extension-owned UI inside the host page.
- **Public API**: DOM mutations, extension message listeners, restored render records.
- **Internal Dependencies**: content-level UI helpers, pet config/lines, tool result records, export types.
- **External Dependencies**: DeepSeek DOM structure, Chrome runtime messaging.
- **Transformation Notes**: This is the largest user-visible text hotspot. Export menu labels, toasts, tool block titles, Agent step statuses, permission prompts, Python labels, and pet bubble lines are all inline Chinese. It needs a small DOM-safe translator API that can be imported outside React.
- **S.U.P.E.R Assessment**:
  - **S**: Violation. Export UI, tool UI, Agent UI, token speed, permissions, and pet behavior live together.
  - **U**: Partial. Mostly runtime entry -> core/types, but UI text is not flowing through a stable port.
  - **P**: Partial. No text key contract; DOM strings are direct implementation details.
  - **E**: Partial. Strong host-page and browser assumptions are required, but locale detection is not abstracted.
  - **R**: Violation. Replacing the presentation language is a broad edit today.

### Sidepanel Shell

- **Path**: `entrypoints/sidepanel/App.tsx`, `entrypoints/sidepanel/main.tsx`, `entrypoints/sidepanel/style.css`
- **Responsibility**: Mount React, provide tabs, page shell, theme variables, and version display.
- **Public API**: Tab layout and page mounting.
- **Internal Dependencies**: `core/version`, chat store, pending text.
- **External Dependencies**: React, Chrome storage.
- **Transformation Notes**: Navigation labels and aria labels are hardcoded. This should be the first React surface to receive an i18n provider/hook.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Shell is reasonably focused, but navigation metadata mixes routing and copy.
  - **U**: Compliant. Shell owns UI and calls stores.
  - **P**: Partial. Tabs have no locale key contract.
  - **E**: Compliant for runtime; language is currently a hardcoded implementation detail.
  - **R**: Partial. Pages are replaceable through lazy imports; text is not.

### Sidepanel Feature Pages

- **Path**: `entrypoints/sidepanel/pages/*.tsx`, `entrypoints/sidepanel/components/*.tsx`
- **Responsibility**: Manage user-facing feature configuration and state.
- **Public API**: Chrome message calls and shared component props.
- **Internal Dependencies**: core types/stores, sidepanel components.
- **External Dependencies**: React, Chrome runtime.
- **Transformation Notes**: Settings, MCP, Tools, Automation, Skill, Memory, Preset, Chat and GitHub import pages all contain inline Chinese text. These should use a React translator hook but avoid translating user-authored data such as skill names, preset names, scenario labels, memory contents, URLs, commands, and imported metadata.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Some pages are long and combine form state, validation messages, remote calls, and rendering.
  - **U**: Partial. UI calls background directly and embeds some validation text.
  - **P**: Partial. Message APIs exist but lack generated contracts; locale keys do not exist.
  - **E**: Compliant enough for extension UI; no env-specific language support.
  - **R**: Partial. Components are replaceable, copy is not.

### Core Domain Stores

- **Path**: `core/memory`, `core/skill`, `core/preset`, `core/scenario`, `core/sync`, `core/theme`, `core/chat`, `core/background`, `core/pet`
- **Responsibility**: Persist and normalize domain state.
- **Public API**: `get*`, `save*`, `update*`, `delete*`, normalization functions.
- **Internal Dependencies**: shared `core/types`.
- **External Dependencies**: Dexie, Chrome storage.
- **Transformation Notes**: Locale preference should fit this pattern as a small `core/i18n/store.ts` or equivalent if manual language selection is needed. Stored user data should not be migrated or translated.
- **S.U.P.E.R Assessment**:
  - **S**: Compliant. Most stores have narrow responsibility.
  - **U**: Compliant. UI/background depend on stores.
  - **P**: Partial. Types exist, but storage schemas are mostly hand-validated.
  - **E**: Partial. Chrome storage is expected but not abstracted for tests everywhere.
  - **R**: Partial. Store implementations are separable, but consumers import concrete stores directly.

### Tool Runtime

- **Path**: `core/tool/**`
- **Responsibility**: Define local tool descriptors and execute tool calls.
- **Public API**: `getRuntimeToolDescriptors`, `executeRuntimeToolCall`, descriptors, `ToolResult`.
- **Internal Dependencies**: memory, web, MCP, tool history.
- **External Dependencies**: fetch for web search, Chrome host permissions indirectly.
- **Transformation Notes**: Tool titles, descriptions, schema descriptions, result summaries and details are model-facing and sometimes user-visible in tool cards. They should be classified separately from pure UI labels because changing their language can affect model behavior and prompt-freeze expectations.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Runtime is clean, individual providers still combine descriptors and localized result text.
  - **U**: Compliant. Runtime dispatches into providers.
  - **P**: Partial. Tool descriptors are serializable, but locale-specific text is embedded in descriptors.
  - **E**: Partial. Search headers and browser permissions are hardcoded.
  - **R**: Partial. Providers are replaceable; localized descriptors are not.

### MCP Subsystem

- **Path**: `core/mcp/**`, `core/shell/**`
- **Responsibility**: Store, discover, execute, and transport MCP tool connections.
- **Public API**: MCP server config/store/discovery/client/transport functions.
- **Internal Dependencies**: shared types, shell contracts.
- **External Dependencies**: Chrome permissions, native messaging, HTTP/SSE.
- **Transformation Notes**: MCP UI copy is mainly in sidepanel. Tool display names from MCP servers are external data and should not be translated.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Transport layers are mostly separated; discovery/store/client coupling remains moderate.
  - **U**: Compliant. UI/background call MCP modules.
  - **P**: Compliant. Config and descriptors are typed serializable structures.
  - **E**: Partial. Native/browser transport assumptions are explicit.
  - **R**: Partial. Transports are replaceable, but UI copy around them is not.

### Prompt and Inline Agent

- **Path**: `core/prompt/**`, `core/inline-agent/**`
- **Responsibility**: Build system prompts, reminders, continuation prompts, and inline Agent rendering logic.
- **Public API**: prompt builder functions and renderer functions.
- **Internal Dependencies**: tool descriptors, memory selector, constants.
- **External Dependencies**: DeepSeek prompt contract and DOM rendering.
- **Transformation Notes**: Prompt strings are product behavior, not merely UI. English runtime support must decide whether prompt language follows UI language, browser language, or remains Chinese for compatibility.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Prompt building and model behavior rules are focused, but language is hardcoded.
  - **U**: Compliant. Prompt builders depend on descriptors and memories.
  - **P**: Partial. Prompt text has no locale or freeze contract for variants.
  - **E**: Partial. Prompt language defaults are hardcoded.
  - **R**: Partial. Prompt variants cannot be swapped without editing builder source.

### Export Subsystem

- **Path**: `core/export/**`, `core/deepseek/conversation-export.ts`
- **Responsibility**: Normalize DeepSeek conversations and produce HTML/Markdown/PDF artifacts.
- **Public API**: export request schema, artifact builders, service runner.
- **Internal Dependencies**: export types/schema.
- **External Dependencies**: DeepSeek conversation API, browser download path in content script.
- **Transformation Notes**: Artifact content may contain headings/warnings such as "Export Warnings"; these are user-facing output strings and should be included in English support if export is in phase scope.
- **S.U.P.E.R Assessment**:
  - **S**: Compliant. Builders and schema are separated.
  - **U**: Compliant. Service orchestrates normalized data into artifacts.
  - **P**: Compliant. Export request/result types are explicit.
  - **E**: Partial. Artifact language is hardcoded.
  - **R**: Partial. Output format builders are replaceable; localized strings are not.

### Automation Subsystem

- **Path**: `core/automation/**`
- **Responsibility**: Store automation tasks, validate schedules, run due tasks.
- **Public API**: automation types, schedule validation, runner/scheduler functions.
- **Internal Dependencies**: DeepSeek adapter, prompt/tool runtime through background.
- **External Dependencies**: Chrome alarms, DeepSeek sessions.
- **Transformation Notes**: Schedule validation messages and runner prompts can surface in UI or model behavior. They should be classified before translation.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Storage, schedule and runner files are split; orchestration still touches several concerns.
  - **U**: Compliant. Background controls scheduler/runner.
  - **P**: Compliant. Automation types are serializable and explicit.
  - **E**: Partial. Timezone default is runtime-derived; browser alarm assumptions are hard dependencies.
  - **R**: Partial. Runner behavior and prompts are not language-pluggable.

### Skill Subsystem

- **Path**: `core/skill/**`
- **Responsibility**: Builtin skills, official OfficeCLI skills, custom skills, GitHub import.
- **Public API**: skill registry, GitHub importer, builtin skill list.
- **Internal Dependencies**: sync schema, shell contracts, types.
- **External Dependencies**: GitHub API, remote repositories, OfficeCLI markdown assets.
- **Transformation Notes**: Builtin skill descriptions/instructions are model-facing and user-visible in skill UI. Translating builtin instructions can materially affect behavior and should be explicit, tested, and likely separated from UI translation.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Registry/importer are focused; `builtin.ts` is a large mixed content source.
  - **U**: Compliant. UI/background consume the registry.
  - **P**: Partial. Skill objects are typed, but localized variants are not represented.
  - **E**: Partial. Remote imports are environment-dependent; builtin language is hardcoded.
  - **R**: Partial. Skill sources are replaceable; builtin copy/instructions are not.

### Pet Subsystem

- **Path**: `core/pet/**`, content pet renderer
- **Responsibility**: Store pet display config and provide state lines.
- **Public API**: `PET_LINES`, `pickPetLine`, config/store helpers.
- **Internal Dependencies**: shared types.
- **External Dependencies**: content script DOM.
- **Transformation Notes**: Pet lines are a compact but highly visible text asset and should be a resource table, not inline Chinese.
- **S.U.P.E.R Assessment**:
  - **S**: Compliant. Config, store and lines are clear.
  - **U**: Compliant. Content consumes pet state and lines.
  - **P**: Partial. Line resources are typed by state but not by locale.
  - **E**: Compliant.
  - **R**: Partial. Replacing pet copy requires editing the module.

### Shell Native Host

- **Path**: `packages/shell-host/**`, `native-host/**`
- **Responsibility**: Install and run the native Shell MCP host.
- **Public API**: npm binary, native host messaging protocol.
- **Internal Dependencies**: shared conventions with extension shell contracts.
- **External Dependencies**: Node, OS shell, browser native host manifests.
- **Transformation Notes**: User-facing installer messages may be in scope later, but the first plugin-English phase can reasonably focus on extension UI/runtime. Avoid mixing npm package localization with extension runtime unless requested.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Installer and host are separated, but scripts are long.
  - **U**: Compliant. Extension communicates through native messaging.
  - **P**: Compliant. Messaging contract is explicit enough for smoke tests.
  - **E**: Partial. OS/browser-specific behavior is intrinsic.
  - **R**: Partial. Host can be replaced if contract holds.

### Tests and Smoke Scripts

- **Path**: `tests/**`, `scripts/**`
- **Responsibility**: Validate core behavior, release assets, automation contracts, MCP/shell smoke, prompt freeze.
- **Public API**: npm scripts.
- **Internal Dependencies**: source files and fixtures.
- **External Dependencies**: Node, actionlint, network in selected smoke scripts.
- **Transformation Notes**: Existing smoke scripts assert Chinese strings in some places. English support should update deterministic tests and avoid network smoke as the primary locale validation.
- **S.U.P.E.R Assessment**:
  - **S**: Partial. Tests are targeted; smoke scripts sometimes duplicate runtime logic.
  - **U**: Compliant. Tests depend on source, not vice versa.
  - **P**: Partial. Some script-level mocks duplicate descriptors instead of importing contracts.
  - **E**: Partial. Network smoke and local shell assumptions can be environment-sensitive.
  - **R**: Partial. Tests can evolve, but lack i18n-specific fixtures today.
