export type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

export type ColorGradientStop = { offset: number; color: string };

export type GrainClass = {
  headRadius: number
  tailRadius: number
  spread: number
  brightness: number
  visibleWisps: number
  bodyColor: readonly [number, number, number]
  headColor: readonly [number, number, number]
}

export type StreakProfile = {
  jitter: number
  bodyColor: readonly [number, number, number]
  headColor: readonly [number, number, number]
  visibleWisps: number
  headRadius: number
  tailRadius: number
  spread: number
  brightness: number
}

export type LaneSamples = {
  points: Float32Array
  segments: number
  closed: boolean
}

export type ParticleSeed = {
  laneIndex: number
  phase: number
  speed: number
  size: number
  issue: boolean
}

export type BeadSeed = {
  angle: number
  radius: number
  yOffset: number
  phase: number
  size: number
  direction: number
}

export type ParticleKind = 'chamber' | 'floating' | 'spark'

export type TowerFace = { axis: 'x' | 'z'; sign: 1 | -1; index: number; rotation: number }

export type Stage = 'idle' | 'overview' | 'drawing' | 'focused'
