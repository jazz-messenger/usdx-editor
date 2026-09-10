// Captures the four landing-page tour screenshots from the running app.
//
// Needs a dev server: `npm run dev` in another shell, then
//     node scripts/capture-tour.mjs            # German shots
//     LOCALE=en node scripts/capture-tour.mjs  # English shots
//
// Writes raw PNGs; scripts/process-tour-shots.py turns them into the .webp
// files under src/assets/tour that LandingTour.tsx imports.
//
// The shots are real application states, not mockups: the demo song is loaded
// through the actual file input, the tooltip comes from a real hover, and the
// highlighted lyric line is a genuinely playing video paused mid-phrase.
import { writeFileSync, mkdirSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { launch, openTab } from './cdp.mjs'

const PORT = 9333
const BASE = process.env.BASE_URL || 'http://localhost:5173/usdx-editor/'
const LOCALE = process.env.LOCALE || 'de'
const OUT = process.env.OUT_DIR || `/tmp/usdx-tour-shots/${LOCALE}`
const W = 1360, H = 780, SCALE = 2

mkdirSync(OUT, { recursive: true })

const chrome = await launch({ port: PORT, width: W, height: H })
const cdp = await openTab(PORT, BASE)
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false })

const loaded = new Promise((res) => cdp.on('Page.loadEventFired', res))
await cdp.send('Page.navigate', { url: BASE })
await loaded
await sleep(1000)

// The Ko-fi widget is a permanent overlay — irrelevant to the tour.
await cdp.eval(`(() => {
  const s = document.createElement('style');
  s.textContent = '.kofi-widget, [class*="kofi"] { display: none !important; }';
  document.head.appendChild(s);
})()`)

if (LOCALE !== 'de') {
  await cdp.eval(`[...document.querySelectorAll('.lang-btn')].find(b => b.textContent.trim() === '${LOCALE.toUpperCase()}')?.click()`)
  await sleep(400)
}

async function shot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  console.log('wrote', name)
}

async function hover(selector) {
  const box = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`)
  if (!box) throw new Error(`hover target missing: ${selector}`)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 })
}

// Load the demo song through the real file input — the same code path the
// "Load demo song" button uses.
const loadResult = await cdp.eval(`(async () => {
  const names = ['Neon Skyline.txt', 'Neon Skyline.wav', 'Neon Skyline.webm', 'Neon Skyline [CO].png'];
  const dt = new DataTransfer();
  for (const n of names) {
    const r = await fetch('demo/' + encodeURIComponent(n));
    if (!r.ok) return 'fail ' + n + ' ' + r.status;
    dt.items.add(new File([await r.blob()], n));
  }
  const input = document.querySelector('input[type=file]');
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'ok';
})()`)
if (loadResult !== 'ok') throw new Error(`could not load the demo song: ${loadResult}`)
await sleep(3000)

// ── 1. Everything loaded: cover, metadata, lyrics, video ─────────────────────
await shot('01-overview')

// ── 2. Splitting a duet: hover the assign arrow of an unassigned line ────────
await hover('.phrases .phrase:nth-child(2) .assign-btn')
await sleep(700)
await shot('02-duet')
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: H - 10, buttons: 0 })
await sleep(300)

// ── 3. Live highlighting: play into the third phrase, then freeze ────────────
const playResult = await cdp.eval(`(() => {
  const v = document.querySelector('video.local-video');
  if (!v) return 'no video element';
  v.currentTime = 4.35;   // videogap 1.8 + gap 1.2 + ~1.35s into the lyrics
  return v.play().then(() => 'playing').catch((e) => 'blocked: ' + e.message);
})()`)
if (playResult !== 'playing') throw new Error(`playback did not start: ${playResult}`)
await sleep(450)
await cdp.eval(`document.querySelector('video.local-video')?.pause()`)
await sleep(200)
await shot('03-highlight')

// ── 4. Waveform tab with a pending GAP candidate ─────────────────────────────
await cdp.eval(`(() => {
  const v = document.querySelector('video.local-video');
  if (v) v.currentTime = 3.4;
  [...document.querySelectorAll('.lyrics-view-toggle button')][1].click();
})()`)
await sleep(2500)
await cdp.eval(`(() => {
  const c = document.querySelector('canvas.waveform-canvas');
  const r = c.getBoundingClientRect();
  const x = r.left + r.width * (1.25 / 4.6);   // just around the real GAP
  const y = r.top + r.height / 2;
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
    c.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  }
})()`)
await sleep(600)
await shot('04-waveform')

chrome.kill()
console.log(`\n${OUT} — now run: /usr/bin/python3 scripts/process-tour-shots.py`)
process.exit(0)
