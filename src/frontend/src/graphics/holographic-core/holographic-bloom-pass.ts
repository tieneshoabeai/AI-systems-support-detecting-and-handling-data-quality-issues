import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three'
import type { WebGLRenderer } from 'three'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'

// Preserve UnrealBloomPass's former direct-to-screen appearance:
// output-transform the base first, then add bloom without tone-mapping it again.
// Producing that same image in a buffer lets Project glass sample it unchanged.
export class HolographicBloomPass extends UnrealBloomPass {
  private readonly base = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  private readonly baseOutput = new OutputPass()
  private readonly composite = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tBloom: { value: null } },
    vertexShader: CopyShader.vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tBloom;
      varying vec2 vUv;
      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec3 bloom = texture2D(tBloom, vUv).rgb;
        gl_FragColor = vec4(base.rgb + bloom, base.a);
      }
    `,
  })

  constructor(resolution: Vector2, strength: number, radius: number, threshold: number) {
    super(resolution, strength, radius, threshold)
    this.needsSwap = true
  }

  override render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    this.base.setSize(readBuffer.width, readBuffer.height)
    this.baseOutput.render(renderer, this.base, readBuffer, deltaTime, maskActive)
    const toScreen = this.renderToScreen
    try {
      this.renderToScreen = false
      super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)
    } finally { this.renderToScreen = toScreen }
    this.composite.uniforms.tBloom.value = this.renderTargetsHorizontal[0].texture
    this.composite.renderToScreen = toScreen
    this.composite.render(renderer, writeBuffer, this.base, deltaTime, maskActive)
  }

  override dispose() {
    super.dispose()
    this.base.dispose()
    this.baseOutput.dispose()
    this.composite.dispose()
  }
}
