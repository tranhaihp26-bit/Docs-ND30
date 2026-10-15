import assert from "node:assert/strict";
import { isStoredDraft } from "../src/utils/draftStore.ts";

const valid = {
  schemaVersion: 1,
  savedAt: "2026-10-15T03:00:00.000Z",
  standardType: "state",
  doc: { orgHeader1: "TỔNG CÔNG TY", orgHeader2: "CÔNG TY", bodyHtml: "<p>Nội dung</p>" },
  versions: [],
  structuredImport: null,
  sourceSnapshot: null,
  uploadedFileName: "",
  uploadedFileType: null,
  rawText: "",
  uploadedHtml: "",
  importReviewAccepted: false,
};

assert.equal(isStoredDraft(valid), true);
assert.equal(isStoredDraft({ ...valid, schemaVersion: 2 }), false);
assert.equal(isStoredDraft({ ...valid, doc: null }), false);
assert.equal(isStoredDraft({ ...valid, standardType: "unknown" }), false);
assert.equal(isStoredDraft({ ...valid, versions: "not-an-array" }), false);
console.log("Draft schema validation passed");
