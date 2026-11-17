import{a as e,c as t,d as n,i as r}from"./index-BlexVsjK.js";import{t as i}from"./required-value-DcwRrTKb.js";import{m as a,n as o,r as s,t as c}from"./react-three-fiber.esm-Bf-eOBUg.js";import{i as l,r as u,t as d}from"./preview-scene-runtime-BsxrKPE3.js";var ee=e(),f=n(t(),1),p=r();function m(e){let t=(0,ee.c)(9),{mix:n,moving:r}=e,i;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(i={value:0},t[0]=i):i=t[0];let a;t[1]===n?a=t[2]:(a={uMix:n,uTime:i},t[1]=n,t[2]=a);let s=a,c;t[3]!==r||t[4]!==s?(c=(e,t)=>{r&&d(s.uTime,s.uTime.value+Math.min(t,.05))},t[3]=r,t[4]=s,t[5]=c):c=t[5],o(c);let l;t[6]===Symbol.for(`react.memo_cache_sentinel`)?(l=(0,p.jsx)(`planeGeometry`,{args:[2.7,1.8]}),t[6]=l):l=t[6];let u;return t[7]===s?u=t[8]:(u=(0,p.jsxs)(`mesh`,{children:[l,(0,p.jsx)(`shaderMaterial`,{transparent:!0,depthWrite:!1,uniforms:s,vertexShader:`varying vec2 p; void main(){ p=(uv-.5)*vec2(2.7,1.8); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,fragmentShader:`
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
        }`})]}),t[7]=s,t[8]=u),u}var h=class extends f.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}render(){return this.state.failed?this.props.fallback:this.props.children}},g=[{orbit:1.5,size:.105,speed:.42,phase:.4,tilt:[.5,.15,.2],bands:.35,bandScale:3.4,seed:1.7,dark:{a:`#0b4b45`,b:`#5eead4`,rim:`#a5fff2`},light:{a:`#115e59`,b:`#5eead4`,rim:`#2dd4bf`}},{orbit:1.82,size:.17,speed:.28,phase:2.3,tilt:[1.05,-.3,.7],bands:.7,bandScale:4.2,seed:2.9,dark:{a:`#3b1f86`,b:`#c4b5fd`,rim:`#ede9fe`},light:{a:`#5b21b6`,b:`#c4b5fd`,rim:`#8b5cf6`},ring:{dark:`#c4b5fd`,light:`#7c3aed`}},{orbit:2.05,size:.12,speed:-.22,phase:4.1,tilt:[.35,.55,-.5],bands:.22,bandScale:3,seed:4.4,dark:{a:`#7c3f07`,b:`#fcd34d`,rim:`#fef3c7`},light:{a:`#92400e`,b:`#fbbf24`,rim:`#f59e0b`}},{orbit:2.3,size:.19,speed:.18,phase:1.2,tilt:[.8,-.65,.1],bands:.55,bandScale:3.8,seed:5.6,dark:{a:`#123a7d`,b:`#7dd3fc`,rim:`#e0f2fe`},light:{a:`#1e3a8a`,b:`#60a5fa`,rim:`#38bdf8`},ring:{dark:`#7dd3fc`,light:`#2563eb`}},{orbit:1.95,size:.085,speed:-.32,phase:5.5,tilt:[-.55,.4,1.1],bands:.18,bandScale:3.2,seed:.8,dark:{a:`#7a1f4c`,b:`#f9a8d4`,rim:`#fce7f3`},light:{a:`#831843`,b:`#f472b6`,rim:`#db2777`}},{orbit:2.52,size:.14,speed:.14,phase:3.3,tilt:[.62,.28,-.42],bands:.6,bandScale:4,seed:6.2,dark:{a:`#0c4f38`,b:`#6ee7b7`,rim:`#d1fae5`},light:{a:`#064e3b`,b:`#34d399`,rim:`#10b981`},ring:{dark:`#6ee7b7`,light:`#047857`}},{orbit:1.63,size:.07,speed:-.46,phase:.9,tilt:[-.2,.9,.35],bands:.1,bandScale:2.8,seed:7.3,dark:{a:`#6b4a06`,b:`#fde68a`,rim:`#fffbeb`},light:{a:`#78350f`,b:`#fcd34d`,rim:`#d97706`}},{orbit:2.68,size:.095,speed:-.1,phase:5,tilt:[1.25,.1,.55],bands:.3,bandScale:3.6,seed:3.7,dark:{a:`#3f2378`,b:`#d8b4fe`,rim:`#f5f3ff`},light:{a:`#4c1d95`,b:`#c084fc`,rim:`#a855f7`}},{orbit:2.18,size:.15,speed:.21,phase:2,tilt:[-.9,-.35,-.15],bands:.5,bandScale:4.4,seed:8.1,dark:{a:`#7c2626`,b:`#fca5a5`,rim:`#fee2e2`},light:{a:`#7f1d1d`,b:`#f87171`,rim:`#ef4444`},ring:{dark:`#fca5a5`,light:`#b91c1c`}}],_=[{spec:{size:.2,bands:.2,bandScale:3.1,seed:2.4,dark:{a:`#0f3b5c`,b:`#93c5fd`,rim:`#dbeafe`},light:{a:`#1e40af`,b:`#93c5fd`,rim:`#60a5fa`},ring:{dark:`#bfdbfe`,light:`#3b82f6`}},position:[-1.62,1.02,.2],scale:.95},{spec:{size:.16,bands:.4,bandScale:3.6,seed:5.1,dark:{a:`#3b1f86`,b:`#d8b4fe`,rim:`#f3e8ff`},light:{a:`#5b21b6`,b:`#c4b5fd`,rim:`#8b5cf6`}},position:[1.55,.62,-.1],scale:.8},{spec:{size:.13,bands:.15,bandScale:2.9,seed:3.3,dark:{a:`#7c3f07`,b:`#fcd34d`,rim:`#fef3c7`},light:{a:`#92400e`,b:`#fbbf24`,rim:`#f59e0b`}},position:[-.9,-1.42,.3],scale:.75},{spec:{size:.18,bands:.45,bandScale:3.9,seed:6.8,dark:{a:`#0c4f38`,b:`#86efac`,rim:`#dcfce7`},light:{a:`#065f46`,b:`#4ade80`,rim:`#22c55e`},ring:{dark:`#86efac`,light:`#15803d`}},position:[1.72,-.92,.1],scale:.85}],v=`
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`,y=`
  uniform float uMix;
  uniform vec3 uDarkA, uDarkB, uDarkRim, uLightA, uLightB, uLightRim;
  uniform float uBands, uBandScale, uSeed;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;

  void main() {
    vec3 baseA = mix(uDarkA, uLightA, uMix);
    vec3 baseB = mix(uDarkB, uLightB, uMix);
    vec3 rim = mix(uDarkRim, uLightRim, uMix);
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    vec3 lightDir = normalize(vec3(-0.42, 0.5, 0.76));
    float lit = smoothstep(-0.28, 0.85, dot(n, lightDir));
    float band = sin((p.y * uBandScale + sin(p.x * 2.6 + uSeed) * 0.18 + sin(p.z * 2.1 + uSeed * 1.7) * 0.14) * 6.2831853);
    float grain = sin(p.x * 21.0 + uSeed * 4.0) * sin(p.y * 17.0 - uSeed * 2.0) * sin(p.z * 19.0 + uSeed);
    float tone = clamp(0.5 + band * 0.5 * uBands + grain * 0.05, 0.0, 1.0);
    vec3 surface = mix(baseA, baseB, tone);
    vec3 color = surface * (0.44 + 0.68 * lit);
    color = mix(color * vec3(0.8, 0.87, 1.2), color, lit);
    vec3 halfV = normalize(lightDir + normalize(vView));
    color += vec3(1.0, 0.99, 0.95) * pow(max(dot(n, halfV), 0.0), 40.0) * 0.3;
    float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 2.8);
    color += rim * fres * (0.14 + 0.6 * lit);
    gl_FragColor = vec4(color, 1.0);
  }`,b=`
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }`,x=`
  uniform float uMix;
  uniform float uAlpha;
  uniform vec3 uDark, uLight;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 3.0);
    gl_FragColor = vec4(mix(uDark, uLight, uMix), fres * uAlpha);
  }`,S=`
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,C=`
  uniform float uMix, uSeed, uInner, uOuter;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float edge = smoothstep(uInner, uInner + 0.012, r) * (1.0 - smoothstep(uOuter - 0.014, uOuter, r));
    float strata = 0.6 + 0.4 * sin(r * 190.0 + uSeed);
    float lightFall = 0.55 + 0.45 * sin(atan(vLocal.y, vLocal.x) + 1.1);
    float alpha = edge * strata * lightFall * 0.82;
    vec3 color = mix(mix(uDarkA, uDarkB, strata), mix(uLightA, uLightB, strata), uMix);
    gl_FragColor = vec4(color, alpha);
  }`,w=`
  uniform float uMix, uPhase;
  uniform vec3 uDark, uLight;
  varying vec2 vLocal;
  void main() {
    float angle = atan(vLocal.y, vLocal.x);
    float trail = 0.5 + 0.5 * sin(angle + uPhase);
    float baseAlpha = mix(0.34, 0.46, uMix);
    float alpha = (0.14 + 0.6 * pow(trail, 2.6)) * baseAlpha;
    gl_FragColor = vec4(mix(uDark, uLight, uMix), alpha);
  }`,T=`
  uniform float uMix, uSeed;
  uniform vec3 uDarkA, uDarkB, uDarkRim, uLightA, uLightB, uLightRim;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;

  void main() {
    vec3 baseA = mix(uDarkA, uLightA, uMix);
    vec3 baseB = mix(uDarkB, uLightB, uMix);
    vec3 rim = mix(uDarkRim, uLightRim, uMix);
    vec3 n = normalize(vNormal);
    vec3 p = normalize(vPos);
    vec3 lightDir = normalize(vec3(-0.46, 0.42, 0.78));
    float lit = smoothstep(-0.32, 0.9, dot(n, lightDir));
    float surfacePattern = sin(p.x * 3.3 + uSeed) * sin(p.y * 4.1 - uSeed * 0.8) * sin(p.z * 3.7 + uSeed * 1.6);
    float land = smoothstep(0.0, 0.55, surfacePattern);
    vec3 surface = mix(mix(baseA, baseB, smoothstep(-0.9, 0.9, p.y)), baseB * 1.15, land * 0.5);
    vec3 color = surface * (0.52 + 0.56 * lit);
    color = mix(color * vec3(0.78, 0.86, 1.24), color, lit);
    vec3 halfV = normalize(lightDir + normalize(vView));
    color += vec3(0.9, 0.98, 1.0) * pow(max(dot(n, halfV), 0.0), 26.0) * 0.45;
    float fres = pow(1.0 - clamp(dot(n, normalize(vView)), 0.0, 1.0), 2.2);
    color += rim * fres * (0.3 + 0.8 * lit);
    gl_FragColor = vec4(color, 1.0);
  }`,E=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,D=`
  uniform float uMix;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float glow = exp(-d * d * 5.0) * 0.75 + exp(-pow((d - 0.52) * 5.4, 2.0)) * 0.3;
    float alpha = glow * mix(0.62, 0.3, uMix);
    vec3 color = mix(mix(uDarkA, uDarkB, smoothstep(0.1, 0.9, d)), mix(uLightA, uLightB, smoothstep(0.1, 0.9, d)), uMix);
    gl_FragColor = vec4(color, alpha);
  }`,O=`
  uniform float uMix, uAlpha;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d1 = length((p - vec2(-0.18, 0.08)) * vec2(0.9, 1.25));
    float d2 = length((p - vec2(0.26, -0.16)) * vec2(1.3, 0.9));
    float blob = exp(-d1 * d1 * 4.2) + 0.65 * exp(-d2 * d2 * 6.5);
    float alpha = blob * uAlpha;
    if (alpha < 0.004) discard;
    vec3 color = mix(mix(uDarkA, uDarkB, smoothstep(0.0, 1.0, d1)), mix(uLightA, uLightB, smoothstep(0.0, 1.0, d1)), uMix);
    gl_FragColor = vec4(color, alpha);
  }`,k=`
  uniform float uMix;
  uniform vec3 uDarkIn, uDarkOut, uLightIn, uLightOut;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0), 1.35);
    vec3 color = mix(mix(uDarkIn, uDarkOut, fres), mix(uLightIn, uLightOut, fres), uMix);
    gl_FragColor = vec4(color, 1.0);
  }`,A=`
  uniform float uMix, uPhase, uSegments, uPower, uAlpha;
  uniform vec3 uDarkA, uDarkB, uLightA, uLightB;
  varying vec2 vLocal;
  void main() {
    float angle = atan(vLocal.y, vLocal.x);
    float arc = pow(0.5 + 0.5 * sin(angle * uSegments + uPhase), uPower);
    vec3 color = mix(mix(uDarkA, uDarkB, arc), mix(uLightA, uLightB, arc), uMix);
    gl_FragColor = vec4(color, arc * uAlpha);
  }`,j=`
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`,M=`
  uniform float uMix, uAlpha;
  uniform vec3 uDark, uLight;
  void main() {
    gl_FragColor = vec4(mix(uDark, uLight, uMix), uAlpha);
  }`,N=`
  attribute float size;
  uniform float ratio;
  varying float phase;
  void main() {
    phase = position.x * 2.7 + position.y * 3.1;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * ratio;
  }`,P=`
  uniform float time, uMix;
  uniform vec3 uDark, uLight;
  varying float phase;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = exp(-d * d * 150.0);
    float halo = exp(-d * d * 18.0) * 0.4;
    float rays = (exp(-abs(p.x) * 90.0) + exp(-abs(p.y) * 90.0)) * max(0.0, 1.0 - d * 2.0) * 0.2;
    float alpha = (core + halo + rays) * (0.7 + 0.3 * sin(time * 0.8 + phase));
    alpha *= mix(1.0, 0.72, uMix);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(mix(uDark, uLight, uMix), min(alpha, 1.0));
  }`;function te(e,t){let n=(0,ee.c)(12),r;n[0]===e?r=n[1]:(r=()=>({value:+!!e}),n[0]=e,n[1]=r);let[i]=(0,f.useState)(r),{invalidate:a}=s(),c;n[2]!==a||n[3]!==e||n[4]!==i?(c=(t,n)=>{let r=+!!e,o=Math.min(n,.05),s=i.value+(r-i.value)*(1-Math.exp(-o*4.5));Math.abs(r-s)<.002?i.value!==r&&(d(i,r),a()):d(i,s)},n[2]=a,n[3]=e,n[4]=i,n[5]=c):c=n[5],o(c);let l,u;return n[6]!==a||n[7]!==e||n[8]!==i||n[9]!==t?(l=()=>{t||(d(i,+!!e),a())},u=[e,t,i,a],n[6]=a,n[7]=e,n[8]=i,n[9]=t,n[10]=l,n[11]=u):(l=n[10],u=n[11]),(0,f.useEffect)(l,u),i}function F(e){let t=(0,ee.c)(26),{radius:n,tilt:r,dark:i,light:o,phase:s,mix:c}=e,l;t[0]===i?l=t[1]:(l=new a(i),t[0]=i,t[1]=l);let u;t[2]===l?u=t[3]:(u={value:l},t[2]=l,t[3]=u);let d;t[4]===o?d=t[5]:(d=new a(o),t[4]=o,t[5]=d);let f;t[6]===d?f=t[7]:(f={value:d},t[6]=d,t[7]=f);let m;t[8]===s?m=t[9]:(m={value:s},t[8]=s,t[9]=m);let h;t[10]!==c||t[11]!==u||t[12]!==f||t[13]!==m?(h={uMix:c,uDark:u,uLight:f,uPhase:m},t[10]=c,t[11]=u,t[12]=f,t[13]=m,t[14]=h):h=t[14];let g=h,_;t[15]===r?_=t[16]:(_=r??[0,0,0],t[15]=r,t[16]=_);let v=n-.006,y=n+.006,b;t[17]!==v||t[18]!==y?(b=(0,p.jsx)(`ringGeometry`,{args:[v,y,180]}),t[17]=v,t[18]=y,t[19]=b):b=t[19];let x;t[20]===g?x=t[21]:(x=(0,p.jsx)(`shaderMaterial`,{uniforms:g,vertexShader:S,fragmentShader:w,transparent:!0,depthWrite:!1,side:2}),t[20]=g,t[21]=x);let C;return t[22]!==b||t[23]!==x||t[24]!==_?(C=(0,p.jsxs)(`mesh`,{rotation:_,children:[b,x]}),t[22]=b,t[23]=x,t[24]=_,t[25]=C):C=t[25],C}function I(e){let t=(0,ee.c)(83),{planet:n,mix:r}=e,i;t[0]===n.dark.a?i=t[1]:(i=new a(n.dark.a),t[0]=n.dark.a,t[1]=i);let o;t[2]===i?o=t[3]:(o={value:i},t[2]=i,t[3]=o);let s;t[4]===n.dark.b?s=t[5]:(s=new a(n.dark.b),t[4]=n.dark.b,t[5]=s);let c;t[6]===s?c=t[7]:(c={value:s},t[6]=s,t[7]=c);let l;t[8]===n.dark.rim?l=t[9]:(l=new a(n.dark.rim),t[8]=n.dark.rim,t[9]=l);let u;t[10]===l?u=t[11]:(u={value:l},t[10]=l,t[11]=u);let d;t[12]===n.light.a?d=t[13]:(d=new a(n.light.a),t[12]=n.light.a,t[13]=d);let f;t[14]===d?f=t[15]:(f={value:d},t[14]=d,t[15]=f);let m;t[16]===n.light.b?m=t[17]:(m=new a(n.light.b),t[16]=n.light.b,t[17]=m);let h;t[18]===m?h=t[19]:(h={value:m},t[18]=m,t[19]=h);let g;t[20]===n.light.rim?g=t[21]:(g=new a(n.light.rim),t[20]=n.light.rim,t[21]=g);let _;t[22]===g?_=t[23]:(_={value:g},t[22]=g,t[23]=_);let w;t[24]===n.bands?w=t[25]:(w={value:n.bands},t[24]=n.bands,t[25]=w);let T;t[26]===n.bandScale?T=t[27]:(T={value:n.bandScale},t[26]=n.bandScale,t[27]=T);let E;t[28]===n.seed?E=t[29]:(E={value:n.seed},t[28]=n.seed,t[29]=E);let D;t[30]!==r||t[31]!==h||t[32]!==_||t[33]!==w||t[34]!==T||t[35]!==E||t[36]!==o||t[37]!==c||t[38]!==u||t[39]!==f?(D={uMix:r,uDarkA:o,uDarkB:c,uDarkRim:u,uLightA:f,uLightB:h,uLightRim:_,uBands:w,uBandScale:T,uSeed:E},t[30]=r,t[31]=h,t[32]=_,t[33]=w,t[34]=T,t[35]=E,t[36]=o,t[37]=c,t[38]=u,t[39]=f,t[40]=D):D=t[40];let O=D,k;t[41]===n.dark.rim?k=t[42]:(k=new a(n.dark.rim),t[41]=n.dark.rim,t[42]=k);let A;t[43]===k?A=t[44]:(A={value:k},t[43]=k,t[44]=A);let j;t[45]===n.light.rim?j=t[46]:(j=new a(n.light.rim),t[45]=n.light.rim,t[46]=j);let M;t[47]===j?M=t[48]:(M={value:j},t[47]=j,t[48]=M);let N;t[49]===Symbol.for(`react.memo_cache_sentinel`)?(N={value:.5},t[49]=N):N=t[49];let P;t[50]!==r||t[51]!==A||t[52]!==M?(P={uMix:r,uDark:A,uLight:M,uAlpha:N},t[50]=r,t[51]=A,t[52]=M,t[53]=P):P=t[53];let te=P,F;t[54]!==r||t[55]!==n.dark.rim||t[56]!==n.light.rim||t[57]!==n.ring||t[58]!==n.seed||t[59]!==n.size?(F=n.ring?{uMix:r,uDarkA:{value:new a(n.ring.dark)},uDarkB:{value:new a(n.dark.rim)},uLightA:{value:new a(n.ring.light)},uLightB:{value:new a(n.light.rim)},uSeed:{value:n.seed*3.1},uInner:{value:n.size*1.5},uOuter:{value:n.size*2.05}}:null,t[54]=r,t[55]=n.dark.rim,t[56]=n.light.rim,t[57]=n.ring,t[58]=n.seed,t[59]=n.size,t[60]=F):F=t[60];let I=F,L;t[61]===n.size?L=t[62]:(L=(0,p.jsx)(`sphereGeometry`,{args:[n.size,32,22]}),t[61]=n.size,t[62]=L);let R;t[63]===O?R=t[64]:(R=(0,p.jsx)(`shaderMaterial`,{uniforms:O,vertexShader:v,fragmentShader:y}),t[63]=O,t[64]=R);let z;t[65]!==L||t[66]!==R?(z=(0,p.jsxs)(`mesh`,{children:[L,R]}),t[65]=L,t[66]=R,t[67]=z):z=t[67];let B;t[68]===n.size?B=t[69]:(B=(0,p.jsx)(`sphereGeometry`,{args:[n.size,20,14]}),t[68]=n.size,t[69]=B);let V;t[70]===te?V=t[71]:(V=(0,p.jsx)(`shaderMaterial`,{uniforms:te,vertexShader:b,fragmentShader:x,transparent:!0,depthWrite:!1,blending:2}),t[70]=te,t[71]=V);let H;t[72]!==B||t[73]!==V?(H=(0,p.jsxs)(`mesh`,{scale:1.25,children:[B,V]}),t[72]=B,t[73]=V,t[74]=H):H=t[74];let U;t[75]!==n.ring||t[76]!==n.size||t[77]!==I?(U=n.ring&&I&&(0,p.jsxs)(`mesh`,{rotation:[-Math.PI/2,0,0],children:[(0,p.jsx)(`ringGeometry`,{args:[n.size*1.5,n.size*2.05,96]}),(0,p.jsx)(`shaderMaterial`,{uniforms:I,vertexShader:S,fragmentShader:C,transparent:!0,depthWrite:!1,side:2})]}),t[75]=n.ring,t[76]=n.size,t[77]=I,t[78]=U):U=t[78];let W;return t[79]!==z||t[80]!==H||t[81]!==U?(W=(0,p.jsxs)(p.Fragment,{children:[z,H,U]}),t[79]=z,t[80]=H,t[81]=U,t[82]=W):W=t[82],W}function L(e){let t=(0,ee.c)(27),{planet:n,moving:r,mix:i}=e,a=(0,f.useRef)(null),s;t[0]!==r||t[1]!==n.speed?(s=(e,t)=>{r&&a.current&&(a.current.rotation.z=a.current.rotation.z+Math.min(t,.05)*n.speed)},t[0]=r,t[1]=n.speed,t[2]=s):s=t[2],o(s);let c;t[3]!==i||t[4]!==n.dark.rim||t[5]!==n.light.rim||t[6]!==n.orbit||t[7]!==n.phase?(c=(0,p.jsx)(F,{radius:n.orbit,dark:n.dark.rim,light:n.light.rim,phase:n.phase,mix:i}),t[3]=i,t[4]=n.dark.rim,t[5]=n.light.rim,t[6]=n.orbit,t[7]=n.phase,t[8]=c):c=t[8];let l;t[9]===n.phase?l=t[10]:(l=[0,0,n.phase],t[9]=n.phase,t[10]=l);let u;t[11]===n.orbit?u=t[12]:(u=[n.orbit,0,0],t[11]=n.orbit,t[12]=u);let d;t[13]===Symbol.for(`react.memo_cache_sentinel`)?(d=[.28,0,.2],t[13]=d):d=t[13];let m;t[14]!==i||t[15]!==n?(m=(0,p.jsx)(I,{planet:n,mix:i}),t[14]=i,t[15]=n,t[16]=m):m=t[16];let h;t[17]!==u||t[18]!==m?(h=(0,p.jsx)(`group`,{position:u,rotation:d,children:m}),t[17]=u,t[18]=m,t[19]=h):h=t[19];let g;t[20]!==l||t[21]!==h?(g=(0,p.jsx)(`group`,{ref:a,rotation:l,children:h}),t[20]=l,t[21]=h,t[22]=g):g=t[22];let _;return t[23]!==n.tilt||t[24]!==c||t[25]!==g?(_=(0,p.jsxs)(`group`,{rotation:n.tilt,children:[c,g]}),t[23]=n.tilt,t[24]=c,t[25]=g,t[26]=_):_=t[26],_}function R(e){let t=(0,ee.c)(12),{planet:n,position:r,moving:i,mix:a,scale:s}=e,c=s===void 0?1:s,l=(0,f.useRef)(null),u=(0,f.useRef)(n.seed),d;t[0]!==i||t[1]!==n.seed||t[2]!==r?(d=(e,t)=>{i&&l.current&&(u.current+=Math.min(t,.05),l.current.position.y=r[1]+Math.sin(u.current*.55+n.seed)*.1,l.current.position.x=r[0]+Math.cos(u.current*.38+n.seed)*.06)},t[0]=i,t[1]=n.seed,t[2]=r,t[3]=d):d=t[3],o(d);let m;t[4]===Symbol.for(`react.memo_cache_sentinel`)?(m=[.25,0,-.2],t[4]=m):m=t[4];let h;t[5]!==a||t[6]!==n?(h=(0,p.jsx)(I,{planet:n,mix:a}),t[5]=a,t[6]=n,t[7]=h):h=t[7];let g;return t[8]!==r||t[9]!==c||t[10]!==h?(g=(0,p.jsx)(`group`,{ref:l,position:r,rotation:m,scale:c,children:h}),t[8]=r,t[9]=c,t[10]=h,t[11]=g):g=t[11],g}var z=Array.from({length:26},(e,t)=>{let n=1-t/25*2,r=Math.sqrt(Math.max(0,1-n*n)),i=t*2.399;return[Math.cos(i)*r*1.08,n*1.08,Math.sin(i)*r*1.08]});function B(e){let t=(0,ee.c)(57),{moving:n,light:r,mix:i}=e,s=(0,f.useRef)(null),c;t[0]===n?c=t[1]:(c=(e,t)=>{n&&s.current&&(s.current.rotation.y=s.current.rotation.y+Math.min(t,.05)*.16)},t[0]=n,t[1]=c),o(c);let l,u,d,m,h,g,_;t[2]===Symbol.for(`react.memo_cache_sentinel`)?(l={value:2.2},u={value:new a(`#081d3f`)},d={value:new a(`#2f7cf6`)},m={value:new a(`#7fe9ff`)},h={value:new a(`#1e3a8a`)},g={value:new a(`#3b82f6`)},_={value:new a(`#67e8f9`)},t[2]=l,t[3]=u,t[4]=d,t[5]=m,t[6]=h,t[7]=g,t[8]=_):(l=t[2],u=t[3],d=t[4],m=t[5],h=t[6],g=t[7],_=t[8]);let y;t[9]===i?y=t[10]:(y={uMix:i,uSeed:l,uDarkA:u,uDarkB:d,uDarkRim:m,uLightA:h,uLightB:g,uLightRim:_},t[9]=i,t[10]=y);let S=y,C,w,O,k;t[11]===Symbol.for(`react.memo_cache_sentinel`)?(C={value:new a(`#38bdf8`)},w={value:new a(`#6366f1`)},O={value:new a(`#818cf8`)},k={value:new a(`#22d3ee`)},t[11]=C,t[12]=w,t[13]=O,t[14]=k):(C=t[11],w=t[12],O=t[13],k=t[14]);let A;t[15]===i?A=t[16]:(A={uMix:i,uDarkA:C,uDarkB:w,uLightA:O,uLightB:k},t[15]=i,t[16]=A);let j=A,M,N,P;t[17]===Symbol.for(`react.memo_cache_sentinel`)?(M={value:new a(`#67e8f9`)},N={value:new a(`#6366f1`)},P={value:.5},t[17]=M,t[18]=N,t[19]=P):(M=t[17],N=t[18],P=t[19]);let te;t[20]===i?te=t[21]:(te={uMix:i,uDark:M,uLight:N,uAlpha:P},t[20]=i,t[21]=te);let I=te,L,R,B;t[22]===Symbol.for(`react.memo_cache_sentinel`)?(L=[0,0,-1.6],R=[3.6,3.6,1],B=(0,p.jsx)(`planeGeometry`,{args:[1,1]}),t[22]=L,t[23]=R,t[24]=B):(L=t[22],R=t[23],B=t[24]);let V=r?1:2,H;t[25]!==j||t[26]!==V?(H=(0,p.jsxs)(`mesh`,{position:L,scale:R,children:[B,(0,p.jsx)(`shaderMaterial`,{uniforms:j,vertexShader:E,fragmentShader:D,transparent:!0,depthWrite:!1,blending:V})]}),t[25]=j,t[26]=V,t[27]=H):H=t[27];let U;t[28]===Symbol.for(`react.memo_cache_sentinel`)?(U=[1.2,.24,.24],t[28]=U):U=t[28];let W;t[29]===i?W=t[30]:(W=(0,p.jsx)(F,{radius:1.34,tilt:U,dark:`#7fdcff`,light:`#3b82f6`,phase:.7,mix:i}),t[29]=i,t[30]=W);let G;t[31]===Symbol.for(`react.memo_cache_sentinel`)?(G=[-.78,.42,-.3],t[31]=G):G=t[31];let K;t[32]===i?K=t[33]:(K=(0,p.jsx)(F,{radius:1.6,tilt:G,dark:`#7fdcff`,light:`#3b82f6`,phase:3.2,mix:i}),t[32]=i,t[33]=K);let q;t[34]===Symbol.for(`react.memo_cache_sentinel`)?(q=(0,p.jsx)(`sphereGeometry`,{args:[1.05,64,48]}),t[34]=q):q=t[34];let J;t[35]===S?J=t[36]:(J=(0,p.jsxs)(`mesh`,{children:[q,(0,p.jsx)(`shaderMaterial`,{uniforms:S,vertexShader:v,fragmentShader:T})]}),t[35]=S,t[36]=J);let Y;t[37]===Symbol.for(`react.memo_cache_sentinel`)?(Y=(0,p.jsx)(`icosahedronGeometry`,{args:[1.05,2]}),t[37]=Y):Y=t[37];let ne=r?`#dbeafe`:`#9ae6ff`,re=r?.34:.22,X;t[38]!==ne||t[39]!==re?(X=(0,p.jsxs)(`mesh`,{scale:1.04,children:[Y,(0,p.jsx)(`meshBasicMaterial`,{color:ne,wireframe:!0,transparent:!0,opacity:re,depthWrite:!1})]}),t[38]=ne,t[39]=re,t[40]=X):X=t[40];let ie;t[41]===r?ie=t[42]:(ie=z.map((e,t)=>(0,p.jsxs)(`mesh`,{position:e,children:[(0,p.jsx)(`sphereGeometry`,{args:[.026,8,6]}),(0,p.jsx)(`meshBasicMaterial`,{color:r?`#f0f9ff`:`#c8f7ff`,transparent:!0,opacity:.9})]},t)),t[41]=r,t[42]=ie);let Z;t[43]!==J||t[44]!==X||t[45]!==ie?(Z=(0,p.jsxs)(`group`,{ref:s,children:[J,X,ie]}),t[43]=J,t[44]=X,t[45]=ie,t[46]=Z):Z=t[46];let Q;t[47]===Symbol.for(`react.memo_cache_sentinel`)?(Q=(0,p.jsx)(`sphereGeometry`,{args:[1.05,40,28]}),t[47]=Q):Q=t[47];let ae=r?1:2,oe;t[48]!==I||t[49]!==ae?(oe=(0,p.jsxs)(`mesh`,{scale:1.24,children:[Q,(0,p.jsx)(`shaderMaterial`,{uniforms:I,vertexShader:b,fragmentShader:x,transparent:!0,depthWrite:!1,blending:ae})]}),t[48]=I,t[49]=ae,t[50]=oe):oe=t[50];let $;return t[51]!==H||t[52]!==W||t[53]!==K||t[54]!==Z||t[55]!==oe?($=(0,p.jsxs)(`group`,{children:[H,W,K,Z,oe]}),t[51]=H,t[52]=W,t[53]=K,t[54]=Z,t[55]=oe,t[56]=$):$=t[56],$}var V=[{radius:.42,thickness:.024,segments:1,speed:.2,phase:.4,alpha:.8},{radius:.5,thickness:.028,segments:2,speed:-.14,phase:2.2,alpha:.64},{radius:.59,thickness:.032,segments:1,speed:.15,phase:4.1,alpha:.56},{radius:.69,thickness:.036,segments:3,speed:-.1,phase:1.1,alpha:.46},{radius:.8,thickness:.042,segments:2,speed:.08,phase:5.3,alpha:.36}];function H(e){let t=(0,ee.c)(67),{moving:n,light:r,mix:s}=e,c=(0,f.useRef)(null),l=(0,f.useRef)(null),u=(0,f.useRef)(null),d=(0,f.useRef)(0),m,h,g,_;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(m={value:new a(`#8b5cf6`)},h={value:new a(`#22d3ee`)},g={value:new a(`#a855f7`)},_={value:new a(`#0891b2`)},t[0]=m,t[1]=h,t[2]=g,t[3]=_):(m=t[0],h=t[1],g=t[2],_=t[3]);let y;t[4]===s?y=t[5]:(y={uMix:s,uDarkA:m,uDarkB:h,uLightA:g,uLightB:_},t[4]=s,t[5]=y);let C=y,w,T,O,N;t[6]===Symbol.for(`react.memo_cache_sentinel`)?(w={value:new a(`#ffffff`)},T={value:new a(`#8b5cf6`)},O={value:new a(`#7e22ce`)},N={value:new a(`#e9d5ff`)},t[6]=w,t[7]=T,t[8]=O,t[9]=N):(w=t[6],T=t[7],O=t[8],N=t[9]);let P;t[10]===s?P=t[11]:(P={uMix:s,uDarkIn:w,uDarkOut:T,uLightIn:O,uLightOut:N},t[10]=s,t[11]=P);let te=P,F,I,L;t[12]===Symbol.for(`react.memo_cache_sentinel`)?(F={value:new a(`#a78bfa`)},I={value:new a(`#c084fc`)},L={value:.55},t[12]=F,t[13]=I,t[14]=L):(F=t[12],I=t[13],L=t[14]);let R;t[15]===s?R=t[16]:(R={uMix:s,uDark:F,uLight:I,uAlpha:L},t[15]=s,t[16]=R);let z=R,B,H,U;t[17]===Symbol.for(`react.memo_cache_sentinel`)?(B={value:new a(`#fde68a`)},H={value:new a(`#f59e0b`)},U={value:.95},t[17]=B,t[18]=H,t[19]=U):(B=t[17],H=t[18],U=t[19]);let W;t[20]===s?W=t[21]:(W={uMix:s,uDark:B,uLight:H,uAlpha:U},t[20]=s,t[21]=W);let G=W,K;t[22]===s?K=t[23]:(K=V.map((e,t)=>({uMix:s,uPhase:{value:e.phase},uSegments:{value:e.segments},uPower:{value:2.6},uAlpha:{value:e.alpha},uDarkA:{value:new a(t%2==0?`#67e8f9`:`#c4b5fd`)},uDarkB:{value:new a(t%2==0?`#22d3ee`:`#8b5cf6`)},uLightA:{value:new a(t%2==0?`#0891b2`:`#7c3aed`)},uLightB:{value:new a(t%2==0?`#0e7490`:`#c026d3`)}})),t[22]=s,t[23]=K);let q=K,J,Y,ne;t[24]===Symbol.for(`react.memo_cache_sentinel`)?(J={value:new a(`#e0f2fe`)},Y={value:new a(`#7c3aed`)},ne={value:.9},t[24]=J,t[25]=Y,t[26]=ne):(J=t[24],Y=t[25],ne=t[26]);let re;t[27]===s?re=t[28]:(re={uMix:s,uDark:J,uLight:Y,uAlpha:ne},t[27]=s,t[28]=re);let X=re,ie;t[29]===n?ie=t[30]:(ie=(e,t)=>{if(!n)return;let r=Math.min(t,.05);d.current+=r,c.current?.children.forEach((e,t)=>{e.rotation.z=e.rotation.z+r*i(V[t],`home-universe.tsx:647`).speed}),l.current&&(l.current.rotation.z=l.current.rotation.z-r*.3),u.current&&u.current.scale.setScalar(1.55+Math.sin(d.current*1.4)*.06)},t[29]=n,t[30]=ie),o(ie);let Z,Q,ae;t[31]===Symbol.for(`react.memo_cache_sentinel`)?(Z=[0,0,-.3],Q=[2.9,2.9,1],ae=(0,p.jsx)(`planeGeometry`,{args:[1,1]}),t[31]=Z,t[32]=Q,t[33]=ae):(Z=t[31],Q=t[32],ae=t[33]);let oe=r?1:2,$;t[34]!==C||t[35]!==oe?($=(0,p.jsxs)(`mesh`,{position:Z,scale:Q,children:[ae,(0,p.jsx)(`shaderMaterial`,{uniforms:C,vertexShader:E,fragmentShader:D,transparent:!0,depthWrite:!1,blending:oe})]}),t[34]=C,t[35]=oe,t[36]=$):$=t[36];let se;t[37]===Symbol.for(`react.memo_cache_sentinel`)?(se=(0,p.jsx)(`sphereGeometry`,{args:[.3,32,24]}),t[37]=se):se=t[37];let ce=r?1:2,le;t[38]!==z||t[39]!==ce?(le=(0,p.jsxs)(`mesh`,{scale:1.55,ref:u,children:[se,(0,p.jsx)(`shaderMaterial`,{uniforms:z,vertexShader:b,fragmentShader:x,transparent:!0,depthWrite:!1,blending:ce})]}),t[38]=z,t[39]=ce,t[40]=le):le=t[40];let ue;t[41]===Symbol.for(`react.memo_cache_sentinel`)?(ue=(0,p.jsx)(`sphereGeometry`,{args:[.3,40,30]}),t[41]=ue):ue=t[41];let de;t[42]===te?de=t[43]:(de=(0,p.jsxs)(`mesh`,{children:[ue,(0,p.jsx)(`shaderMaterial`,{uniforms:te,vertexShader:v,fragmentShader:k})]}),t[42]=te,t[43]=de);let fe,pe;t[44]===Symbol.for(`react.memo_cache_sentinel`)?(fe=[0,0,0],pe=(0,p.jsx)(`torusGeometry`,{args:[.335,.011,8,120]}),t[44]=fe,t[45]=pe):(fe=t[44],pe=t[45]);let me=r?1:2,he;t[46]!==G||t[47]!==me?(he=(0,p.jsxs)(`mesh`,{rotation:fe,children:[pe,(0,p.jsx)(`shaderMaterial`,{uniforms:G,vertexShader:j,fragmentShader:M,transparent:!0,depthWrite:!1,blending:me})]}),t[46]=G,t[47]=me,t[48]=he):he=t[48];let ge;t[49]===Symbol.for(`react.memo_cache_sentinel`)?(ge=[.78,.14,-.26],t[49]=ge):ge=t[49];let _e;t[50]!==q||t[51]!==r?(_e=V.map((e,t)=>(0,p.jsxs)(`mesh`,{children:[(0,p.jsx)(`ringGeometry`,{args:[e.radius,e.radius+e.thickness,128]}),(0,p.jsx)(`shaderMaterial`,{...q[t]===void 0?{}:{uniforms:q[t]},vertexShader:S,fragmentShader:A,transparent:!0,depthWrite:!1,blending:r?1:2})]},t)),t[50]=q,t[51]=r,t[52]=_e):_e=t[52];let ve;t[53]===_e?ve=t[54]:(ve=(0,p.jsx)(`group`,{ref:c,children:_e}),t[53]=_e,t[54]=ve);let ye;t[55]!==r||t[56]!==X?(ye=(0,p.jsx)(`group`,{ref:l,children:Array.from({length:26},(e,t)=>{let n=.45+t%5*.07,i=t*2.399;return(0,p.jsxs)(`mesh`,{position:[Math.cos(i)*n,Math.sin(i)*n,t%3*.012],children:[(0,p.jsx)(`sphereGeometry`,{args:[.014,6,5]}),(0,p.jsx)(`shaderMaterial`,{uniforms:X,vertexShader:j,fragmentShader:M,transparent:!0,depthWrite:!1,blending:r?1:2})]},t)})}),t[55]=r,t[56]=X,t[57]=ye):ye=t[57];let be;t[58]!==ve||t[59]!==ye?(be=(0,p.jsxs)(`group`,{rotation:ge,children:[ve,ye]}),t[58]=ve,t[59]=ye,t[60]=be):be=t[60];let xe;return t[61]!==$||t[62]!==le||t[63]!==de||t[64]!==he||t[65]!==be?(xe=(0,p.jsxs)(`group`,{children:[$,le,de,he,be]}),t[61]=$,t[62]=le,t[63]=de,t[64]=he,t[65]=be,t[66]=xe):xe=t[66],xe}function U(e){let t=(0,ee.c)(34),{width:n,height:r,mix:i,moving:c}=e,{gl:l}=s(),u,m;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(u={value:0},m={value:1},t[0]=u,t[1]=m):(u=t[0],m=t[1]);let h,g;t[2]===Symbol.for(`react.memo_cache_sentinel`)?(h={value:new a(`#dcf3ff`)},g={value:new a(`#2f4f7a`)},t[2]=h,t[3]=g):(h=t[2],g=t[3]);let _;t[4]===i?_=t[5]:(_={time:u,ratio:m,uMix:i,uDark:h,uLight:g},t[4]=i,t[5]=_);let v=_,y,b;if(t[6]!==r||t[7]!==n){y=new Float32Array(780),b=new Float32Array(260);for(let e=0;e<260;e+=1)y[e*3]=Math.sin(e*127.1+.7)*n*.5,y[e*3+1]=Math.cos(e*73.7+1.3)*r*.48,y[e*3+2]=-1-e*37%100/50,b[e]=e%13==0?16:e%4==0?8:4;t[6]=r,t[7]=n,t[8]=y,t[9]=b}else y=t[8],b=t[9];let x;t[10]!==y||t[11]!==b?(x={positions:y,sizes:b},t[10]=y,t[11]=b,t[12]=x):x=t[12];let S=x,C;t[13]!==l||t[14]!==v.ratio?(C=()=>{d(v.ratio,l.getPixelRatio())},t[13]=l,t[14]=v.ratio,t[15]=C):C=t[15];let w;t[16]!==l||t[17]!==v?(w=[l,v],t[16]=l,t[17]=v,t[18]=w):w=t[18],(0,f.useLayoutEffect)(C,w);let T;t[19]!==c||t[20]!==v.time?(T=(e,t)=>{c&&d(v.time,v.time.value+Math.min(t,.05))},t[19]=c,t[20]=v.time,t[21]=T):T=t[21],o(T);let E;t[22]===S.positions?E=t[23]:(E=(0,p.jsx)(`bufferAttribute`,{attach:`attributes-position`,args:[S.positions,3]}),t[22]=S.positions,t[23]=E);let D;t[24]===S.sizes?D=t[25]:(D=(0,p.jsx)(`bufferAttribute`,{attach:`attributes-size`,args:[S.sizes,1]}),t[24]=S.sizes,t[25]=D);let O;t[26]!==E||t[27]!==D?(O=(0,p.jsxs)(`bufferGeometry`,{children:[E,D]}),t[26]=E,t[27]=D,t[28]=O):O=t[28];let k;t[29]===v?k=t[30]:(k=(0,p.jsx)(`shaderMaterial`,{uniforms:v,vertexShader:N,fragmentShader:P,transparent:!0,depthWrite:!1}),t[29]=v,t[30]=k);let A;return t[31]!==O||t[32]!==k?(A=(0,p.jsxs)(`points`,{frustumCulled:!1,children:[O,k]}),t[31]=O,t[32]=k,t[33]=A):A=t[33],A}function W(e){let t=(0,ee.c)(20),{mix:n,light:r,position:i,scale:o}=e,s=r?.3:.45,c;t[0]===s?c=t[1]:(c={value:s},t[0]=s,t[1]=c);let l,u,d,f;t[2]===Symbol.for(`react.memo_cache_sentinel`)?(l={value:new a(`#8b5cf6`)},u={value:new a(`#0891b2`)},d={value:new a(`#c4b5fd`)},f={value:new a(`#99f6e4`)},t[2]=l,t[3]=u,t[4]=d,t[5]=f):(l=t[2],u=t[3],d=t[4],f=t[5]);let m;t[6]!==n||t[7]!==c?(m={uMix:n,uAlpha:c,uDarkA:l,uDarkB:u,uLightA:d,uLightB:f},t[6]=n,t[7]=c,t[8]=m):m=t[8];let h=m,g;t[9]!==o[0]||t[10]!==o[1]?(g=[o[0],o[1],1],t[9]=o[0],t[10]=o[1],t[11]=g):g=t[11];let _;t[12]===Symbol.for(`react.memo_cache_sentinel`)?(_=(0,p.jsx)(`planeGeometry`,{args:[1,1]}),t[12]=_):_=t[12];let v=r?1:2,y;t[13]!==v||t[14]!==h?(y=(0,p.jsx)(`shaderMaterial`,{uniforms:h,vertexShader:E,fragmentShader:O,transparent:!0,depthWrite:!1,blending:v}),t[13]=v,t[14]=h,t[15]=y):y=t[15];let b;return t[16]!==i||t[17]!==y||t[18]!==g?(b=(0,p.jsxs)(`mesh`,{position:i,scale:g,children:[_,y]}),t[16]=i,t[17]=y,t[18]=g,t[19]=b):b=t[19],b}function G(e){let t=(0,ee.c)(106),{moving:n,light:r}=e,a=te(r,n),{size:o,camera:c,invalidate:l}=s(),d=o.width/Math.max(o.height,1)*5.4,h;t[0]===d?h=t[1]:(h={width:d,height:5.4},t[0]=d,t[1]=h);let v=h,y;t[2]!==c||t[3]!==l||t[4]!==o.height?(y=()=>{u(c,Math.max(o.height,1)/5.4)&&l()},t[2]=c,t[3]=l,t[4]=o.height,t[5]=y):y=t[5];let b;t[6]!==c||t[7]!==l||t[8]!==o.height||t[9]!==o.width?(b=[c,o.width,o.height,l],t[6]=c,t[7]=l,t[8]=o.height,t[9]=o.width,t[10]=b):b=t[10],(0,f.useLayoutEffect)(y,b);let x=Math.min(.84,v.width/9.6,v.height/6.4),S=v.width<v.height*1.35,C=v.width*.3,w=v.height*.04,T;t[11]!==C||t[12]!==w?(T=[C,w,-4],t[11]=C,t[12]=w,t[13]=T):T=t[13];let E=v.width*.8,D=v.height*1.35,O;t[14]!==E||t[15]!==D?(O=[E,D],t[14]=E,t[15]=D,t[16]=O):O=t[16];let k;t[17]!==r||t[18]!==a||t[19]!==O||t[20]!==T?(k=(0,p.jsx)(W,{mix:a,light:r,position:T,scale:O}),t[17]=r,t[18]=a,t[19]=O,t[20]=T,t[21]=k):k=t[21];let A=v.width*.6,j=v.height*-.26,M;t[22]!==A||t[23]!==j?(M=[A,j,-4],t[22]=A,t[23]=j,t[24]=M):M=t[24];let N=v.width*.46,P=v.height*.85,F;t[25]!==N||t[26]!==P?(F=[N,P],t[25]=N,t[26]=P,t[27]=F):F=t[27];let I;t[28]!==r||t[29]!==a||t[30]!==M||t[31]!==F?(I=(0,p.jsx)(W,{mix:a,light:r,position:M,scale:F}),t[28]=r,t[29]=a,t[30]=M,t[31]=F,t[32]=I):I=t[32];let z=v.width*.25,V=v.height*-.015,G;t[33]!==z||t[34]!==V?(G=[z,V,0],t[33]=z,t[34]=V,t[35]=G):G=t[35];let K;t[36]!==r||t[37]!==a||t[38]!==n?(K=(0,p.jsx)(B,{moving:n,light:r,mix:a}),t[36]=r,t[37]=a,t[38]=n,t[39]=K):K=t[39];let q;t[40]!==a||t[41]!==n?(q=g.map((e,t)=>(0,p.jsx)(L,{planet:e,moving:n,mix:a},t)),t[40]=a,t[41]=n,t[42]=q):q=t[42];let J;t[43]!==a||t[44]!==n?(J=_.map((e,t)=>(0,p.jsx)(R,{planet:e.spec,position:e.position,moving:n,mix:a,scale:e.scale},`drifter-${t}`)),t[43]=a,t[44]=n,t[45]=J):J=t[45];let Y;t[46]!==x||t[47]!==G||t[48]!==K||t[49]!==q||t[50]!==J?(Y=(0,p.jsxs)(`group`,{position:G,scale:x,children:[K,q,J]}),t[46]=x,t[47]=G,t[48]=K,t[49]=q,t[50]=J,t[51]=Y):Y=t[51];let ne=v.width*(S?.14:.088),re=v.height*(S?.26:.29),X;t[52]!==ne||t[53]!==re?(X=[ne,re,0],t[52]=ne,t[53]=re,t[54]=X):X=t[54];let ie=S?.62:.86,Z;t[55]!==r||t[56]!==a||t[57]!==n?(Z=(0,p.jsx)(H,{moving:n,light:r,mix:a}),t[55]=r,t[56]=a,t[57]=n,t[58]=Z):Z=t[58];let Q;t[59]!==X||t[60]!==ie||t[61]!==Z?(Q=(0,p.jsx)(`group`,{position:X,scale:ie,children:Z}),t[59]=X,t[60]=ie,t[61]=Z,t[62]=Q):Q=t[62];let ae=v.width*(S?.05:-.025),oe=v.height*-.19,$;t[63]!==ae||t[64]!==oe?($=[ae,oe,.8],t[63]=ae,t[64]=oe,t[65]=$):$=t[65];let se=S?.62:.95,ce;t[66]!==a||t[67]!==n?(ce=(0,p.jsx)(m,{moving:n,mix:a}),t[66]=a,t[67]=n,t[68]=ce):ce=t[68];let le;t[69]!==$||t[70]!==se||t[71]!==ce?(le=(0,p.jsx)(`group`,{position:$,scale:se,children:ce}),t[69]=$,t[70]=se,t[71]=ce,t[72]=le):le=t[72];let ue;t[73]===Symbol.for(`react.memo_cache_sentinel`)?(ue=[{index:2,x:-.3,y:.34,scale:1.45},{index:5,x:-.23,y:-.24,scale:1.35},{index:7,x:.39,y:.35,scale:1.65},{index:8,x:.43,y:-.31,scale:1.25}],t[73]=ue):ue=t[73];let de;t[74]!==S||t[75]!==a||t[76]!==n||t[77]!==v.height||t[78]!==v.width?(de=ue.map(e=>{let{index:t,x:r,y:o,scale:s}=e;return(0,p.jsx)(R,{planet:i(g[t],`outer planet`),position:[v.width*r,v.height*o,.25],moving:n,mix:a,scale:S?s*.65:s},`outer-${t}`)}),t[74]=S,t[75]=a,t[76]=n,t[77]=v.height,t[78]=v.width,t[79]=de):de=t[79];let fe=v.width*.39,pe=v.height*.35,me;t[80]!==fe||t[81]!==pe?(me=[fe,pe,.25],t[80]=fe,t[81]=pe,t[82]=me):me=t[82];let he=S?.65:1,ge;t[83]===Symbol.for(`react.memo_cache_sentinel`)?(ge=i(g[6],`orbiting planet`),t[83]=ge):ge=t[83];let _e;t[84]===Symbol.for(`react.memo_cache_sentinel`)?(_e={...ge,orbit:.34,size:.035,speed:.65,tilt:[.7,.2,.4]},t[84]=_e):_e=t[84];let ve;t[85]!==a||t[86]!==n?(ve=(0,p.jsx)(L,{planet:_e,moving:n,mix:a}),t[85]=a,t[86]=n,t[87]=ve):ve=t[87];let ye;t[88]!==me||t[89]!==he||t[90]!==ve?(ye=(0,p.jsx)(`group`,{position:me,scale:he,children:ve}),t[88]=me,t[89]=he,t[90]=ve,t[91]=ye):ye=t[91];let be;t[92]!==a||t[93]!==n||t[94]!==v.height||t[95]!==v.width?(be=(0,p.jsx)(U,{width:v.width,height:v.height,mix:a,moving:n}),t[92]=a,t[93]=n,t[94]=v.height,t[95]=v.width,t[96]=be):be=t[96];let xe;return t[97]!==k||t[98]!==I||t[99]!==Y||t[100]!==Q||t[101]!==le||t[102]!==de||t[103]!==ye||t[104]!==be?(xe=(0,p.jsxs)(p.Fragment,{children:[k,I,Y,Q,le,de,ye,be]}),t[97]=k,t[98]=I,t[99]=Y,t[100]=Q,t[101]=le,t[102]=de,t[103]=ye,t[104]=be,t[105]=xe):xe=t[105],xe}function K(e){let t=(0,ee.c)(16),{fallback:n,paused:r,light:a}=e,{moving:o}=l(),s=(0,f.useRef)(null),[u,d]=(0,f.useState)(!0),[m,g]=(0,f.useState)(!1),_,v;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(_=()=>{if(!s.current||typeof IntersectionObserver>`u`)return;let e=new IntersectionObserver(e=>{let[t]=e;return d(i(t,`home-universe.tsx:807`).isIntersecting)});return e.observe(s.current),()=>e.disconnect()},v=[],t[0]=_,t[1]=v):(_=t[0],v=t[1]),(0,f.useEffect)(_,v);let y=o&&!r&&u;if(typeof WebGL2RenderingContext>`u`||m)return n;let b;t[2]===Symbol.for(`react.memo_cache_sentinel`)?(b=[1,1.5],t[2]=b):b=t[2];let x=y?`always`:`demand`,S,C;t[3]===Symbol.for(`react.memo_cache_sentinel`)?(S={position:[0,0,8],zoom:90,near:.1,far:30},C={alpha:!0,antialias:!0,powerPreference:`low-power`},t[3]=S,t[4]=C):(S=t[3],C=t[4]);let w;t[5]===Symbol.for(`react.memo_cache_sentinel`)?(w=e=>{let{gl:t}=e;t.domElement.addEventListener(`webglcontextlost`,()=>g(!0),{once:!0})},t[5]=w):w=t[5];let T;t[6]!==y||t[7]!==a?(T=(0,p.jsx)(G,{moving:y,light:a}),t[6]=y,t[7]=a,t[8]=T):T=t[8];let E;t[9]!==n||t[10]!==x||t[11]!==T?(E=(0,p.jsx)(`div`,{ref:s,className:`home-universe-canvas`,"aria-hidden":`true`,children:(0,p.jsx)(c,{orthographic:!0,dpr:b,frameloop:x,camera:S,gl:C,fallback:n,onCreated:w,children:T})}),t[9]=n,t[10]=x,t[11]=T,t[12]=E):E=t[12];let D;return t[13]!==n||t[14]!==E?(D=(0,p.jsx)(h,{fallback:n,children:E}),t[13]=n,t[14]=E,t[15]=D):D=t[15],D}export{K as default};