'use strict';

/**
 * Каталог форматов и правила совместимости.
 * Используется и в main-процессе, и (через preload) в интерфейсе.
 */

const FORMATS = {
  mp3: {
    ext: 'mp3',
    label: 'MP3',
    kind: 'audio',
    icon: 'music',
    hint: 'Компактное аудио',
  },
  wav: {
    ext: 'wav',
    label: 'WAV',
    kind: 'audio',
    icon: 'wave',
    hint: 'Без потерь',
  },
  flac: {
    ext: 'flac',
    label: 'FLAC',
    kind: 'audio',
    icon: 'lossless',
    hint: 'Lossless',
  },
  ogg: {
    ext: 'ogg',
    label: 'OGG',
    kind: 'audio',
    icon: 'drop',
    hint: 'Открытый кодек',
  },
  m4a: {
    ext: 'm4a',
    label: 'M4A',
    kind: 'audio',
    icon: 'apple',
    hint: 'AAC / Apple',
  },
  mp4: {
    ext: 'mp4',
    label: 'MP4',
    kind: 'video',
    icon: 'film',
    hint: 'H.264 + AAC',
  },
  webm: {
    ext: 'webm',
    label: 'WebM',
    kind: 'video',
    icon: 'globe',
    hint: 'Для веба',
  },
  gif: {
    ext: 'gif',
    label: 'GIF',
    kind: 'image',
    icon: 'gif',
    hint: 'Анимация',
  },
  png: {
    ext: 'png',
    label: 'PNG',
    kind: 'image',
    icon: 'image',
    hint: 'Прозрачность',
  },
  jpg: {
    ext: 'jpg',
    label: 'JPG',
    kind: 'image',
    icon: 'camera',
    hint: 'Фото',
  },
  webp: {
    ext: 'webp',
    label: 'WEBP',
    kind: 'image',
    icon: 'spark',
    hint: 'Лёгкий вес',
  },
  bmp: {
    ext: 'bmp',
    label: 'BMP',
    kind: 'image',
    icon: 'grid',
    hint: 'Без сжатия',
  },
  pdf: {
    ext: 'pdf',
    label: 'PDF',
    kind: 'document',
    icon: 'pdf',
    hint: 'Документ PDF',
  },
  docx: {
    ext: 'docx',
    label: 'WORD',
    kind: 'document',
    icon: 'word',
    hint: 'Документ Word',
  },
  txt: {
    ext: 'txt',
    label: 'TXT',
    kind: 'document',
    icon: 'text',
    hint: 'Простой текст',
  },
};

const AUDIO_EXT = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'm4a', 'aac', 'opus', 'wma', 'aiff', 'aif', 'alac', 'amr', 'mid'];
const VIDEO_EXT = ['mp4', 'm4v', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', '3gp', 'ogv'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'avif', 'ico'];
const DOCUMENT_EXT = ['pdf', 'docx', 'txt'];

const SETS = {
  audio: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
  video: ['mp3', 'm4a', 'mp4', 'webm', 'gif', 'wav'],
  image: ['png', 'jpg', 'webp', 'gif', 'bmp'],
  document: ['docx', 'pdf', 'txt'],
  default: ['mp3', 'wav', 'mp4', 'gif', 'png', 'webp'],
};

function extOf(filePath) {
  const name = String(filePath || '');
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

function categoryFor(filePath) {
  if (typeof filePath === 'string' && /^(video|audio|image)\//.test(filePath)) {
    return filePath.split('/')[0];
  }
  if (
    filePath === 'application/pdf' ||
    filePath === 'text/plain' ||
    (typeof filePath === 'string' && filePath.includes('wordprocessingml'))
  ) {
    return 'document';
  }
  const ext = extOf(filePath);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (DOCUMENT_EXT.includes(ext)) return 'document';
  return 'unknown';
}

function formatsFor(category, excludeExt) {
  const list = SETS[category] || SETS.default;
  return list
    .filter((key) => !excludeExt || FORMATS[key].ext !== excludeExt)
    .map((key) => ({ key, ...FORMATS[key] }));
}

/** Можно ли из файла исходной категории получить целевой формат. */
function isCompatible(sourceCategory, targetKey) {
  const target = FORMATS[targetKey];
  if (!target) return false;
  if (sourceCategory === 'unknown') return target.kind === 'audio' || target.kind === 'video';
  if (sourceCategory === 'audio') return target.kind === 'audio';
  if (sourceCategory === 'video') return target.kind !== 'image' || targetKey === 'gif';
  if (sourceCategory === 'image') return target.kind === 'image';
  if (sourceCategory === 'document') return target.kind === 'document';
  return false;
}

module.exports = {
  FORMATS,
  SETS,
  AUDIO_EXT,
  VIDEO_EXT,
  IMAGE_EXT,
  DOCUMENT_EXT,
  extOf,
  categoryFor,
  formatsFor,
  isCompatible,
};
