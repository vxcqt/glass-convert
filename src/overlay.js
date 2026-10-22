'use strict';

/* ------------------------------------------------------------------ */
/* иконки                                                             */
/* ------------------------------------------------------------------ */

const ICON_PATHS = {
  music: '<path d="M9 17.5V6l9.5-2v11.5"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="16" cy="15.5" r="2.6"/>',
  wave: '<path d="M3 12h2.2l1.8-5 3 10 2.6-13 2.4 16 1.8-8H21"/>',
  lossless: '<path d="M4 14v-4M8 18V6M12 15V9M16 20V4M20 13v-2"/>',
  drop: '<path d="M12 3.2s5.6 5.9 5.6 9.8a5.6 5.6 0 0 1-11.2 0c0-3.9 5.6-9.8 5.6-9.8z"/>',
  apple: '<path d="M12 7.4c0-2.2 1.6-3.8 3.7-4.2-.2 2.3-1.6 3.9-3.7 4.2z"/><path d="M12 8.2c-2.2-1.5-5.5-.5-6.4 2.4-1 3.1 1 7.7 3.4 9.3 1.1.7 1.9 1 3 .5 1.1.5 1.9.2 3-.5 2.4-1.6 4.4-6.2 3.4-9.3-.9-2.9-4.2-3.9-6.4-2.4z"/>',
  film: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M7.5 4.5v15M16.5 4.5v15M3 9.5h4.5M3 14.5h4.5M16.5 9.5H21M16.5 14.5H21"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.9 3.3 2.9 13.9 0 17.2M12 3.4c-2.9 3.3-2.9 13.9 0 17.2"/>',
  gif: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><path d="M9.2 10.2H7.4v3.6h1.8M12 10.2v3.6M15 13.8v-1.4h1.7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="3.2"/><circle cx="9" cy="9.8" r="1.7"/><path d="m4.4 17.2 4.7-4 3.7 3 3-2.2 4.2 3.2"/>',
  camera: '<path d="M4.2 8h3l1.4-2h6.8L16.8 8h3a1.2 1.2 0 0 1 1.2 1.2v8.6A1.2 1.2 0 0 1 19.8 19H4.2A1.2 1.2 0 0 1 3 17.8V9.2A1.2 1.2 0 0 1 4.2 8z"/><circle cx="12" cy="13.2" r="3.3"/>',
  spark: '<path d="M11.5 3.5 13 8.6l5.1 1.5-5.1 1.5-1.5 5.1-1.5-5.1L4.9 10l5.1-1.4z"/><path d="m18 15.3.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  grid: '<rect x="3.4" y="3.4" width="7" height="7" rx="1.6"/><rect x="13.6" y="3.4" width="7" height="7" rx="1.6"/><rect x="3.4" y="13.6" width="7" height="7" rx="1.6"/><rect x="13.6" y="13.6" width="7" height="7" rx="1.6"/>',
  pdf: '<path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z"/><path d="M14 3.4V8h4.6"/><path d="M8.4 12.4h2.1a1.4 1.4 0 0 1 0 2.8H8.4v-2.8zm0 2.8v2.4M13.2 12.4v5.2h1.2a2.1 2.1 0 0 0 2.1-2.1v-1a2.1 2.1 0 0 0-2.1-2.1h-1.2z"/>',
  word: '<path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z"/><path d="M14 3.4V8h4.6"/><path d="m8.2 12 1.2 5.2 1.7-3.7 1.7 3.7L14 12"/>',
  text: '<path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z"/><path d="M14 3.4V8h4.6"/><path d="M8.5 12.2h7M8.5 15.2h7M8.5 18.2h4.4"/>',
  file: '<path d="M14 3.4H7.2a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h9.6a1.8 1.8 0 0 0 1.8-1.8V8z"/><path d="M14 3.4V8h4.6"/>',
};

function svg(name) {
  const inner = ICON_PATHS[name] || ICON_PATHS.file;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
}

/* ------------------------------------------------------------------ */
/* DOM                                                                */
/* ------------------------------------------------------------------ */

const stage = document.getElementById('stage');
const itemsEl = document.getElementById('items');
const backdropEl = document.getElementById('backdrop');
const captionEl = document.getElementById('caption');
const captionText = document.getElementById('captionText');
const core = document.getElementById('core');
const coreIcon = document.getElementById('coreIcon');
const coreKicker = document.getElementById('coreKicker');
const coreTitle = document.getElementById('coreTitle');
const coreSub = document.getElementById('coreSub');
const PREVIEW = new URLSearchParams(location.search).has('preview');

