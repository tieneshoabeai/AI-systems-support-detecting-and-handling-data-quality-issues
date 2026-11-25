import type { PanelKind } from './type'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { authGlassConfig } from './auth-glass.config'
import { authGlassProviderIcons } from './auth-glass.provider-icons'

const { pixelsWide, pixelsHigh } = authGlassConfig.artwork
const ink = '#f3f8ff'
const muted = '#c1d3ea'
const darkPalette = { ink, muted, control: '#101f36', line: '#7898bf', primary: '#244779', onPrimary: ink }
const lightPalette = { ink: '#172b47', muted: '#536b86', control: '#ffffff', line: '#b5c8df', primary: '#225cd6', onPrimary: '#ffffff' }
type Palette = typeof darkPalette

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = ink, weight = 500) {
  ctx.fillStyle = color
  ctx.font = `${weight} ${size}px system-ui, sans-serif`
  ctx.fillText(value, x, y)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function field(ctx: CanvasRenderingContext2D, label: string, placeholder: string, x: number, y: number, width: number, height = 54, colors: Palette = darkPalette) {
  const { ink, muted } = colors
  text(ctx, label, x, y, 15, ink, 650)
  roundedRect(ctx, x, y + 13, width, height, 10)
  ctx.fillStyle = colors.control
  ctx.fill()
  ctx.strokeStyle = colors.line
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

function drawLogin(ctx: CanvasRenderingContext2D, colors: Palette) {
  const { ink, muted } = colors
  const left = 24
  const width = pixelsWide - left * 2
  const center = pixelsWide / 2
  text(ctx, 'Chào mừng trở lại', left, 138, 36, ink, 700)
  text(ctx, 'Đăng nhập để tiếp tục với DataVerse.', left, 168, 14, muted)
  field(ctx, 'Email', 'ten@congty.com', left, 212, width, 54, colors)
  field(ctx, 'Mật khẩu', 'Nhập mật khẩu', left, 310, width, 54, colors)

  roundedRect(ctx, left, 394, 15, 15, 3)
  ctx.strokeStyle = colors.line
  ctx.stroke()
  text(ctx, 'Ghi nhớ đăng nhập', left + 21, 406, 13, muted)
  ctx.save()
  ctx.textAlign = 'right'
  text(ctx, 'Quên mật khẩu', left + width, 406, 13, ink, 650)
  ctx.restore()

  roundedRect(ctx, left, 430, width, 50, 10)
  ctx.fillStyle = colors.primary
  ctx.fill()
  ctx.save()
  ctx.textAlign = 'center'
  text(ctx, 'Đăng nhập', center, 460, 15, colors.onPrimary, 650)
  text(ctx, 'Đăng nhập qua nhà cung cấp chưa khả dụng.', center, 564, 12, muted)
  text(ctx, 'Chưa có tài khoản? Đăng ký', center, 597, 13, muted)
  ctx.restore()
  drawProviders(ctx, 496, colors)
}

function drawProviders(ctx: CanvasRenderingContext2D, top: number, colors: Palette) {
  const { ink } = colors
  const left = 24
  const width = pixelsWide - left * 2
  const gap = 10
  const buttonWidth = (width - gap * 2) / 3
  authGlassProviderIcons.forEach(({ paths }, index) => {
    const x = left + index * (buttonWidth + gap)
    roundedRect(ctx, x, top, buttonWidth, 46, 10)
    ctx.fillStyle = colors.control
    ctx.fill()
    ctx.strokeStyle = colors.line
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

function drawRegister(ctx: CanvasRenderingContext2D, colors: Palette) {
  const { ink, muted } = colors
  const left = 24
  const width = pixelsWide - left * 2
  const center = pixelsWide / 2
  const nameWidth = (width - 12) / 2
  text(ctx, 'Tạo tài khoản', left, 115, 36, ink, 700)
  text(ctx, 'Đăng ký để bắt đầu với DataVerse.', left, 145, 14, muted)
  field(ctx, 'Họ', 'Nhập họ', left, 176, nameWidth, 46, colors)
  field(ctx, 'Tên', 'Nhập tên', left + nameWidth + 12, 176, nameWidth, 46, colors)
  field(ctx, 'Email', 'Nhập email', left, 263, width, 46, colors)
  field(ctx, 'Mật khẩu', 'Nhập mật khẩu', left, 349, width, 46, colors)

  roundedRect(ctx, left, 424, width, 50, 10)
  ctx.fillStyle = colors.primary
  ctx.fill()
  ctx.save()
  ctx.textAlign = 'center'
  text(ctx, 'Tạo tài khoản', center, 454, 15, colors.onPrimary, 650)
  text(ctx, 'Chưa mở đăng ký tài khoản.', center, 495, 11, muted)
  text(ctx, 'Đăng ký qua nhà cung cấp chưa khả dụng.', center, 580, 12, muted)
  text(ctx, 'Đã có tài khoản? Đăng nhập', center, 613, 13, muted)
  ctx.restore()
  drawProviders(ctx, 512, colors)
}

export function createAuthArtwork(kind: PanelKind, rear: boolean, resolution: number, colorMode: 'light' | 'dark' = 'dark', avatar?: HTMLImageElement | null) {
  const colors = colorMode === 'light' ? lightPalette : darkPalette
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

  if (avatar) ctx.drawImage(avatar, 20, 18, 52, 52)
  if (kind === 'login') drawLogin(ctx, colors)
  else drawRegister(ctx, colors)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}
