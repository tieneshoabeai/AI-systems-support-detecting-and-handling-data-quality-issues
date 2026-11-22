// Màu cho scene Three.js đọc từ token `--scene-*` của design system, nên khung 3D tự đổi
// theo Light/Dark thay vì giữ một bộ hex sáng cố định. THREE.Color không hiểu `color-mix()`
// nên chỉ nhận giá trị hex/rgb đặc — token scene vì thế được khai báo bằng hex.

export type ScenePalette = {
  background: string
  floor: string
  grid: string
  gridAlt: string
  shadow: string
  shadowOpacity: number
  accent: string
  accentAlt: string
  ink: string
}

const lightPalette: ScenePalette = {
  background: '#eef4f1', floor: '#e4ede8', grid: '#cbdad2', gridAlt: '#dfeae4',
  shadow: '#1f3d33', shadowOpacity: 0.16, accent: '#007a57', accentAlt: '#268fdd', ink: '#202a29',
}

const darkPalette: ScenePalette = {
  background: '#0b1513', floor: '#0f1c19', grid: '#22332d', gridAlt: '#16241f',
  shadow: '#000000', shadowOpacity: 0.46, accent: '#23c18f', accentAlt: '#58b6ff', ink: '#eff5f2',
}

const colorPattern = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i

export function readScenePalette(light: boolean, element: Element | null = null): ScenePalette {
  const base = light ? lightPalette : darkPalette
  const target = element ?? document.querySelector('[data-preview="2d"]') ?? document.documentElement
  const styles = getComputedStyle(target)
  const read = (name: string, fallback: string) => {
    const value = styles.getPropertyValue(name).trim()
    return colorPattern.test(value) ? value : fallback
  }
  return {
    background: read('--scene-bg', base.background),
    floor: read('--scene-floor', base.floor),
    grid: read('--scene-grid', base.grid),
    gridAlt: read('--scene-grid-alt', base.gridAlt),
    shadow: read('--scene-shadow', base.shadow),
    shadowOpacity: base.shadowOpacity,
    accent: read('--scene-accent', base.accent),
    accentAlt: read('--scene-accent-alt', base.accentAlt),
    ink: read('--scene-ink', base.ink),
  }
}
