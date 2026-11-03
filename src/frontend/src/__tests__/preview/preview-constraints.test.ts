import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

// Gate ràng buộc cho frame preview 2D. Bốn cái trước mắt dễ vỡ nhất và đều đã từng vỡ:
//   · màu viết thẳng trong rule (brand-guidelines 5.6 bắt đi qua nguồn chung);
//   · var(--pv-…) trỏ tới token không tồn tại — CSS im lặng bỏ qua, chỗ đó mất màu;
//   · cỡ chữ nửa bậc (11.5/12.5px) len lỏi trở lại — mắt người không phân biệt được 0.5px
//     nên cả màn thành một đám chữ "gần bằng nhau" (đây chính là phản hồi "rối mắt");
//   · thời lượng viết tay (100ms, 200ms) nằm ngoài ngân sách đã chốt 140ms cho chrome.
// Tất cả đọc thẳng file CSS, không qua browser: jsdom không tính cascade, còn browser thì
// không chạy trong CI. Phần "màu có thật trên nền tinh vân" do audit thủ công đo pixel.

// Đường dẫn theo cwd của vitest (= thư mục frontend): trong môi trường jsdom,
// import.meta.url là URL http do Vite phục vụ nên không dùng để đọc file thật được.
const css = readFileSync(join(process.cwd(), 'src/views/preview/preview.css'), 'utf8')

