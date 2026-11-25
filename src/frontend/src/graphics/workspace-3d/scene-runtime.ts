import { OrthographicCamera, type Camera, type Scene, type ShaderMaterial } from 'three'

// Three.js owns these mutable objects and reads them directly on each draw.
export function setNumberUniform(uniform: { value: number }, value: number): void {
  uniform.value = value
}

export function updatePreviewCameraZoom(camera: Camera, zoom: number): boolean {
  if (!(camera instanceof OrthographicCamera)) return false
  camera.zoom = zoom
  camera.updateProjectionMatrix()
  return true
}

// Dịch khung nhìn của camera trực giao (pixel-per-unit không đổi). Cần thiết khi cảnh nằm
// sau một khối chữ chiếm nửa khung: dịch camera sang trái để nội dung trượt sang phải.
export function setPreviewCameraOffset(camera: Camera, x: number, y: number): boolean {
  if (!(camera instanceof OrthographicCamera)) return false
  camera.position.x = x
  camera.position.y = y
  camera.updateMatrixWorld()
  return true
}

// R3F chép từng entry của prop `uniforms` thành object mới ({ ...uniform }) khi gán vào material,
// nên uniform dựng trong useMemo KHÔNG phải object mà shader đang đọc — sửa nó trong useFrame
// (uTime của đĩa, uMix của theme, uHead của vành…) không bao giờ tới shader, và cảnh chỉ đổi
// đúng tông lúc mount, tức phải tải lại trang mới thấy theme mới. Gắn lại các entry dùng chung
// ngay sau khi material ra đời; từ đó R3F gán lại prop cũng ghi thẳng vào chính các object đó.
export function bindShaderUniforms(
  material: ShaderMaterial | null,
  uniforms: Record<string, { value: unknown }>,
): void {
  if (!material) return
  Object.assign(material.uniforms, uniforms)
}

export function setPreviewEnvironment(scene: Scene, environment: Scene['environment']): void {
  scene.environment = environment
}
