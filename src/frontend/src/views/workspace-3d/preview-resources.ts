import type { ResourceNode } from '../../types/workspace-3d/resource-map.types'

// Imported only by the development preview entry, never by the real app.
export const previewResources: readonly ResourceNode[] = [
  { id: 'demo-workspace', kind: 'workspace', name: 'Đồ án', parentId: null },
  { id: 'demo-sales', kind: 'project', name: 'Bán hàng', parentId: 'demo-workspace' },
  { id: 'demo-survey', kind: 'project', name: 'Khảo sát', parentId: 'demo-workspace' },
  { id: 'demo-orders', kind: 'dataset', name: 'Đơn hàng', parentId: 'demo-sales' },
  { id: 'demo-customers', kind: 'dataset', name: 'Khách hàng', parentId: 'demo-sales' },
  { id: 'demo-feedback', kind: 'dataset', name: 'Phản hồi', parentId: 'demo-survey' },
]

export const extendedPreviewResources: readonly ResourceNode[] = [
  { id: 'demo-large', kind: 'workspace', name: 'Không gian mở rộng', parentId: null },
  ...Array.from({ length: 4 }, (_, index): ResourceNode => ({
    id: `demo-project-${index}`, kind: 'project', name: `Dự án ${index + 1}`, parentId: 'demo-large',
  })),
  ...Array.from({ length: 25 }, (_, index): ResourceNode => ({
    id: `demo-dataset-${index}`, kind: 'dataset', name: `Bộ dữ liệu ${index + 1}`,
    parentId: `demo-project-${index % 4}`,
  })),
]
