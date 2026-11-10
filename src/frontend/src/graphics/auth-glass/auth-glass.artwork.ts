import { CanvasTexture, SRGBColorSpace } from 'three'
import { authGlassConfig } from './auth-glass.config'
import { authGlassProviderIcons } from './auth-glass.provider-icons'

type PanelKind = 'login' | 'register'
const { pixelsWide, pixelsHigh } = authGlassConfig.artwork
const ink = '#f3f8ff'
const muted = '#c1d3ea'

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = ink, weight = 500) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  ctx.fillText(value, x, y)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function logo(ctx: CanvasRenderingContext2D) {
  const facets = [
    { color: '#397bff', points: [[0, 13], [22, 0], [43, 13], [22, 26]] },
    { color: '#164bd1', points: [[0, 13], [22, 26], [22, 52], [0, 39]] },
    { color: '#71ceff', points: [[22, 26], [43, 13], [43, 39], [22, 52]] },
  ]
  ctx.save()
  ctx.translate(20, 18)
  for (const { color, points } of facets) {
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.restore()
}

function field(ctx: CanvasRenderingContext2D, label: string, placeholder: string, x: number, y: number, width: number, height = 54) {
  text(ctx, label, x, y, 15, ink, 650)
  roundedRect(ctx, x, y + 13, width, height, 10)
  ctx.fillStyle = '#101f36'
  ctx.fill()
  ctx.strokeStyle = '#7898bf'
  ctx.stroke()
  text(ctx, placeholder, x + 12, y + 19 + height / 2, 16, muted)
  if (label === 'Mật khẩu' && height === 54) {
    const eyeX = x + width - 20
    const eyeY = y + 40
    ctx.strokeStyle = muted
    ctx.beginPath()
    ctx.ellipse(eyeX, eyeY, 7, 4.5, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(eyeX, eyeY, 1.8, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawLogin(ctx: CanvasRenderingContext2D) {
  const left = 24
  const width = pixelsWide - left * 2
  const center = pixelsWide / 2
  text(ctx, 'Chào mừng trở lại', left, 138, 36, ink, 700)
  text(ctx, 'Đăng nhập để tiếp tục với DataVerse.', left, 168, 14, muted)
  field(ctx, 'Email', 'ten@congty.com', left, 212, width)
  field(ctx, 'Mật khẩu', 'Nhập mật khẩu', left, 310, width)

  roundedRect(ctx, left, 394, 15, 15, 3)
  ctx.strokeStyle = '#7898bf'
  ctx.stroke()
  text(ctx, 'Ghi nhớ đăng nhập', left + 21, 406, 13, muted)
  ctx.save()
  ctx.textAlign = 'right'
  text(ctx, 'Quên mật khẩu', left + width, 406, 13, ink, 650)
  ctx.restore()

  roundedRect(ctx, left, 430, width, 50, 10)
  ctx.fillStyle = '#244779'
  ctx.fill()
  ctx.save()
  ctx.textAlign = 'center'
  text(ctx, 'Đăng nhập', center, 460, 15, ink, 650)
  text(ctx, 'Đăng nhập qua nhà cung cấp chưa khả dụng.', center, 564, 12, muted)
  text(ctx, 'Chưa có tài khoản? Đăng ký', center, 597, 13, muted)
  ctx.restore()
  drawProviders(ctx, 496)
}

function drawProviders(ctx: CanvasRenderingContext2D, top: number) {
  const left = 24
  const width = pixelsWide - left * 2
  const gap = 10
  const buttonWidth = (width - gap * 2) / 3
  authGlassProviderIcons.forEach(({ paths }, index) => {
    const x = left + index * (buttonWidth + gap)
    roundedRect(ctx, x, top, buttonWidth, 46, 10)
    ctx.fillStyle = '#101f36'
    ctx.fill()
    ctx.strokeStyle = '#7898bf'
    ctx.stroke()
    ctx.save()
    ctx.translate(x + (buttonWidth - 22) / 2, top + 12)
    ctx.scale(22 / 24, 22 / 24)
    for (const { fill, d } of paths) {
      ctx.fillStyle = fill === 'currentColor' ? ink : fill
      ctx.fill(new Path2D(d))
    }
    ctx.restore()
  })
}

function drawRegister(ctx: CanvasRenderingContext2D) {
  const left = 24
  const width = pixelsWide - left * 2
  const center = pixelsWide / 2
  const nameWidth = (width - 12) / 2
  text(ctx, 'Tạo tài khoản', left, 115, 36, ink, 700)
  text(ctx, 'Đăng ký để bắt đầu với DataVerse.', left, 145, 14, muted)
  field(ctx, 'Họ', 'Nhập họ', left, 176, nameWidth, 46)
  field(ctx, 'Tên', 'Nhập tên', left + nameWidth + 12, 176, nameWidth, 46)
  field(ctx, 'Email', 'Nhập email', left, 263, width, 46)
  field(ctx, 'Mật khẩu', 'Nhập mật khẩu', left, 349, width, 46)

  roundedRect(ctx, left, 424, width, 50, 10)
  ctx.fillStyle = '#244779'
  ctx.fill()
  ctx.save()
  ctx.textAlign = 'center'
  text(ctx, 'Tạo tài khoản', center, 454, 15, ink, 650)
  text(ctx, 'Chưa mở đăng ký tài khoản.', center, 495, 11, muted)
  text(ctx, 'Đăng ký qua nhà cung cấp chưa khả dụng.', center, 580, 12, muted)
  text(ctx, 'Đã có tài khoản? Đăng nhập', center, 613, 13, muted)
  ctx.restore()
  drawProviders(ctx, 512)
}

export function createAuthArtwork(kind: PanelKind, rear: boolean, resolution: number) {
  const canvas = document.createElement('canvas')
  canvas.width = resolution
  canvas.height = resolution * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const scale = resolution / pixelsWide
  ctx.scale(scale, canvas.height / pixelsHigh)
  if (rear) {
    // Only static copy is mirrored. This function never receives auth state.
    ctx.translate(pixelsWide, 0)
    ctx.scale(-1, 1)
    ctx.globalAlpha = 0.35
    ctx.filter = `blur(${Math.max(1.5, scale * 1.1)}px)`
  }

  logo(ctx)
  if (kind === 'login') drawLogin(ctx)
  else drawRegister(ctx)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
