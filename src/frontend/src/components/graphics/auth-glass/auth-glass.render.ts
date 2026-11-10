import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RefObject } from 'react'
import { HalfFloatType, UnsignedByteType, Vector2, Vector3, WebGLRenderTarget } from 'three'
import type { Group, Mesh, MeshPhysicalMaterial, WebGLRenderer } from 'three'
import { authGlassConfig } from '../../../graphics/auth-glass/auth-glass.config'
import { createAuthLensMaterial } from '../../../graphics/auth-glass/auth-glass.materials'

function createRenderResources(gl: WebGLRenderer) {
  // Three's WebGLRenderer requires WebGL 2.
  const context = gl.getContext() as WebGL2RenderingContext
  const halfFloat = gl.extensions.has('EXT_color_buffer_float')
  const type = halfFloat ? HalfFloatType : UnsignedByteType
  const colorFormat = halfFloat ? context.RGBA16F : context.RGBA8
  const supportedSamples = (format: number): Int32Array =>
    context.getInternalformatParameter(context.RENDERBUFFER, format, context.SAMPLES)
  const colorSamples = supportedSamples(colorFormat)
  const depthSamples = supportedSamples(context.DEPTH_COMPONENT24)
  const samples = [4, 2].find(count => colorSamples.includes(count) && depthSamples.includes(count)) ?? 0
  return {
    backdrop: new WebGLRenderTarget(1, 1, { type, samples }),
    behindGlass: new WebGLRenderTarget(1, 1, { type, samples }),
    loginLens: createAuthLensMaterial(),
    registerLens: createAuthLensMaterial(),
    size: new Vector2(),
    eye: new Vector3(),
  }
}

export function useAuthGlassRender(fallback: MeshPhysicalMaterial, low: boolean, dragLight?: RefObject<Vector2>, debug = 0, thickness?: number) {
  const invalidate = useThree(state => state.invalidate)
  const gl = useThree(state => state.gl)
  const assembly = useRef<Group>(null)
  const loginGroup = useRef<Group>(null)
  const registerGroup = useRef<Group>(null)
  const loginMesh = useRef<Mesh>(null)
  const registerMesh = useRef<Mesh>(null)
  const pipeline = useRef<ReturnType<typeof createRenderResources>>(null)
  const lensFailed = useRef(false)

  useEffect(() => {
    if (low) return
    const resources = createRenderResources(gl)
    lensFailed.current = false
    pipeline.current = resources
    invalidate()
    return () => {
      pipeline.current = null
      resources.backdrop.dispose()
      resources.behindGlass.dispose()
      resources.loginLens.dispose()
      resources.registerLens.dispose()
    }
  }, [gl, invalidate, low])

  useEffect(() => {
    const resources = pipeline.current
    if (!resources) return
    const { loginLens, registerLens } = resources
    loginLens.uniforms.uDebug.value = registerLens.uniforms.uDebug.value = debug
    loginLens.uniforms.uThickness.value = registerLens.uniforms.uThickness.value = thickness ?? authGlassConfig.glass.thicknessPixels
    invalidate()
  }, [debug, invalidate, low, thickness])

  useFrame(({ gl, scene, camera, size: layout }) => {
    const root = assembly.current
    const login = loginGroup.current
    const register = registerGroup.current
    const loginBody = loginMesh.current
    const registerBody = registerMesh.current
    if (!root || !login || !register || !loginBody || !registerBody) {
      gl.render(scene, camera)
      return
    }

    function renderFallback() {
      if (loginBody) loginBody.material = fallback
      if (registerBody) registerBody.material = fallback
      gl.render(scene, camera)
    }

    const resources = pipeline.current
    if (!resources || lensFailed.current) {
      renderFallback()
      return
    }

    const { backdrop, behindGlass, loginLens, registerLens, size, eye } = resources
    const light = dragLight?.current
    const uvX = 1 / Math.max(layout.width, 1)
    const uvY = 1 / Math.max(layout.height, 1)
    loginLens.uniforms.uUvPerPixel.value.set(uvX, uvY)
    registerLens.uniforms.uUvPerPixel.value.set(uvX, uvY)
    loginLens.uniforms.uLightDir.value.set(-0.6 + (light?.x ?? 0) * 0.65, 0.8 + (light?.y ?? 0) * 0.35)
    registerLens.uniforms.uLightDir.value.copy(loginLens.uniforms.uLightDir.value)
    loginBody.material = loginLens
    registerBody.material = registerLens
    gl.getDrawingBufferSize(size)
    const scale = authGlassConfig.glass.targetScale
    const width = Math.max(1, Math.round(size.x * scale))
    const height = Math.max(1, Math.round(size.y * scale))
    backdrop.setSize(width, height)
    behindGlass.setSize(width, height)

    // The seam plane separates the two closed slabs. If a ray crosses both,
    // the slab on the camera's side of that plane is the first one it hits.
    root.worldToLocal(camera.getWorldPosition(eye))
    const registerNear = eye.x > 0
    const near = registerNear ? register : login
    const far = registerNear ? login : register
    const nearLens = registerNear ? registerLens : loginLens
    const farLens = registerNear ? loginLens : registerLens
    const previousTarget = gl.getRenderTarget()
    const previousShaderHandler = gl.debug.onShaderError

    gl.debug.onShaderError = (...args) => {
      lensFailed.current = true
      previousShaderHandler?.(...args)
    }
    try {
      near.visible = false
      far.visible = false
      gl.setRenderTarget(backdrop)
      gl.render(scene, camera)

      far.visible = true
      farLens.uniforms.tBackdrop.value = backdrop.texture
      farLens.uniforms.uViewport.value.set(width, height)
      gl.setRenderTarget(behindGlass)
      gl.render(scene, camera)

      near.visible = true
      nearLens.uniforms.tBackdrop.value = behindGlass.texture
      nearLens.uniforms.uViewport.value.copy(size)
      farLens.uniforms.uViewport.value.copy(size)
    } catch {
      lensFailed.current = true
    } finally {
      near.visible = true
      far.visible = true
      gl.setRenderTarget(previousTarget)
      gl.debug.onShaderError = previousShaderHandler
    }

    if (lensFailed.current) {
      console.warn('Auth glass: using the physical material after a refraction pass failed.')
      renderFallback()
    } else {
      gl.render(scene, camera)
    }
  }, 1)

  return { assembly, loginGroup, registerGroup, loginMesh, registerMesh }
}
