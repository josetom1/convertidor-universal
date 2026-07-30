/* ============================================================
   APP — Convertidor Universal
   Versión simplificada + anuncios + premium
   ============================================================ */

(function () {
  'use strict';

  // ================================================================
  //  ESTADO GLOBAL
  // ================================================================

  const state = {
    isPremium: !!localStorage.getItem('convertidor_premium'),
    premiumCode: localStorage.getItem('convertidor_premium') || null,
    adPending: null,
    adTimerInterval: null,
    dailyUses: parseInt(localStorage.getItem('convertidor_dailyUses') || '0'),
    maxFreeUses: 5,
    lastUseDate: localStorage.getItem('convertidor_lastUseDate') || '',
  };

  // Reset contador diario si cambió el día
  const today = new Date().toDateString();
  if (state.lastUseDate !== today) {
    state.dailyUses = 0;
    state.lastUseDate = today;
    localStorage.setItem('convertidor_dailyUses', '0');
    localStorage.setItem('convertidor_lastUseDate', today);
  }

  // ================================================================
  //  UTILIDADES
  // ================================================================

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  function showToast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:2000;display:flex;flex-direction:column;gap:0.5rem';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.style.cssText = `padding:0.6rem 1rem;border-radius:8px;font-size:0.85rem;animation:toastIn 0.25s ease;box-shadow:0 4px 12px rgba(0,0,0,0.15);max-width:360px;background:${
      type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#1e293b'
    };color:#fff;font-family:'Segoe UI',sans-serif`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 2500);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(
      () => showToast('✅ Copiado', 'success'),
      () => showToast('Error al copiar', 'error')
    );
  }

  // ================================================================
  //  TEMA
  // ================================================================

  function initTheme() {
    const saved = localStorage.getItem('convertidor_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    const btn = $('.theme-toggle');
    if (!btn) return;
    btn.textContent = saved === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('convertidor_theme', next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  }

  // ================================================================
  //  CONTADOR DE USOS
  // ================================================================

  function updateUsageCounter() {
    const el = document.getElementById('usage-counter');
    if (!el) return;
    const remaining = Math.max(0, state.maxFreeUses - state.dailyUses);
    if (state.isPremium) {
      el.textContent = '⭐ Premium';
      el.className = 'usage-counter';
      el.style.cssText = 'border-color:#059669;color:#059669;background:#d1fae5';
      return;
    }
    if (remaining === 0) {
      el.textContent = `📊 0/${state.maxFreeUses} · ver anuncio`;
      el.className = 'usage-counter exhausted';
    } else if (state.dailyUses >= 1) {
      el.textContent = `📊 ${remaining}/${state.maxFreeUses} · con anuncio`;
      el.className = 'usage-counter low';
    } else {
      el.textContent = `📊 1 gratis · luego anuncios`;
      el.className = 'usage-counter';
    }
  }

  function canUseTool() {
    if (state.isPremium) return true;
    if (state.dailyUses < state.maxFreeUses) return true;
    return false;
  }

  function incrementUsage() {
    if (state.isPremium) return;
    state.dailyUses++;
    localStorage.setItem('convertidor_dailyUses', state.dailyUses.toString());
    localStorage.setItem('convertidor_lastUseDate', state.lastUseDate);
    updateUsageCounter();
  }

  // ================================================================
  //  SISTEMA DE ANUNCIOS
  // ================================================================

  function showAdModal(callback) {
    if (state.isPremium) { callback(); return; }

    // Primer uso es gratis, luego anuncio siempre
    if (state.dailyUses < 1) { callback(); return; }

    state.adPending = callback;
    const overlay = document.getElementById('ad-wall');
    if (!overlay) { callback(); return; }
    overlay.classList.add('open');

    const timer = document.getElementById('ad-timer');
    const label = document.getElementById('ad-timer-label');
    const btn = document.getElementById('btn-watch-ad');
    if (timer) timer.textContent = '⏱️ 5s';
    if (label) label.textContent = 'Haz clic en "Ver anuncio"';
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📺 Ver anuncio (5 seg)';
      btn.onclick = null;
    }
  }

  function closeAdModal() {
    const overlay = document.getElementById('ad-wall');
    if (overlay) overlay.classList.remove('open');
    if (state.adTimerInterval) {
      clearInterval(state.adTimerInterval);
      state.adTimerInterval = null;
    }
  }

  function initAdWall() {
    const btn = document.getElementById('btn-watch-ad');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const timer = document.getElementById('ad-timer');
      const label = document.getElementById('ad-timer-label');
      let seconds = 5;

      btn.disabled = true;
      btn.innerHTML = '⏳ Viendo...';
      if (timer) timer.textContent = '⏳ 5s';
      if (label) label.textContent = 'Espera 5 segundos...';

      state.adTimerInterval = setInterval(() => {
        seconds--;
        if (timer) timer.textContent = `⏳ ${seconds}s`;
        if (label) label.textContent = seconds > 0 ? `Espera ${seconds}s...` : '¡Listo!';

        if (seconds <= 0) {
          clearInterval(state.adTimerInterval);
          state.adTimerInterval = null;
          if (timer) timer.textContent = '✅';
          if (label) label.textContent = '¡Anuncio completado!';
          btn.innerHTML = '✅ Continuar';
          btn.disabled = false;
          btn.classList.add('btn-success');

          incrementUsage();
          btn.onclick = () => {
            closeAdModal();
            if (state.adPending) { state.adPending(); state.adPending = null; }
            btn.onclick = null;
            btn.classList.remove('btn-success');
          };
        }
      }, 1000);
    });

    // Cerrar con overlay
    const overlay = document.getElementById('ad-wall');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAdModal();
      });
    }

    // Botón "Hazte Premium" en ad wall
    const premiumBtn = document.getElementById('ad-wall-premium');
    if (premiumBtn) {
      premiumBtn.addEventListener('click', () => {
        closeAdModal();
        openPremiumModal();
      });
    }
  }

  // ================================================================
  //  SISTEMA PREMIUM
  // ================================================================

  function openPremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.add('open');
  }

  function closePremiumModal() {
    const modal = document.getElementById('premium-modal');
    if (modal) modal.classList.remove('open');
  }

  function initPremium() {
    // Botón "Sin anuncios" en header
    const headerBtn = document.getElementById('header-premium-btn');
    if (headerBtn) {
      headerBtn.addEventListener('click', () => {
        if (state.isPremium) {
          if (confirm('¿Desactivar modo Premium?')) {
            state.isPremium = false;
            state.premiumCode = null;
            localStorage.removeItem('convertidor_premium');
            updatePremiumUI();
            showToast('Premium desactivado', 'info');
          }
        } else {
          openPremiumModal();
        }
      });
    }

    // Botón activar demo
    const demoBtn = document.getElementById('premium-activate-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        activatePremium('PREMIUM2024');
        closePremiumModal();
      });
    }

    // Código premium
    const codeBtn = document.getElementById('premium-code-btn');
    const codeInput = document.getElementById('premium-code-input');
    if (codeBtn && codeInput) {
      codeBtn.addEventListener('click', () => {
        const code = codeInput.value.trim().toUpperCase();
        const validCodes = ['PREMIUM2024', 'VIP2024', 'TESTPREMIUM'];
        if (validCodes.includes(code)) {
          activatePremium(code);
          closePremiumModal();
        } else {
          showToast('Código inválido. Prueba: PREMIUM2024', 'error');
        }
      });
      codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') codeBtn.click(); });
    }

    // Cerrar premium modal
    const closeBtn = document.getElementById('premium-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closePremiumModal);
    }

    // Cerrar con overlay
    const modal = document.getElementById('premium-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closePremiumModal();
      });
    }

    updatePremiumUI();
    updateUsageCounter();
  }

  function activatePremium(code) {
    state.isPremium = true;
    state.premiumCode = code;
    localStorage.setItem('convertidor_premium', code);
    updatePremiumUI();
    updateUsageCounter();
    showToast('🎉 ¡Premium activado! Sin anuncios.', 'success');
  }

  function updatePremiumUI() {
    const btn = document.getElementById('header-premium-btn');
    if (!btn) return;
    if (state.isPremium) {
      btn.textContent = '⭐ Premium ✓';
      btn.style.background = 'linear-gradient(135deg, #059669, #047857)';
      btn.style.color = '#fff';
      $$('.ad-row').forEach(el => el.style.display = 'none');
    } else {
      btn.textContent = '⭐ Sin anuncios';
      btn.style.background = '';
      btn.style.color = '';
      $$('.ad-row').forEach(el => el.style.display = '');
    }
  }

  // ================================================================
  //  SELECTOR DE FORMATO + BUSCADOR
  // ================================================================

  let currentFormat = 'all';

  function initFormatSelector() {
    const buttons = $$('.format-btn');
    const searchInput = document.getElementById('tool-search');

    // Click en formato
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFormat = btn.dataset.format;
        // Limpiar búsqueda al cambiar formato
        if (searchInput) searchInput.value = '';
        filterTools();
      });
    });

    // Búsqueda
    if (searchInput) {
      searchInput.addEventListener('input', filterTools);
    }

    // Filtro inicial
    filterTools();
  }

  function filterTools() {
    const q = (document.getElementById('tool-search')?.value || '').toLowerCase().trim();
    const cards = $$('.tool-card');
    const noResults = document.getElementById('no-results');
    let visibleCount = 0;

    cards.forEach(card => {
      const formats = (card.dataset.format || '').split(' ');
      // Coincide con el formato seleccionado?
      const matchFormat = currentFormat === 'all' || formats.includes(currentFormat);
      // Coincide con la búsqueda?
      const matchSearch = !q || card.textContent.toLowerCase().includes(q);

      if (matchFormat && matchSearch) {
        card.classList.remove('hidden');
        card.classList.add('fade-in');
        visibleCount++;
      } else {
        card.classList.add('hidden');
        card.classList.remove('fade-in');
      }
    });

    // Mostrar/ocultar mensaje de sin resultados
    if (noResults) {
      noResults.style.display = (currentFormat !== 'all' && visibleCount === 0 && !q) ? 'block' : 'none';
      if (q && visibleCount === 0) noResults.style.display = 'block';
    }
  }

  // ================================================================
  //  FILE UPLOAD (drag & drop unificado)
  // ================================================================

  function initFileUploads() {
    $$('.file-upload').forEach(el => {
      const input = el.querySelector('input[type="file"]');
      if (!input) return;

      el.addEventListener('click', () => input.click());

      input.addEventListener('change', () => {
        if (input.files.length > 0) {
          const names = Array.from(input.files).map(f => `📎 ${f.name}`).join(', ');
          const p = el.querySelector('p');
          if (p) { p.textContent = names; p.style.fontWeight = '600'; p.style.color = 'var(--primary)'; }
        }
      });

      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          input.files = e.dataTransfer.files;
          const names = Array.from(e.dataTransfer.files).map(f => `📎 ${f.name}`).join(', ');
          const p = el.querySelector('p');
          if (p) { p.textContent = names; p.style.fontWeight = '600'; p.style.color = 'var(--primary)'; }
        }
      });
    });
  }

  // ================================================================
  //  SISTEMA CENTRALIZADO DE HERRAMIENTAS
  // ================================================================

  const toolHandlers = {};

  function getVal(id) { const el = document.querySelector(`[data-id="${id}"]`); return el ? el.value : ''; }
  function getFile(id) { const el = document.querySelector(`[data-id="${id}"]`); return el && el.files ? el.files : null; }
  function getNum(id) { const v = parseFloat(getVal(id)); return isNaN(v) ? null : v; }
  function setResult(id, html, type = 'success') {
    const el = document.querySelector(`[data-result="${id}"]`);
    if (!el) return;
    el.className = `result-placeholder ${type}`;
    el.innerHTML = html;
    el.style.maxHeight = '400px';
    el.style.overflow = 'auto';
  }

  // --- Registrar handlers ---
  function registerTool(btnId, handler) {
    toolHandlers[btnId] = handler;
  }

  function initToolButtons() {
    $$('.tool-btn').forEach(btn => {
      const id = btn.dataset.btn;
      btn.addEventListener('click', () => {
        const handler = toolHandlers[id];
        if (handler) {
          // Verificar límite de usos
          if (!state.isPremium && state.dailyUses >= state.maxFreeUses) {
            showAdModal(() => handler());
            return;
          }
          handler();
        }
      });
    });
  }

  // ================================================================
  //  DEFINIR TODAS LAS HERRAMIENTAS
  // ================================================================

  function initAllTools() {

    // --- PDF → Texto ---
    registerTool('pdf-text', () => {
      const files = getFile('pdf-text-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.pdfToText(files[0]);
        if (r.error) return setResult('pdf-text', '❌ ' + r.error, 'error');
        setResult('pdf-text', `<div style="font-weight:600;margin-bottom:0.25rem">${r.pages} páginas extraídas</div><pre style="white-space:pre-wrap;font-size:0.8rem">${r.text.slice(0,3000)}${r.text.length > 3000 ? '\n...' : ''}</pre>`);
      });
    });

    // --- Combinar PDFs ---
    registerTool('pdf-merge', () => {
      const files = getFile('pdf-merge-files');
      if (!files || files.length < 2) return showToast('Selecciona al menos 2 PDFs', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.mergePDFs(Array.from(files));
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ PDFs combinados (${GeneralTools.formatSize(r.size)})`, 'success');
      });
    });

    // --- Dividir PDF ---
    registerTool('pdf-split', () => {
      const files = getFile('pdf-split-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.splitPDF(files[0]);
        if (r.error) return showToast(r.error, 'error');
        r.pages.forEach(p => GeneralTools.downloadBlob(p.blob, p.filename));
        showToast(`✅ PDF dividido en ${r.total} páginas`, 'success');
      });
    });

    // --- Comprimir PDF ---
    registerTool('pdf-compress', () => {
      const files = getFile('pdf-compress-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.compressPDF(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        const saved = ((1 - r.newSize / r.originalSize) * 100).toFixed(1);
        showToast(`✅ Comprimido (${GeneralTools.formatSize(r.originalSize)} → ${GeneralTools.formatSize(r.newSize)}, -${saved}%)`, 'success');
      });
    });

    // --- PDF → Imágenes ---
    registerTool('pdf-img', () => {
      const files = getFile('pdf-img-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const fmt = getVal('pdf-img-format') || 'png';
        const r = await GeneralTools.pdfToImages(files[0], fmt);
        if (r.error) return showToast(r.error, 'error');
        r.images.forEach(img => GeneralTools.downloadBlob(img.blob, img.filename));
        showToast(`✅ ${r.total} imágenes generadas`, 'success');
      });
    });

    // --- Imagen → PDF ---
    registerTool('img-pdf', () => {
      const files = getFile('img-pdf-file');
      if (!files || !files.length) return showToast('Selecciona al menos una imagen', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.imagesToPDF(Array.from(files));
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ PDF con ${r.pages} páginas`, 'success');
      });
    });

    // --- Rotar PDF ---
    registerTool('pdf-rotate', () => {
      const files = getFile('pdf-rotate-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const angle = parseInt(getVal('pdf-rotate-angle')) || 90;
        const r = await GeneralTools.rotatePDF(files[0], angle);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ PDF rotado ${angle}°`, 'success');
      });
    });

    // --- Excel → CSV ---
    registerTool('excel-csv', () => {
      const files = getFile('excel-csv-file');
      if (!files || !files.length) return showToast('Selecciona un Excel', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.excelToCSV(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.filename}`, 'success');
      });
    });

    // --- Excel → JSON ---
    registerTool('excel-json', () => {
      const files = getFile('excel-json-file');
      if (!files || !files.length) return showToast('Selecciona un Excel', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.excelToJSON(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ JSON (${r.rows} filas)`, 'success');
      });
    });

    // --- Word → HTML ---
    registerTool('word-html', () => {
      const files = getFile('word-html-file');
      if (!files || !files.length) return showToast('Selecciona un Word', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.wordToHTML(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.filename}`, 'success');
      });
    });

    // --- Word → Texto ---
    registerTool('word-text', () => {
      const files = getFile('word-text-file');
      if (!files || !files.length) return showToast('Selecciona un Word', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.wordToText(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.filename}`, 'success');
      });
    });

    // --- CSV → Excel ---
    registerTool('csv-excel', () => {
      const files = getFile('csv-excel-file');
      if (!files || !files.length) return showToast('Selecciona un CSV', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.csvToExcel(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.filename}`, 'success');
      });
    });

    // --- JSON → Excel ---
    registerTool('json-excel', () => {
      const files = getFile('json-excel-file');
      if (!files || !files.length) return showToast('Selecciona un JSON', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.jsonToExcel(files[0]);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ Excel (${r.rows} filas)`, 'success');
      });
    });

    // --- Word → Markdown ---
    registerTool('word-md', () => {
      const files = getFile('word-md-file');
      if (!files || !files.length) return showToast('Selecciona un Word', 'error');
      showAdModal(async () => {
        if (typeof TurndownService === 'undefined') {
          await new Promise(r => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.3/turndown.min.js'; s.onload = r; document.head.appendChild(s); });
        }
        const htmlR = await GeneralTools.wordToHTML(files[0]);
        if (htmlR.error) return showToast(htmlR.error, 'error');
        const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        const md = td.turndown(htmlR.html);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        GeneralTools.downloadBlob(blob, files[0].name.replace(/\.docx?$/, '.md'));
        showToast('✅ Markdown descargado', 'success');
      });
    });

    // --- Imagen: Convertir ---
    registerTool('img-convert', () => {
      const files = getFile('img-convert-file');
      if (!files || !files.length) return showToast('Selecciona una imagen', 'error');
      showAdModal(async () => {
        const fmt = getVal('img-format') || 'png';
        const r = await GeneralTools.convertImage(files[0], fmt);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.filename}`, 'success');
      });
    });

    // --- Imagen: Redimensionar ---
    registerTool('img-resize', () => {
      const files = getFile('img-resize-file');
      if (!files || !files.length) return showToast('Selecciona una imagen', 'error');
      showAdModal(async () => {
        const w = parseInt(getVal('img-width')) || 800;
        const h = parseInt(getVal('img-height')) || 800;
        const r = await GeneralTools.resizeImage(files[0], w, h);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ ${r.width}×${r.height}`, 'success');
      });
    });

    // --- Imagen: Filtros ---
    registerTool('img-filter', () => {
      const files = getFile('img-filter-file');
      if (!files || !files.length) return showToast('Selecciona una imagen', 'error');
      showAdModal(async () => {
        const type = getVal('img-filter-type') || 'grayscale';
        const r = await GeneralTools.applyImageFilter(files[0], type);
        if (r.error) return showToast(r.error, 'error');
        GeneralTools.downloadBlob(r.blob, r.filename);
        showToast(`✅ Filtro: ${type}`, 'success');
      });
    });

    // --- Imagen a Base64 ---
    registerTool('img-base64', () => {
      const files = getFile('img-base64-file');
      if (!files || !files.length) return showToast('Selecciona una imagen', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.imageToBase64(files[0]);
        const preview = r.dataUrl.length > 150 ? r.dataUrl.slice(0, 150) + '...' : r.dataUrl;
        setResult('img-base64', `<div style="font-size:0.7rem;word-break:break-all">${preview}</div>
          <button class="btn btn-sm btn-primary" style="margin-top:0.35rem" onclick="navigator.clipboard.writeText('${r.dataUrl}').then(()=>showToast('✅ Copiado'))">📋 Copiar</button>`);
      });
    });

    // --- Texto: Estadísticas ---
    registerTool('text-stats', () => {
      const text = getVal('text-stats-input');
      const stats = GeneralTools.textStats(text);
      setResult('text-stats', `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.35rem">
        <div style="text-align:center;background:var(--surface);padding:0.35rem;border-radius:4px"><div style="font-weight:700;color:var(--primary)">${stats.chars}</div><div style="font-size:0.65rem;color:var(--text-light)">Caracteres</div></div>
        <div style="text-align:center;background:var(--surface);padding:0.35rem;border-radius:4px"><div style="font-weight:700;color:var(--primary)">${stats.words}</div><div style="font-size:0.65rem;color:var(--text-light)">Palabras</div></div>
        <div style="text-align:center;background:var(--surface);padding:0.35rem;border-radius:4px"><div style="font-weight:700;color:var(--primary)">${stats.lines}</div><div style="font-size:0.65rem;color:var(--text-light)">Líneas</div></div>
        <div style="text-align:center;background:var(--surface);padding:0.35rem;border-radius:4px"><div style="font-weight:700;color:var(--primary)">${stats.charsNoSpace}</div><div style="font-size:0.65rem;color:var(--text-light)">Sin espacios</div></div>
        <div style="text-align:center;background:var(--surface);padding:0.35rem;border-radius:4px"><div style="font-weight:700;color:var(--primary)">${stats.paragraphs}</div><div style="font-size:0.65rem;color:var(--text-light)">Párrafos</div></div>
      </div>`);
    });

    // --- Texto: Mayúsculas ---
    registerTool('text-case', () => {
      const text = getVal('text-case-input');
      const type = getVal('text-case-type') || 'upper';
      const r = GeneralTools.caseConvert(text, type);
      setResult('text-case', `<pre style="white-space:pre-wrap">${r}</pre>`);
    });

    // --- Comparar Textos ---
    registerTool('diff', () => {
      const a = getVal('diff-text-a');
      const b = getVal('diff-text-b');
      const r = GeneralTools.textDiff(a, b);
      const colored = r.diff.split('\n').map(line => {
        if (line.startsWith('+ ')) return `<span style="color:#059669;font-weight:600">${line}</span>`;
        if (line.startsWith('- ')) return `<span style="color:#dc2626;font-weight:600">${line}</span>`;
        return line;
      }).join('\n');
      setResult('diff', `<div style="font-size:0.8rem;margin-bottom:0.25rem">${r.changes} cambio(s) · ${r.linesA} → ${r.linesB} líneas</div>
        <pre style="white-space:pre-wrap;font-size:0.75rem">${colored}</pre>`);
    });

    // --- HTML → Markdown ---
    registerTool('html-md', async () => {
      const html = getVal('html-md-input');
      if (!html.trim()) return showToast('Pega algo de HTML', 'error');
      if (typeof TurndownService === 'undefined') {
        await new Promise(r => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/turndown/7.1.3/turndown.min.js'; s.onload = r; document.head.appendChild(s); });
      }
      try {
        const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
        const md = td.turndown(html);
        setResult('html-md', `<pre style="white-space:pre-wrap;font-size:0.8rem">${md}</pre>`);
      } catch (e) { setResult('html-md', '❌ ' + e.message, 'error'); }
    });

    // --- PDF → Markdown ---
    registerTool('pdf-md', () => {
      const files = getFile('pdf-md-file');
      if (!files || !files.length) return showToast('Selecciona un PDF', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.pdfToText(files[0]);
        if (r.error) return showToast(r.error, 'error');
        let md = `# ${files[0].name.replace(/\.pdf$/, '')}\n\n*${r.pages} páginas*\n\n---\n\n${r.text}`;
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        GeneralTools.downloadBlob(blob, files[0].name.replace(/\.pdf$/, '.md'));
        showToast('✅ Markdown descargado', 'success');
      });
    });

    // --- Excel → Markdown ---
    registerTool('excel-md', () => {
      const files = getFile('excel-md-file');
      if (!files || !files.length) return showToast('Selecciona un Excel', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.excelToCSV(files[0]);
        if (r.error) return showToast(r.error, 'error');
        const lines = r.text.trim().split('\n');
        if (lines.length < 2) return showToast('Mínimo 2 filas', 'error');
        const headers = lines[0].split(',').map(h => h.trim());
        const sep = headers.map(() => '---');
        let md = `# ${files[0].name.replace(/\.(xlsx|xls)$/, '')}\n\n`;
        md += `| ${headers.join(' | ')} |\n| ${sep.join(' | ')} |\n`;
        for (let i = 1; i < lines.length; i++) {
          md += `| ${lines[i].split(',').map(c => c.trim()).join(' | ')} |\n`;
        }
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        GeneralTools.downloadBlob(blob, files[0].name.replace(/\.(xlsx|xls)$/, '.md'));
        showToast(`✅ Markdown con ${lines.length-1} filas`, 'success');
      });
    });

    // --- Base64: Codificar ---
    registerTool('base64-encode', () => {
      const text = getVal('base64-input');
      try {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        setResult('base64', `<pre style="white-space:pre-wrap;word-break:break-all;font-size:0.75rem">${encoded}</pre>`);
      } catch (e) { setResult('base64', '❌ Error: ' + e.message, 'error'); }
    });

    // --- Base64: Decodificar ---
    registerTool('base64-decode', () => {
      const text = getVal('base64-input');
      try {
        const decoded = decodeURIComponent(escape(atob(text)));
        setResult('base64', `<pre style="white-space:pre-wrap">${decoded}</pre>`);
      } catch (e) { setResult('base64', '❌ Base64 inválido', 'error'); }
    });

    // --- Hash SHA-256 ---
    registerTool('hash', () => {
      const files = getFile('hash-file');
      if (!files || !files.length) return showToast('Selecciona un archivo', 'error');
      showAdModal(async () => {
        const r = await GeneralTools.fileHash(files[0]);
        setResult('hash', `<div style="font-size:0.7rem;word-break:break-all;font-family:var(--font-mono)"><strong>SHA-256:</strong><br>${r.hash}</div>`);
      });
    });

  }

  // ================================================================
  //  INICIALIZACIÓN
  // ================================================================

  function init() {
    initTheme();
    initAdWall();
    initPremium();
    initFormatSelector();
    initFileUploads();
    initAllTools();
    initToolButtons();
    updateUsageCounter();

    console.log('Convertidor Universal — Modo ' + (state.isPremium ? '⭐ Premium' : '📺 Gratis'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
