import { CanvasTexture, SRGBColorSpace } from 'three'
import { NEON_CUBE_LABELS } from '../neon-cube/neon-cube-label.config'
import { NEON_CUBE_THEMES } from '../neon-cube/neon-cube.model'
import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'
import { CUBE_LABEL_ASPECT } from './cube-label-layout'

const FONT = '"Plus Jakarta Sans", sans-serif'
const HEIGHT = 200
const WIDTH = HEIGHT * CUBE_LABEL_ASPECT

export async function loadCubeLabelFont() {
  const copy = Object.values(NEON_CUBE_LABELS).map(({ label, detail }) => `${label} ${detail}`).join(' ')
  await Promise.allSettled([document.fonts.load(`700 48px ${FONT}`, copy), document.fonts.load(`500 32px ${FONT}`, copy)])
}

function drawIcon(context: CanvasRenderingContext2D, theme: NeonCubeThemeId) {
  context.save()
  context.translate(61, 56)
  context.strokeStyle = NEON_CUBE_THEMES[theme].glow
  context.fillStyle = context.strokeStyle
  context.shadowColor = context.strokeStyle
  context.shadowBlur = 10
  context.lineWidth = 7
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  switch (theme) {
    case 'violet':
      for (const x of [4, 47]) {
        for (const y of [4, 47]) context.roundRect(x, y, 34, 34, 6)
      }
      context.stroke()
      break
    case 'blue':
      for (const [i, height] of [34, 55, 82, 60].entries()) {
        context.fillRect(2 + 22 * i, 83 - height, 13, height)
      }
      break
    case 'orange':
      context.moveTo(43, 4)
      context.lineTo(82, 76)
      context.lineTo(4, 76)
      context.closePath()
      context.moveTo(43, 30)
      context.lineTo(43, 49)
      context.stroke()
      context.beginPath()
      context.arc(43, 62, 4, 0, Math.PI * 2)
      context.fill()
      break
    case 'cyan':
      context.arc(35, 34, 26, 0, Math.PI * 2)
      context.moveTo(54, 53)
      context.lineTo(78, 77)
      context.stroke()
      break
  }
  context.restore()
}

export function createCubeLabelTexture(theme: NeonCubeThemeId, colorMode: 'light' | 'dark' = 'dark') {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * 2
  canvas.height = HEIGHT * 2
  const context = canvas.getContext('2d')
  if (!context) return null
  context.scale(2, 2)
  drawIcon(context, theme)

  const { label, detail } = NEON_CUBE_LABELS[theme]
  const textX = 196
  const maxWidth = WIDTH - textX - 45
  context.font = `500 32px ${FONT}`
  const lines = ['']
  for (const word of detail.split(' ')) {
    const index = lines.length - 1
    const line = lines[index]
    const next = line ? `${line} ${word}` : word
    if (line && context.measureText(next).width > maxWidth) lines.push(word)
    else lines[index] = next
  }

  context.textBaseline = 'middle'
  const titleY = lines.length === 1 ? 76 : 60
  context.fillStyle = colorMode === 'light' ? '#334e68' : '#cfe3f1'
  lines.forEach((line, index) => context.fillText(line, textX, titleY + 53 + index * 37, maxWidth))
  context.font = `700 48px ${FONT}`
  context.fillStyle = colorMode === 'light' ? '#102b46' : '#f5fbff'
  context.fillText(label, textX, titleY, maxWidth)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}
