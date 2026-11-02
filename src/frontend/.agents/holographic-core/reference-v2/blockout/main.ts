import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import spec from '../object-sculpt-spec.json';
import { createHolographicOrbitalDataCoreV2Model, type ProceduralModelRuntime } from './generated-core';

const WIDTH = 468;
const HEIGHT = 360;
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const evidencePanel = document.querySelector<HTMLPreElement>('#evidence')!;
const selectedLabel = document.querySelector<HTMLParagraphElement>('#selected')!;
const intermediateBase = {
  id: 'base-intermediate',
  parent: 'base-shell',
  dimensions: { width: 5.4, height: 0.20, depth: 5.4 },
  innerRadius: 2.15,
  outerRadius: 2.7,
  bottomY: 0.46,
};
const components = [...spec.componentTree, intermediateBase];
type ViewName = 'reference' | 'front' | 'right' | 'rear' | 'left' | 'high';

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

try {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); // Evidence pixels match the source, independent of Retina DPR.
  renderer.setSize(WIDTH, HEIGHT);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-label', 'Blockout trung tính 468 × 360 pixel');
  renderer.domElement.setAttribute('role', 'img');
  stage.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101010');
  const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.minDistance = 3;
  controls.maxDistance = 40;
  const ambient = new THREE.AmbientLight('#ffffff', 0.9);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#ffffff', 2.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', 0.65);
  fill.position.set(-4, 1, -3);
  scene.add(fill);

  // Postprocessing composer with UnrealBloomPass
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  // Keep bloom selective: it supports emissive contours, but must not flatten the silhouette.
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(WIDTH, HEIGHT), 0.18, 0.45, 1.0);
  bloomPass.enabled = false;
  composer.addPass(bloomPass);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const model = createHolographicOrbitalDataCoreV2Model({ castShadow: false, receiveShadow: false });
  scene.add(model);
  const runtime = model.userData.sculptRuntime as ProceduralModelRuntime;
  // Local coordinates use the base-shell's center at world Y = 0.225.
  const baseNode = runtime.nodes['base-shell'];
  if (!baseNode) throw new Error('Thiếu base-shell để gắn base trung gian');
  const intermediateNode = new THREE.Group();
  intermediateNode.name = intermediateBase.id;
  intermediateNode.position.y = intermediateBase.bottomY + intermediateBase.dimensions.height / 2 - 0.225;
  const profile = [
    new THREE.Vector2(intermediateBase.innerRadius, -intermediateBase.dimensions.height / 2),
    new THREE.Vector2(intermediateBase.outerRadius, -intermediateBase.dimensions.height / 2),
    new THREE.Vector2(intermediateBase.outerRadius, intermediateBase.dimensions.height / 2),
    new THREE.Vector2(intermediateBase.innerRadius, intermediateBase.dimensions.height / 2),
    new THREE.Vector2(intermediateBase.innerRadius, -intermediateBase.dimensions.height / 2),
  ];
  const intermediateMesh = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 96),
    new THREE.MeshStandardMaterial({ color: '#1269e8', emissive: '#168dff', emissiveIntensity: 0.45, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
  );
  intermediateMesh.name = intermediateBase.id;
  intermediateNode.add(intermediateMesh);
  baseNode.add(intermediateNode);
  runtime.nodes[intermediateBase.id] = intermediateNode;
  runtime.meshes[intermediateBase.id] = intermediateMesh;
  // Keep the violet loop above the approved intermediate ring.
  // Moving its owner pivot also moves the attached front-loop-light.
  const orbitComponent = spec.componentTree.find(component => component.id === 'orbit-violet');
  if (!orbitComponent || !runtime.nodes['orbit-violet']) throw new Error('Thiếu orbit-violet');
  runtime.nodes['orbit-violet'].position.y = orbitComponent.transform.position[1];
  const pickables: THREE.Object3D[] = [];
  const baseline = new Map<string, THREE.Vector3>();
  const originalMaterials = new Map<string, THREE.Material | THREE.Material[]>();
  const hologramMaterials = new Map<string, THREE.Material>();
  const contourLines = new Map<string, THREE.LineSegments>();
  const towerCages = new Map<string, THREE.LineSegments>();
  const technicalDetails: THREE.Object3D[] = [];
  const luminousNodes: THREE.InstancedMesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>[] = [];
  const primaryHotspots: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial>[] = [];
  const axialSpines: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>[] = [];
  let orbitRunner: THREE.Group | undefined;
  let orbitRunnerMaterial: THREE.MeshBasicMaterial | undefined;
  const neutral = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#adb4bf' });
  const frameMaterial = new THREE.LineBasicMaterial({ color: '#929daa' });
  let currentView: ViewName = 'reference';
  let exploded = false;
  let materialMode = false;
  let selected: THREE.Object3D | undefined;
  let priorColor: THREE.Color | undefined;

  /**
   * The reference is a synthetic hologram, not clear physical glass.
   * These values preserve a readable hierarchy: blue mass, cyan contours,
   * and one violet orbital accent.
   */
  function createHologramMaterial(component: typeof components[number], original: THREE.Material | THREE.Material[]) {
    const source = Array.isArray(original) ? original[0] : original;
    const material = source.clone() as THREE.MeshStandardMaterial;
    const materialRole = 'material' in component ? component.material : 'base-intermediate';
    const basePreset = {
      'blue-volume': { color: '#075bff', emissive: '#1065ff', emission: 0.52, opacity: 0.58 },
      'cyan-contour': { color: '#17d7ff', emissive: '#17d7ff', emission: 0.7, opacity: 0.34 },
      'violet-band': { color: '#a849f8', emissive: '#b968ff', emission: 0.75, opacity: 0.58 },
      'blue-face': { color: '#0a5cdf', emissive: '#1065e8', emission: 0.34, opacity: 0.3 },
      'field-fill': { color: '#0c5ced', emissive: '#1269e8', emission: 0.18, opacity: 0.06 },
      'base-intermediate': { color: '#0754d7', emissive: '#1269e8', emission: 0.28, opacity: 0.18 },
    }[materialRole] ?? { color: '#0754d7', emissive: '#1269e8', emission: 0.25, opacity: 0.14 };
    const towerDepthOpacity: Record<string, number> = {
      'tower-01-back-high': 0.19, 'tower-02': 0.21, 'tower-03': 0.25,
      'tower-04': 0.36, 'tower-05': 0.42, 'tower-06': 0.39,
      'tower-07': 0.3, 'tower-08': 0.23, 'tower-09': 0.2,
    };
    const preset = component.id in towerDepthOpacity
      ? { ...basePreset, opacity: towerDepthOpacity[component.id] }
      : basePreset;

    material.color.set(preset.color);
    material.emissive.set(preset.emissive);
    material.emissiveIntensity = preset.emission;
    material.transparent = true;
    material.opacity = preset.opacity;
    material.depthWrite = false;
    material.side = THREE.DoubleSide;
    return material;
  }

  function setLineLook(line: THREE.LineSegments, color: string, opacity: number) {
    const material = line.material as THREE.LineBasicMaterial;
    material.color.set(color);
    material.transparent = opacity < 1;
    material.opacity = opacity;
    material.depthWrite = false;
  }

  function createTechnicalLine(positions: number[], opacity = 0.46) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: '#42eaff', transparent: true, opacity, depthWrite: false });
    const line = new THREE.LineSegments(geometry, material);
    line.visible = false;
    technicalDetails.push(line);
    return line;
  }

  function createTechnicalPoints(positions: number[], opacity = 0.9, size = 0.034) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: '#7af5ff', size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    technicalDetails.push(points);
    return points;
  }

  function createLuminousNodes(positions: number[], size = 0.026) {
    const color = new THREE.Color().setRGB(0.08, 2.6, 4.2);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const nodes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(size, 1), material, positions.length / 3);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < positions.length; index += 3) {
      matrix.makeTranslation(positions[index], positions[index + 1], positions[index + 2]);
      nodes.setMatrixAt(index / 3, matrix);
    }
    nodes.instanceMatrix.needsUpdate = true;
    nodes.visible = false;
    technicalDetails.push(nodes);
    luminousNodes.push(nodes);
    return nodes;
  }

  function createPrimaryHotspot(componentId: string, position: THREE.Vector3, radius: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu mesh để tạo primary hotspot: ${componentId}`);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.35, 3.2, 5.2), transparent: true, opacity: 0.96, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const hotspot = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), material);
    hotspot.position.copy(position);
    hotspot.visible = false;
    technicalDetails.push(hotspot);
    primaryHotspots.push(hotspot);
    mesh.add(hotspot);
  }

  function addAxialSpine(centerY: number, height: number) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(0.08, 2.4, 4.5), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, height, 8, 1, true), material);
    spine.position.y = centerY;
    spine.visible = false;
    technicalDetails.push(spine);
    axialSpines.push(spine);
    model.add(spine);
  }

  function addCapSolarRays(componentId: string, y: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu cap để tạo solar rays: ${componentId}`);
    const ranges: Array<[number, number, number]> = [[0.06, 0.26, 0.52], [0.26, 0.52, 0.26], [0.52, 0.82, 0.09]];
    for (const [innerRadius, outerRadius, opacity] of ranges) {
      const positions: number[] = [];
      for (let ray = 0; ray < 12; ray++) {
        const angle = (ray / 12) * Math.PI * 2;
        positions.push(innerRadius * Math.cos(angle), y, innerRadius * Math.sin(angle), outerRadius * Math.cos(angle), y, outerRadius * Math.sin(angle));
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({ color: new THREE.Color().setRGB(0.1, 2.2, 3.7), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      const rays = new THREE.LineSegments(geometry, material);
      rays.visible = false;
      technicalDetails.push(rays);
      mesh.add(rays);
    }
  }

  function addScatteredNodes(componentId: string, positions: number[], size: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu mesh để tạo scattered nodes: ${componentId}`);
    mesh.add(createLuminousNodes(positions, size));
  }

  function addCylinderGrid(componentId: string, radius: number, height: number, horizontalCount: number, verticalCount: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu mesh để tạo grid: ${componentId}`);
    const positions: number[] = [];
    const segments = 32;
    for (let row = 1; row <= horizontalCount; row++) {
      const y = -height / 2 + (row * height) / (horizontalCount + 1);
      for (let segment = 0; segment < segments; segment++) {
        const a = (segment / segments) * Math.PI * 2;
        const b = ((segment + 1) / segments) * Math.PI * 2;
        positions.push(radius * Math.cos(a), y, radius * Math.sin(a), radius * Math.cos(b), y, radius * Math.sin(b));
      }
    }
    for (let column = 0; column < verticalCount; column++) {
      const angle = (column / verticalCount) * Math.PI * 2;
      positions.push(radius * Math.cos(angle), -height / 2, radius * Math.sin(angle), radius * Math.cos(angle), height / 2, radius * Math.sin(angle));
    }
    mesh.add(createTechnicalLine(positions, 0.26));
  }

  function addPlanarGrid(componentId: string, radii: number[], spokes: number, y: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu mesh để tạo grid: ${componentId}`);
    const positions: number[] = [];
    const segments = 40;
    for (const radius of radii) {
      for (let segment = 0; segment < segments; segment++) {
        const a = (segment / segments) * Math.PI * 2;
        const b = ((segment + 1) / segments) * Math.PI * 2;
        positions.push(radius * Math.cos(a), y, radius * Math.sin(a), radius * Math.cos(b), y, radius * Math.sin(b));
      }
    }
    const outerRadius = radii[radii.length - 1];
    for (let spoke = 0; spoke < spokes; spoke++) {
      const angle = (spoke / spokes) * Math.PI * 2;
      positions.push(0, y, 0, outerRadius * Math.cos(angle), y, outerRadius * Math.sin(angle));
    }
    mesh.add(createTechnicalLine(positions, 0.3));
  }

  function addTowerDataMarks(componentId: string, width: number, height: number, depth: number, density: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu tower để tạo data marks: ${componentId}`);
    const positions: number[] = [];
    for (let index = 0; index < density; index++) {
      const y = (-0.34 + (index / Math.max(density - 1, 1)) * 0.68) * height;
      const start = -width * 0.3;
      const end = start + width * ([0.3, 0.62, 0.45, 0.76][index % 4]);
      positions.push(start, y, depth / 2 + 0.012, end, y, depth / 2 + 0.012);
      positions.push(width / 2 + 0.012, y, -depth * 0.28, width / 2 + 0.012, y, depth * (index % 2 === 0 ? 0.32 : 0.08));
      if (index % 2 === 0) {
        positions.push(end, y - height * 0.025, depth / 2 + 0.013, end, y + height * 0.025, depth / 2 + 0.013);
      }
    }
    mesh.add(createTechnicalLine(positions, 0.78));
  }

  function addTowerGrid(componentId: string, width: number, height: number, depth: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu tower để tạo grid: ${componentId}`);
    const positions: number[] = [];
    const frontZ = depth / 2 + 0.006;
    const rightX = width / 2 + 0.006;
    for (const x of [-width / 4, 0, width / 4]) {
      positions.push(x, -height / 2, frontZ, x, height / 2, frontZ);
    }
    for (const z of [-depth / 4, 0, depth / 4]) {
      positions.push(rightX, -height / 2, z, rightX, height / 2, z);
    }
    for (const y of [-height / 4, 0, height / 4]) {
      positions.push(-width / 2, y, frontZ, width / 2, y, frontZ);
      positions.push(rightX, y, -depth / 2, rightX, y, depth / 2);
    }
    mesh.add(createTechnicalLine(positions, 0.18));
  }

  function addMicroDataPattern(componentId: string, width: number, height: number, depth: number, variant: number) {
    const mesh = runtime.meshes[componentId];
    if (!mesh) throw new Error(`Thiếu tower để tạo micro pattern: ${componentId}`);
    const lines: number[] = [];
    const nodes: number[] = [];
    const frontZ = depth / 2 + 0.016;
    const rightX = width / 2 + 0.016;
    const baseY = (-0.12 + (variant % 3) * 0.09) * height;

    // Small bar-chart panel on the front face.
    for (let index = 0; index < 4; index++) {
      const x = -width * 0.25 + index * width * 0.14;
      const barHeight = height * ([0.06, 0.12, 0.085, 0.16][(index + variant) % 4]);
      lines.push(x, baseY, frontZ, x, baseY + barHeight, frontZ);
      nodes.push(x, baseY + barHeight, frontZ);
    }

    // A connected node trace on the side face makes the pattern visible from a 3/4 view.
    const trace = [-0.24, -0.06, 0.14, 0.3].map((ratio, index) => [rightX, ratio * height, (-0.22 + ((index + variant) % 3) * 0.16) * depth] as const);
    for (let index = 0; index < trace.length - 1; index++) lines.push(...trace[index], ...trace[index + 1]);
    for (const node of trace) nodes.push(...node);

    // Corner brackets suggest a bounded data panel without fabricating readable text.
    const bracketX = -width * 0.32;
    const bracketY = baseY - height * 0.05;
    lines.push(bracketX, bracketY, frontZ, bracketX + width * 0.08, bracketY, frontZ);
    lines.push(bracketX, bracketY, frontZ, bracketX, bracketY + height * 0.1, frontZ);
    mesh.add(createTechnicalLine(lines, 0.92));
    mesh.add(createTechnicalPoints(nodes, 0.95, 0.045));
  }

  function addCapHotspot(componentId: string, y: number) {
    createPrimaryHotspot(componentId, new THREE.Vector3(0, y, 0), 0.052);
  }

  // Adapt generated carriers, preserving pivots, IDs and authored dimensions.
  // Frames remain genuine 3D edge cages rather than opaque boxes or flat cards.
  for (const component of components) {
    const mesh = runtime.meshes[component.id];
    const node = runtime.nodes[component.id];
    if (!mesh || !node) throw new Error(`Thiếu bộ phận được đặc tả: ${component.id}`);
    baseline.set(component.id, node.position.clone());
    originalMaterials.set(component.id, mesh.material);
    hologramMaterials.set(component.id, createHologramMaterial(component, mesh.material));
    mesh.material = neutral.clone();
    mesh.userData.componentId = component.id;
    mesh.userData.explodeWithParent = true;
    if ((component.id.startsWith('tower-') || component.id === 'inner-projection-field')) {
      mesh.visible = component.id.startsWith('tower-');
      if (component.id.startsWith('tower-')) {
        mesh.material = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 1, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
      }
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), frameMaterial.clone());
      edges.name = `${component.id}.edge-cage`;
      edges.position.copy(mesh.position);
      edges.quaternion.copy(mesh.quaternion);
      edges.userData.componentId = component.id;
      edges.userData.explodeWithParent = true;
      node.add(edges);
      towerCages.set(component.id, edges);
      pickables.push(edges);
    } else {
      pickables.push(mesh);
      if (component.id !== 'lower-node') {
        const rim = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMaterial);
        rim.name = `${component.id}.neutral-contours`;
        rim.userData.componentId = component.id;
        rim.userData.explodeWithParent = true;
        mesh.add(rim);
        contourLines.set(component.id, rim);
      }
    }
  }

  // Technical surface pass: generated 3D linework, not a bitmap texture.
  // It remains hidden in neutral inspection mode and is only revealed in hologram mode.
  addCylinderGrid('core-upper', 0.906, 1.2, 6, 12);
  addCylinderGrid('core-lower', 0.906, 0.95, 5, 12);
  addCylinderGrid('core-foot', 0.966, 0.25, 2, 12);
  addPlanarGrid('core-cap', [0.22, 0.46, 0.69, 0.9], 12, 0.028);
  addPlanarGrid('base-deck', [1.1, 1.55, 2.05, 2.55, 3.02], 16, 0.016);
  addPlanarGrid('base-intermediate', [2.18, 2.4, 2.66], 16, 0.106);
  addCapHotspot('core-cap', 0.036);
  addCapSolarRays('core-cap', 0.038);
  createPrimaryHotspot('core-mid-collar', new THREE.Vector3(0, 0.12, 0), 0.038);
  createPrimaryHotspot('core-foot', new THREE.Vector3(0, 0.13, 0), 0.042);
  addAxialSpine(1.9, 1.16);
  addAxialSpine(0.825, 0.86);
  addAxialSpine(0.24, 0.2);
  addScatteredNodes('core-upper', [0.56, 0.32, 0.7, -0.7, 0.18, 0.56, 0.8, -0.16, 0.38, -0.44, -0.3, 0.78], 0.015);
  addScatteredNodes('core-upper', [0.04, 0.06, 0.91, -0.84, 0.24, 0.25], 0.023);
  addScatteredNodes('core-lower', [0.66, 0.28, 0.61, -0.74, 0.06, 0.49, 0.34, -0.25, 0.84, -0.31, -0.34, 0.84], 0.014);
  addScatteredNodes('base-deck', [1.58, 0.026, 1.18, -1.35, 0.026, 1.48, 2.3, 0.026, -1.42, -2.42, 0.026, -0.7, 0.44, 0.026, -2.18, -0.65, 0.026, 2.42], 0.018);
  addScatteredNodes('base-intermediate', [2.44, 0.108, 0.45, -2.31, 0.108, -0.72, 0.42, 0.108, -2.5], 0.014);
  addTowerGrid('tower-01-back-high', 0.76, 2.65, 0.76);
  addTowerGrid('tower-02', 0.48, 1.95, 0.48);
  addTowerGrid('tower-03', 0.45, 1.7, 0.45);
  addTowerGrid('tower-04', 0.42, 1.2, 0.42);
  addTowerGrid('tower-05', 0.36, 0.85, 0.36);
  addTowerGrid('tower-06', 0.4, 1, 0.4);
  addTowerGrid('tower-07', 0.42, 1.3, 0.42);
  addTowerGrid('tower-08', 0.46, 1.8, 0.46);
  addTowerGrid('tower-09', 0.46, 1.95, 0.46);
  addScatteredNodes('tower-01-back-high', [-0.18, 0.55, 0.39, 0.16, -0.3, 0.39], 0.018);
  addScatteredNodes('tower-03', [-0.12, 0.32, 0.24, 0.12, -0.22, 0.24], 0.014);
  addScatteredNodes('tower-05', [0.08, 0.16, 0.19], 0.024);
  addScatteredNodes('tower-06', [-0.1, 0.25, 0.21, 0.1, -0.18, 0.21], 0.017);
  addScatteredNodes('tower-08', [-0.12, 0.38, 0.24, 0.12, -0.28, 0.24], 0.015);
  addTowerDataMarks('tower-01-back-high', 0.76, 2.65, 0.76, 8);
  addTowerDataMarks('tower-03', 0.45, 1.7, 0.45, 5);
  addTowerDataMarks('tower-04', 0.42, 1.2, 0.42, 6);
  addTowerDataMarks('tower-05', 0.36, 0.85, 0.36, 4);
  addTowerDataMarks('tower-06', 0.4, 1, 0.4, 7);
  addTowerDataMarks('tower-07', 0.42, 1.3, 0.42, 5);
  addTowerDataMarks('tower-08', 0.46, 1.8, 0.46, 6);
  addTowerDataMarks('tower-09', 0.46, 1.95, 0.46, 4);
  addMicroDataPattern('tower-01-back-high', 0.76, 2.65, 0.76, 0);
  addMicroDataPattern('tower-03', 0.45, 1.7, 0.45, 1);
  addMicroDataPattern('tower-04', 0.42, 1.2, 0.42, 2);
  addMicroDataPattern('tower-05', 0.36, 0.85, 0.36, 3);
  addMicroDataPattern('tower-06', 0.4, 1, 0.4, 4);
  addMicroDataPattern('tower-07', 0.42, 1.3, 0.42, 5);
  addMicroDataPattern('tower-08', 0.46, 1.8, 0.46, 6);
  orbitRunner = new THREE.Group();
  orbitRunner.name = 'orbit-violet.light-runner';
  orbitRunner.position.y = orbitComponent.transform.position[1];
  orbitRunnerMaterial = new THREE.MeshBasicMaterial({ color: '#f0b5ff', transparent: true, opacity: 0.92, depthWrite: false, blending: THREE.AdditiveBlending });
  const runnerArc = new THREE.Mesh(new THREE.TorusGeometry(2.53, 0.026, 6, 36, Math.PI * 2 * 0.1), orbitRunnerMaterial);
  runnerArc.rotation.x = Math.PI / 2;
  orbitRunner.add(runnerArc);
  orbitRunner.visible = false;
  model.add(orbitRunner);
  const carrierTriangleCount = components.reduce((total, component) => {
    const geometry = runtime.meshes[component.id].geometry;
    return total + (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
  }, 0);
  const luminousNodeTriangleCount = luminousNodes.reduce((total, nodes) => {
    const geometry = nodes.geometry;
    return total + ((geometry.index?.count ?? geometry.getAttribute('position').count) / 3) * nodes.count;
  }, 0);
  const primaryHotspotTriangleCount = primaryHotspots.reduce((total, hotspot) => total + (hotspot.geometry.index?.count ?? hotspot.geometry.getAttribute('position').count) / 3, 0);
  const axialSpineTriangleCount = axialSpines.reduce((total, spine) => total + (spine.geometry.index?.count ?? spine.geometry.getAttribute('position').count) / 3, 0);
  const modelTriangleCount = carrierTriangleCount + luminousNodeTriangleCount + primaryHotspotTriangleCount + axialSpineTriangleCount;
  model.updateMatrixWorld(true);

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animatedNodes = [
    { id: 'orbit-violet', radiansPerSecond: Math.PI * 2 / 21 },
    { id: 'core-mid-collar', radiansPerSecond: -Math.PI * 2 / 15 },
    { id: 'base-deck', radiansPerSecond: Math.PI * 2 / 32 },
    { id: 'core-cap', radiansPerSecond: -Math.PI * 2 / 24 },
  ].map(motion => {
    const node = runtime.nodes[motion.id];
    if (!node) throw new Error(`Thiếu bộ phận để animate: ${motion.id}`);
    return { ...motion, node, baseRotationY: node.rotation.y };
  });
  let animationFrame: number | undefined;
  let animationStart = 0;

  function render() {
    if (bloomPass.enabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  function resetHologramMotion() {
    for (const motion of animatedNodes) motion.node.rotation.y = motion.baseRotationY;
    for (const nodeGroup of luminousNodes) nodeGroup.material.opacity = 0.9;
    primaryHotspots.forEach((hotspot, index) => {
      hotspot.material.opacity = [0.96, 0.85, 0.84][index] ?? 0.75;
      hotspot.scale.setScalar(1);
    });
    for (const spine of axialSpines) spine.material.opacity = 0.7;
    if (orbitRunner) {
      orbitRunner.rotation.y = 0;
      if (orbitRunnerMaterial) orbitRunnerMaterial.opacity = 0.92;
    }
  }

  function updateHologramLights(elapsedSeconds: number) {
    for (let index = 0; index < luminousNodes.length; index++) {
      luminousNodes[index].material.opacity = 0.72 + (Math.sin(elapsedSeconds * 1.4 + index * 0.9) + 1) * 0.09;
    }
    primaryHotspots.forEach((hotspot, index) => {
      const baseOpacity = [0.96, 0.85, 0.84][index] ?? 0.75;
      const pulse = index === 0 ? 0.9 + Math.sin((elapsedSeconds / 3.2) * Math.PI * 2) * 0.1 : 0.96 + Math.sin(elapsedSeconds * 1.1 + index) * 0.04;
      hotspot.material.opacity = baseOpacity * pulse;
      hotspot.scale.setScalar(index === 0 ? 0.96 + pulse * 0.08 : 0.98 + pulse * 0.035);
    });
    for (const spine of axialSpines) spine.material.opacity = 0.62 + Math.sin(elapsedSeconds * 1.1) * 0.08;
    if (orbitRunner) {
      orbitRunner.rotation.y = (elapsedSeconds / 6) * Math.PI * 2;
      if (orbitRunnerMaterial) orbitRunnerMaterial.opacity = 0.72 + Math.sin((elapsedSeconds / 2.4) * Math.PI * 2) * 0.16;
    }
  }

  function stopHologramMotion() {
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    resetHologramMotion();
  }

  function runHologramMotion(now: number) {
    if (!materialMode || motionPreference.matches) {
      animationFrame = undefined;
      return;
    }
    const elapsedSeconds = (now - animationStart) / 1000;
    for (const motion of animatedNodes) motion.node.rotation.y = motion.baseRotationY + elapsedSeconds * motion.radiansPerSecond;
    updateHologramLights(elapsedSeconds);
    render();
    animationFrame = requestAnimationFrame(runHologramMotion);
  }

  function startHologramMotion() {
    if (motionPreference.matches || animationFrame !== undefined) return;
    animationStart = performance.now();
    animationFrame = requestAnimationFrame(runHologramMotion);
  }

  motionPreference.addEventListener('change', () => {
    if (motionPreference.matches) stopHologramMotion();
    else if (materialMode) startHologramMotion();
    refreshEvidence();
  });

  function projectedBounds() {
    const min = new THREE.Vector2(Infinity, Infinity);
    const max = new THREE.Vector2(-Infinity, -Infinity);
    const point = new THREE.Vector3();
    model.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    for (const object of pickables) {
      const geometry = (object as THREE.Mesh | THREE.LineSegments).geometry;
      const positions = geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index++) {
        point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).project(camera);
        const x = (point.x + 1) * WIDTH / 2;
        const y = (1 - point.y) * HEIGHT / 2;
        min.min(new THREE.Vector2(x, y));
        max.max(new THREE.Vector2(x, y));
      }
    }
    return { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y };
  }

  function cameraEvidence() {
    return {
      name: currentView, projection: 'perspective', fovDegrees: camera.fov,
      position: camera.position.toArray(), target: controls.target.toArray(), viewportPx: [WIDTH, HEIGHT],
      pixelRatio: renderer.getPixelRatio(), projectedBounds: projectedBounds(), calibrated: false,
      note: 'Camera hypothesis fitted to approximate assembly bounds, not an exact source-camera solution.',
    };
  }

  function evidence(includeGeometry = false) {
    model.updateMatrixWorld(true);
    const parts = components.map(component => {
      const mesh = runtime.meshes[component.id];
      const bounds = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const worldBounds = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
      return {
        name: component.id, componentId: component.id, kind: 'part', module: component.id,
        representation: (component.id.startsWith('tower-') || component.id === 'inner-projection-field') ? '3D-edge-cage' : 'neutral-carrier',
        triangles: (component.id.startsWith('tower-') || component.id === 'inner-projection-field') ? 0 : (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
        dimensions: size.toArray(), measuredWorldCenter: center.toArray(),
        worldBounds: { min: worldBounds.min.toArray(), max: worldBounds.max.toArray() },
        intendedDimensions: [component.dimensions.width, component.dimensions.height, component.dimensions.depth],
        parentComponent: component.parent,
      };
    });
    const result = {
      model: spec.targetId, pass: 'blockout', materialMode: materialMode ? 'hologram-look-dev' : 'neutral-map-stripped',
      camera: cameraEvidence(), exploded, autoRotate: false, animationLoop: animationFrame !== undefined,
      reducedMotion: motionPreference.matches,
      renderer: { revision: THREE.REVISION, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, bloom: bloomPass.enabled, shadows: false },
      modelTriangles: modelTriangleCount,
      parts, unnamedMeshes: 0, integralMeshes: pickables.length,
      measuredPositions: Object.fromEntries(parts.map(part => [part.componentId, part.measuredWorldCenter])),
      technicalDetailCount: technicalDetails.length,
      deferredDetails: materialMode ? ['localized data glyphs beyond the selected towers'] : ['colored volume density', 'technical surface grids', 'violet arc brightness', 'localized emission'],
      visibleComponentCount: pickables.length,
    };
    if (!includeGeometry) return result;
    const meshes = components.filter(component => !(component.id.startsWith('tower-') || component.id === 'inner-projection-field')).map(component => {
      const mesh = runtime.meshes[component.id];
      const positions = mesh.geometry.getAttribute('position');
      const normals = mesh.geometry.getAttribute('normal');
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      const vertices = [], normalValues = [];
      for (let index = 0; index < positions.count; index++) {
        vertices.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld).toArray());
        normalValues.push(new THREE.Vector3().fromBufferAttribute(normals, index).applyNormalMatrix(normalMatrix).toArray());
      }
      return { name: component.id, vertices, normals: normalValues, indices: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : Array.from({ length: positions.count }, (_, i) => i) };
    });
    return { ...result, meshes, meshScope: '22 closed carriers; 9 tower edge cages and 1 open field excluded from closed-surface analysis' };
  }

  function refreshEvidence() {
    render();
    evidencePanel.textContent = JSON.stringify(evidence(), null, 2);
    const captureLink = document.querySelector<HTMLAnchorElement>('#capture-png')!;
    captureLink.href = renderer.domElement.toDataURL('image/png');
    captureLink.download = `blockout-${currentView}${exploded ? '-exploded' : ''}.png`;
    const geometryLink = document.querySelector<HTMLAnchorElement>('#capture-evidence')!;
    geometryLink.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(evidence(true)));
    status.textContent = `Sẵn sàng · ${pickables.length}/${components.length} bộ phận · ${modelTriangleCount.toLocaleString()} tam giác hình học · ${currentView}`;
  }

  const referenceTarget = new THREE.Vector3(0, 1.17, 0);
  const targetBounds = { x: 18, y: 11.45, width: 428.1, height: 333.8 };
  let referencePosition = new THREE.Vector3();
  let fittedTarget = referenceTarget.clone();

  // Bounded numeric framing, not a visual-fidelity score or source-camera calibration.
  // Elevation is proposed from the source's projected orbital ellipse (approximate ellipse; seed only, not recovered optics).
  function prepareReferenceCamera() {
    const azimuth = Math.PI / 4;
    const elevation = THREE.MathUtils.degToRad(20);
    const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    let distance = 10.2;
    fittedTarget.copy(referenceTarget);
    for (let iteration = 0; iteration < 4; iteration++) {
      camera.position.copy(fittedTarget).addScaledVector(direction, distance);
      camera.lookAt(fittedTarget);
      camera.updateMatrixWorld(true);
      const bounds = projectedBounds();
      const fit = Math.min(targetBounds.width / bounds.width, targetBounds.height / bounds.height);
      distance /= fit;
    }
    camera.position.copy(fittedTarget).addScaledVector(direction, distance);
    camera.lookAt(fittedTarget);
    camera.updateMatrixWorld(true);
    const bounds = projectedBounds();
    const worldPerPixel = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / HEIGHT;
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    fittedTarget.addScaledVector(right, (bounds.x + bounds.width / 2 - (targetBounds.x + targetBounds.width / 2)) * worldPerPixel);
    fittedTarget.addScaledVector(up, (targetBounds.y + targetBounds.height / 2 - (bounds.y + bounds.height / 2)) * worldPerPixel);
    referencePosition.copy(fittedTarget).addScaledVector(direction, distance);
    referencePosition.lerp(fittedTarget, 0.1);
  }
  prepareReferenceCamera();

  function setView(view: ViewName) {
    currentView = view;
    controls.target.copy(fittedTarget);
    if (view === 'reference') camera.position.copy(referencePosition);
    else {
      const azimuth = { front: 0, right: 90, rear: 180, left: 270, high: 32 }[view];
      const elevation = view === 'high' ? 60 : 20;
      const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
      const distance = referencePosition.distanceTo(fittedTarget) * (exploded ? 1.75 : view === 'high' ? 1.2 : 1);
      camera.position.copy(fittedTarget).add(new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(distance));
    }
    camera.lookAt(controls.target);
    controls.update();
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    refreshEvidence();
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.addEventListener('click', () => setView(button.dataset.view as ViewName));
  controls.addEventListener('change', render);
  controls.addEventListener('end', refreshEvidence);

  const toggleMaterialButton = document.querySelector<HTMLButtonElement>('#toggle-material');
  if (toggleMaterialButton) {
    toggleMaterialButton.addEventListener('click', () => {
      materialMode = !materialMode;
      toggleMaterialButton.setAttribute('aria-pressed', String(materialMode));
      toggleMaterialButton.textContent = materialMode ? 'Chế độ hình khối (Blockout xám)' : 'Chế độ vật liệu (Look-dev Hologram)';

      // Hologram mode uses dim scene lights so emissive color is not washed to gray.
      scene.background = new THREE.Color(materialMode ? '#05070f' : '#101010');
      bloomPass.enabled = materialMode;
      ambient.intensity = materialMode ? 0.18 : 0.9;
      key.intensity = materialMode ? 0.55 : 2.8;
      fill.intensity = materialMode ? 0.25 : 0.65;
      for (const detail of technicalDetails) detail.visible = materialMode;
      if (orbitRunner) orbitRunner.visible = materialMode;
      
      for (const component of components) {
        const mesh = runtime.meshes[component.id];
        if (!mesh) continue;
        const materialRole = 'material' in component ? component.material : 'base-intermediate';
        if (materialMode) {
          const mat = hologramMaterials.get(component.id);
          if (mat) {
            mesh.material = mat;
          }
          mesh.visible = true;
          const contour = contourLines.get(component.id);
          if (contour) setLineLook(contour, materialRole === 'violet-band' ? '#d597ff' : '#47efff', materialRole === 'blue-face' ? 0.38 : 0.72);
          const cage = towerCages.get(component.id);
          if (cage) setLineLook(cage, '#4defff', 0.8);
        } else {
          mesh.material = neutral.clone();
          if (component.id.startsWith('tower-')) {
            mesh.material = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 1, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
          } else if (component.id === 'inner-projection-field') {
            mesh.visible = false;
          }
          const contour = contourLines.get(component.id);
          if (contour) setLineLook(contour, '#adb4bf', 1);
          const cage = towerCages.get(component.id);
          if (cage) setLineLook(cage, '#929daa', 1);
        }
      }
      if (materialMode) startHologramMotion();
      else stopHologramMotion();
      refreshEvidence();
    });
  }

  document.querySelector('#export-png')!.addEventListener('click', () => {
    render();
    renderer.domElement.toBlob(blob => {
      if (!blob) { status.textContent = 'Không xuất được PNG. Hãy kiểm tra WebGL và thử lại.'; return; }
      download(`blockout-${currentView}${exploded ? '-exploded' : ''}.png`, blob);
    }, 'image/png');
  });
  document.querySelector('#export-evidence')!.addEventListener('click', () => {
    refreshEvidence();
    download(`blockout-${currentView}${exploded ? '-exploded' : ''}-evidence.json`, new Blob([JSON.stringify(evidence(true), null, 2)], { type: 'application/json' }));
  });

  // One stable part definition supports both picking and exploded inspection.
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line.threshold = 0.035;
  let pointerStart = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', event => pointerStart.set(event.clientX, event.clientY));
  renderer.domElement.addEventListener('pointerup', event => {
    if (pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / WIDTH * 2 - 1, -(event.clientY - rect.top) / HEIGHT * 2 + 1), camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (selected && priorColor) (selected as THREE.Mesh | THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>).material && ((selected as THREE.Mesh).material as THREE.MeshStandardMaterial).color.copy(priorColor);
    selected = hit?.object;
    if (selected) {
      const material = (selected as THREE.Mesh).material as THREE.MeshStandardMaterial;
      priorColor = material.color.clone();
      material.color.set('#f1f1f1');
      selectedLabel.textContent = `Đã chọn: ${selected.userData.componentId}`;
    } else selectedLabel.textContent = 'Chưa chọn bộ phận.';
    render();
  });
  document.querySelector('#explode')!.addEventListener('click', () => {
    exploded = !exploded;
    let index = 0;
    for (const component of components.filter(item => !item.parent)) {
      const node = runtime.nodes[component.id];
      node.position.copy(baseline.get(component.id)!);
      if (exploded) {
        node.position.multiplyScalar(1.65);
        if (!(component.id.startsWith('tower-') || component.id === 'inner-projection-field')) node.position.x += (index++ % 2 ? -1 : 1) * 0.3;
      }
    }
    document.querySelector('#explode')!.setAttribute('aria-pressed', String(exploded));
    setView(exploded ? 'high' : 'reference');
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.textContent = 'WebGL đã mất context. Tải lại trang để khôi phục preview.';
  });

  const requestedView = new URLSearchParams(location.search).get('view');
  const allowedViews: ViewName[] = ['reference', 'front', 'right', 'rear', 'left', 'high'];
  setView(allowedViews.includes(requestedView as ViewName) ? requestedView as ViewName : 'reference');
  // Public capture data is read-only evidence; controls are surfaced as actual buttons.
  Object.assign(window, { __IMG2THREEJS_READY__: true, __IMG2THREEJS_VIEWER__: { renderer, model, camera }, __IMG2THREEJS_EVIDENCE__: evidence });
  window.addEventListener('pagehide', () => {
    controls.dispose();
    model.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    renderer.dispose();
  }, { once: true });
} catch (error) {
  status.setAttribute('role', 'alert');
  status.textContent = `Không khởi tạo được blockout: ${error instanceof Error ? error.message : 'Lỗi không xác định'}. Kiểm tra WebGL rồi tải lại trang.`;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) button.disabled = true;
  console.error(error);
}
