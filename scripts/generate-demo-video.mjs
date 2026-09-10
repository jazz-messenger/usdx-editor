// Renders the demo song's video: a synthwave clip drawn on a canvas in
// headless Chrome and recorded to a real .webm via MediaRecorder — no ffmpeg
// involved. The clip starts VIDEOGAP seconds before the music, so the title
// fades in exactly where #VIDEOGAP says the song begins.
//
//     node scripts/generate-demo-video.mjs ["public/demo/Neon Skyline.webm"]
import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { launch, openTab } from './cdp.mjs'

const PORT = 9334
const OUT = process.argv[2] ?? 'public/demo/Neon Skyline.webm'
const VIDEOGAP_S = 1.8   // must match #VIDEOGAP in generate-demo-song.py

// MediaRecorder captures in real time, so the clip comes out as long as the
// wall clock allowed — a loaded machine yields a shorter file. Record with
// headroom and check afterwards rather than trusting the requested duration.
const DURATION_MS = 7500
// Only the sung part needs pictures — the audio's silent tail does not.
// Last note ends at beat 62: GAP 1.2s + 62 * 46.875ms = 4.11s.
const MIN_SECONDS = VIDEOGAP_S + 4.11

const chrome = await launch({ port: PORT, width: 1280, height: 720, profile: '/tmp/usdx-video-profile' })
const cdp = await openTab(PORT, 'about:blank')
await cdp.send('Runtime.enable')

const script = `(async () => {
  const W = 640, H = 360;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 420_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => rec.onstop = res);

  const t0 = performance.now();
  const draw = () => {
    const t = (performance.now() - t0) / 1000;
    const sky = x.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120a24');
    sky.addColorStop(0.55, '#3b1550');
    sky.addColorStop(1, '#0d0718');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);

    // sun
    const cy = H * 0.46;
    const g = x.createLinearGradient(0, cy - 120, 0, cy + 120);
    g.addColorStop(0, '#ffd166'); g.addColorStop(1, '#ff5e6c');
    x.fillStyle = g;
    x.beginPath(); x.arc(W / 2, cy, 110, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#120a24';
    for (let i = 0; i < 7; i++) {
      const yy = cy + 10 + i * 16;
      x.fillRect(W / 2 - 120, yy, 240, 3 + i * 1.6);
    }

    // skyline — deterministic pseudo-random building widths and heights
    x.fillStyle = '#160c2c';
    let px = -40;
    let seed = 7;
    while (px < W + 40) {
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const w = 26 + rnd() * 46, h = 60 + rnd() * 170;
      x.fillRect(px, H * 0.60 - h, w, h + 10);
      px += w + 6;
    }

    // grid floor, scrolling towards the viewer
    x.strokeStyle = 'rgba(249,115,22,0.55)'; x.lineWidth = 1.4;
    const horizon = H * 0.60;
    for (let i = 0; i < 16; i++) {
      const k = ((i / 16) + (t * 0.16) % (1 / 16));
      const yy = horizon + Math.pow(k, 2.2) * (H - horizon);
      x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      x.beginPath(); x.moveTo(W / 2 + i * 26, horizon); x.lineTo(W / 2 + i * 340, H); x.stroke();
    }

    // title fades in once the music starts
    const a = Math.max(0, Math.min(1, (t - ${VIDEOGAP_S}) * 1.4));
    if (a > 0) {
      x.globalAlpha = a;
      x.textAlign = 'center';
      x.fillStyle = '#ffffff';
      x.font = '600 31px Helvetica, Arial, sans-serif';
      x.fillText('NEON SKYLINE', W / 2, H * 0.30);
      x.fillStyle = 'rgba(255,190,140,0.95)';
      x.font = '500 14px Helvetica, Arial, sans-serif';
      x.fillText('THE MIDNIGHT OWLS', W / 2, H * 0.36);
      x.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  };
  let raf = requestAnimationFrame(draw);

  rec.start();
  await new Promise((r) => setTimeout(r, ${DURATION_MS}));
  rec.stop(); cancelAnimationFrame(raf);
  await done;

  const blob = new Blob(chunks, { type: 'video/webm' });

  // Read the duration back out of the encoded file — that is what a player
  // will see, and it is what the length check downstream needs.
  const probe = document.createElement('video');
  probe.src = URL.createObjectURL(blob);
  await new Promise((res, rej) => { probe.onloadedmetadata = res; probe.onerror = () => rej(new Error('recorded clip does not decode')); });

  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { data: btoa(s), duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight };
})()`

const { data, duration, width, height } = await cdp.eval(script)
const bytes = Buffer.from(data, 'base64')
writeFileSync(OUT, bytes)
chrome.kill()

console.log(`wrote ${OUT} — ${width}x${height}, ${duration.toFixed(2)}s, ${Math.round(bytes.length / 1024)} KB`)
if (duration < MIN_SECONDS) {
  console.error(
    `\nWARNING: ${duration.toFixed(2)}s is shorter than the ${MIN_SECONDS.toFixed(2)}s the song needs — `
    + `the clip will run out before the last note. Re-run on an idle machine.`
  )
  await sleep(200)
  process.exit(1)
}
await sleep(200)
process.exit(0)
