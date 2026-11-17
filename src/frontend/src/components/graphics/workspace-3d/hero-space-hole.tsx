import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { setNumberUniform } from '../../../graphics/workspace-3d/preview-scene-runtime'

// A separate screen-facing lens effect: a dark silhouette, thin photon ring,
// asymmetric accretion disk and a bent image of the disk above the horizon.
export function HeroSpaceHole({ mix, moving }: { mix: { value: number }; moving: boolean }) {
  const uniforms = useMemo(() => ({ uMix: mix, uTime: { value: 0 } }), [mix])
  useFrame((_, delta) => {
    if (moving) setNumberUniform(uniforms.uTime, uniforms.uTime.value + Math.min(delta, 0.05))
  })
  return <mesh>
    <planeGeometry args={[2.7, 1.8]} />
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={'varying vec2 p; void main(){ p=(uv-.5)*vec2(2.7,1.8); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }'}
      fragmentShader={`
        varying vec2 p; uniform float uMix, uTime;
        float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1,311.7)))*43758.5453); }
        void main(){
          // Tiến động rất chậm: đĩa nghiêng dần thay vì đứng yên như ảnh chụp.
          float drift=uTime*.045;
          vec2 q=mat2(cos(drift),-sin(drift),sin(drift),cos(drift))*mat2(.98,-.20,.20,.98)*p;
          float r=length(q), horizon=.255;
          float photon=exp(-pow((r-.278)/.012,2.));
          float halo=exp(-abs(r-.30)*11.)*.26;
          vec2 diskP=vec2(q.x,q.y/.24);
          float diskR=length(diskP), angle=atan(diskP.y,diskP.x);
          float disk=smoothstep(.30,.38,diskR)*(1.-smoothstep(.64,1.14,diskR));
          // Ba lớp nhiễu lệch pha, trôi theo thời gian: khí chảy thay vì nhấp nháy đều.
          float turbulence=.58
            +.16*sin(diskR*88.+angle*3.-uTime*1.25)
            +.10*sin(diskR*151.-angle*7.+uTime*.78)
            +.06*sin(diskR*263.+angle*11.+uTime*.42);
          // Doppler beaming: nửa quay về phía người xem sáng gắt hơn hẳn nửa kia.
          float beaming=.50+.50*smoothstep(-1.,1.,q.x);
          disk*=turbulence*beaming;
          // Doppler shift: nửa sáng ngả vàng, nửa lùi tối và ngả tím.
          float shift=smoothstep(-1.,1.,q.x);
          // Gravitationally bent far-side disk is distinct from the flat foreground disk.
          float bendR=length(vec2(q.x,q.y*.84));
          float arc=exp(-pow((bendR-.36)/.032,2.))*smoothstep(-.04,.12,q.y);
          // Sao nền bị hút về vành photon: vành sáng tự nó cũng là một thấu kính.
          vec2 starP=q*(1.+.55*exp(-abs(r-.30)*4.5));
          float stars=0.;
          for(int layer=0;layer<2;layer++){
            float scale=layer==0?12.:21.;
            vec2 cell=floor(starP*scale);
            vec2 local=fract(starP*scale)-.5;
            float present=step(.70,hash(cell+float(layer)*7.3));
            stars+=present*exp(-dot(local,local)*120.)*(layer==0?.55:.32);
          }
          stars*=smoothstep(horizon+.015,horizon+.08,r)*(1.-smoothstep(.85,1.3,r));
          stars*=.6+.4*sin(uTime*1.9+starP.x*3.);
          float glow=disk+arc*.72+photon*.95+halo;
          float hot=clamp(glow,0.,1.);
          // Vành trong nóng vàng, vành ngoài ngả hồng — cùng hệ ấm với vành photon hổ phách.
          float heat=clamp((.78-r)/.48,0.,1.);
          vec3 gold=mix(vec3(.96,.30,.52),vec3(1.,.83,.42),heat);
          vec3 deep=mix(vec3(.70,.14,.40),vec3(.95,.56,.12),heat);
          vec3 acc=mix(gold,deep,uMix);
          acc=mix(acc*vec3(.74,.68,.92),acc,shift);
          vec3 col=mix(acc,vec3(1.,.96,.88),hot*hot*.55);
          float alpha=clamp(hot*1.15,0.,1.);
          float shadow=1.-smoothstep(horizon-.008,horizon+.008,r);
          // Nền tối: nguồn sáng trắng, mép ấm dần; nền sáng: lõi đen tuyệt đối.
          vec3 source=mix(vec3(.99,1.,1.),vec3(1.,.90,.64),smoothstep(.10,horizon,r));
          col=mix(col,mix(source,vec3(.006,.004,.012),uMix),shadow);
          alpha=max(alpha,shadow);
          col+=stars*mix(vec3(.95,.80,.62),vec3(.42,.34,.30),uMix);
          alpha=max(alpha,stars*.85);
          col*=.94+.06*sin(uTime*2.2+r*7.);
          alpha*=1.-smoothstep(1.05,1.34,length(p));
          if(alpha<.012) discard;
          gl_FragColor=vec4(col,alpha);
        }`} />
  </mesh>
}
