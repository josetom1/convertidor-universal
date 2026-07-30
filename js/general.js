/* ============================================================
   MÓDULO GENERAL — PDF, Excel, Word, PPT, Imágenes, Texto
   ============================================================ */

const GeneralTools = (() => {
  'use strict';

  // --- Utilidades ---

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return +(bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- 1. PDF TOOLS (con pdf-lib vía CDN) ---

  let pdfLibLoaded = false;

  async function ensurePdfLib() {
    if (pdfLibLoaded) return true;
    if (typeof PDFLib !== 'undefined') { pdfLibLoaded = true; return true; }
    // Intentar cargar dinámicamente
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
      script.onload = () => { pdfLibLoaded = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function pdfToText(file) {
    // Para PDF a texto, usamos PDF.js
    if (typeof pdfjsLib === 'undefined') {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const data = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += `--- Página ${i} ---\n${pageText}\n\n`;
    }
    return { text, pages: pdf.numPages };
  }

  async function mergePDFs(files) {
    await ensurePdfLib();
    if (!pdfLibLoaded) return { error: 'No se pudo cargar pdf-lib. Verifica tu conexión.' };

    const mergedPdf = await PDFLib.PDFDocument.create();
    for (const file of files) {
      const data = await readFileAsArrayBuffer(file);
      const pdf = await PDFLib.PDFDocument.load(data);
      const indices = pdf.getPageIndices();
      const pages = await mergedPdf.copyPages(pdf, indices);
      pages.forEach(page => mergedPdf.addPage(page));
    }
    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return { blob, filename: 'merged.pdf', size: blob.size };
  }

  async function splitPDF(file) {
    await ensurePdfLib();
    if (!pdfLibLoaded) return { error: 'No se pudo cargar pdf-lib.' };

    const data = await readFileAsArrayBuffer(file);
    const pdf = await PDFLib.PDFDocument.load(data);
    const results = [];

    for (let i = 0; i < pdf.getPageCount(); i++) {
      const newPdf = await PDFLib.PDFDocument.create();
      const [page] = await newPdf.copyPages(pdf, [i]);
      newPdf.addPage(page);
      const bytes = await newPdf.save();
      results.push({
        blob: new Blob([bytes], { type: 'application/pdf' }),
        filename: `pagina_${i + 1}.pdf`,
        index: i,
      });
    }
    return { pages: results, total: results.length };
  }

  async function compressPDF(file) {
    await ensurePdfLib();
    if (!pdfLibLoaded) return { error: 'No se pudo cargar pdf-lib.' };

    const data = await readFileAsArrayBuffer(file);
    const pdf = await PDFLib.PDFDocument.load(data, { ignoreEncryption: true });
    // pdf-lib no tiene compresión nativa, pero re-save ayuda a optimizar
    const pdfBytes = await pdf.save({ useObjectStreams: true });
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return { blob, filename: 'optimized.pdf', originalSize: file.size, newSize: blob.size };
  }

  // --- 2. EXCEL TOOLS (SheetJS vía CDN) ---

  let xlsxLoaded = false;

  async function ensureXLSX() {
    if (xlsxLoaded) return true;
    if (typeof XLSX !== 'undefined') { xlsxLoaded = true; return true; }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
      script.onload = () => { xlsxLoaded = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function excelToCSV(file) {
    await ensureXLSX();
    if (!xlsxLoaded) return { error: 'No se pudo cargar SheetJS.' };

    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    return { blob, filename: file.name.replace(/\.(xlsx|xls)$/, '.csv'), text: csv, sheetName };
  }

  async function excelToJSON(file) {
    await ensureXLSX();
    if (!xlsxLoaded) return { error: 'No se pudo cargar SheetJS.' };

    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const text = JSON.stringify(json, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    return { blob, filename: file.name.replace(/\.(xlsx|xls)$/, '.json'), text, sheetName, rows: json.length };
  }

  async function excelToHTML(file) {
    await ensureXLSX();
    if (!xlsxLoaded) return { error: 'No se pudo cargar SheetJS.' };

    const data = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const html = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]);
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sheetName}</title>
    <style>table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style></head>
    <body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    return { blob, filename: file.name.replace(/\.(xlsx|xls)$/, '.html'), html: fullHtml };
  }

  // --- 3. WORD TOOLS (mammoth.js) ---

  let mammothLoaded = false;

  async function ensureMammoth() {
    if (mammothLoaded) return true;
    if (typeof mammoth !== 'undefined') { mammothLoaded = true; return true; }
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload = () => { mammothLoaded = true; resolve(true); };
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  async function wordToHTML(file) {
    await ensureMammoth();
    if (!mammothLoaded) return { error: 'No se pudo cargar mammoth.js.' };

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value;
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>body{font-family:Georgia,serif;max-width:800px;margin:auto;padding:2rem}
    table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px}</style>
    </head><body>${html}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    return { blob, filename: file.name.replace(/\.docx?$/, '.html'), html: fullHtml };
  }

  async function wordToText(file) {
    await ensureMammoth();
    if (!mammothLoaded) return { error: 'No se pudo cargar mammoth.js.' };

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    const blob = new Blob([result.value], { type: 'text/plain;charset=utf-8' });
    return { blob, filename: file.name.replace(/\.docx?$/, '.txt'), text: result.value };
  }

  // --- 4. IMAGE TOOLS (Canvas API) ---

  async function convertImage(file, targetFormat, quality = 0.9) {
    const dataUrl = await readFileAsDataURL(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let mimeType;
        switch (targetFormat) {
          case 'jpg': case 'jpeg': mimeType = 'image/jpeg'; break;
          case 'png': mimeType = 'image/png'; break;
          case 'webp': mimeType = 'image/webp'; break;
          case 'gif': mimeType = 'image/gif'; break;
          case 'bmp': mimeType = 'image/bmp'; break;
          default: mimeType = 'image/png';
        }

        canvas.toBlob((blob) => {
          if (!blob) return resolve({ error: 'Error al convertir la imagen.' });
          const ext = targetFormat === 'jpg' ? 'jpg' : targetFormat;
          resolve({
            blob,
            filename: file.name.replace(/\.[^.]+$/, `.${ext}`),
            originalSize: file.size,
            newSize: blob.size,
            width: img.width,
            height: img.height,
          });
        }, mimeType, quality);
      };
      img.onerror = () => resolve({ error: 'Error al cargar la imagen.' });
      img.src = dataUrl;
    });
  }

  async function resizeImage(file, maxWidth, maxHeight) {
    const dataUrl = await readFileAsDataURL(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        width = Math.round(width);
        height = Math.round(height);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve({ blob, filename: `resized_${file.name}`, width, height, originalSize: file.size, newSize: blob.size });
        }, file.type || 'image/jpeg', 0.9);
      };
      img.onerror = () => resolve({ error: 'Error al cargar la imagen.' });
      img.src = dataUrl;
    });
  }

  // --- 5. TEXT TOOLS ---

  function textStats(text) {
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
    return { chars, charsNoSpace, words, lines, paragraphs };
  }

  function caseConvert(text, type) {
    switch (type) {
      case 'upper': return text.toUpperCase();
      case 'lower': return text.toLowerCase();
      case 'title': return text.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
      case 'sentence': return text.replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
      case 'camel': return text.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase());
      default: return text;
    }
  }

  function findReplace(text, find, replace) {
    if (!find) return { text, count: 0 };
    const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const count = (text.match(regex) || []).length;
    return { text: text.replace(regex, replace), count };
  }

  function sortLines(text, type = 'asc') {
    const lines = text.split('\n');
    const sorted = type === 'asc' ? lines.sort() : lines.sort().reverse();
    return sorted.join('\n');
  }

  function uniqueLines(text) {
    const lines = text.split('\n');
    return [...new Set(lines)].join('\n');
  }

  // --- 6. PDF TO IMAGES (pdf.js + Canvas) ---

  async function pdfToImages(file, format = 'png') {
    if (typeof pdfjsLib === 'undefined') {
      await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = resolve;
        document.head.appendChild(script);
      });
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const data = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const scale = 2; // 2x para buena calidad
    const images = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, `image/${format === 'jpg' ? 'jpeg' : format}`, 0.92));
      if (blob) {
        images.push({
          blob,
          filename: `pagina_${i}.${format}`,
          width: canvas.width,
          height: canvas.height,
        });
      }
    }
    return { images, total: images.length, pages: pdf.numPages };
  }

  // --- 7. IMAGE TO PDF (pdf-lib) ---

  async function imagesToPDF(files) {
    await ensurePdfLib();
    if (!pdfLibLoaded) return { error: 'No se pudo cargar pdf-lib.' };

    const pdfDoc = await PDFLib.PDFDocument.create();

    for (const file of files) {
      const dataUrl = await readFileAsDataURL(file);
      let image;
      if (file.type === 'image/png') {
        image = await pdfDoc.embedPng(dataUrl);
      } else {
        image = await pdfDoc.embedJpg(dataUrl);
      }
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return { blob, filename: 'imagenes_convertidas.pdf', size: blob.size, pages: files.length };
  }

  // --- 8. ROTATE PDF (pdf-lib) ---

  async function rotatePDF(file, degrees = 90) {
    await ensurePdfLib();
    if (!pdfLibLoaded) return { error: 'No se pudo cargar pdf-lib.' };

    const data = await readFileAsArrayBuffer(file);
    const pdf = await PDFLib.PDFDocument.load(data);
    const pages = pdf.getPages();

    const rotationMap = { 90: PDFLib.Rotation.degrees90, 180: PDFLib.Rotation.degrees180, 270: PDFLib.Rotation.degrees270 };
    const rotation = rotationMap[degrees] || PDFLib.Rotation.degrees90;

    for (const page of pages) {
      page.setRotation(rotation);
    }

    const pdfBytes = await pdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return { blob, filename: `rotated_${degrees}.pdf`, size: blob.size, pages: pages.length };
  }

  // --- 9. CSV TO EXCEL (SheetJS) ---

  async function csvToExcel(file) {
    await ensureXLSX();
    if (!xlsxLoaded) return { error: 'No se pudo cargar SheetJS.' };

    const text = await readFileAsText(file);
    const workbook = XLSX.read(text, { type: 'string' });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(text.split('\n').map(line => line.split(',')));
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    return { blob, filename: file.name.replace(/\.csv$/, '.xlsx'), size: blob.size };
  }

  // --- 10. JSON TO EXCEL (SheetJS) ---

  async function jsonToExcel(file) {
    await ensureXLSX();
    if (!xlsxLoaded) return { error: 'No se pudo cargar SheetJS.' };

    const text = await readFileAsText(file);
    let data;
    try { data = JSON.parse(text); } catch (e) { return { error: 'JSON inválido. Debe ser un array de objetos.' }; }
    if (!Array.isArray(data) || data.length === 0) return { error: 'JSON debe ser un array no vacío.' };

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    return { blob, filename: file.name.replace(/\.json$/, '.xlsx'), size: blob.size, rows: data.length };
  }

  // --- 11. IMAGE FILTERS (Canvas API) ---

  async function applyImageFilter(file, filterType) {
    const dataUrl = await readFileAsDataURL(file);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        switch (filterType) {
          case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
              const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
              data[i] = data[i+1] = data[i+2] = gray;
            }
            break;
          case 'sepia':
            for (let i = 0; i < data.length; i += 4) {
              const r = data[i], g = data[i+1], b = data[i+2];
              data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
              data[i+1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
              data[i+2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            break;
          case 'negative':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = 255 - data[i];
              data[i+1] = 255 - data[i+1];
              data[i+2] = 255 - data[i+2];
            }
            break;
          case 'brightness':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, data[i] * 1.5);
              data[i+1] = Math.min(255, data[i+1] * 1.5);
              data[i+2] = Math.min(255, data[i+2] * 1.5);
            }
            break;
          case 'contrast':
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.min(255, Math.max(0, ((data[i]/255 - 0.5) * 1.5 + 0.5) * 255));
              data[i+1] = Math.min(255, Math.max(0, ((data[i+1]/255 - 0.5) * 1.5 + 0.5) * 255));
              data[i+2] = Math.min(255, Math.max(0, ((data[i+2]/255 - 0.5) * 1.5 + 0.5) * 255));
            }
            break;
          case 'blur':
            ctx.putImageData(imageData, 0, 0);
            ctx.filter = 'blur(4px)';
            ctx.drawImage(canvas, 0, 0);
            ctx.filter = 'none';
            const newData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
              resolve({ blob, filename: `${filterType}_${file.name}`, width: img.width, height: img.height });
            }, file.type || 'image/png', 0.92);
            return;
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(blob => {
          resolve({ blob, filename: `${filterType}_${file.name}`, width: img.width, height: img.height, originalSize: file.size, newSize: blob.size });
        }, file.type || 'image/png', 0.92);
      };
      img.onerror = () => resolve({ error: 'Error al cargar la imagen.' });
      img.src = dataUrl;
    });
  }

  // --- 12. IMAGE TO BASE64 ---

  async function imageToBase64(file) {
    const dataUrl = await readFileAsDataURL(file);
    return { dataUrl, filename: file.name, size: file.size, type: file.type };
  }

  // --- 13. TEXT DIFF (simple line-by-line) ---

  function textDiff(textA, textB) {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const maxLen = Math.max(linesA.length, linesB.length);
    let result = '';
    let changes = 0;

    for (let i = 0; i < maxLen; i++) {
      const lineA = i < linesA.length ? linesA[i] : null;
      const lineB = i < linesB.length ? linesB[i] : null;

      if (lineA === lineB) {
        result += `  ${lineA}\n`;
      } else if (lineA === null) {
        result += `+ ${lineB}\n`;
        changes++;
      } else if (lineB === null) {
        result += `- ${lineA}\n`;
        changes++;
      } else {
        result += `- ${lineA}\n+ ${lineB}\n`;
        changes++;
      }
    }
    return { diff: result, changes, linesA: linesA.length, linesB: linesB.length };
  }

  // --- 14. FILE HASH (SHA-256 via SubtleCrypto) ---

  async function fileHash(file) {
    const buffer = await readFileAsArrayBuffer(file);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { hash: hashHex, algorithm: 'SHA-256', size: file.size, name: file.name };
  }

  // --- API pública ---
  return {
    // PDF
    pdfToText,
    mergePDFs,
    splitPDF,
    compressPDF,
    pdfToImages,
    imagesToPDF,
    rotatePDF,
    // Excel
    excelToCSV,
    excelToJSON,
    excelToHTML,
    csvToExcel,
    jsonToExcel,
    // Word
    wordToHTML,
    wordToText,
    // Image
    convertImage,
    resizeImage,
    applyImageFilter,
    imageToBase64,
    // Text
    textStats,
    caseConvert,
    findReplace,
    sortLines,
    uniqueLines,
    textDiff,
    // Crypto
    fileHash,
    // Util
    downloadBlob,
    formatSize,
  };
})();