const CATEGORY_META = {
  audio: { kicker: 'Аудио', title: 'Аудиофайл', icon: 'music', sub: 'выберите формат' },
  video: { kicker: 'Видео', title: 'Видеофайл', icon: 'film', sub: 'выберите формат' },
  image: { kicker: 'Изображение', title: 'Картинка', icon: 'image', sub: 'выберите формат' },
  document: { kicker: 'Документ', title: 'Документ', icon: 'file', sub: 'выберите формат' },
  unknown: { kicker: 'drag', title: 'Форматы', icon: 'spark', sub: 'отпустите файл' },
};

const state = {
  open: false,
  mode: 'manual',
  category: 'unknown',
  sourceExt: '',
  trigger: 'shift',
  theme: 'liquid',
  hot: -1,
  segs: [],
  fileName: '',
  dropped: false,
  timer: null,
  closeTimer: null,
};

function triggerLabel() {
  try {
    return window.gc.triggerLabel(state.trigger);
  } catch (_) {
    return 'Shift';
  }
}

/* ------------------------------------------------------------------ */
/* отрисовка                                                          */
/* ------------------------------------------------------------------ */

function renderItems(category, sourceExt = '') {
  const set = category === 'unknown' ? 'default' : category;
  const list = window.gc.formatsFor(set, sourceExt);
  state.segs = list;
  state.hot = -1;
  itemsEl.classList.remove('has-hot');
  itemsEl.innerHTML = '';

  const step = 360 / Math.max(1, list.length);
  list.forEach((fmt, i) => {
    const angle = -90 + i * step;
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.setProperty('--a', `${angle}deg`);
    seg.style.setProperty('--i', String(i));
    seg.dataset.key = fmt.key;
    seg.innerHTML = `<div class="seg-glass"><span class="seg-icon">${svg(fmt.icon)}</span><span class="seg-label">${fmt.label}</span></div>`;
    itemsEl.appendChild(seg);
  });
}

function setCoreIdle() {
  const meta = CATEGORY_META[state.category] || CATEGORY_META.unknown;
  coreIcon.innerHTML = svg(meta.icon);
  coreKicker.textContent =
    state.category === 'unknown' ? `${triggerLabel()} + drag` : meta.kicker;
  coreTitle.textContent = meta.title;
  coreSub.textContent = meta.sub;
}

function setCoreHot(fmt) {
  coreIcon.innerHTML = svg(fmt.icon);
  coreKicker.textContent = 'Конвертация';
  coreTitle.textContent = fmt.label;
  coreSub.textContent = fmt.hint || 'выбран';
  core.classList.remove('pulse');
  void core.offsetWidth;
  core.classList.add('pulse');
}

function setCaption(text, hot) {
  captionText.textContent = text;
  captionEl.classList.toggle('is-hot', Boolean(hot));
}

function updateCaption() {
  if (state.hot >= 0) {
    const fmt = state.segs[state.hot];
    const from = state.fileName ? `«${truncate(state.fileName, 34)}» → ` : '';
    setCaption(`${from}${fmt.label} · отпустите, чтобы начать`, true);
  } else if (state.fileName) {
    setCaption(`Файл: ${truncate(state.fileName, 46)} · выберите формат`);
  } else {
    setCaption('Отпустите файл на нужный формат');
  }
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function setHot(index) {
  if (index === state.hot) return;
  state.hot = index;
  const segs = Array.from(itemsEl.children);
  segs.forEach((el, i) => el.classList.toggle('is-hot', i === index));
  itemsEl.classList.toggle('has-hot', index >= 0);

  if (index >= 0) {
    setCoreHot(state.segs[index]);
  } else {
    setCoreIdle();
  }
  updateCaption();
}

function clearHot() {
  setHot(-1);
}

/* ------------------------------------------------------------------ */
/* геометрия                                                          */
/* ------------------------------------------------------------------ */

function center() {
  const rect = stage.getBoundingClientRect();
  return { x: rect.width / 2, y: rect.height / 2 };
}

function pointFromEvent(event) {
  return { x: event.clientX, y: event.clientY };
}

function segmentAt(point) {
  const c = center();
  const dx = point.x - c.x;
  const dy = point.y - c.y;
  const distance = Math.hypot(dx, dy);
  const n = state.segs.length;
  if (!n) return -1;
  if (distance < 62) return -1;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180, 0 = вправо
  deg = (deg + 90 + 720) % 360; // 0 = вверх
  const step = 360 / n;
  const index = Math.round(deg / step) % n;
  return index;
}

/* ------------------------------------------------------------------ */
/* определение типа файла при перетаскивании                          */
/* ------------------------------------------------------------------ */

function dragFiles(dt) {
  try {
    return Array.from((dt && dt.files) || []);
  } catch (_) {
    return [];
  }
}

const DOCUMENT_MIME_EXT = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-word.document.macroenabled.12': 'docx',
  'text/plain': 'txt',
};

