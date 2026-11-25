export type SparkOptions = {
  pixelScale: number
  drift: number
  flare: number
  opacity: number
  near: readonly [number, number]
}

export type CameraEditorProps = {
  cameraEditing: boolean
  onCameraSnapshot(this: void, value: string): void
}

export type HeroHover = { id: string; label: string; x: number; y: number }
