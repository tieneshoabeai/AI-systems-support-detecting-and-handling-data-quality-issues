import { BufferGeometry, LineSegments, Material, Mesh, Object3D, Points } from 'three'

type Drawable = Mesh<BufferGeometry, Material | Material[]> | Points<BufferGeometry, Material | Material[]> | LineSegments<BufferGeometry, Material | Material[]>

export const isMesh = (object: Object3D): object is Mesh<BufferGeometry, Material | Material[]> => object instanceof Mesh
export const isDrawable = (object: Object3D): object is Drawable => object instanceof Mesh || object instanceof Points || object instanceof LineSegments

/** Uniform values originate in Three's untyped dictionary; validate before use. */
export function uniformValue<T>(uniform: { value: unknown } | undefined, expected: abstract new (...args: never[]) => T): T {
  const value = uniform?.value
  if (!(value instanceof expected)) throw new Error('Shader uniform has an unexpected value type')
  return value
}