function documentExtFromType(type) {
  return DOCUMENT_MIME_EXT[String(type || '').toLowerCase()] || '';
}

function guessDragInfo(dt) {
  if (!dt) return { category: 'unknown', name: '', ext: '' };
  const items = Array.from(dt.items || []);
  for (const item of items) {
    if (item.kind !== 'file') continue;
    const mimeExt = documentExtFromType(item.type);
    let file = null;
    try {
      file = item.getAsFile();
    } catch (_) {
      file = null;
    }
    if (file && file.name) {
      return { category: window.gc.categoryFor(file.name), name: file.name, ext: mimeExt };
    }
    if (item.type) {
      const cat = window.gc.categoryFor(item.type);
      if (cat !== 'unknown') return { category: cat, name: '', ext: mimeExt };
    }
  }
  const files = dragFiles(dt);
  if (files.length && files[0].name) {
    return { category: window.gc.categoryFor(files[0].name), name: files[0].name, ext: '' };
  }
  return { category: 'unknown', name: '', ext: '' };
}

function hasFiles(dt) {
  if (!dt) return false;
  try {
    return Array.from(dt.types || []).includes('Files');
  } catch (_) {
    return false;
  }
}

function applyDragInfo(info) {
  const previousCategory = state.category;
  const previousExt = state.sourceExt;
  const ext = info.ext || (info.name ? window.gc.extOf(info.name) : '');

  if (info.name) state.fileName = info.name;
  if (info.category !== 'unknown') state.category = info.category;
  if (ext) state.sourceExt = ext;

  if (
    previousCategory !== state.category ||
    previousExt !== state.sourceExt ||
    !state.segs.length
  ) {
    renderItems(state.category, state.sourceExt);
    setCoreIdle();
  }
  updateCaption();
}

/* ------------------------------------------------------------------ */
/* открытие / закрытие                                                */
/* ------------------------------------------------------------------ */

function renderBackdrop(url) {
  backdropEl.classList.remove('is-visible');
  if (!url) {
    backdropEl.removeAttribute('src');
    return;
  }
  backdropEl.onload = () => backdropEl.classList.add('is-visible');
  backdropEl.src = url;
}

function openMenu(payload) {
  clearTimeout(state.closeTimer);
  clearTimeout(state.timer);
  state.open = true;
  state.mode = (payload && payload.mode) || 'manual';
  state.category = 'unknown';
  state.sourceExt = '';
  state.fileName = '';
  state.dropped = false;
  state.hot = -1;
  state.trigger = (payload && payload.trigger) || state.trigger || 'shift';
  state.theme = (payload && payload.theme) || state.theme || 'liquid';
  document.body.dataset.theme = state.theme;

  renderBackdrop(payload && payload.backdrop);
  renderItems('unknown');
  setCoreIdle();
  updateCaption();
  stage.classList.remove('is-leaving', 'is-visible');
  void stage.offsetWidth;
  stage.classList.add('is-visible');

  if (state.mode === 'manual') {
    state.timer = setTimeout(() => closeMenu(), 12000);
  }
}

function closeMenu() {
  if (!state.open) return;
  state.open = false;
  clearTimeout(state.timer);
  stage.classList.remove('is-visible');
  stage.classList.add('is-leaving');
  state.closeTimer = setTimeout(() => {
    stage.classList.remove('is-leaving');
    itemsEl.innerHTML = '';
    state.segs = [];
    state.hot = -1;
    backdropEl.classList.remove('is-visible');
  }, 220);
}

/* ------------------------------------------------------------------ */
/* события перетаскивания                                             */
/* ------------------------------------------------------------------ */

window.addEventListener('dragenter', (event) => {
  if (!state.open || !hasFiles(event.dataTransfer)) return;
  event.preventDefault();
  applyDragInfo(guessDragInfo(event.dataTransfer));
});

