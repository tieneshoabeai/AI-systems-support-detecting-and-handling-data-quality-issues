import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import spec from '../object-sculpt-spec.json';
import { createLayeredHolographicDataCoreModel, type ProceduralModelRuntime } from './generated-core';

const WIDTH = 468;
const HEIGHT = 360;
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const evidencePanel = document.querySelector<HTMLPreElement>('#evidence')!;
const selectedLabel = document.querySelector<HTMLParagraphElement>('#selected')!;
const components = spec.componentTree;
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
  scene.background = new THREE.Color('#10151f');
  const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.minDistance = 3;
  controls.maxDistance = 40;
  scene.add(new THREE.AmbientLight('#ffffff', 0.9));
  const key = new THREE.DirectionalLight('#ffffff', 2.8);
  key.position.set(3, 5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight('#ffffff', 0.65);
  fill.position.set(-4, 1, -3);
  scene.add(fill);

  const model = createLayeredHolographicDataCoreModel({ castShadow: false, receiveShadow: false });
  scene.add(model);
  const runtime = model.userData.sculptRuntime as ProceduralModelRuntime;
  const pickables: THREE.Object3D[] = [];
  const baseline = new Map<string, THREE.Vector3>();
  const neutral = new THREE.MeshStandardMaterial({ color: '#9ca3ad', roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: '#adb4bf' });
  const frameMaterial = new THREE.LineBasicMaterial({ color: '#929daa' });
  let currentView: ViewName = 'reference';
  let exploded = false;
  let selected: THREE.Object3D | undefined;
  let priorColor: THREE.Color | undefined;

  // Adapt generated carriers, preserving pivots, IDs and authored dimensions.
  // Frames remain genuine 3D edge cages rather than opaque boxes or flat cards.
  for (const component of components) {
    const mesh = runtime.meshes[component.id];
    const node = runtime.nodes[component.id];
    if (!mesh || !node) throw new Error(`Thiếu bộ phận được đặc tả: ${component.id}`);
    baseline.set(component.id, node.position.clone());
    mesh.material = neutral.clone();
    mesh.userData.componentId = component.id;
    mesh.userData.explodeWithParent = true;
    if (component.id.startsWith('frame-')) {
      mesh.visible = false;
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), frameMaterial.clone());
      edges.name = `${component.id}.edge-cage`;
      edges.position.copy(mesh.position);
      edges.quaternion.copy(mesh.quaternion);
      edges.userData.componentId = component.id;
      edges.userData.explodeWithParent = true;
      node.add(edges);
      pickables.push(edges);
    } else {
      pickables.push(mesh);
      if (component.id !== 'lower-node') {
        const rim = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMaterial);
        rim.name = `${component.id}.neutral-contours`;
        rim.userData.componentId = component.id;
        rim.userData.explodeWithParent = true;
        mesh.add(rim);
      }
    }
  }
  model.updateMatrixWorld(true);

  function render() { renderer.render(scene, camera); }

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
      return {
        name: component.id, componentId: component.id, kind: 'part', module: component.id,
        representation: component.id.startsWith('frame-') ? '3D-edge-cage' : 'neutral-carrier',
        triangles: component.id.startsWith('frame-') ? 0 : (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
        dimensions: size.toArray(), measuredWorldCenter: center.toArray(),
        intendedDimensions: [component.dimensions.width, component.dimensions.height, component.dimensions.depth],
        parentComponent: component.parent,
      };
    });
    const result = {
      model: spec.targetId, pass: 'blockout', materialMode: 'neutral-map-stripped',
      camera: cameraEvidence(), exploded, autoRotate: false, animationLoop: false,
      renderer: { revision: THREE.REVISION, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, lines: renderer.info.render.lines, bloom: false, shadows: false },
      parts, unnamedMeshes: 0, integralMeshes: pickables.length,
      measuredPositions: Object.fromEntries(parts.map(part => [part.componentId, part.measuredWorldCenter])),
      deferredDetails: ['colored volume density', 'technical surface grids', 'violet arc brightness', 'localized emission'],
      visibleComponentCount: pickables.length,
    };
    if (!includeGeometry) return result;
    const meshes = components.filter(component => !component.id.startsWith('frame-')).map(component => {
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
    return { ...result, meshes, meshScope: '9 closed carrier surfaces; 5 open edge cages excluded from closed-surface self-intersection analysis' };
  }

  function refreshEvidence() {
    render();
    evidencePanel.textContent = JSON.stringify(evidence(), null, 2);
    status.textContent = `Sẵn sàng · ${pickables.length}/14 bộ phận · ${renderer.info.render.triangles.toLocaleString()} tam giác · ${currentView} · không animation/bloom`;
  }

  const referenceTarget = new THREE.Vector3(0, -0.35, 0);
  const targetBounds = { x: 18, y: 12, width: 415, height: 322 };
  let referencePosition = new THREE.Vector3();
  let fittedTarget = referenceTarget.clone();

  // Bounded numeric framing, not a visual-fidelity score or source-camera calibration.
  // Elevation is proposed from the source's projected orbital ellipse (~0.41 ratio).
  function prepareReferenceCamera() {
    const azimuth = Math.atan2(5, 8);
    const elevation = THREE.MathUtils.degToRad(24);
    const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    let distance = 9.8;
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
  }
  prepareReferenceCamera();

  function setView(view: ViewName) {
    currentView = view;
    controls.target.copy(fittedTarget);
    if (view === 'reference') camera.position.copy(referencePosition);
    else {
      const azimuth = { front: 0, right: 90, rear: 180, left: 270, high: 32 }[view];
      const elevation = view === 'high' ? 60 : 24;
      const az = THREE.MathUtils.degToRad(azimuth), el = THREE.MathUtils.degToRad(elevation);
      const distance = referencePosition.distanceTo(fittedTarget) * (exploded ? 1.75 : 1);
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
        if (!component.id.startsWith('frame-')) node.position.x += (index++ % 2 ? -1 : 1) * 0.3;
      }
    }
    document.querySelector('#explode')!.setAttribute('aria-pressed', String(exploded));
    setView(exploded ? 'high' : 'reference');
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.textContent = 'WebGL đã mất context. Tải lại trang để khôi phục preview.';
  });

  setView('reference');
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
