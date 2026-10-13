import { describe, expect, it } from 'vitest';

import { FileTooLargeError, readFileText } from './readFileText';

const bytesFile = (bytes: number[], name = 'a.csv') => new File([new Uint8Array(bytes)], name);

describe('readFileText', () => {
  it("décode de l'UTF-8", async () => {
    const f = new File([new TextEncoder().encode('é€ ok')], 'a.csv');
    expect(await readFileText(f)).toBe('é€ ok');
  });

  it('se replie sur Windows-1252', async () => {
    expect(await readFileText(bytesFile([0xe9, 0xe8, 0x80]))).toBe('éè€');
  });

  it('retire le BOM UTF-8', async () => {
    expect(await readFileText(bytesFile([0xef, 0xbb, 0xbf, 0x61]))).toBe('a');
  });

  it('refuse un fichier trop gros', async () => {
    await expect(readFileText(bytesFile([1, 2, 3]), 2)).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it('rejette sur erreur de lecture', async () => {
    const f = bytesFile([1]);
    f.arrayBuffer = () => Promise.reject(new Error('boom'));
    await expect(readFileText(f)).rejects.toThrow('boom');
  });
});
