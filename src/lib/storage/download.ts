/**
 * Hands a file to the browser's downloads. Kept on its own so screens can be tested
 * without a real browser: a test swaps this module out and checks what it was asked to save.
 */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
