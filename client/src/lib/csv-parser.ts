export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  delimiter: string;
  /** Échantillon des 5 premières lignes de données (avant toute conversion). */
  sample: string[][];
}

// ─── Détection du délimiteur ──────────────────────────────────────────────────

function countDelimiter(line: string, char: string): number {
  let count = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === char) {
      count++;
    }
  }
  return count;
}

function detectDelimiter(lines: string[]): string {
  const candidates = [';', ',', '\t'];
  const probe = lines.slice(0, 5).join('\n');
  let best = ';';
  let bestCount = 0;
  for (const c of candidates) {
    const count = countDelimiter(probe, c);
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

// ─── Parsing CSV (RFC 4180 simplifié) ────────────────────────────────────────

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function parseCsvRaw(text: string, forceDelimiter?: string): CsvParseResult {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [], delimiter: ';', sample: [] };
  }

  const delimiter = forceDelimiter ?? detectDelimiter(rawLines);
  const [headerLine, ...dataLines] = rawLines;
  const headers = parseLine(headerLine, delimiter);
  const rows = dataLines.map((l) => parseLine(l, delimiter));
  const sample = rows.slice(0, 5);

  return { headers, rows, delimiter, sample };
}

// ─── Séparateur décimal ────────────────────────────────────────────────────────

export function detectDecimalSeparator(values: string[]): ',' | '.' {
  let commaScore = 0;
  let dotScore = 0;
  for (const v of values) {
    const clean = v.replace(/\s/g, '');
    // Virgule en position décimale : 1234,56 ou -12,00
    if (/\d,\d{1,2}$/.test(clean)) commaScore++;
    // Point en position décimale : 1234.56 ou -12.00
    if (/\d\.\d{1,2}$/.test(clean)) dotScore++;
  }
  return commaScore >= dotScore ? ',' : '.';
}

// ─── Conversion montant ────────────────────────────────────────────────────────

export function parseCsvAmount(raw: string, decimalSep: ',' | '.'): number {
  if (!raw || raw.trim() === '') return Number.NaN;
  let s = raw.trim();
  if (decimalSep === ',') {
    // Retirer séparateurs de milliers (point ou espace) puis normaliser la virgule
    s = s.replaceAll('.', '').replaceAll(/\s/g, '').replace(',', '.');
  } else {
    // Retirer séparateurs de milliers (virgule ou espace)
    s = s.replaceAll(',', '').replaceAll(/\s/g, '');
  }
  return Number.parseFloat(s);
}
