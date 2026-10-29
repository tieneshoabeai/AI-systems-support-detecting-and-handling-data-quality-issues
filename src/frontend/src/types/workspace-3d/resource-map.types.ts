export type ResourceKind = 'workspace' | 'project' | 'dataset'

// Presentation model; deliberately independent of backend DTOs.
export type ResourceNode = Readonly<{
  id: string
  kind: ResourceKind
  name: string
  parentId: string | null
}>

export type ResourceMapProps = {
  resources: readonly ResourceNode[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenDataset?: (id: string) => void
  localFileMode?: boolean
}

export type PositionedResource = {
  resource: ResourceNode
  position: [number, number, number]
  ports?: ResourcePort[]
}

export type Point3 = [number, number, number]
export type ResourcePort = { id: string; position: Point3; normal: Point3; direction: 'in' | 'out'; radius: number }
export type ResourceRoute = { segments: [Point3, Point3, Point3, Point3][]; radius: number }
export type CameraCommand = { sequence: number; type: 'focus' | 'reset' | 'left' | 'right' | 'forward' | 'back' | 'near' | 'far'; resourceId?: string }

export type ResourceLayout = {
  nodes: PositionedResource[]
  edges: { id: string; source: PositionedResource; target: PositionedResource; route: ResourceRoute }[]
  center: [number, number, number]
  span: number
}
