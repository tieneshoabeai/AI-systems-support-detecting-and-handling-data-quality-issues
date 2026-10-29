// Internal evidence harness: imports the product models; never bundled into production.
import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { WebGLRenderer } from 'three'
import { ResourceHardware } from '../../../src/graphics/workspace-3d/resource-hardware'
import { HardwareLighting } from '../../../src/graphics/workspace-3d/hardware-lighting'
import type { ResourceKind } from '../../../src/types/workspace-3d/resource-map.types'

export function Review() {
  const query = new URLSearchParams(window.location.search)
  const kind = (['workspace', 'project', 'dataset'].includes(query.get('kind') ?? '') ? query.get('kind') : 'workspace') as ResourceKind
  const azimuth = Number(query.get('azimuth') ?? '0') * Math.PI / 180
  const renderer = useRef<WebGLRenderer | null>(null)
  const [capture, setCapture] = useState('')
  const direction = new Vector3(0.46, 0.4, 1).normalize().applyAxisAngle(new Vector3(0, 1, 0), azimuth)
  const camera = direction.multiplyScalar(8).add(new Vector3(0, 0.2, 0))
  return <>
    <button onClick={() => { if (renderer.current) setCapture(renderer.current.domElement.toDataURL('image/png')) }}>Capture model</button>
    <img id="capture" src={capture || undefined} alt="Current browser-rendered model capture" />
    <Canvas orthographic camera={{ position: camera.toArray(), zoom: kind === 'workspace' ? 110 : kind === 'project' ? 115 : 155, near: 0.01, far: 100 }}
      gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }} dpr={1} shadows="percentage" frameloop="demand"
      onCreated={({ gl, camera }) => { renderer.current = gl; camera.lookAt(0, 0.2, 0); camera.updateProjectionMatrix() }}>
      <HardwareLighting />
      <ambientLight intensity={0.65} />
      <directionalLight position={[-5, 8, 5]} intensity={2.5} />
      <ResourceHardware node={{resource:{id:`review-${kind}`,kind,name:kind,parentId:null},position:[0,0,0]}}
        selected={false} onSelect={() => {}} onHover={() => {}} />
    </Canvas>
  </>
}

createRoot(document.getElementById('root')!).render(<Review />)
