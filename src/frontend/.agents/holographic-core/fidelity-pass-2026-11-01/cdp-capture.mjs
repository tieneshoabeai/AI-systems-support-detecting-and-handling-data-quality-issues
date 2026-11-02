// CDP capture: launch headless Chrome, load a URL, wait real time, report the stage, screenshot.
// Usage: node cdp-capture.mjs <url> <outPng> [waitSeconds] [port] [viewport e.g. 390x844]
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [url, out, waitSec = '8', port = '9333', viewport = ''] = process.argv.slice(2)
const [viewportWidth, viewportHeight] = viewport.split('x').map(Number)
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/cdp-profile-${port}`, '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--window-size=${viewportWidth || 1280},${viewportHeight || 900}`, '--force-device-scale-factor=1', '--no-first-run',
  '--disable-background-timer-throttling', 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function targets() {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`)
  return (await res.json()).filter(t => t.type === 'page')
}

let ws
function send(id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const pending = (msg) => {
      const data = JSON.parse(msg.data)
      if (data.id === id) { ws.removeEventListener('message', pending); data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result) }
    }
    ws.addEventListener('message', pending)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

try {
  let page = null
  for (let i = 0; i < 40 && !page; i++) { await sleep(250); page = (await targets().catch(() => []))[0] }
  if (!page) throw new Error('no chrome page target')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let msgId = 0
  const logs = []
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data)
    if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' '))
    if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text))
  })
  await send(++msgId, 'Runtime.enable')
  await send(++msgId, 'Page.enable')
  await send(++msgId, 'Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  if (viewportWidth && viewportHeight) {
    await send(++msgId, 'Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 680 })
  }
  await send(++msgId, 'Page.navigate', { url })
  await sleep(Number(waitSec) * 1000)
  const stat = await send(++msgId, 'Runtime.evaluate', { expression: `JSON.stringify({
    canvases: [...document.querySelectorAll('canvas')].map(c => ({ w: c.width, h: c.height, cls: c.className })),
    fallback: document.querySelector('.dataset-3d-fallback')?.textContent ?? null,
    title: document.querySelector('h1')?.textContent
  })`, returnByValue: true })
  console.log('STAT ' + stat.result.value)
  console.log('LOGS\n' + logs.slice(0, 30).join('\n'))
  const shot = await send(++msgId, 'Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('SAVED ' + out)
} finally {
  ws?.close()
  proc.kill()
}
