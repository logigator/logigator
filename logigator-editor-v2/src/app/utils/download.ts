/**
 * Triggers a browser download of a Blob via a transient object URL. Shared by
 * file export (native circuit format) and image export.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
