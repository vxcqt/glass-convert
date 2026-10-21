'use strict';

/** Быстрая проверка конвертера: создаёт тестовые файлы и прогоняет форматы. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { convertFile, resolveFfmpeg } = require('../src/convert');

const dir = path.join(require('os').tmpdir(), 'glass-convert-test');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const ffmpeg = resolveFfmpeg();
console.log('ffmpeg:', ffmpeg);

const wav = path.join(dir, 'tone.wav');
const mp4 = path.join(dir, 'clip.mp4');
const png = path.join(dir, 'image.png');

execFileSync(ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', wav]);
execFileSync(ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=24:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=660:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', mp4]);
execFileSync(ffmpeg, ['-hide_banner', '-y', '-f', 'lavfi', '-i', 'testsrc=size=200x200:duration=1', '-frames:v', '1', png]);

async function run(input, target) {
  const started = Date.now();
  let last = 0;
  const result = await convertFile({
    input,
    targetKey: target,
    onProgress: (p) => {
      last = p;
    },
  });
  const stat = fs.statSync(result.output);
  console.log(
    `${path.basename(input)} -> ${target}: ${path.basename(result.output)} (${Math.round(stat.size / 1024)} KB, ${Date.now() - started} ms, progress ${Math.round(last * 100)}%)`
  );
}

(async () => {
  await run(wav, 'mp3');
  await run(wav, 'flac');
  await run(mp4, 'mp3');
  await run(mp4, 'gif');
  await run(mp4, 'webm');
  await run(png, 'jpg');
  await run(png, 'webp');

  try {
    await run(wav, 'mp4');
  } catch (err) {
    console.log('ожидаемая ошибка:', err.message);
  }
  console.log('готово');
})().catch((err) => {
  console.error('FAILED', err);
  process.exit(1);
});