// Comment là nơi GHI LẠI số đo cũ (#6e869f = 4.20:1 → vì sao thay). Nó không phải màu đang
// chạy, nên mọi gate đều làm việc trên bản đã cắt comment — nhưng cắt thành đúng số dòng
// trống để số dòng báo ra khi test đỏ vẫn là số dòng thật trong file.
const code = css.replace(/\/\*[\s\S]*?\*\//g, comment => '\n'.repeat((comment.match(/\n/g) ?? []).length))

const definitions = new Map<string, string>()
for (const match of code.matchAll(/^\s*(--pv-[\w-]+):\s*([^;]+);/gm)) definitions.set(match[1], match[2].trim())

const token = (name: string): string => {
  const value = definitions.get(name)
  if (value === undefined) throw new Error(`preview.css thiếu token ${name}`)
  return value
}

// ---------- Màu ----------

it('mọi hex nằm trong khối token — không rule nào được viết màu thẳng', () => {
  const offenders = code.split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /#[0-9a-fA-F]{3,8}\b/.test(line) && !/^\s*--pv-/.test(line))
    .map(({ line, number }) => `${number}: ${line.trim()}`)
  expect(offenders).toEqual([])
})

it('không var(--pv-…) nào trỏ tới token chưa khai báo', () => {
  // --pv-viewport-h do JS ghi tại runtime (preview-shell.tsx đo chiều cao vùng cuộn bằng
  // ResizeObserver) nên nó KHÔNG có chỗ trong khối token — đó là biến kênh truyền, không
  // phải màu hay thời lượng. Danh sách này dài ra là một tín hiệu đáng nghi.
  const injectedByJs = new Set(['--pv-viewport-h'])
  const missing = [...code.matchAll(/var\((--pv-[\w-]+)/g)]
    .map(match => match[1])
    .filter(name => !definitions.has(name) && !injectedByJs.has(name))
  // CSS bỏ qua cả thuộc tính khi var() không phân giải được → triệu chứng là "mất màu",
  // rất khó nhìn ra trong review nên phải bắt bằng test.
  expect([...new Set(missing)]).toEqual([])
})

// ---------- Chữ ----------

it('thang chữ: tối thiểu 11px và không có nửa bậc', () => {
  const sizes = [...code.matchAll(/font-size:\s*([\d.]+)px/g)].map(match => Number(match[1]))
  expect(sizes.length).toBeGreaterThan(20) // không được để lọt regex rỗng rồi "đỗ"
  const tooSmall = sizes.filter(size => size < 11)
  const halfSteps = sizes.filter(size => !Number.isInteger(size))
  expect(tooSmall).toEqual([])
  expect(halfSteps).toEqual([])
  // Bậc thang thật đang dùng — ghi lại để một lần chỉnh cỡ chữ là một lần có chủ đích.
  expect([...new Set(sizes)].sort((a, b) => a - b)).toEqual([11, 12, 14, 16, 18, 21, 30, 34])
})

// ---------- Chuyển động ----------

// Khối prefers-reduced-motion PHẢI viết tay (1ms !important) vì nó ghi đè mọi token; kiểm
// tra nó là kiểm tra sai đối tượng nên cắt cả khối trước khi quét.
const withoutReducedMotion = (() => {
  const start = code.indexOf('@media (prefers-reduced-motion')
  if (start === -1) return code
  let depth = 0
  let index = code.indexOf('{', start)
  for (; index < code.length; index += 1) {
    if (code[index] === '{') depth += 1
    else if (code[index] === '}' && (depth -= 1) === 0) break
  }
  return code.slice(0, start) + code.slice(index + 1)
})()

it('thời lượng chuyển động đi qua token, không viết tay', () => {
  const literals = withoutReducedMotion.split('\n')
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(({ line }) => /transition|animation/.test(line) && /\b\d+(\.\d+)?(ms|s)\b/.test(line))
    // `visibility 0s` không phải thời lượng: đó là cách bật/ẩn visibility tức thì trong
    // bộ transition shorthand, giữ nguyên cũng không thêm độ trễ nào.
    .filter(({ line }) => line.replace(/\b0s\b/g, '').match(/\b\d+(\.\d+)?(ms|s)\b/))
    .map(({ line, number }) => `${number}: ${line.trim()}`)
  expect(literals).toEqual([])
})

it('ngân sách thời gian đã chốt: chrome 140ms, mọi token duration ≤ 200ms', () => {
  // 140ms là quyết định của nhóm trưởng sau khi đo "bấm mà thấy lag", không phải sở thích
  // của người viết code — đổi nó phải là một thay đổi có chủ đích (test này sẽ đỏ).
  expect(token('--pv-d-chrome')).toBe('140ms')
  const durations = [...definitions.entries()]
    .filter(([name]) => name.startsWith('--pv-d-'))
    .map(([name, value]) => ({ name, ms: Number(value.replace('ms', '')) }))
  expect(durations.map(entry => `${entry.name}=${entry.ms}ms`)).toContain('--pv-d-chrome=140ms')
  expect(durations.every(entry => entry.ms > 0 && entry.ms <= 200)).toBe(true)
  // Hover/press không được chậm hơn chrome: phản hồi tức thì là cái user cảm nhận đầu tiên.
  expect(Number(token('--pv-d-press').replace('ms', ''))).toBeLessThan(140)
  expect(Number(token('--pv-d-hover').replace('ms', ''))).toBeLessThanOrEqual(140)
})

// ---------- Tương phản (brand-guidelines mục 5.5) ----------

const rgb = (hexValue: string): number[] => {
  const plain = hexValue.replace('#', '')
  const full = plain.length === 3 ? [...plain].map(char => char + char).join('') : plain
  return [0, 2, 4].map(offset => Number.parseInt(full.slice(offset, offset + 2), 16))
}

const luminance = (hexValue: string): number => {
  const channels = rgb(hexValue).map(value => {
    const srgb = value / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrast = (foreground: string, background: string): number => {
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

// Cặp (chữ, nền) lấy đúng nơi nó xuất hiện trong file, nền chọn MỨC SÁNG NHẤT mà chữ đó
// từng đứng (surface-2 là panel nổi bật nhất, chưa tính các lớp tint trong suốt — những chỗ
// đó đã được đo bằng pixel thật trong audit trình duyệt, xem báo cáo phiên).
const bodyPairs: readonly [string, string][] = [
  ['--pv-ink', '--pv-surface-2'], ['--pv-ink', '--pv-bg-0'],
  ['--pv-muted', '--pv-surface-2'], ['--pv-faint', '--pv-surface-2'],
  ['--pv-ink-link', '--pv-surface-2'], ['--pv-ink-accent', '--pv-surface-2'],
  ['--pv-ink-accent-hi', '--pv-surface-2'], ['--pv-ink-accent-soft', '--pv-surface-2'],
  ['--pv-ink-eyebrow', '--pv-surface-2'], ['--pv-ink-brand', '--pv-surface-2'],
  ['--pv-ink-green', '--pv-surface-2'], ['--pv-ink-green-hi', '--pv-surface-2'],
  ['--pv-ink-green-glow', '--pv-surface-2'], ['--pv-ink-amber', '--pv-surface-2'],
  ['--pv-ink-rose', '--pv-surface-2'], ['--pv-ink-rose-hi', '--pv-surface-2'],
  ['--pv-ink-violet', '--pv-surface-2'], ['--pv-ink-avatar', '--pv-surface-2'],
]

// Chữ trắng trên nền ĐẶC của nút/chip — chỗ dễ hỏng nhất khi người khác chỉnh màu brand.
const fillPairs: readonly string[] = [
  '--pv-blue-fill', '--pv-blue-fill-hover', '--pv-fill-deep', '--pv-fill-deep-hover',
  '--pv-violet-fill', '--pv-indigo-fill',
]

it('tương phản chữ/nền đạt 4.5:1 theo brand-guidelines 5.5', () => {
  const failing = bodyPairs
    .map(([ink, background]) => ({ ink, background, ratio: contrast(token(ink), token(background)) }))
    .filter(entry => entry.ratio < 4.5)
    .map(entry => `${entry.ink} trên ${entry.background} = ${entry.ratio.toFixed(2)}`)
  expect(failing).toEqual([])
  // Số thấp nhất trong bảng là trần thật của hệ: ghi lại để lần chỉnh token sau biết mình
  // đang tiến gần hay rời xa ngưỡng.
  const lowest = Math.min(...bodyPairs.map(([ink, background]) => contrast(token(ink), token(background))))
  expect(lowest).toBeGreaterThanOrEqual(4.5)
})

it('chữ trắng trên nền đặc đạt 4.5:1, viền/độ phát sáng đạt 3:1', () => {
  const white = token('--pv-on-fill')
  const failing = fillPairs
    .map(name => ({ name, ratio: contrast(white, token(name)) }))
    .filter(entry => entry.ratio < 4.5)
    .map(entry => `${entry.name} = ${entry.ratio.toFixed(2)}`)
  expect(failing).toEqual([])
  // Viền tương phản với nền nó nằm trên: ngưỡng 3:1 cho element đồ họa (WCAG 1.4.11).
  expect(contrast(token('--pv-blue-edge'), token('--pv-surface-2'))).toBeGreaterThanOrEqual(3)
  expect(contrast(token('--pv-hc-edge'), token('--pv-bg-0'))).toBeGreaterThanOrEqual(3)
  expect(contrast(token('--pv-ink-link'), token('--pv-surface-2'))).toBeGreaterThanOrEqual(3)
})

// ---------- Khung tự cuộn của Home ----------

// Đặc tả chủ batch: một trang nằm TRỌNG VẸN trong danh sách lướt — Workspaces 24 nút nhưng
// khung hé 4 hàng × 3 cột, Projects 10 dòng nhưng khung hé 5. Xóa max-height hoặc để
// overflow-y: visible thì khung giãn ra, người dùng phải cuộn cả trang và nút lật trang thành
// vô nghĩa. jsdom không tính layout (mọi phần tử cao 0) nên phép thử này đọc thẳng CSS.
it('hai khung "gần đây" của Home cuộn NGAY TRONG KHUNG (max-height + overflow-y: auto)', () => {
  for (const selector of ['.ws-tiles', '.home-table']) {
    expect(code, `preview.css thiếu rule cuộn trong khung cho ${selector}`).toMatch(
      new RegExp(`\\]\\s+\\${selector}[^{]*\\{[^}]*max-height:[^;]+;[^}]*overflow-y:\\s*auto`),
    )
  }
})

// ---------- Xếp lớp & modal với tới được ----------

// jsdom không xếp lớp cũng không đo layout, nên hai lỗi chỉ lộ ra khi chạy trình duyệt thật
// (báo cáo chạy thử): toast rơi dưới scrim của modal → "Hoàn tác" vừa không thấy vừa bấm
// không tới; modal cao hơn viewport thì footer nằm ngoài màn hình, chuột không với được.
// Đọc thẳng CSS là cách duy nhất khóa được hai hành vi này trong CI.
const ruleBlock = (selector: string): string => {
  const block = new RegExp(`\\]\\s+\\${selector}\\s*\\{([^}]*)\\}`).exec(code)?.[1]
  if (block === undefined) throw new Error(`preview.css thiếu rule cho ${selector}`)
  return block
}

const zIndexOf = (selector: string): number => {
  const value = Number(/z-index:\s*(\d+)/.exec(ruleBlock(selector))?.[1])
  if (!Number.isFinite(value)) throw new Error(`${selector} không có z-index số hóa`)
  return value
}

it('toast xếp TRÊN modal để "Hoàn tác" nhìn thấy và bấm tới được', () => {
  expect(zIndexOf('.preview-toaster')).toBeGreaterThan(zIndexOf('.preview-dialog-scrim'))
})

it('modal cao hơn viewport thì tự cuộn trong thân nó (footer luôn với tới)', () => {
  expect(ruleBlock('.preview-dialog-scrim')).toMatch(/overflow-y:\s*auto/)
  // place-items:center mà con cao hơn vùng chứa sẽ tràn CẢ hai phía → đỉnh bị cắt vô phương
  // cứu; chặn nó bằng max-height tính theo viewport, cộng overflow-y:auto bên trong.
  expect(ruleBlock('.preview-dialog')).toMatch(/max-height:[^;]*100dvh/)
  expect(ruleBlock('.preview-dialog')).toMatch(/overflow-y:\s*auto/)
})
