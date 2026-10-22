'use strict';

/**
 * Проверка документных конвертаций внутри Electron:
 *   npm run test:docs
 *
 * Создаёт DOCX с текстом и таблицей, печатает его в PDF,
 * затем извлекает PDF обратно в DOCX/TXT и сверяет текст.
 */

const { app } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
} = require('docx');
const { convertFile } = require('../src/convert');
const { extractPdf, printHtmlToPdf } = require('../src/convert-docs');

const dir = path.join(os.tmpdir(), 'glass-convert-docs-test');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const PHRASE = 'Glass Convert проверяет документы';

async function makeSampleDocx() {
  const doc = new Document({
    creator: 'Glass Convert test',
    title: 'Тестовый документ',
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Glass Convert — тест документа',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Это проверка конвертации Word → PDF и обратно. ', bold: true }),
              new TextRun({ text: 'Кириллица, латиница, цифры 12345.', italics: true }),
            ],
          }),
          new Paragraph({ text: PHRASE }),
          new Paragraph({ text: 'Таблица ниже тоже должна попасть в PDF:' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Формат')] }),
                  new TableCell({ children: [new Paragraph('Направление')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('PDF')] }),
                  new TableCell({ children: [new Paragraph('Word')] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph('Word')] }),
                  new TableCell({ children: [new Paragraph('PDF')] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const input = path.join(dir, 'sample.docx');
  fs.writeFileSync(input, await Packer.toBuffer(doc));
  return input;
}

async function run(input, target, label) {
  const started = Date.now();
  let progress = 0;
  const result = await convertFile({
    input,
    targetKey: target,
    onProgress: (p) => {
      progress = p;
    },
  });
  const size = fs.statSync(result.output).size;
  console.log(
    `${label}: ${path.basename(result.output)} (${Math.round(size / 1024)} KB, ${Date.now() - started} ms, ${Math.round(progress * 100)}%)`
  );
  return result.output;
}

async function textOfDocx(file) {
  const result = await mammoth.extractRawText({ path: file });
  return String(result.value || '');
}

app.whenReady().then(async () => {
  try {
    const docx = await makeSampleDocx();
    console.log('DOCX:', docx);

    const pdf = await run(docx, 'pdf', 'Word → PDF');
    const header = fs.readFileSync(pdf).subarray(0, 5).toString('latin1');
    if (header !== '%PDF-') throw new Error(`PDF имеет неверный заголовок: ${header}`);
    if (fs.statSync(pdf).size < 4096) throw new Error('PDF подозрительно маленький');

    const backDocx = await run(pdf, 'docx', 'PDF → Word');
    const backText = await textOfDocx(backDocx);
    if (!backText.includes('Glass Convert')) throw new Error('В обратном DOCX потерялся текст');
    if (!backText.includes('12345')) throw new Error('В обратном DOCX потерялись цифры');
    console.log('Текст PDF → Word извлечён, длина:', backText.length);

    const pdfTxt = await run(pdf, 'txt', 'PDF → TXT');
    const pdfText = fs.readFileSync(pdfTxt, 'utf8');
    if (!pdfText.includes('Glass Convert')) throw new Error('В TXT из PDF нет текста');

    const docxTxt = await run(docx, 'txt', 'Word → TXT');
    if (!fs.readFileSync(docxTxt, 'utf8').includes('12345')) throw new Error('В TXT из Word нет цифр');

    const plain = path.join(dir, 'plain.txt');
    fs.writeFileSync(plain, 'Простой текст для проверки.\nВторая строка: 42.\n', 'utf8');
    const plainDocx = await run(plain, 'docx', 'TXT → Word');
    if (!(await textOfDocx(plainDocx)).includes('Вторая строка')) {
      throw new Error('В DOCX из TXT потерялась вторая строка');
    }
    await run(plain, 'pdf', 'TXT → PDF');

    const multiHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      body { font-family: Calibri, sans-serif; font-size: 12pt; }
      .next { page-break-before: always; }
    </style></head><body>
      <p>Первая страница многостраничного теста.</p>
      <p>Glass Convert page one.</p>
      <p class="next">Вторая страница: 98765.</p>
    </body></html>`;
    const multiPdf = path.join(dir, 'multipage.pdf');
    await printHtmlToPdf(multiHtml, multiPdf, () => {});
    const multiPages = await extractPdf(multiPdf, () => {});
    if (multiPages.length !== 2) throw new Error(`Ожидалось 2 страницы, получено ${multiPages.length}`);
    const multiDocx = await run(multiPdf, 'docx', 'PDF 2 стр. → Word');
    const zip = await JSZip.loadAsync(fs.readFileSync(multiDocx));
    const documentXml = await zip.file('word/document.xml').async('string');
    if (!/pageBreakBefore/.test(documentXml)) {
      throw new Error('В DOCX не сохранился разрыв страницы');
    }
    if (!(await textOfDocx(multiDocx)).includes('98765')) {
      throw new Error('Во второй странице DOCX потерялся текст');
    }
    console.log('Многостраничный PDF → Word: разрыв страницы сохранён');

    console.log('DOCS OK · файлы в', dir);
    app.quit();
  } catch (err) {
    console.error('DOCS FAILED', err);
    app.exit(1);
  }
});

app.on('window-all-closed', () => {});
