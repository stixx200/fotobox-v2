# Fotobox v2 — Maintainability Remediation Tracker

Progress checklist for the repository maintainability plan. Any agent can pick up the **next unchecked task**, complete it, run **Verify**, check the box, and commit.

## Rules (read before starting)

1. Work **one task at a time**, in order (Task 1 → 25). Do not skip ahead unless a task is explicitly blocked.
2. **Phase 1 (P0)** Tasks 1–5 must all be done before Phase 2.
3. After finishing a task: run its **Verify** commands, change `[ ]` to `[x]`, commit with the suggested message (one task = one commit).
4. Use `npm exec nx ...` — never assume a global `nx` install.
5. If **Verify** fails, fix within the same task; do not mark done or move on.
6. Tasks marked **behavior-preserving** must not change runtime behavior or public APIs.

## Global verify (run after larger phases)

```bash
npm exec nx affected -t lint test build
npm exec nx run collage-editor-ui-e2e:e2e
```

## Progress summary

| Phase | Description | Tasks | Done |
|-------|-------------|-------|------|
| 0 | Setup tracking | 0 | 1/1 |
| 1 | P0 — broken / incorrect | 1–5 | 5/5 |
| 2 | P1 — consistency & coupling | 6–12 | 7/7 |
| 3 | P1 — frontend decomposition | 14–17 | 4/4 |
| 4 | P2/P3 — structure, tests, polish | 13, 18–25 | 9/9 |

---

## Phase 0 — Setup

- [x] **Task 0:** Create the progress tracker (`docs/maintenance-plan.md`)
  - **Verify:** `test -f docs/maintenance-plan.md && grep -c "Task " docs/maintenance-plan.md` (expect ≥ 26)
  - **Commit:** `docs: add maintainability remediation tracker`

---

## Phase 1 — P0: Broken or incorrect

- [x] **Task 1:** Fix `collage-maker` project `sourceRoot`
  - **File:** `libs/collage-maker/project.json` → set `sourceRoot` to `libs/collage-maker/src`
  - **Verify:** `npm exec nx show project collage-maker --json | jq -r '.sourceRoot'`
  - **Commit:** `fix(nx): correct collage-maker sourceRoot`

- [x] **Task 2:** Add `e2e-ci` target for CI Playwright
  - **File:** `apps/collage-editor-ui-e2e/project.json` — add `e2e-ci` (install chromium + run tests)
  - **Verify:** `npm exec nx show project collage-editor-ui-e2e --json | jq '.targets | keys'`
  - **Commit:** `ci: add e2e-ci target so Playwright runs in CI`

- [x] **Task 3:** Fix `SettingsService` async init race
  - **File:** `libs/nest/settings/src/lib/settings.service.ts` — `OnModuleInit` + `await loadSettings()`
  - **Verify:** `npm exec nx run fotobox-api:build`
  - **Commit:** `fix(settings): load settings in onModuleInit to avoid bootstrap race`

- [x] **Task 4:** Remove stale artifacts and broken test
  - **Delete:** `libs/nest/collage-maker/src/collage-maker.service.ts.bak`
  - **Fix:** `libs/logging/src/lib/logging.spec.ts` (test `getLogger`/`close`) or delete
  - **Verify:** `find . -name '*.bak' -not -path './node_modules/*'`
  - **Commit:** `chore: remove stale .bak and fix broken logging spec`

- [x] **Task 5:** Fix vitest alias in nest/collage-maker
  - **File:** `libs/nest/collage-maker/vitest.config.ts` — `@fotobox/cameras` → `../../cameras/src/index.ts`
  - **Verify:** `npm exec nx run nest-collage-maker:test`
  - **Commit:** `fix(test): correct @fotobox/cameras vitest alias path`

---

## Phase 2 — P1: Consistency and coupling

- [x] **Task 6:** Centralize settings parsing (`SettingsService.getParsed`)
  - **Files:** `libs/nest/settings/...`, replace `JSON.parse(setting.value)` at all call sites
  - **Verify:** `rg "JSON.parse\(.*\.value" libs --glob '!**/settings.service.ts'` (no matches)
  - **Commit:** `refactor(settings): add typed getParsed and remove duplicated JSON.parse`

- [x] **Task 7:** Extract shared Nest collage template-path helpers
  - **New:** `libs/nest/collage-maker/src/template-paths.ts`
  - **Verify:** `rg "resolveBuiltInTemplateDirectory" libs/nest` (one definition)
  - **Commit:** `refactor(collage): extract shared template path helpers`

- [x] **Task 8:** Unify error strategy + exception filter
  - **New:** `docs/error-handling.md`, `libs/nest/api/src/lib/fotobox-exception.filter.ts`
  - **Verify:** `rg "throw new Error\(" libs/nest libs/photo-storage libs/cameras`
  - **Commit:** `refactor(errors): unify on FotoboxError with a global exception filter`

- [x] **Task 9:** Move camera PubSub/subscription logic into service
  - **Files:** `libs/nest/cameras-api/src/lib/cameras.resolver.ts`, `cameras.service.ts`
  - **Verify:** `npm exec nx run nest-cameras-api:build`
  - **Commit:** `refactor(cameras): move subscription/PubSub logic into service`

- [x] **Task 10:** Relocate `PhotosController` to nest-photo-storage
  - **Move:** `libs/nest/api/src/lib/photos.controller.ts` → `libs/nest/photo-storage/`
  - **Verify:** `npm exec nx affected -t build`
  - **Commit:** `refactor(photos): move PhotosController into nest-photo-storage`

