import { useEffect, useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { DoubleSide, ExtrudeGeometry, Path, Quaternion, Shape, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PositionedResource, ResourcePort } from '../../types/workspace-3d/resource-map.types'
import { CONNECTION } from '../../math/workspace-3d/resource-connection-profile'
import { hubSocketWall, socketPanel } from './connection-geometry'

type Finish = 'shell' | 'edge' | 'dark' | 'signal' | 'glass'
type PartProps = {
  size: [number, number, number]
  position: [number, number, number]
  finish?: Finish
  accent: string
}

function FinishMaterial({ finish, accent }: { finish: Finish; accent: string }) {
  if (finish === 'glass') return <meshPhysicalMaterial color="#bce7de" transparent opacity={0.22} roughness={0.08} metalness={0.1} depthWrite={false} />
  if (finish === 'signal') return <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} roughness={0.22} metalness={0.2} />
  return <meshStandardMaterial color={finish === 'dark' ? '#173c37' : finish === 'edge' ? '#72958b' : '#d4e5df'}
    metalness={finish === 'dark' ? 0.25 : 0.65} roughness={finish === 'shell' ? 0.28 : 0.38} />
}

function RoundedPart({ size: [x, y, z], position, finish = 'shell', accent }: PartProps) {
  const geometry = useMemo(() => new RoundedBoxGeometry(x, y, z, 4, Math.min(x, y, z) * 0.22), [x, y, z])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={position} castShadow receiveShadow>
    <primitive object={geometry} attach="geometry" />
    <FinishMaterial finish={finish} accent={accent} />
  </mesh>
}

function AnnularPart({ outer, inner, depth, y, accent, finish = 'shell' }: {
  outer: number; inner: number; depth: number; y: number; accent: string; finish?: Finish
}) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
    const hole = new Path()
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 3, curveSegments: 64 })
  }, [outer, inner, depth])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} castShadow receiveShadow>
    <FinishMaterial finish={finish} accent={accent} />
  </mesh>
}

function SocketWall({ ports, accent, kind }: { ports: readonly ResourcePort[]; accent: string; kind: 'workspace' | 'project' | 'dataset' }) {
  const geometry = useMemo(() => kind === 'workspace' ? hubSocketWall(ports)
    : socketPanel(kind === 'project' ? 1.35 : 2.4, kind === 'project' ? 2.05 : 0.7, CONNECTION.recess,
      ports.map(port => ({ x: kind === 'project' ? -port.position[2] : -port.position[0],
        y: port.position[1] - (kind === 'project' ? 0.35 : -0.23), radius: port.radius * 1.32 }))), [ports, kind])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={kind === 'project' ? [0.71, 0.35, 0] : kind === 'dataset' ? [0, -0.23, -0.65] : [0, 0, 0]}
    rotation={[0, kind === 'project' ? Math.PI / 2 : kind === 'dataset' ? Math.PI : 0, 0]} castShadow receiveShadow>
    <FinishMaterial finish="shell" accent={accent} />
  </mesh>
}

function Socket({ port }: { port: ResourcePort }) {
  const orientation = useMemo(() => new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...port.normal)), [port.normal])
  return <group position={port.position} quaternion={orientation}>
    <mesh position={[0, 0, -CONNECTION.recess / 2]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[port.radius * 1.3, port.radius * 1.3, CONNECTION.recess, 20, 1, true]} />
      <meshStandardMaterial color="#17332e" roughness={0.45} metalness={0.3} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 0, -CONNECTION.recess + 0.003]}>
      <circleGeometry args={[port.radius * 1.3, 20]} /><meshStandardMaterial color="#102b27" />
    </mesh>
    <mesh position={[0, 0, CONNECTION.lip / 2]}>
      <torusGeometry args={[port.radius * 1.28, port.radius * 0.12, 8, 20]} />
      <meshStandardMaterial color="#738c83" metalness={0.7} roughness={0.24} />
    </mesh>
  </group>
}

const noPorts: readonly ResourcePort[] = []

function WorkspaceHub({ accent, ports }: { accent: string; ports: readonly ResourcePort[] }) {
  return <>
    <AnnularPart outer={1.75} inner={1.05} depth={0.14} y={-0.72} accent={accent} finish="edge" />
    <AnnularPart outer={1.52} inner={1.1} depth={0.34} y={-0.57} accent={accent} />
    <SocketWall kind="workspace" ports={ports} accent={accent} />
    <mesh position={[0, -0.45, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.83, 0.83, 0.65, 6]} /><FinishMaterial finish="dark" accent={accent} />
    </mesh>
    <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.32, 0.075, 10, 64]} /><FinishMaterial finish="edge" accent={accent} />
    </mesh>
    <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.05, 0.035, 8, 64]} /><FinishMaterial finish="signal" accent={accent} />
    </mesh>
    <mesh position={[0, 0.28, 0]} castShadow>
      <cylinderGeometry args={[0.76, 0.76, 1.1, 6]} /><FinishMaterial finish="dark" accent={accent} />
    </mesh>
    {[-0.28, 0.85].map(y => <mesh key={y} position={[0, y, 0]} castShadow>
      <cylinderGeometry args={[0.88, 0.88, 0.15, 6]} /><FinishMaterial finish="shell" accent={accent} />
    </mesh>)}
    <mesh position={[0, 0.94, 0]}>
      <cylinderGeometry args={[0.62, 0.62, 0.035, 6]} /><FinishMaterial finish="signal" accent={accent} />
    </mesh>
    {Array.from({ length: 6 }, (_, i) => <group key={i} rotation={[0, i * Math.PI / 3, 0]}>
      <RoundedPart size={[0.13, 0.9, 0.07]} position={[0, 0.29, 0.67]} accent={accent} finish="signal" />
      <RoundedPart size={[0.36, 0.045, 0.14]} position={[0, -0.23, 1.4]} accent={accent} finish="dark" />
    </group>)}
  </>
}

