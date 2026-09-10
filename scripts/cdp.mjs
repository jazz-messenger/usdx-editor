// Minimal Chrome DevTools Protocol client over Node's global WebSocket, plus a
// headless Chrome launcher. Shared by generate-demo-video.mjs and
// capture-tour.mjs — neither needs Playwright or Puppeteer for this.
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export class Cdp {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map() }

  static async connect(url) {
    const ws = new WebSocket(url)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    const cdp = new Cdp(ws)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && cdp.pending.has(msg.id)) {
        const { res, rej } = cdp.pending.get(msg.id)
        cdp.pending.delete(msg.id)
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result)
      } else if (msg.method) {
        cdp.handlers.get(msg.method)?.forEach((h) => h(msg.params))
      }
    }
    return cdp
  }

  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, [])
    this.handlers.get(method).push(handler)
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
}

export async function launch({ port = 9333, width = 1360, height = 720, profile = '/tmp/usdx-shot-profile' } = {}) {
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${port}`,
    '--headless=new',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    // The tour captures a playing song; without this the play() call is refused.
    '--autoplay-policy=no-user-gesture-required',
    '--mute-audio',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' })

  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return chrome
    } catch { /* not up yet */ }
    await sleep(250)
  }
  chrome.kill()
  throw new Error(`Chrome DevTools endpoint on port ${port} never came up`)
}

export async function openTab(port, url) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  const target = await res.json()
  return Cdp.connect(target.webSocketDebuggerUrl)
}
