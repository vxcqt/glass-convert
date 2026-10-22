'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { categoryFor, extOf, isCompatible, FORMATS } = require('./formats');
const { convertDocument } = require('./convert-docs');

let cachedFfmpeg = null;

/** Путь к ffmpeg: сначала bundled ffmpeg-static, потом системный. */
function resolveFfmpeg() {
  if (cachedFfmpeg) return cachedFfmpeg;

  const candidates = [];
  try {
    let p = require('ffmpeg-static');
    if (typeof p === 'string' && p) {
      if (p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
      candidates.push(p);
    }
  } catch (_) {
    /* пакет не установлен — пробуем системный ffmpeg */
  }
  candidates.push('ffmpeg');

  for (const c of candidates) {
    if (c === 'ffmpeg') {
      cachedFfmpeg = c;
      return c;
    }
    try {
      if (fs.existsSync(c)) {
        cachedFfmpeg = c;
        return c;
      }
    } catch (_) {
      /* ignore */
    }
  }

  throw new Error('ffmpeg не найден. Установите зависимости: npm install');
}

/** Уникальное имя рядом с исходником: «клип.mp3», «клип (2).mp3». */
function uniqueOutputPath(input, ext) {
  const dir = path.dirname(input);
  const base = path.basename(input, path.extname(input));
  let candidate = path.join(dir, `${base}.${ext}`);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i}).${ext}`);
    i += 1;
  }
  return candidate;
}

const AUDIO_CODECS = {
  mp3: ['-vn', '-c:a', 'libmp3lame', '-q:a', '2'],
  wav: ['-vn', '-c:a', 'pcm_s16le'],
  flac: ['-vn', '-c:a', 'flac', '-compression_level', '5'],
  ogg: ['-vn', '-c:a', 'libvorbis', '-q:a', '5'],
  m4a: ['-vn', '-c:a', 'aac', '-b:a', '192k'],
};

const IMAGE_ARGS = {
  png: ['-frames:v', '1', '-c:v', 'png'],
  jpg: ['-frames:v', '1', '-c:v', 'mjpeg', '-q:v', '2'],
  webp: ['-frames:v', '1', '-c:v', 'libwebp', '-quality', '90'],
  bmp: ['-frames:v', '1', '-c:v', 'bmp'],
  gif: ['-frames:v', '1', '-loop', '0'],
};

function buildArgs(input, output, targetKey, sourceCategory) {
  const args = ['-hide_banner', '-nostdin', '-y', '-i', input];

  if (sourceCategory === 'image' && targetKey !== 'mp4' && targetKey !== 'webm') {
    args.push(...(IMAGE_ARGS[targetKey] || []));
  } else if (targetKey === 'mp4') {
    if (sourceCategory === 'image') {
      args.push('-loop', '1', '-t', '3', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-r', '30');
    } else {
      args.push('-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2');
    }
    args.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'
    );
  } else if (targetKey === 'webm') {
    args.push(
      '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-row-mt', '1',
      '-deadline', 'good', '-cpu-used', '4',
      '-c:a', 'libopus', '-b:a', '128k'
    );
  } else if (targetKey === 'gif') {
    args.push(
      '-vf', "fps=12,scale='min(640,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3",
      '-loop', '0'
    );
    args.push('-an');
  } else if (AUDIO_CODECS[targetKey]) {
    args.push(...AUDIO_CODECS[targetKey], '-map_metadata', '0');
  }

  args.push('-progress', 'pipe:1', '-nostats', output);
  return args;
}

function parseDuration(stderr) {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Конвертирует файл. Возвращает { output, duration }.
 * onProgress получает число 0..1 (или null, если прогресс неизвестен).
 */
function convertFile({ input, targetKey, onProgress = () => {} }) {
  return new Promise((resolve, reject) => {
    const target = FORMATS[targetKey];
    if (!target) {
      reject(new Error('Неизвестный формат'));
      return;
    }
    if (!fs.existsSync(input)) {
      reject(new Error('Файл не найден'));
      return;
    }

    const sourceCategory = categoryFor(input);
    if (!isCompatible(sourceCategory, targetKey)) {
      reject(new Error(`Нельзя конвертировать ${extOf(input).toUpperCase() || 'этот файл'} в ${target.label}`));
      return;
    }
    if (extOf(input) === target.ext) {
      reject(new Error(`Файл уже в формате ${target.label}`));
      return;
    }

    const output = uniqueOutputPath(input, target.ext);

    if (sourceCategory === 'document') {
      convertDocument({ input, targetKey, output, onProgress })
        .then(() => resolve({ output, duration: 0 }))
        .catch((err) => {
          try {
            if (fs.existsSync(output)) fs.unlinkSync(output);
          } catch (_) {
            /* ignore */
          }
          reject(err);
        });
      return;
    }

    let ffmpeg;
    try {
      ffmpeg = resolveFfmpeg();
    } catch (err) {
      reject(err);
      return;
    }

    const args = buildArgs(input, output, targetKey, sourceCategory);
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    let stdout = '';
    let duration = 0;

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('out_time_us=')) {
          const us = Number(line.slice('out_time_us='.length));
          if (duration > 0 && Number.isFinite(us)) {
            onProgress(Math.max(0, Math.min(1, us / 1e6 / duration)));
          }
        } else if (line.startsWith('progress=') && line.includes('end')) {
          onProgress(1);
        }
      }
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 64 * 1024) stderr = stderr.slice(-32 * 1024);
      if (!duration) duration = parseDuration(stderr);
    });

    child.on('error', (err) => {
      reject(new Error(`Не удалось запустить ffmpeg: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(output)) {
        resolve({ output, duration });
        return;
      }
      const tail = stderr.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' ');
      try {
        if (fs.existsSync(output)) fs.unlinkSync(output);
      } catch (_) {
        /* ignore */
      }
      reject(new Error(tail || `ffmpeg завершился с кодом ${code}`));
    });
  });
}

module.exports = { convertFile, resolveFfmpeg, uniqueOutputPath };
