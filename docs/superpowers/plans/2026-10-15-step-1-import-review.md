# Step 1 Import Review Implementation Plan

> **For agentic workers:** Implement directly in this session; retain the user's instruction to finish Step 1 before moving to later workflow steps. Use test-driven fixes and inspect the local UI after each change.

**Goal:** Make template selection, upload, structural parsing, detailed source review and editing one usable Step 1 for Docs-ND30's internal company release. Render A4 preview only in the separate Xem trước tab.

**Architecture:** Keep the parser pure and offline. Add a review model built from source blocks and applicable rules; render it inside Step 1. Keep import state immutable and preserve all source blocks even when classification is uncertain.

**Tech Stack:** React/TypeScript, JSZip, DOCX OOXML parser, `tsx` tests, Vite.

**Spec:** `docs/superpowers/specs/2026-10-15-step-1-import-review-design.md`.

## Global Constraints

- Use NĐ 30 administrative catalog for company documents; HD 05 only for Party regime.
- Never report a rule PASS without actual source or output evidence.
- Do not commit real employee documents.
- Do not navigate to later UI steps until Step 1 meets its acceptance checks.

## Review Focus

- First two-column body table without a national heading stays in body.
- Missing date/number/name and placeholders remain `needs_review` after confirmation.
- A real three-signer table keeps all three names and cells.
- A real appendix heading and its table remain separate from the body and preserve source order.
- Different upload results cannot mix old and new source blocks.

---

### Task 1: Source fidelity and routing

**Files:** `src/server/structuralSegmenter.ts`, `src/utils/localFileImport.ts`, `src/shared/schemas/document.schema.ts`, `test/import-segments.test.ts`, `test/local-file-import.test.ts`.

**Interfaces:** `segmentSourceBlocks(blocks, options): StructuredImport` returns ordered `sourceBlocks` plus detected regime; parser only classifies a header with national/Party heading evidence.

- [ ] Add failing synthetic tests for non-header two-column table, regime recognition, body/signature/appendix ownership and placeholder state.
- [ ] Fix parser and source model; preserve all original blocks and mark uncertain cases.
- [ ] Run local import and segment tests.

### Task 2: Rule-aware review model

**Files:** `src/utils/importReview.ts`, `src/utils/importRules.ts` (new), `test/import-review.test.ts`.

**Interfaces:** `buildImportReview(source, selectedRegime)` returns region summaries and evidence-backed checks; `updateImportField` and optional block assignment invalidate prior confirmation.

- [ ] Add failing tests for rule routing, exact header texts, missing/ambiguous fields, source ownership and tables.
- [ ] Implement grouped checks with `PASS`, `NEEDS_REVIEW`, `NOT_EVALUATED`; show rule IDs/source locators where available.
- [ ] Run review tests and TypeScript.

### Task 3: Detailed Step 1 UI

**Files:** `src/App.tsx`, optional `src/components/ImportReviewPanel.tsx` (new).

**Interfaces:** Step 1 renders full source regions, all table cells, fields, rule status and the editable document. Upload success populates the editor immediately. Review acknowledgment records the user's comparison but does not gate editing.

- [ ] Render the review panel without truncating body/appendix evidence; show source block positions and status.
- [ ] Route selected regime from source evidence and show conflicts; populate document state as soon as parse succeeds while keeping uncertain fields marked for review.
- [ ] Remove the separate Soạn thảo tab and all preview thumbnails outside Xem trước.
- [ ] Verify manually in browser using the user-provided DOCX and a synthetic appendix fixture; capture local screenshots.

### Task 4: Close Step 1

**Files:** tests/documentation as needed.

- [ ] Run targeted tests, TypeScript and build.
- [ ] Inspect source diff and check no personal data was added.
- [ ] Verify the Step 1 UI visually with at least one actual DOCX and one negative/edge case. Only then mark Step 1 complete.
