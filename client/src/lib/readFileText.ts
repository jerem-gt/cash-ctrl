export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor() {
    super('File too large');
    this.name = 'FileTooLargeError';
  }
}

/** Lit un fichier texte : UTF-8 strict, repli Windows-1252, BOM retiré, taille bornée. */
export async function readFileText(file: File, maxBytes = MAX_IMPORT_FILE_BYTES): Promise<string> {
  if (file.size > maxBytes) throw new FileTooLargeError();
  const buffer = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.startsWith('\uFEFF') ? text.slice(1) : text;
}
