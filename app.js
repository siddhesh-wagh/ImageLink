/* ═══════════════════════════════════════════════════════
   PixelVault — app.js
   Features:
   • ImgBB cloud upload with configurable API key
   • Local storage fallback (IndexedDB + base64)
   • Drag & drop + click to upload
   • Multi-format copy (URL, markdown, HTML, BBCode)
   • Gallery with search/filter
   • Image rename & delete
   • Stats bar (cloud / local / total size)
   • Toast notifications
   • Modal lightbox with all formats
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── CONSTANTS ──────────────────────────────────────────
const DB_NAME    = 'PixelVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'uploads';
const KEY_APIKEY = 'pixelvault_apikey';

// ── STATE ──────────────────────────────────────────────
let db          = null;
let currentMode = 'cloud';   // 'cloud' | 'local'
let gallery     = [];        // combined array of all entries
let currentFile = null;      // File object selected
let currentEntry= null;      // Entry shown in modal

// ── DOM REFS ───────────────────────────────────────────
const $ = id => document.getElementById(id);

const dropZone     = $('drop-zone');
const fileInput    = $('file-input');
const apiKeyInput  = $('api-key-input');
const uploadBtn    = $('upload-btn');
const progressWrap = $('progress-wrap');
const progressFill = $('progress-fill');
const progressText = $('progress-text');
const previewPanel = $('preview-panel');
const previewImg   = $('preview-img');
const previewName  = $('preview-name');
const previewSize  = $('preview-size');
const previewType  = $('preview-type');
const previewDims  = $('preview-dims');
const resultCard   = $('result-card');
const resultDot    = $('result-dot');
const resultTitle  = $('result-title');
const resultSub    = $('result-sub');
const urlInput     = $('url-input');
const formatLinks  = $('format-links');
const galleryGrid  = $('gallery-grid');
const galleryCount = $('gallery-count');
const statCloud    = $('stat-cloud');
const statLocal    = $('stat-local');
const statSize     = $('stat-size');
const searchInput  = $('search-input');
const filterSelect = $('filter-select');
const toastCont    = $('toast-container');
const modal        = $('modal');
const modalImg     = $('modal-img');
const modalFmts    = $('modal-formats');
const tabCloud     = $('tab-cloud');
const tabLocal     = $('tab-local');
const localBanner  = $('local-banner');
const nameInput    = $('name-input');
const expireSelect = $('expire-select');

// ── INDEXEDDB ─────────────────────────────────────────
function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        const store = d.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_date', 'date', { unique: false });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(entry) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── UTILS ──────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function getDimensions(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = src;
  });
}

// ── TOAST ──────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  toastCont.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── API KEY ─────────────────────────────────────────────
function loadApiKey() {
  const saved = localStorage.getItem(KEY_APIKEY);
  if (saved) apiKeyInput.value = saved;
}

function saveApiKey() {
  localStorage.setItem(KEY_APIKEY, apiKeyInput.value.trim());
}

apiKeyInput.addEventListener('change', saveApiKey);

// ── TABS ───────────────────────────────────────────────
tabCloud.addEventListener('click', () => switchMode('cloud'));
tabLocal.addEventListener('click', () => switchMode('local'));

function switchMode(mode) {
  currentMode = mode;
  tabCloud.classList.toggle('active', mode === 'cloud');
  tabLocal.classList.toggle('active', mode === 'local');
  localBanner.style.display = mode === 'local' ? 'flex' : 'none';
  apiKeyInput.closest('.api-row').style.display = mode === 'cloud' ? 'flex' : 'none';
  expireSelect.closest('.option-group').style.display = mode === 'cloud' ? 'flex' : 'none';
  resetUploadUI();
}

// ── DROP ZONE ──────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length) handleFileSelect(files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFileSelect(fileInput.files[0]);
});

// Paste support
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      handleFileSelect(item.getAsFile());
      break;
    }
  }
});

// ── FILE SELECTION ─────────────────────────────────────
async function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) {
    toast('Please select a valid image file.', 'error');
    return;
  }
  currentFile = file;
  resetUploadUI();

  // Auto-fill name
  if (!nameInput.value) {
    nameInput.value = file.name.replace(/\.[^.]+$/, '');
  }

  // Preview
  const base64 = await fileToBase64(file);
  previewImg.src = base64;
  previewPanel.classList.add('visible');
  previewName.textContent = file.name;
  previewSize.textContent = formatBytes(file.size);
  previewType.textContent = file.type;
  const { w, h } = await getDimensions(base64);
  previewDims.textContent = w && h ? `${w} × ${h}` : '—';

  uploadBtn.disabled = false;
}

// ── UPLOAD ─────────────────────────────────────────────
uploadBtn.addEventListener('click', () => {
  if (!currentFile) return;
  if (currentMode === 'cloud') uploadToImgBB();
  else                         saveLocally();
});

// ── IMGBB UPLOAD ───────────────────────────────────────
async function uploadToImgBB() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    toast('Please enter your ImgBB API key.', 'error');
    apiKeyInput.focus();
    return;
  }
  saveApiKey();

  setUploading(true);

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(currentFile);
    });

    setProgress(10, 'Connecting to ImgBB...');

    const body = new URLSearchParams({ image: base64Data });
    const expire = expireSelect.value;
    if (expire) body.append('expiration', expire);
    const customName = nameInput.value.trim();
    if (customName) body.append('name', customName);

    // Simulate progress (ImgBB doesn't give real progress)
    let fakeProgress = 10;
    const ticker = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 12, 85);
      setProgress(fakeProgress, 'Uploading...');
    }, 300);

    const res  = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST', body
    });

    clearInterval(ticker);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    setProgress(100, 'Done!');
    await delay(300);

    if (data.success) {
      const entry = {
        id:        uid(),
        type:      'cloud',
        name:      customName || currentFile.name,
        url:       data.data.url,
        thumb:     data.data.thumb?.url || data.data.url,
        deleteUrl: data.data.delete_url || null,
        size:      currentFile.size,
        mime:      currentFile.type,
        date:      Date.now(),
        dims:      { w: data.data.width, h: data.data.height }
      };
      await dbPut(entry);
      gallery.unshift(entry);
      showResult(entry);
      renderGallery();
      updateStats();
      toast('Uploaded to ImgBB successfully!', 'success');
    } else {
      throw new Error(data.error?.message || 'Upload failed');
    }
  } catch (err) {
    console.error('[ImgBB Error]', err);
    setUploading(false);
    showError(`Cloud upload failed: ${err.message}. Try switching to Local mode.`);
    toast('Upload failed — try Local mode as fallback!', 'error', 5000);
  }
}

// ── LOCAL SAVE ─────────────────────────────────────────
async function saveLocally() {
  setUploading(true);
  setProgress(20, 'Reading file...');

  try {
    const base64 = await fileToBase64(currentFile);
    setProgress(60, 'Saving to device...');

    const dims = await getDimensions(base64);
    const customName = nameInput.value.trim();

    const entry = {
      id:     uid(),
      type:   'local',
      name:   customName || currentFile.name,
      url:    base64,          // full data URL stored in IndexedDB
      thumb:  base64,
      size:   currentFile.size,
      mime:   currentFile.type,
      date:   Date.now(),
      dims
    };

    await dbPut(entry);
    gallery.unshift(entry);

    setProgress(100, 'Saved!');
    await delay(300);

    showResult(entry);
    renderGallery();
    updateStats();
    toast('Image saved locally on your device!', 'success');
  } catch (err) {
    console.error('[Local Save Error]', err);
    setUploading(false);
    showError(`Local save failed: ${err.message}`);
  }
}

// ── RESULT DISPLAY ─────────────────────────────────────
function showResult(entry) {
  setUploading(false);
  resultCard.className = `result-card visible ${entry.type === 'cloud' ? 'success' : ''}`;
  resultDot.className  = `result-status-dot ${entry.type === 'cloud' ? 'success' : 'local'}`;
  resultTitle.textContent = entry.type === 'cloud'
    ? '✓ Uploaded to ImgBB cloud'
    : '✓ Saved to local storage';
  resultSub.textContent = formatDate(entry.date);
  urlInput.value = entry.url;

  // Format chips
  renderFormatChips(entry);

  // Wire copy URL button
  $('btn-copy-url').onclick = () => copyText(entry.url, 'URL copied!');
  $('btn-open').onclick     = () => window.open(entry.url, '_blank');
  $('btn-download').onclick = () => downloadEntry(entry);
  $('btn-reset').onclick    = resetAll;
}

function showError(msg) {
  resultCard.className = 'result-card visible error';
  resultDot.className  = 'result-status-dot error';
  resultTitle.textContent = '✗ Upload failed';
  resultSub.textContent   = '';
  urlInput.value = msg;
  formatLinks.innerHTML = '';
  $('btn-copy-url').onclick = null;
  $('btn-open').onclick     = null;
  $('btn-download').onclick = null;
  $('btn-reset').onclick    = resetAll;
}

// ── FORMAT CHIPS ───────────────────────────────────────
function renderFormatChips(entry) {
  const formats = getFormats(entry);
  formatLinks.innerHTML = formats.map(f => `
    <div class="fmt-chip" data-fmt="${f.key}">
      <span class="fmt-label">${f.label}</span>
      <span>${f.icon}</span>
    </div>
  `).join('');

  formatLinks.querySelectorAll('.fmt-chip').forEach(chip => {
    const key = chip.dataset.fmt;
    const fmt = formats.find(f => f.key === key);
    chip.addEventListener('click', () => {
      copyText(fmt.value, `${fmt.label} copied!`);
    });
  });
}

function getFormats(entry) {
  const url   = entry.url;
  const name  = entry.name;
  return [
    { key: 'url',     label: 'URL',      icon: '🔗', value: url },
    { key: 'md',      label: 'Markdown', icon: '📝', value: `![${name}](${url})` },
    { key: 'html',    label: 'HTML',     icon: '🌐', value: `<img src="${url}" alt="${name}" />` },
    { key: 'bbcode',  label: 'BBCode',   icon: '💬', value: `[img]${url}[/img]` },
    { key: 'rst',     label: 'RST',      icon: '📄', value: `.. image:: ${url}\n   :alt: ${name}` },
  ];
}

// ── PROGRESS ───────────────────────────────────────────
function setProgress(pct, label) {
  progressWrap.classList.add('visible');
  progressFill.style.width = `${pct}%`;
  progressText.textContent = label;
}

function setUploading(active) {
  uploadBtn.disabled = active;
  uploadBtn.innerHTML = active
    ? `<span class="spinning">⟳</span> Uploading...`
    : `<span>⬆</span> Upload Image`;
  if (!active) {
    progressWrap.classList.remove('visible');
    progressFill.style.width = '0%';
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── GALLERY ────────────────────────────────────────────
async function loadGallery() {
  gallery = await dbGetAll();
  gallery.sort((a, b) => b.date - a.date);
  renderGallery();
  updateStats();
}

function renderGallery() {
  const q   = searchInput.value.trim().toLowerCase();
  const flt = filterSelect.value;

  let items = gallery.filter(e => {
    const matchQ   = !q || e.name.toLowerCase().includes(q) || e.url.includes(q);
    const matchFlt = flt === 'all' || e.type === flt;
    return matchQ && matchFlt;
  });

  galleryCount.textContent = items.length;

  if (!items.length) {
    galleryGrid.innerHTML = `
      <div class="gallery-empty">
        ${q || flt !== 'all' ? '🔍 No results found.' : '📂 No uploads yet. Start uploading!'}
      </div>`;
    return;
  }

  galleryGrid.innerHTML = items.map(e => `
    <div class="gallery-item" data-id="${e.id}" title="${e.name}">
      <img class="item-thumb" src="${e.thumb}" alt="${e.name}" loading="lazy" />
      <span class="item-type-badge ${e.type}">${e.type === 'cloud' ? '☁ Cloud' : '💾 Local'}</span>
      <div class="item-actions">
        <button class="item-action-btn copy-btn" title="Copy URL" data-id="${e.id}">📋</button>
        <button class="item-action-btn open-btn" title="Open" data-id="${e.id}">↗</button>
        <button class="item-action-btn del-btn"  title="Delete" data-id="${e.id}">🗑</button>
      </div>
      <div class="item-info">
        <div class="item-name">${e.name}</div>
        <div class="item-meta">
          <span>${formatBytes(e.size)}</span>
          <span>${formatDate(e.date)}</span>
        </div>
      </div>
    </div>
  `).join('');

  // Click: open modal
  galleryGrid.querySelectorAll('.gallery-item').forEach(el => {
    el.addEventListener('click', ev => {
      if (ev.target.closest('.item-action-btn')) return;
      const id = el.dataset.id;
      openModal(gallery.find(e => e.id === id));
    });
  });

  // Copy
  galleryGrid.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const entry = gallery.find(e => e.id === btn.dataset.id);
      if (entry) copyText(entry.url, 'URL copied!');
    });
  });

  // Open
  galleryGrid.querySelectorAll('.open-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const entry = gallery.find(e => e.id === btn.dataset.id);
      if (entry) window.open(entry.url, '_blank');
    });
  });

  // Delete
  galleryGrid.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      deleteEntry(btn.dataset.id);
    });
  });
}

// ── STATS ──────────────────────────────────────────────
function updateStats() {
  const cloud = gallery.filter(e => e.type === 'cloud').length;
  const local = gallery.filter(e => e.type === 'local').length;
  const totalSize = gallery.reduce((s, e) => s + (e.size || 0), 0);
  statCloud.textContent = cloud;
  statLocal.textContent = local;
  statSize.textContent  = formatBytes(totalSize);
}

// ── DELETE ─────────────────────────────────────────────
async function deleteEntry(id) {
  if (!confirm('Delete this image? This cannot be undone.')) return;
  await dbDelete(id);
  gallery = gallery.filter(e => e.id !== id);
  renderGallery();
  updateStats();
  toast('Image deleted.', 'info');
}

// ── DOWNLOAD ───────────────────────────────────────────
function downloadEntry(entry) {
  const a = document.createElement('a');
  a.href = entry.url;
  a.download = entry.name || 'image';
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Download started!', 'success');
}

// ── COPY ───────────────────────────────────────────────
async function copyText(text, msg = 'Copied!') {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg, 'success');
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity  = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    toast(msg, 'success');
  }
}

// ── MODAL ──────────────────────────────────────────────
function openModal(entry) {
  currentEntry = entry;
  modalImg.src = entry.url;
  $('modal-title').textContent = entry.name;

  const formats = getFormats(entry);
  modalFmts.innerHTML = formats.map(f => `
    <div class="modal-fmt-row">
      <span class="fmt-key">${f.label}</span>
      <span class="fmt-val" title="${f.value}">${f.value}</span>
      <button class="fmt-copy" data-val="${encodeURIComponent(f.value)}">Copy</button>
    </div>
  `).join('');

  modalFmts.querySelectorAll('.fmt-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      copyText(decodeURIComponent(btn.dataset.val), 'Copied!');
    });
  });

  modal.classList.add('open');
}

function closeModal() {
  modal.classList.remove('open');
  currentEntry = null;
}

modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});
$('modal-close').addEventListener('click', closeModal);
$('modal-download').addEventListener('click', () => {
  if (currentEntry) downloadEntry(currentEntry);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── SEARCH & FILTER ────────────────────────────────────
searchInput.addEventListener('input', renderGallery);
filterSelect.addEventListener('change', renderGallery);

// ── CLEAR ALL ──────────────────────────────────────────
$('btn-clear-all').addEventListener('click', async () => {
  if (!confirm('Delete ALL uploads? This cannot be undone.')) return;
  for (const e of gallery) await dbDelete(e.id);
  gallery = [];
  renderGallery();
  updateStats();
  toast('All uploads cleared.', 'info');
});

// ── RESET UI ───────────────────────────────────────────
function resetUploadUI() {
  currentFile = null;
  fileInput.value = '';
  previewPanel.classList.remove('visible');
  resultCard.className = 'result-card';
  progressWrap.classList.remove('visible');
  progressFill.style.width = '0%';
  setUploading(false);
  nameInput.value = '';
}

function resetAll() {
  resetUploadUI();
}

// ── EXPORT GALLERY ─────────────────────────────────────
$('btn-export').addEventListener('click', () => {
  const data = JSON.stringify(gallery.map(e => ({
    id: e.id, name: e.name, url: e.type === 'cloud' ? e.url : '[local]',
    type: e.type, size: e.size, date: e.date
  })), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pixelvault-export.json';
  a.click();
  toast('Gallery exported as JSON!', 'success');
});

// ── INIT ───────────────────────────────────────────────
(async () => {
  await initDB();
  loadApiKey();
  await loadGallery();
  switchMode('cloud');
  uploadBtn.disabled = true;
  toast('PixelVault ready! Drop an image to get started.', 'info', 2500);
})();
