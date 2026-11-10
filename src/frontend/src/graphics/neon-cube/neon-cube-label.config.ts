import type { NeonCubeThemeId } from '../../types/dataset-3d/cube-focus.types'

export const NEON_CUBE_LABELS = {
  violet: { label: 'Tổng quan', detail: 'Khám phá dữ liệu' },
  cyan: { label: 'Data Analysis', detail: 'Phân tích và trực quan hóa dữ liệu' },
  blue: { label: 'Data View', detail: 'Góc nhìn dữ liệu' },
  orange: { label: 'Detection', detail: 'Phát hiện vấn đề chất lượng' },
} satisfies Record<NeonCubeThemeId, { label: string; detail: string }>