window.addEventListener('dragover', (event) => {
  if (!state.open) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  if (!hasFiles(event.dataTransfer)) return;
  if (!state.segs.length) return;
  if (!state.fileName) applyDragInfo(guessDragInfo(event.dataTransfer));
  setHot(segmentAt(pointFromEvent(event)));
});

window.addEventListener('dragleave', (event) => {
  if (!state.open) return;
  if (!event.relatedTarget) clearHot();
});

window.addEventListener('drop', (event) => {
  if (!state.open) return;
  event.preventDefault();
  event.stopPropagation();
  if (state.dropped) return;

  const point = pointFromEvent(event);
  const index = segmentAt(point);
  const files = dragFiles(event.dataTransfer);

  if (!files.length) {
    closeMenu();
    return;
  }
  if (index < 0) {
    shake();
    updateCaption();
    return;
  }

  const fmt = state.segs[index];
  if (!fmt) return;

  const targets = files.filter((file) => {
    const cat = window.gc.categoryFor(file.name);
    const ext = window.gc.extOf(file.name);
    return cat !== 'unknown' && ext !== fmt.ext && window.gc.isCompatible(cat, fmt.key);
  });

  if (!targets.length) {
    shake();
    setCaption(`Для ${fmt.label} нужен другой тип файла`, false);
    return;
  }

  const paths = targets.map((file) => window.gc.getPathForFile(file)).filter(Boolean);
  if (!paths.length) {
    shake();
    return;
  }

  state.dropped = true;
  setCaption(`Отправлено на конвертацию в ${fmt.label}`, true);
  for (const filePath of paths.slice(0, 30)) {
    window.gc.startConversion(filePath, fmt.key);
  }
});

function shake() {
  setCaption('Отпустите файл именно на формат', false);
  core.classList.remove('pulse');
  void core.offsetWidth;
  core.classList.add('pulse');
}

/* ------------------------------------------------------------------ */
/* прочее                                                             */
/* ------------------------------------------------------------------ */

window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());
window.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMenu();
    window.gc.closeMenu();
  }
});

// наведение мышью работает, когда меню открыто вручную из трея
document.addEventListener('mousemove', (event) => {
  if (PREVIEW) return;
  if (!state.open || state.mode !== 'manual') return;
  setHot(segmentAt(pointFromEvent(event)));
});

stage.addEventListener('click', (event) => {
  if (!state.open || state.mode !== 'manual') return;
  if (event.target.closest('.seg')) {
    const seg = event.target.closest('.seg');
    const index = state.segs.findIndex((f) => f.key === seg.dataset.key);
    const fmt = state.segs[index];
    if (fmt) setCaption(`Перетащите файл на «${fmt.label}» или зажмите ${triggerLabel()} во время перетаскивания`);
    return;
  }
  closeMenu();
  window.gc.closeMenu();
});

window.gc.onMenuOpen(openMenu);
window.gc.onMenuClose(closeMenu);

const PREVIEW_PARAMS = new URLSearchParams(location.search);
if (PREVIEW) {
  document.body.classList.add('is-preview');
  const previewTheme = PREVIEW_PARAMS.get('theme');
  const previewTrigger = PREVIEW_PARAMS.get('trigger');
  const previewCategory = PREVIEW_PARAMS.get('category');
  const previewExt = PREVIEW_PARAMS.get('ext');
  const hotParam = Number(PREVIEW_PARAMS.get('hot'));
  setTimeout(() => openMenu({ mode: 'manual', theme: previewTheme, trigger: previewTrigger }), 80);
  if (previewCategory) {
    setTimeout(() => {
      applyDragInfo({ category: previewCategory, name: previewExt ? `preview.${previewExt}` : '' });
    }, 350);
  }
  if (Number.isInteger(hotParam) && hotParam >= 0) {
    setTimeout(() => setHot(hotParam), 900);
  }
  setTimeout(() => {
    const bg = getComputedStyle(document.body).backgroundImage;
    const match = /url\("?(.+?)"?\)/.exec(bg || '');
    if (!match) return;
    const source = new Image();
    source.onload = () => {
      const side = Math.min(source.width, source.height);
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 600;
      canvas
        .getContext('2d')
        .drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, 600, 600);
      backdropEl.onload = () => backdropEl.classList.add('is-visible');
      backdropEl.src = canvas.toDataURL('image/png');
    };
    source.src = match[1];
  }, 400);
}
