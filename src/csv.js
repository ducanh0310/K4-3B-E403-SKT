import { readFile } from 'node:fs/promises';

function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}

export function parseCsv(text) {
  const rows = parseRows(text.replace(/^\uFEFF/, ''));
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows.filter(row => row.some(Boolean)).map(row => {
    if (row.length !== headers.length) throw new Error(`CSV row has ${row.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  });
}

export async function loadDiscordCsv(filePath) {
  return parseCsv(await readFile(filePath, 'utf8'));
}
