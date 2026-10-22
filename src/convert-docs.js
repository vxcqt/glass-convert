'use strict';

/**
 * Конвертация документов без внешних приложений:
 *  - PDF → Word/TXT: текстовый слой через pdf.js
 *  - Word/TXT → PDF: HTML через mammoth и печать в PDF средствами Electron
 *  - Word/TXT → TXT: извлечение текста
 *
 * Это «умный текст», а не побайтовое сохранение вёрстки: сложные
 * многоколоночные PDF и фигуры Word могут выглядеть проще оригинала.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const mammoth = require('mammoth');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
} = require('docx');
const { extOf } = require('./formats');

/* ------------------------------------------------------------------ */
/* PDF: извлечение текста                                             */
/* ------------------------------------------------------------------ */

function pdfjs() {
  // pdf.js ищет canvas/DOMMatrix даже для извлечения текста.
  // Заглушки убирают предупреждения и не используются без рендера.
  if (typeof globalThis.DOMMatrix === 'undefined') globalThis.DOMMatrix = class DOMMatrix {};
  if (typeof globalThis.Path2D === 'undefined') globalThis.Path2D = class Path2D {};
  return require('pdfjs-dist/legacy/build/pdf.js');
}

function normalizeLine(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function lineFromItems(items) {
  const sorted = items.slice().sort((a, b) => a.x - b.x);
  let text = '';
  let lastEnd = null;
  let maxHeight = 0;
  let bold = false;

  for (const item of sorted) {
    const raw = String(item.str || '').replace(/\u00a0/g, ' ');
    if (!raw) continue;
    const height = item.height || 10;
    maxHeight = Math.max(maxHeight, height);
    if (/bold|black|heavy|semibold|demi/i.test(item.fontName || '')) bold = true;

    if (!text) {
      text = raw;
    } else {
      const gap = typeof lastEnd === 'number' ? item.x - lastEnd : 0;
      const needSpace =
        gap > Math.max(1.2, Math.min(height, maxHeight) * 0.18) &&
        !/\s$/.test(text) &&
        !/^\s/.test(raw);
      if (needSpace) text += ' ';
      text += raw;
    }
    lastEnd = item.x + (item.width || 0);
  }

  return { text: normalizeLine(text), height: Math.min(48, maxHeight || 11), bold };
}

function pageLines(textContent) {
  const items = [];
  for (const item of textContent.items) {
    if (!item || typeof item.str !== 'string' || !item.str.trim()) continue;
    const tr = item.transform || [];
    items.push({
      str: item.str,
      x: Number(tr[4]) || 0,
      y: Number(tr[5]) || 0,
      width: Number(item.width) || 0,
      height: Math.abs(Number(tr[3])) || Number(item.height) || 11,
      fontName: item.fontName || '',
    });
  }

  if (!items.length) return [];

  // Сверху вниз, затем слева направо. Допуск объединяет символы одной строки.
  items.sort((a, b) => (Math.abs(b.y - a.y) > 1 ? b.y - a.y : a.x - b.x));

  const lines = [];
  for (const item of items) {
    const last = lines[lines.length - 1];
    const tolerance = Math.max(2, Math.min(item.height, last ? last.height : item.height) * 0.45);
    if (last && Math.abs(item.y - last.y) <= tolerance) {
      last.items.push(item);
      last.height = Math.max(last.height, item.height);
      last.y = (last.y + item.y) / 2;
    } else {
      lines.push({ y: item.y, height: item.height, items: [item] });
    }
  }

  return lines
    .map((line) => lineFromItems(line.items))
    .filter((line) => line.text);
}

async function extractPdf(input, onProgress) {
  const pdf = pdfjs();
  const data = new Uint8Array(fs.readFileSync(input));
  let doc;
  try {
    doc = await pdf.getDocument({
      data,
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    if (/password/i.test(message)) throw new Error('PDF защищён паролем');
    throw new Error(`Не удалось открыть PDF: ${message}`);
  }

  const pages = [];
  try {
    const total = doc.numPages;
    if (!total) throw new Error('В PDF нет страниц');
    for (let i = 1; i <= total; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const lines = pageLines(content);
      pages.push(lines);
      page.cleanup();
      if (onProgress) onProgress(0.05 + (0.75 * i) / total);
    }
  } finally {
    try {
      await doc.destroy();
    } catch (_) {
      /* ignore */
    }
  }

  const chars = pages.reduce(
    (sum, lines) => sum + lines.reduce((n, line) => n + line.text.length, 0),
    0
  );
  if (chars < 3) {
    throw new Error('В PDF нет текстового слоя — похоже, это сканы. Нужно распознавание (OCR)');
  }
  return pages;
}

function pagesToText(pages) {
  return pages
    .map((lines) => lines.map((line) => line.text).join('\n'))
    .filter(Boolean)
    .join('\n\n')
    .trimEnd() + '\n';
}

/* ------------------------------------------------------------------ */
/* DOCX: создание                                                     */
/* ------------------------------------------------------------------ */

const DOCX_FONT = 'Calibri';

function baseDocument(children, title) {
  return new Document({
    creator: 'Glass Convert',
    title: title || 'Glass Convert',
    description: 'Создано в Glass Convert',
    styles: {
      default: {
        document: {
          run: { font: DOCX_FONT, size: 22, color: '1f2430' },
          paragraph: { spacing: { after: 40, line: 240 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });
}

async function writeDocxFromPdf(pages, output, input) {
  const children = [];

  pages.forEach((lines, pageIndex) => {
    if (!lines.length) return;
    lines.forEach((line, lineIndex) => {
      const size = Math.max(16, Math.min(52, Math.round(line.height * 2)));
      const run = new TextRun({
        text: line.text,
        bold: line.bold || line.height >= 17,
        size,
        font: DOCX_FONT,
      });
      children.push(
        new Paragraph({
          children: [run],
          pageBreakBefore: pageIndex > 0 && lineIndex === 0,
          spacing: { after: 20, line: 240 },
        })
      );
    });
  });

  if (!children.length) throw new Error('В PDF не найден текст');
  const doc = baseDocument(children, path.basename(input, path.extname(input)));
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(output, buffer);
}

function textToDocx(text, output, title) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const children = lines.map((line) => {
    if (!line) return new Paragraph({ children: [], spacing: { after: 60 } });
    return new Paragraph({
      children: [new TextRun({ text: line, font: DOCX_FONT })],
      spacing: { after: 40, line: 240 },
    });
  });
  return Packer.toBuffer(baseDocument(children, title)).then((buffer) => fs.writeFileSync(output, buffer));
}

/* ------------------------------------------------------------------ */
/* HTML → PDF через скрытое окно Electron                              */
/* ------------------------------------------------------------------ */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlDocument(body, title) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:;" />
<title>${escapeHtml(title || 'Glass Convert')}</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #1a1a1a; }
  body {
    font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  p { margin: 0 0 8pt; }
  h1, h2, h3, h4, h5, h6 { margin: 0 0 8pt; line-height: 1.2; color: #111; page-break-after: avoid; }
  h1 { font-size: 20pt; }
  h2 { font-size: 16pt; }
  h3 { font-size: 13pt; }
  h4, h5, h6 { font-size: 11pt; }
  ul, ol { margin: 0 0 8pt 18pt; padding: 0; }
  li { margin: 0 0 3pt; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 10pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  td, th { border: 1px solid #b8bcc6; padding: 5pt 7pt; vertical-align: top; text-align: left; }
  th { background: #eef1f6; font-weight: 600; }
  img { max-width: 100%; height: auto; page-break-inside: avoid; }
  a { color: #1b64c6; text-decoration: none; }
  blockquote { margin: 0 0 8pt; padding-left: 10pt; border-left: 3px solid #d8dce4; color: #444; }
  pre, code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 10pt; }
  pre { white-space: pre-wrap; background: #f4f5f7; padding: 8pt; }
  .plain { white-space: pre-wrap; font-family: Calibri, "Segoe UI", Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
  .empty { height: 8pt; }
</style>
</head>
<body>${body}</body>
</html>`;
}

async function printHtmlToPdf(html, output, onProgress) {
  let BrowserWindow;
  try {
    ({ BrowserWindow } = require('electron'));
  } catch (err) {
    throw new Error(`Печать PDF доступна только внутри приложения: ${err.message}`);
  }
  if (typeof BrowserWindow !== 'function') {
    throw new Error('Печать PDF доступна только внутри приложения');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glass-convert-'));
  const tempFile = path.join(tempDir, 'document.html');
  fs.writeFileSync(tempFile, html, 'utf8');
  let win = null;

  try {
    win = new BrowserWindow({
      width: 900,
      height: 1200,
      show: false,
      frame: false,
      backgroundColor: '#ffffff',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });

    if (onProgress) onProgress(0.35);
    try {
      await win.loadFile(tempFile);
    } catch (_) {
      // Антивирус иногда блокирует только что созданный HTML на долю секунды.
      await new Promise((resolve) => setTimeout(resolve, 350));
      try {
        await win.loadFile(tempFile);
      } catch (secondError) {
        if (Buffer.byteLength(html, 'utf8') > 1500000) {
          throw new Error(`Не удалось открыть документ для печати: ${secondError.message}`);
        }
        // Резервный путь: отдать тот же HTML как data URL.
        await win.loadURL(`data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
      }
    }

    // Картинки в DOCX встроены как data URL; ждём их декодирования.
    await win.webContents.executeJavaScript(`
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        ...Array.from(document.images).map((img) =>
          img.complete ? Promise.resolve() :
            new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
        )
      ]).then(() => true)
    `);

    if (onProgress) onProgress(0.7);
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.7, right: 0.7 },
      preferCSSPageSize: false,
    });
    fs.writeFileSync(output, pdf);
    if (onProgress) onProgress(1);
  } finally {
    try {
      if (win && !win.isDestroyed()) win.destroy();
    } catch (_) {
      /* ignore */
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Диспетчер                                                          */
/* ------------------------------------------------------------------ */

async function convertDocument({ input, targetKey, output, onProgress = () => {} }) {
  if (!fs.existsSync(input)) throw new Error('Файл не найден');
  const source = extOf(input);
  const readText = () => {
    const buffer = fs.readFileSync(input);
    let text;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.toString('utf16le');
    else text = buffer.toString('utf8');
    return text.replace(/^\ufeff/, '');
  };
  onProgress(0.02);

  if (source === 'pdf' && targetKey === 'docx') {
    const pages = await extractPdf(input, onProgress);
    await writeDocxFromPdf(pages, output, input);
    onProgress(1);
    return;
  }

  if (source === 'pdf' && targetKey === 'txt') {
    const pages = await extractPdf(input, onProgress);
    fs.writeFileSync(output, pagesToText(pages), 'utf8');
    onProgress(1);
    return;
  }

  if (source === 'docx' && targetKey === 'txt') {
    let result;
    try {
      result = await mammoth.extractRawText({ path: input });
    } catch (err) {
      throw new Error(`Не удалось прочитать Word: ${err.message}`);
    }
    const text = String(result.value || '').trim();
    if (!text) throw new Error('Документ пуст');
    fs.writeFileSync(output, `${text}\n`, 'utf8');
    onProgress(1);
    return;
  }

  if (source === 'docx' && targetKey === 'pdf') {
    onProgress(0.08);
    let result;
    try {
      result = await mammoth.convertToHtml({ path: input });
    } catch (err) {
      throw new Error(`Не удалось прочитать Word: ${err.message}`);
    }
    const body = result.value || '';
    if (!body.replace(/<[^>]*>/g, '').trim() && !/<img\b/i.test(body)) {
      throw new Error('Документ пуст');
    }
    onProgress(0.22);
    const html = htmlDocument(body, path.basename(input, path.extname(input)));
    await printHtmlToPdf(html, output, onProgress);
    return;
  }

  if (source === 'txt' && targetKey === 'docx') {
    const text = readText();
    if (!text.trim()) throw new Error('Текстовый файл пуст');
    await textToDocx(text, output, path.basename(input, path.extname(input)));
    onProgress(1);
    return;
  }

  if (source === 'txt' && targetKey === 'pdf') {
    const text = readText();
    if (!text.trim()) throw new Error('Текстовый файл пуст');
    const body = `<div class="plain">${escapeHtml(text.replace(/\r\n?/g, '\n'))}</div>`;
    const html = htmlDocument(body, path.basename(input, path.extname(input)));
    await printHtmlToPdf(html, output, onProgress);
    return;
  }

  throw new Error(`Конвертация ${source.toUpperCase()} → ${String(targetKey).toUpperCase()} не поддерживается`);
}

module.exports = {
  convertDocument,
  extractPdf,
  pagesToText,
  printHtmlToPdf,
};
