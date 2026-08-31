/**
 * Opens the browser's file picker and resolves with the chosen file's text, or
 * `null` if the read fails. A cancelled picker never fires `change`, so the
 * promise never resolves.
 */
export function pickTextFile(accept = ''): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
    input.click();
  });
}