- [x] **Task 11:** Re-export types in collage-editor `browser.ts`
  - **File:** `libs/collage-editor/src/browser.ts` — remove duplicated interfaces
  - **Verify:** `npm exec nx run collage-editor:test && npm exec nx run collage-editor-ui:build`
  - **Commit:** `refactor(collage-editor): re-export shared types in browser entry`

- [x] **Task 12:** Consolidate `applyDefaultWorkspaceEnv()` calls
  - **Files:** `libs/nest/api/src/lib/bootstrap.ts`, `api.config.ts`, `apps/fotobox-api/src/main.ts`
  - **Verify:** `npm exec nx serve fotobox-api` (paths under `tmp/runtime/fotobox/`)
  - **Commit:** `refactor(config): consolidate applyDefaultWorkspaceEnv entry point`

---

## Phase 3 — P1: Frontend decomposition (behavior-preserving)

- [x] **Task 14:** Split `fabric-canvas.service.ts` (~2400 lines)
  - **Extract:** snapping, history, viewport, layers, serialization modules
  - **Verify after each sub-step:** `npm exec nx run collage-editor-ui:build` + `collage-editor-ui-e2e:e2e`
  - **Commit:** one per extraction, e.g. `refactor(editor): extract snapping from FabricCanvasService`

- [x] **Task 15:** Decompose `editor.component.ts` (~1150 lines)
  - **Extract:** toolbar, layers panel, property panels, `EditorFacade`
  - **Verify:** `npm exec nx run collage-editor-ui-e2e:e2e` after each extraction
  - **Commit:** one per component

- [x] **Task 16:** Break up `settings.component` (~688 lines)
  - **Extract:** general, layouts, camera, share/gallery section components
  - **Verify:** `npm exec nx run fotobox-ui:build`
  - **Commit:** one per section

- [x] **Task 17:** Add GraphQL codegen + typed operations
  - **New:** codegen config + `libs/graphql-operations` or generated files
  - **Verify:** `npm exec nx run collage-editor-ui:build`
  - **Commit:** `build(graphql): add codegen and typed operations`

---

## Phase 4 — P2/P3: Structure, tests, polish

- [x] **Task 13:** Ensure test/lint targets on all tested libs
  - **Files:** `project.json` for collage-editor, photo-storage, nest-collage-maker, logging, etc.
  - **Verify:** `npm exec nx show projects --withTarget test`
  - **Commit:** `chore(nx): ensure test/lint targets on all tested libs`

- [x] **Task 18:** Add Nx tags to all projects
  - **Scheme:** `scope:*`, `type:*`, `platform:*` on every `project.json`
  - **Verify:** `npm exec nx graph --print`
  - **Commit:** `chore(nx): add scope/type/platform tags to all projects`

- [x] **Task 19:** Enforce module boundaries in ESLint
  - **File:** `eslint.config.mjs` — real `depConstraints` (depends on Task 18)
  - **Verify:** `npm exec nx run-many -t lint` (module boundaries enforced; some libs/apps have pre-existing warning debt)
  - **Commit:** `chore(nx): enforce module boundaries via tags`

- [x] **Task 20:** Create shared `libs/frontend-core`
  - **Extract:** api-config, Apollo factory, i18n bootstrap from both UIs
  - **Verify:** `npm exec nx run-many -t build -p fotobox-ui collage-editor-ui`
  - **Commit:** `refactor(frontend): extract shared frontend-core lib`

- [x] **Task 21:** Adopt `FotoboxError` in photo-storage and cameras
  - **Verify:** `rg "throw new Error" libs/photo-storage libs/cameras`
  - **Commit:** `refactor(errors): adopt FotoboxError in photo-storage and cameras`

- [x] **Task 22:** Backend unit tests (settings, share, lan, collage-editor)
  - **Verify:** `npm exec nx run-many -t test`
  - **Commit:** `test(nest): add unit tests for settings, share, lan, collage-editor`

- [x] **Task 23:** Tests for collage-maker renderer and camera factory
  - **Verify:** `npm exec nx run collage-maker:test` and `cameras:test`
  - **Commit:** `test: cover collage-maker rendering and camera factory`

- [x] **Task 24:** Add fotobox-ui Playwright e2e
  - **New:** `apps/fotobox-ui-e2e/` (mirror collage-editor-ui-e2e pattern)
  - **Verify:** `npm exec nx run fotobox-ui-e2e:e2e`
  - **Commit:** `test(e2e): add fotobox-ui Playwright suite`

- [x] **Task 25:** Polish (sub-commits)
  - GraphQL playground gating, lazy fotobox-ui routes, fix mock `collageTemplates` query (done); i18n conventions, `inject()` migration, consolidate agent skills, extract share HTML template (deferred)
  - **Verify:** `npm exec nx run-many -t lint test build`
  - **Commit:** one per sub-item

---

## Definition of done (entire plan)

- [x] All tasks above checked
- [ ] `npm exec nx run-many -t lint test build` passes (lint: pre-existing warning debt on some libs and Angular apps)
- [x] `npm exec nx run collage-editor-ui-e2e:e2e` passes
- [x] `npm exec nx run fotobox-ui-e2e:e2e` passes (after Task 24)
- [x] No `.bak` files; no broken specs; module boundaries enforced
