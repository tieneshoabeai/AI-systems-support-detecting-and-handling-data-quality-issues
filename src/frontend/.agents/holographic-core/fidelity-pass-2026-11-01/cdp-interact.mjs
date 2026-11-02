// CDP interaction capture: toggle the model apart, pick a part, and screenshot each state.
// Usage: node cdp-interact.mjs <url> <outDir> [port] [reduced]
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [url, outDir = 'renders', port = '9369', reduced = ''] = process.argv.slice(2)
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/cdp-profile-${port}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--window-size=1280,900', '--force-device-scale-factor=1', '--no-first-run',
  '--disable-background-timer-throttling', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`)
  return (await res.json()).filter(t => t.type === 'page')
}

let ws
let msgId = 0
function send(method, params = {}) {
  const id = ++msgId
  return new Promise((resolve, reject) => {
    const pending = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.id === id) { ws.removeEventListener('message', pending); data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result) }
    }
    ws.addEventListener('message', pending)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return result.result.value
}

async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  const path = `${outDir}/${name}.png`
  writeFileSync(path, Buffer.from(result.data, 'base64'))
  console.log('SAVED ' + path)
}

async function click(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
}

try {
  let page = null
  for (let i = 0; i < 40 && !page; i++) { await sleep(250); page = (await targets().catch(() => []))[0] }
  if (!page) throw new Error('no chrome page target')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const logs = []
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data)
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text))
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] })
  await send('Page.navigate', { url })
  let ready = false
  for (let i = 0; i < 60 && !ready; i++) {
    await sleep(500)
    ready = await evaluate(`!!document.querySelector('.dataset-3d-detach') && !!document.querySelector('.dataset-3d-stage canvas')`)
  }
  if (!ready) throw new Error('dataset-3d stage never appeared')
  await sleep(3000)

  let pressed = null
  for (let i = 0; i < 4 && pressed !== 'true'; i++) {
    await evaluate(`document.querySelector('.dataset-3d-detach')?.click()`)
    await sleep(reduced ? 300 : 1200)
    pressed = await evaluate(`document.querySelector('.dataset-3d-detach')?.getAttribute('aria-pressed')`)
  }
  if (pressed !== 'true') throw new Error('detach toggle did not engage')
  await shot('detach-exploded')

  const rect = await evaluate(`(() => {
    const r = document.querySelector('.dataset-3d-stage').getBoundingClientRect()
    return JSON.stringify({ x: r.x, y: r.y, w: r.width, h: r.height })
  })()`)
  const stage = JSON.parse(rect)
  let detail = null
  const candidates = []
  for (const fy of [0.4, 0.55, 0.68, 0.32, 0.78, 0.5]) {
    for (const fx of [0.3, 0.5, 0.7, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) candidates.push([fx, fy])
  }
  for (const [fx, fy] of candidates) {
    await click(stage.x + stage.w * fx, stage.y + stage.h * fy)
    await sleep(320)
    detail = await evaluate(`(() => {
      const panel = document.querySelector('.dataset-3d-detail')
      return JSON.stringify({ id: panel?.getAttribute('data-part-id') ?? '', text: panel?.textContent ?? '' })
    })()`)
    const parsed = JSON.parse(detail)
    if (parsed.id) { detail = parsed; break }
    detail = parsed
  }
  await shot('detach-selected')

  const summary = await evaluate(`JSON.stringify({
    pressed: document.querySelector('.dataset-3d-detach')?.getAttribute('aria-pressed'),
    label: document.querySelector('.dataset-3d-detach')?.textContent,
    fallback: document.querySelector('.dataset-3d-fallback')?.textContent ?? null,
    panel: document.querySelector('.dataset-3d-detail')?.textContent ?? null
  })`)
  console.log('STAT ' + summary)
  console.log('DETAIL ' + JSON.stringify(detail))
  if (logs.length) console.log('LOGS\n' + logs.slice(0, 20).join('\n'))
} finally {
  ws?.close()
  proc.kill()
}
