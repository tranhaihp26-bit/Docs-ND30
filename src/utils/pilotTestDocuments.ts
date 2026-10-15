export interface PilotTestDocument {
  id: string;
  documentType: string;
  scenario: string;
  filename: string;
  url: string;
  testGroup?: "standard" | "complex" | "format-error" | "data-error";
  testFocus?: string;
}

function isPilotTestDocument(value: unknown): value is PilotTestDocument {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" &&
    typeof item.documentType === "string" &&
    typeof item.scenario === "string" &&
    typeof item.filename === "string" &&
    item.filename.toLowerCase().endsWith(".docx") &&
    typeof item.url === "string" &&
    /^\/pilot-tests\/[\w-]+(?:\/[\w-]+)*\.docx$/.test(item.url) &&
    (item.testGroup === undefined || ["standard", "complex", "format-error", "data-error"].includes(item.testGroup as string)) &&
    (item.testFocus === undefined || typeof item.testFocus === "string");
}

export async function loadPilotTestManifest(fetcher: typeof fetch = fetch): Promise<PilotTestDocument[]> {
  const response = await fetcher("/pilot-tests/manifest.json");
  if (!response.ok) throw new Error("Không tải được danh mục tài liệu pilot.");
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !value.length || !value.every(isPilotTestDocument)) {
    throw new Error("Danh mục tài liệu pilot không đúng định dạng.");
  }
  const ids = value.map((item: PilotTestDocument) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Danh mục tài liệu pilot có mã bị trùng.");
  return value;
}

export async function loadPilotTestCatalog(fetcher: typeof fetch = fetch): Promise<PilotTestDocument[]> {
  const [standard, adversarialResponse] = await Promise.all([
    loadPilotTestManifest(fetcher),
    fetcher("/pilot-tests/adversarial-manifest.json"),
  ]);
  if (!adversarialResponse.ok) throw new Error("Không tải được danh mục pilot nâng cao.");
  const adversarial: unknown = await adversarialResponse.json();
  if (!Array.isArray(adversarial) || !adversarial.length || !adversarial.every(isPilotTestDocument)) {
    throw new Error("Danh mục pilot nâng cao không đúng định dạng.");
  }
  const combined = [...standard, ...adversarial] as PilotTestDocument[];
  const ids = combined.map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Danh mục pilot có mã bị trùng.");
  return combined;
}

export async function loadPilotTestFile(item: PilotTestDocument, fetcher: typeof fetch = fetch): Promise<File> {
  if (!isPilotTestDocument(item)) throw new Error("Tài liệu pilot không hợp lệ.");
  const response = await fetcher(item.url);
  if (!response.ok) throw new Error(`Không tải được tài liệu “${item.filename}”.`);
  const blob = await response.blob();
  return new File([blob], item.filename, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
