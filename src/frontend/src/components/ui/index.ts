export * from './primitives'
export * from './form'
export * from './overlay'
export * from './feedback'
export * from './data-display'
export * from './layout'
export * from './brand'

// Adapter cũ giữ cho các màn hình hiện có. Export dạng namespace để `Button`, `Dialog`,
// `Input`… của adapter không đụng tên với Design System ở trên. Màn hình cũ vẫn import
// trực tiếp `components/ui/controls` như trước.
export * as controls from './controls'
export * as legacyDialog from './dialog'
