import { BufferGeometry, Float32BufferAttribute } from 'three'

/**
 * Vành/đĩa DÀY thật thay cho RingGeometry phẳng.
 *
 * RingGeometry chỉ có một mặt phẳng: nhìn từ góc nào cũng là một hình ellipse dán lên
 * cảnh, không có thành, không có pháp tuyến khác nhau — đó chính là cảm giác "2D" khi
 * kéo xoay. Ở đây mỗi vành có bốn phần: mặt trên, mặt dưới, thành ngoài và thành trong.
 *
 * `aEdge` = 0 trên hai mặt phẳng, 1 trên hai thành. Shader dùng nó để làm sáng mép đĩa
 * (ánh sáng xuyên qua phần vật chất mỏng ở rìa), nhờ vậy độ dày đọc ra được ở mọi góc.
 */
export function createThickDisk(inner: number, outer: number, thickness: number, segments = 180): BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const edges: number[] = []
  const half = Math.max(thickness, 0.0001) / 2

  const push = (point: [number, number, number], normal: [number, number, number], edge: number) => {
    positions.push(point[0], point[1], point[2])
    normals.push(normal[0], normal[1], normal[2])
    edges.push(edge)
  }

  const quad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number],
    normal: [number, number, number], edge: number,
  ) => {
    push(a, normal, edge); push(b, normal, edge); push(c, normal, edge)
    push(a, normal, edge); push(c, normal, edge); push(d, normal, edge)
  }

  const at = (radius: number, z: number, cos: number, sin: number): [number, number, number] => [cos * radius, sin * radius, z]

  for (let index = 0; index < segments; index += 1) {
    const a0 = (index / segments) * Math.PI * 2
    const a1 = ((index + 1) / segments) * Math.PI * 2
    const c0 = Math.cos(a0)
    const s0 = Math.sin(a0)
    const c1 = Math.cos(a1)
    const s1 = Math.sin(a1)

    // Hai mặt phẳng: chỉ chúng mang vân xoáy của đĩa.
    quad(at(inner, half, c0, s0), at(outer, half, c0, s0), at(outer, half, c1, s1), at(inner, half, c1, s1), [0, 0, 1], 0)
    quad(at(inner, -half, c1, s1), at(outer, -half, c1, s1), at(outer, -half, c0, s0), at(inner, -half, c0, s0), [0, 0, -1], 0)

    // Hai thành: phần duy nhất cho biết vành có bề dày bao nhiêu.
    quad(at(outer, -half, c0, s0), at(outer, -half, c1, s1), at(outer, half, c1, s1), at(outer, half, c0, s0), [c0, s0, 0], 1)
    quad(at(inner, half, c0, s0), at(inner, half, c1, s1), at(inner, -half, c1, s1), at(inner, -half, c0, s0), [-c0, -s0, 0], 1)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aEdge', new Float32BufferAttribute(edges, 1))
  geometry.computeBoundingSphere()
  return geometry
}
