/**
 * Reads a file the person picked, as text.
 *
 * `FileReader` rather than `file.text()`: it's the older API, works in every browser we
 * care about, and — unlike `file.text()` — jsdom implements it, so the Backup screen can
 * be tested with a real file object.
 */
export function readTextFile(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("the file couldn't be read"));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsText(file);
  });
}
