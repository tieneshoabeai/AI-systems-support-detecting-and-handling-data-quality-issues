import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

// A separate screen-facing lens effect: a dark silhouette, thin photon ring,
// asymmetric accretion disk and a bent image of the disk above the horizon.
export function HeroSpaceHole({ mix, moving }: { mix: { value: number }; moving: boolean }) {
  const uniforms = useMemo(() => ({ uMix: mix, uTime: { value: 0 } }), [mix])
  useFrame((_, delta) => { if (moving) uniforms.uTime.value += Math.min(delta, 0.05) })
  return <mesh>
    <planeGeometry args={[2.7, 1.8]} />
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`varying vec2 p; void main(){ p=(uv-.5)*vec2(2.7,1.8); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`}
      fragmentShader={`
        varying vec2 p; uniform float uMix, uTime;
        void main(){
          vec2 q=mat2(.98,-.20,.20,.98)*p;
          float r=length(q), horizon=.255;
          float photon=exp(-pow((r-.278)/.014,2.));
          float halo=exp(-abs(r-.30)*12.)*.28;
          vec2 diskP=vec2(q.x,q.y/.24);
          float diskR=length(diskP), angle=atan(diskP.y,diskP.x);
          float disk=smoothstep(.30,.38,diskR)*(1.-smoothstep(.64,1.14,diskR));
          float turbulence=.62+.18*sin(diskR*90.+angle*3.-uTime*1.3)+.12*sin(diskR*157.-angle*7.+uTime*.8);
          float beaming=.62+.38*smoothstep(-1.,1.,q.x);
          disk*=turbulence*beaming;
          // Gravitationally bent far-side disk is distinct from the flat foreground disk.
          float bendR=length(vec2(q.x,q.y*.84));
          float arc=exp(-pow((bendR-.36)/.035,2.))*smoothstep(-.04,.12,q.y);
          float glow=disk+arc*.75+photon*.95+halo;
          float shadow=1.-smoothstep(horizon-.008,horizon+.008,r);
          vec3 warm=mix(vec3(1.,.31,.07),vec3(1.,.88,.53),clamp(glow,0.,1.));
          vec3 cool=mix(vec3(.25,.66,1.),vec3(.95,.99,1.),clamp(glow,0.,1.));
          vec3 col=mix(cool,warm,uMix);
          float alpha=clamp(glow,0.,1.);
          // Light mode is a true black centre; dark mode is a luminous white source.
          col=mix(col,mix(vec3(.97,.99,1.),vec3(.006,.004,.012),uMix),shadow);
          alpha=max(alpha,shadow);
          alpha*=1.-smoothstep(1.05,1.34,length(p));
          if(alpha<.012) discard;
          gl_FragColor=vec4(col,alpha);
        }`} />
  </mesh>
}
