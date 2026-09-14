import { createTwoFilesPatch } from "diff";

/**
 * Generates standard Git Unified Diff patch text using the diff library.
 */
export function generateGitUnifiedPatch(
  fileName: string,
  originalCode: string,
  modifiedCode: string
): string {
  const fileHeader = fileName || "source_code.ts";
  const patch = createTwoFilesPatch(
    `a/${fileHeader}`,
    `b/${fileHeader}`,
    originalCode,
    modifiedCode,
    "original version",
    "flowdev optimized version",
    { context: 3 }
  );
  return patch;
}

/**
 * Programmatically triggers a browser file download.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain;charset=utf-8"
): void {
  if (typeof window === "undefined") return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Copies text to clipboard safely.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}