function ProjectModule({ accent, ports }: { accent: string; ports: readonly ResourcePort[] }) {
  return <>
    <RoundedPart size={[1.56, 2.05, 1.35]} position={[-0.07, 0.35, 0]} accent={accent} />
    <SocketWall kind="project" ports={ports} accent={accent} />
    {[-0.65, 1.4].map(y => <RoundedPart key={y} size={[1.95, 0.18, 1.55]} position={[0, y, 0]} accent={accent} finish="edge" />)}
    {[1, -1].map(side => <group key={side} rotation={[0, side === -1 ? Math.PI : 0, 0]}>
      <RoundedPart size={[1.35, 1.7, 0.07]} position={[0, 0.35, 0.69]} accent={accent} finish="dark" />
      {[-0.43, 0, 0.43].map(x => <group key={x}>
        <RoundedPart size={[0.2, 1.37, 0.06]} position={[x, 0.4, 0.75]} accent={accent} finish="edge" />
        <RoundedPart size={[0.085, 1.15, 0.065]} position={[x, 0.4, 0.79]} accent={accent} finish="signal" />
      </group>)}
    </group>)}
    <RoundedPart size={[0.65, 0.055, 0.4]} position={[0, 1.52, 0]} accent={accent} finish="dark" />
  </>
}

function DatasetCartridge({ accent, ports }: { accent: string; ports: readonly ResourcePort[] }) {
  const shell = useMemo(() => {
    const outline = new Shape()
    outline.moveTo(-1.2, -0.72)
    outline.lineTo(0.9, -0.72)
    outline.lineTo(1.2, -0.42)
    outline.lineTo(1.2, 0.58)
    outline.lineTo(-1.2, 0.58)
    outline.closePath()
    return new ExtrudeGeometry(outline, { depth: 0.7, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 2, steps: 1 })
  }, [])
  useEffect(() => () => shell.dispose(), [shell])
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, 0]} castShadow receiveShadow>
      <primitive object={shell} attach="geometry" /><FinishMaterial finish="shell" accent={accent} />
    </mesh>
    <SocketWall kind="dataset" ports={ports} accent={accent} />
    <RoundedPart size={[1.8, 0.5, 0.05]} position={[-0.1, -0.2, 0.8]} accent={accent} finish="dark" />
    {[-0.34, -0.18, -0.02].map(y => <RoundedPart key={y} size={[1.45, 0.065, 0.09]} position={[-0.12, y, 0.84]} accent={accent} finish="signal" />)}
    <RoundedPart size={[1.75, 0.48, 0.035]} position={[-0.1, -0.2, 0.91]} accent={accent} finish="glass" />
    <RoundedPart size={[1.55, 0.04, 0.95]} position={[-0.12, 0.23, 0]} accent={accent} finish="dark" />
    {[-0.28, 0, 0.28].map(z => <RoundedPart key={z} size={[1.12, 0.035, 0.085]} position={[-0.12, 0.26, z]} accent={accent} finish="signal" />)}
    {[-1.05, 1.05].map(x => <RoundedPart key={x} size={[0.18, 0.16, 1.12]} position={[x, -0.66, 0]} accent={accent} finish="edge" />)}
  </>
}

export function ResourceHardware({ node, selected, onSelect, onHover }: {
  node: PositionedResource; selected: boolean; onSelect(id: string): void; onHover(id: string | null): void
}) {
  const accent = selected ? '#00dba0' : node.resource.kind === 'dataset' ? '#35a7d5' : '#00a878'
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 6) return
    event.stopPropagation()
    onSelect(node.resource.id)
  }
  return <group position={node.position} onClick={click}
    onPointerOver={event => { event.stopPropagation(); onHover(node.resource.id) }} onPointerOut={() => onHover(null)}>
    {node.resource.kind === 'workspace' ? <WorkspaceHub accent={accent} ports={node.ports ?? noPorts} />
      : node.resource.kind === 'project' ? <ProjectModule accent={accent} ports={node.ports ?? noPorts} /> : <DatasetCartridge accent={accent} ports={node.ports ?? noPorts} />}
    {node.ports?.map(port => <Socket key={port.id} port={port} />)}
    {selected && <mesh position={[0, -0.775, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.83, 1.9, 64]} /><meshBasicMaterial color="#00a878" />
    </mesh>}
  </group>
}
