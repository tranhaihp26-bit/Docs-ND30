import type { DocumentState } from "../App.tsx";
import type { StructuredImport } from "../shared/schemas/document.schema.ts";

const DATABASE_NAME = "docs-nd30-drafts";
const STORE_NAME = "workspace";
const DRAFT_KEY = "current";

export interface StoredDraft {
  schemaVersion: 1;
  savedAt: string;
  standardType: "state" | "party";
  doc: DocumentState;
  versions: Array<{ id: string; timestamp: string; title: string; data: DocumentState; standardType: "state" | "party" }>;
  structuredImport: StructuredImport | null;
  sourceSnapshot: StructuredImport | null;
  uploadedFileName: string;
  uploadedFileType: "docx" | "txt" | null;
  rawText: string;
  uploadedHtml: string;
  importReviewAccepted: boolean;
}

export function isStoredDraft(value: unknown): value is StoredDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  const doc = draft.doc as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return false;
  return draft.schemaVersion === 1 &&
    typeof draft.savedAt === "string" &&
    (draft.standardType === "state" || draft.standardType === "party") &&
    typeof doc.orgHeader1 === "string" &&
    typeof doc.orgHeader2 === "string" &&
    typeof doc.bodyHtml === "string" &&
    Array.isArray(draft.versions) &&
    (draft.structuredImport === null || typeof draft.structuredImport === "object") &&
    (draft.sourceSnapshot === null || typeof draft.sourceSnapshot === "object") &&
    typeof draft.uploadedFileName === "string" &&
    (draft.uploadedFileType === null || draft.uploadedFileType === "docx" || draft.uploadedFileType === "txt") &&
    typeof draft.rawText === "string" && typeof draft.uploadedHtml === "string" &&
    typeof draft.importReviewAccepted === "boolean";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Trình duyệt không hỗ trợ lưu nháp cục bộ."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được kho bản nháp."));
  });
}

export async function loadDraft(): Promise<StoredDraft | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DRAFT_KEY);
      request.onsuccess = () => {
        if (request.result == null) resolve(null);
        else if (isStoredDraft(request.result)) resolve(request.result);
        else reject(new Error("Bản nháp lưu trên thiết bị không đúng định dạng; dữ liệu cũ vẫn được giữ nguyên."));
      };
      request.onerror = () => reject(request.error || new Error("Không đọc được bản nháp."));
    });
  } finally {
    database.close();
  }
}

export async function saveDraft(draft: StoredDraft, expectedSavedAt: string | null): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      let conflict = false;
      const current = store.get(DRAFT_KEY);
      current.onsuccess = () => {
        const actualSavedAt = current.result?.savedAt ?? null;
        if (actualSavedAt !== expectedSavedAt) {
          conflict = true;
          transaction.abort();
          return;
        }
        store.put(draft, DRAFT_KEY);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Không ghi được bản nháp."));
      transaction.onabort = () => reject(conflict
        ? new Error("Bản nháp đã được thay đổi ở tab khác. Hãy tải bản sao dự phòng trước khi tải lại trang.")
        : transaction.error || new Error("Lưu bản nháp bị hủy."));
    });
  } finally {
    database.close();
  }
}
