import { jsonObject } from '../support/json'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import ts from 'typescript'
import { ACESFilmicToneMapping, Color, InstancedMesh, Matrix3, Matrix4, Mesh, NoToneMapping, PerspectiveCamera, Points, Vector3 } from 'three'
import { expect, it, vi } from 'vitest'
import { LIGHT_ENVIRONMENT as C, lightSceneColor } from '../../graphics/holographic-core/light-environment.config'
import { createLightLayers } from '../../graphics/holographic-core/light-environment'
const renderer = { toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }
function outputAces(c: Color) {
  const v = new Vector3(c.r, c.g, c.b).multiplyScalar(1 / .6)
    .applyMatrix3(new Matrix3().set(.59719, .35458, .04823, .076, .90834, .01566, .0284, .13383, .83777))
  const fit = (x: number) => (x*(x+.0245786)-.000090537)/(x*(.983729*x+.432951)+.238081)
  return v.set(fit(v.x), fit(v.y), fit(v.z))
    .applyMatrix3(new Matrix3().set(1.60475, -.53108, -.07367, -.10208, 1.10813, -.00605, -.00327, -.07276, 1.07602))
}
it.each([C.horizon, C.middle, C.zenith, C.lavender, C.cyan, C.line, C.sun])('keeps display swatch %s through one ACES conversion', swatch => {
  const actual = outputAces(lightSceneColor(swatch, renderer))
  const expected = new Color(swatch)
  expect(actual.x).toBeCloseTo(expected.r, 4)
  expect(actual.y).toBeCloseTo(expected.g, 4)
  expect(actual.z).toBeCloseTo(expected.b, 4)
})
it('does not compensate when tone mapping is disabled and accounts for exposure', () => {
  expect(lightSceneColor(C.horizon, { toneMapping:NoToneMapping, toneMappingExposure:1 })).toEqual(new Color(C.horizon))
  const normal = lightSceneColor(C.middle, renderer)
  const doubled = lightSceneColor(C.middle, { ...renderer, toneMappingExposure:2 })
  expect(doubled.r*2).toBeCloseTo(normal.r)
})
it('uses seven decoration draws with normal blending, non-interactive objects and complete disposal', () => {
  const layers = createLightLayers(renderer)
  const disposes: ReturnType<typeof vi.fn>[] = []
  let calls = 0
  layers.group.traverse(object => {
    if (!(object instanceof Mesh) && !(object instanceof Points) && object.type !== 'LineSegments') return
    calls++
    const drawable = object as Mesh
    expect((drawable.raycast as () => void)()).toBeUndefined()
    const materials = Array.isArray(drawable.material) ? drawable.material : [drawable.material]
    for (const m of materials) { expect(m.blending).toBe(1); const spy=vi.fn(); m.addEventListener('dispose', spy); disposes.push(spy) }
    const spy=vi.fn(); drawable.geometry.addEventListener('dispose', spy); disposes.push(spy)
  })
  expect(calls).toBe(7)
  layers.step(12)
  const crystal = layers.group.getObjectByName('light-crystals')!
  const first = crystal.rotation.y
  layers.step(12)
  expect(crystal.rotation.y).toBe(first)
  layers.dispose(); layers.dispose()
  disposes.forEach(spy => expect(spy).toHaveBeenCalledOnce())
})
// Preserve rendering expressions while normalizing equivalent index access and
// explicit undefined checks. The test below also canonicalizes formatting using
// hashes derived from the verified original source before lint formatting.
function normalizeStrictReads(source: string): string {
  const file = ts.createSourceFile('environment.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  function render(node: ts.Node): string {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'requireDefined'
      && node.arguments.length === 2 && node.arguments[0] && node.arguments[1] && ts.isStringLiteral(node.arguments[1])) {
      return render(node.arguments[0])
    }
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)
      && /^[A-Za-z_$][\w$]*$/.test(node.argumentExpression.text)) {
      return render(node.expression) + (node.questionDotToken ? '?.' : '.') + node.argumentExpression.text
    }
    let text = node.getText(file)
    const children: ts.Node[] = []
    ts.forEachChild(node, child => { children.push(child) })
    for (const child of children.reverse()) {
      const next = render(child)
      if (next !== child.getText(file)) text = text.slice(0, child.getStart(file) - node.getStart(file)) + next + text.slice(child.end - node.getStart(file))
    }
    return text
  }
  return render(file)
}
it('preserves the original dark rendering source apart from checked reads and equivalent index access', () => {
  const source=normalizeStrictReads(readFileSync(resolve('src/components/graphics/holographic-core/holographic-core.environment.tsx'), 'utf8'))
  const baseline=jsonObject(readFileSync(resolve('../../.agents/lint-fe/dark-source-baseline.json'), 'utf8')) as Record<string, string>
  const sha=(s:string) => createHash('sha256').update(s).digest('hex')
  // Canonical hashes were derived before formatting, after checking the original
  // byte hashes. This permits whitespace/quote edits while retaining expressions.
  const canonical = (text: string): string => {
    const file = ts.createSourceFile('segment.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const transformed = ts.transform(file, [context => {
      const visit: ts.Visitor = node => ts.isStringLiteral(node)
        ? ts.factory.createStringLiteral(node.text) : ts.visitEachChild(node, visit, context)
      return root => ts.visitNode(root, visit) as ts.SourceFile
    }])
    const normalized = transformed.transformed[0]
    if (!normalized) throw new Error('Missing canonical source')
    const result = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(normalized)
    transformed.dispose()
    return result
  }
  expect(sha(canonical(source.slice(source.indexOf('// Deep-field'), source.indexOf('export function HolographicEnvironment('))))).toBe(baseline['dark_helpers_sha256'])
  expect(sha(canonical(source.slice(source.indexOf('function DarkEnvironment('))))).toBe(baseline['dark_component_sha256'])
})
it('frames crystals on both wings at the default camera', () => {
  const layers=createLightLayers(renderer)
  const camera=new PerspectiveCamera(34, 1280/575, .1, 100)
  camera.position.set(11.45, 9, 11.45); camera.lookAt(0, 2.1, .5); camera.updateMatrixWorld()
  const bodies=layers.group.getObjectByName('light-crystal-bodies') as InstancedMesh
  const points=[] as Vector3[]
  for (let i=0;i<10;i++) { const m=new Matrix4(); bodies.getMatrixAt(i, m); points.push(new Vector3().setFromMatrixPosition(m).project(camera)) }
  const visible=points.filter(p => Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z<1)
  expect(visible.filter(p => p.x<0).length, JSON.stringify(points)).toBeGreaterThanOrEqual(2)
  expect(visible.filter(p => p.x>0).length).toBeGreaterThanOrEqual(2)
  layers.dispose()
})
