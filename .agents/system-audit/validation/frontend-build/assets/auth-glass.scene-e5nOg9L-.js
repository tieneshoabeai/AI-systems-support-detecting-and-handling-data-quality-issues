import{a as e,c as t,d as n,i as r}from"./index-BlexVsjK.js";import{t as i}from"./required-value-DcwRrTKb.js";import{a,i as o,n as s,r as c,t as l}from"./display-base-B8PmnyCE.js";import{l as u,o as d,s as f}from"./application-bootstrap-Cbsh46KH.js";import{B as p,Dt as m,Et as h,O as g,Ot as _,Tt as v,W as y,X as b,m as x,n as S,r as C,st as w,t as T,u as E,ut as D,vt as ee,wt as O}from"./react-three-fiber.esm-Bf-eOBUg.js";import{i as k,t as A}from"./convex-lens.glsl-BNiJMLHk.js";var j=n(t(),1),te=e(),{pixelsWide:M,pixelsHigh:N}=d.artwork,P=`#f3f8ff`,F=`#c1d3ea`;function I(e,t,n,r,i,a=P,o=500){e.fillStyle=a,e.font=`${o} ${i}px system-ui, sans-serif`,e.fillText(t,n,r)}function L(e,t,n,r,i,a){e.beginPath(),e.roundRect(t,n,r,i,a)}function R(e){let t=[{color:`#397bff`,points:[[0,13],[22,0],[43,13],[22,26]]},{color:`#164bd1`,points:[[0,13],[22,26],[22,52],[0,39]]},{color:`#71ceff`,points:[[22,26],[43,13],[43,39],[22,52]]}];e.save(),e.translate(20,18);for(let{color:n,points:r}of t){e.beginPath(),e.moveTo(i(i(r[0],`auth-glass.artwork.ts:32`)[0],`auth-glass.artwork.ts:32`),i(i(r[0],`auth-glass.artwork.ts:32`)[1],`auth-glass.artwork.ts:32`));for(let[t,n]of r.slice(1))e.lineTo(i(t,`auth-glass.artwork.ts:33`),i(n,`auth-glass.artwork.ts:33`));e.closePath(),e.fillStyle=n,e.fill()}e.restore()}function z(e,t,n,r,i,a,o=54){if(I(e,t,r,i,15,P,650),L(e,r,i+13,a,o,10),e.fillStyle=`#101f36`,e.fill(),e.strokeStyle=`#7898bf`,e.stroke(),I(e,n,r+12,i+19+o/2,16,F),t===`Mật khẩu`&&o===54){let t=r+a-20,n=i+40;e.strokeStyle=F,e.beginPath(),e.ellipse(t,n,7,4.5,0,0,Math.PI*2),e.stroke(),e.beginPath(),e.arc(t,n,1.8,0,Math.PI*2),e.stroke()}}function ne(e){let t=M-48,n=M/2;I(e,`Chào mừng trở lại`,24,138,36,P,700),I(e,`Đăng nhập để tiếp tục với DataVerse.`,24,168,14,F),z(e,`Email`,`ten@congty.com`,24,212,t),z(e,`Mật khẩu`,`Nhập mật khẩu`,24,310,t),L(e,24,394,15,15,3),e.strokeStyle=`#7898bf`,e.stroke(),I(e,`Ghi nhớ đăng nhập`,45,406,13,F),e.save(),e.textAlign=`right`,I(e,`Quên mật khẩu`,24+t,406,13,P,650),e.restore(),L(e,24,430,t,50,10),e.fillStyle=`#244779`,e.fill(),e.save(),e.textAlign=`center`,I(e,`Đăng nhập`,n,460,15,P,650),I(e,`Đăng nhập qua nhà cung cấp chưa khả dụng.`,n,564,12,F),I(e,`Chưa có tài khoản? Đăng ký`,n,597,13,F),e.restore(),B(e,496)}function B(e,t){let n=(M-48-20)/3;u.forEach(({paths:r},i)=>{let a=24+i*(n+10);L(e,a,t,n,46,10),e.fillStyle=`#101f36`,e.fill(),e.strokeStyle=`#7898bf`,e.stroke(),e.save(),e.translate(a+(n-22)/2,t+12),e.scale(22/24,22/24);for(let{fill:t,d:n}of r)e.fillStyle=t===`currentColor`?P:t,e.fill(new Path2D(n));e.restore()})}function re(e){let t=M-48,n=M/2,r=(t-12)/2;I(e,`Tạo tài khoản`,24,115,36,P,700),I(e,`Đăng ký để bắt đầu với DataVerse.`,24,145,14,F),z(e,`Họ`,`Nhập họ`,24,176,r,46),z(e,`Tên`,`Nhập tên`,24+r+12,176,r,46),z(e,`Email`,`Nhập email`,24,263,t,46),z(e,`Mật khẩu`,`Nhập mật khẩu`,24,349,t,46),L(e,24,424,t,50,10),e.fillStyle=`#244779`,e.fill(),e.save(),e.textAlign=`center`,I(e,`Tạo tài khoản`,n,454,15,P,650),I(e,`Chưa mở đăng ký tài khoản.`,n,495,11,F),I(e,`Đăng ký qua nhà cung cấp chưa khả dụng.`,n,580,12,F),I(e,`Đã có tài khoản? Đăng nhập`,n,613,13,F),e.restore(),B(e,512)}function ie(e,t,n){let r=document.createElement(`canvas`);r.width=n,r.height=n*2;let i=r.getContext(`2d`);if(!i)return null;let a=n/M;i.scale(a,r.height/N),t&&(i.translate(M,0),i.scale(-1,1),i.globalAlpha=.35,i.filter=`blur(${Math.max(1.5,a*1.1)}px)`),R(i),e===`login`?ne(i):re(i);let o=new E(r);return o.colorSpace=w,o.anisotropy=8,o}var{slab:V,glass:H}=d;function ae(){return new D({depthTest:!1,depthWrite:!1,toneMapped:!1,uniforms:{tPageBackdrop:{value:null},uPageBackdropUv:{value:new m(0,0,1,1)},uPageBackdropBase:{value:new x(`#02040c`)},uHasPageBackdrop:{value:!1}},vertexShader:`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.999, 1.0);
      }
    `,fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D tPageBackdrop;
      uniform vec4 uPageBackdropUv;
      uniform vec3 uPageBackdropBase;
      uniform bool uHasPageBackdrop;
      float orb(vec2 p, vec2 center, vec2 scale) {
        vec2 delta = (p - center) * scale;
        return exp(-dot(delta, delta));
      }
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void main() {
        vec2 uv = vUv;
        vec3 color = vec3(0.0010, 0.0017, 0.0042);
        color += vec3(0.005, 0.019, 0.071) * orb(uv, vec2(0.29, 0.46), vec2(4.1, 3.0));
        color += vec3(0.003, 0.031, 0.049) * orb(uv, vec2(0.75, 0.68), vec2(5.6, 4.5));
        color += vec3(0.026, 0.006, 0.067) * orb(uv, vec2(0.24, 0.20), vec2(5.8, 4.3));
        vec2 grid = uv * vec2(80.0, 84.0);
        vec2 cell = floor(grid);
        vec2 center = vec2(hash(cell), hash(cell + 32.0)) * 0.55 + 0.225;
        float particle = (1.0 - smoothstep(0.035, 0.11, length(fract(grid) - center)));
        color += vec3(0.027, 0.053, 0.083) * particle * step(0.965, hash(cell + 9.0));
        if (uHasPageBackdrop) {
          vec4 backdrop = texture2D(tPageBackdrop, uPageBackdropUv.xy + uv * uPageBackdropUv.zw);
          color = mix(uPageBackdropBase, backdrop.rgb, backdrop.a);
        }
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `})}function U(){return new D({toneMapped:!1,uniforms:{tBackdrop:{value:null},uViewport:{value:new v(1,1)},uUvPerPixel:{value:new v(1,1)},uLightDir:{value:new v(-.6,.8)},uHalfSize:{value:new v(V.width/2,V.height/2)},uCorner:{value:V.cornerRadius},uLensWidth:{value:H.lensWidth},uThickness:{value:H.thicknessPixels},uIor:{value:H.ior},uBlurPixels:{value:H.blurPixels},uChroma:{value:H.chroma},uSaturation:{value:H.saturation},uTint:{value:H.tint},uDebug:{value:0},uRim:{value:H.rimIntensity}},vertexShader:`
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vAxisX;
      varying vec3 vAxisY;
      void main() {
        vLocal = position;
        vLocalNormal = normal;
        vViewNormal = normalMatrix * normal;
        vAxisX = modelViewMatrix[0].xyz;
        vAxisY = modelViewMatrix[1].xyz;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,fragmentShader:`
      uniform sampler2D tBackdrop;
      uniform vec2 uViewport;
      uniform vec2 uUvPerPixel;
      uniform vec2 uLightDir;
      uniform vec2 uHalfSize;
      uniform float uCorner;
      uniform float uLensWidth;
      uniform float uThickness;
      uniform float uIor;
      uniform float uBlurPixels;
      uniform float uChroma;
      uniform float uSaturation;
      uniform float uTint;
      uniform int uDebug;
      uniform float uRim;
      uniform mat4 projectionMatrix;
      varying vec3 vLocal;
      varying vec3 vLocalNormal;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;
      varying vec3 vAxisX;
      varying vec3 vAxisY;

      float roundedDistance(vec2 p) {
        vec2 q = abs(p) - uHalfSize + uCorner;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - uCorner;
      }

      ${A}

      vec3 diskBlur(vec2 uv, vec2 redOffset, vec2 blueOffset, bool splitChannels) {
        if (uBlurPixels <= 0.0) {
          vec3 color = texture2D(tBackdrop, uv).rgb;
          if (splitChannels) {
            color.r = texture2D(tBackdrop, uv + redOffset).r;
            color.b = texture2D(tBackdrop, uv + blueOffset).b;
          }
          return color;
        }
        vec3 color = vec3(0.0);
        vec2 radiusUv = uBlurPixels * uUvPerPixel;
        for (int i = 0; i < 16; i++) {
          float tap = float(i);
          float angle = tap * 2.39996323;
          vec2 sampleUv = uv + vec2(cos(angle), sin(angle)) * sqrt((tap + 0.5) / 16.0) * radiusUv;
          vec3 sampleColor = texture2D(tBackdrop, sampleUv).rgb;
          if (splitChannels) {
            sampleColor.r = texture2D(tBackdrop, sampleUv + redOffset).r;
            sampleColor.b = texture2D(tBackdrop, sampleUv + blueOffset).b;
          }
          color += sampleColor;
        }
        return color / 16.0;
      }

      void main() {
        vec2 p = vLocal.xy - vec2(0.0, uHalfSize.y);
        float d = roundedDistance(p);
        float inset = max(-d, 0.0);
        float profile = 1.0 - clamp(inset / uLensWidth, 0.0, 1.0);
        // Follow the round corner at the rim, then blend neighboring edge
        // directions inside the slab where the nearest edge switches abruptly.
        float normalReach = max(uCorner, inset + 0.08);
        vec2 gradient = sign(p) * max(abs(p) - uHalfSize + normalReach, 0.0);
        vec2 direction = gradient / max(length(gradient), 0.00001);
        vec3 outward = direction.x * vAxisX + direction.y * vAxisY;
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), normalize(vViewPosition))), 3.0);
        float face = abs(normalize(vLocalNormal).z);
        float side = 1.0 - face;
        bool rear = vLocalNormal.z < -0.35;
        vec2 uv = gl_FragCoord.xy / uViewport;
        // Project the edge direction through the panel's perspective camera.
        vec4 outwardClip = projectionMatrix * vec4(outward, 0.0);
        float clipW = (projectionMatrix * vec4(vViewPosition, 1.0)).w;
        vec2 uvPerWorld = 0.5 * (outwardClip.xy - (2.0 * uv - 1.0) * outwardClip.w) / clipW;
        vec2 pixelsPerWorld = uvPerWorld / uUvPerPixel;
        float projectedScale = length(pixelsPerWorld);
        vec2 edgeDirection = pixelsPerWorld / max(projectedScale, 0.0001);

        // Regularize the circular slope at the outer rim and ease into the flat center.
        float slope = convexLensSlope(profile);
        vec3 lensNormal = normalize(vec3(slope, 0.0, 1.0));
        // Bound ray travel relative to the projected bezel to avoid folded samples.
        float thickness = min(uThickness, 0.7 * uLensWidth * projectedScale);
        vec2 travel = edgeDirection * thickness * uUvPerPixel;
        float greenRay = refractedRayX(lensNormal, uIor);
        vec2 offset = travel * greenRay;
        float chroma = rear ? 0.0 : uChroma * smoothstep(0.08, 0.25, profile);
        bool splitChannels = chroma > 0.0 && thickness > 0.0;

        if (uDebug != 0) {
          vec3 diagnostic = vec3(clamp(0.5 - d / uLensWidth, 0.0, 1.0));
          if (uDebug == 2) diagnostic = normalize(vec3(edgeDirection * slope, 1.0)) * 0.5 + 0.5;
          if (uDebug == 3) diagnostic = vec3(0.5 + 0.5 * offset / uUvPerPixel / max(uThickness, 1.0), 0.5);
          gl_FragColor = vec4(diagnostic, 1.0);
          return;
        }

        vec2 redOffset = vec2(0.0);
        vec2 blueOffset = vec2(0.0);
        if (splitChannels) {
          redOffset = travel * (refractedRayX(lensNormal, uIor - chroma) - greenRay);
          blueOffset = travel * (refractedRayX(lensNormal, uIor + chroma) - greenRay);
        }
        // The render target clamps out-of-range samples to its edge.
        vec3 background = diskBlur(uv + offset, redOffset, blueOffset, splitChannels);

        if (rear) {
          background = mix(background, vec3(0.031, 0.046, 0.074), 0.43);
        } else {
          float luminance = dot(background, vec3(0.2126, 0.7152, 0.0722));
          background = mix(max(mix(vec3(luminance), background, uSaturation), vec3(0.0)), vec3(1.0), uTint);
        }

        vec2 light = normalize(uLightDir);
        float facing = dot(edgeDirection, light);
        float specular = pow(profile, 3.0) * (0.15 + 0.5 * abs(facing));
        // The vertical wall sits at the SDF contour for its entire thickness.
        // Limit the white rim there so it doesn't fill that whole wall.
        specular *= mix(0.18, 1.0, smoothstep(0.0, 0.8, face));
        float thinEdge = 1.0 - smoothstep(0.006, 0.022, inset);
        float innerRim = smoothstep(0.018, 0.038, inset) * (1.0 - smoothstep(0.04, 0.068, inset));
        float glint = pow(profile, 4.0) * fresnel;
        vec3 brand = mix(vec3(0.35, 0.14, 0.84), vec3(0.12, 0.65, 0.92), clamp(0.5 + p.y * 0.23, 0.0, 1.0));
        vec3 color = background + uRim * (
          vec3(0.92, 0.97, 1.0) * specular * (thinEdge * 0.66 + innerRim * 0.18 + glint * 0.24) +
          brand * (thinEdge * 0.09 + side * 0.17 + glint * 0.09)
        );
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `})}function oe(){return new y({color:`#f5faff`,transmission:.96,roughness:.18,ior:1.4,thickness:V.depth,clearcoat:1,dispersion:0})}var{artwork:W,slab:G}=d,se=G.width-2*W.inset,ce=G.height-2*W.inset,le=G.depth/2+W.faceOffset,ue=new p().set(se/W.pixelsWide,0,0,-se/2,0,-ce/W.pixelsHigh,0,G.height-W.inset,0,0,1,le,0,0,0,1);function de(e,t,n,r){let i=new p().multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse).multiply(t.matrixWorld).multiply(ue).elements,a=n/2,o=r/2,s=i[15],{pixelsWide:c,pixelsHigh:l}=W,u=s+i[3]*c,d=s+i[7]*l,f=u+d-s;if(Math.min(s,u,d,f)<=0)return null;let m=i[12]/s,h=i[13]/s,g=(i[12]+i[0]*c)/u,_=(i[13]+i[1]*c)/u,v=(i[12]+i[4]*l)/d,y=(i[13]+i[5]*l)/d;return(g-m)*(y-h)-(_-h)*(v-m)>=-5e-4?null:`matrix3d(${[(i[0]+i[3])*a/s,(i[3]-i[1])*o/s,0,i[3]/s,(i[4]+i[7])*a/s,(i[7]-i[5])*o/s,0,i[7]/s,0,0,1,0,(i[12]+s)*a/s,(s-i[13])*o/s,0,1].join(`,`)})`}var fe=`/assets/background-Dca2gfaC.svg`,K=r();function pe(e){let t=(0,te.c)(12),{pageElement:n}=e,r=C(J),a=C(q),o;t[0]===Symbol.for(`react.memo_cache_sentinel`)?(o=ae(),t[0]=o):o=t[0];let s=o,c,l;t[1]===Symbol.for(`react.memo_cache_sentinel`)?(c=()=>()=>s.dispose(),l=[s],t[1]=c,t[2]=l):(c=t[1],l=t[2]),(0,j.useEffect)(c,l);let u;t[3]!==r||t[4]!==a||t[5]!==n?.current?(u=()=>{let e=n?.current;if(!e)return;let t=new Image,o=new ee(t);o.colorSpace=w;let c=s.uniforms,l=function(){if(!e||!t.naturalWidth||!t.naturalHeight)return;let n=e.getBoundingClientRect(),o=r.getBoundingClientRect();if(!n.width||!n.height||!o.width||!o.height)return;let s=Math.max(n.width/t.naturalWidth,n.height/t.naturalHeight),l=t.naturalWidth*s,u=t.naturalHeight*s,d=(n.width-l)/2,f=(n.height-u)/2;k(i(c.uPageBackdropUv,`auth-glass.backdrop.tsx:36`),m).set((o.left-n.left-d)/l,1-(o.bottom-n.top-f)/u,o.width/l,o.height/u),a()},u=function(){o.needsUpdate=!0,i(c.tPageBackdrop,`auth-glass.backdrop.tsx:47`).value=o,i(c.uHasPageBackdrop,`auth-glass.backdrop.tsx:48`).value=!0,l()},d=new ResizeObserver(l);return d.observe(e),d.observe(r),window.addEventListener(`resize`,l),t.addEventListener(`load`,u),t.src=fe,()=>{d.disconnect(),window.removeEventListener(`resize`,l),t.removeEventListener(`load`,u),i(c.tPageBackdrop,`auth-glass.backdrop.tsx:63`).value=null,i(c.uHasPageBackdrop,`auth-glass.backdrop.tsx:64`).value=!1,o.dispose()}},t[3]=r,t[4]=a,t[5]=n?.current,t[6]=u):u=t[6];let d;t[7]!==r||t[8]!==a||t[9]!==n?(d=[r,a,s,n],t[7]=r,t[8]=a,t[9]=n,t[10]=d):d=t[10],(0,j.useEffect)(u,d);let f;return t[11]===Symbol.for(`react.memo_cache_sentinel`)?(f=(0,K.jsx)(`mesh`,{name:`Backdrop`,frustumCulled:!1,renderOrder:-100,material:s,children:(0,K.jsx)(`planeGeometry`,{args:[2,2]})}),t[11]=f):f=t[11],f}function q(e){return e.invalidate}function J(e){return e.gl.domElement}function me(e){let t=e.getContext(),n=e.extensions.has(`EXT_color_buffer_float`),r=n?g:O,i=n?t.RGBA16F:t.RGBA8,a=e=>{let n=t.getInternalformatParameter(t.RENDERBUFFER,e,t.SAMPLES);if(!(n instanceof Int32Array))throw Error(`WebGL did not return sample counts`);return n},o=a(i),s=a(t.DEPTH_COMPONENT24),c=[4,2].find(e=>o.includes(e)&&s.includes(e))??0;return{backdrop:new _(1,1,{type:r,samples:c}),behindGlass:new _(1,1,{type:r,samples:c}),loginLens:U(),registerLens:U(),size:new v,eye:new h}}function he(e,t,n,r=0,a){let o=C(e=>e.invalidate),s=C(e=>e.gl),c=(0,j.useRef)(null),l=(0,j.useRef)(null),u=(0,j.useRef)(null),f=(0,j.useRef)(null),p=(0,j.useRef)(null),m=(0,j.useRef)(null),h=(0,j.useRef)(!1);return(0,j.useEffect)(()=>{if(t)return;let e=me(s);return h.current=!1,m.current=e,o(),()=>{m.current=null,e.backdrop.dispose(),e.behindGlass.dispose(),e.loginLens.dispose(),e.registerLens.dispose()}},[s,o,t]),(0,j.useEffect)(()=>{let e=m.current;if(!e)return;let{loginLens:t,registerLens:n}=e;i(t.uniforms.uDebug,`auth-glass.render.ts:61`).value=i(n.uniforms.uDebug,`auth-glass.render.ts:61`).value=r,i(t.uniforms.uThickness,`auth-glass.render.ts:62`).value=i(n.uniforms.uThickness,`auth-glass.render.ts:62`).value=a??d.glass.thicknessPixels,o()},[r,o,t,a]),S(({gl:t,scene:r,camera:a,size:o})=>{let s=c.current,g=l.current,_=u.current,y=f.current,b=p.current;if(!s||!g||!_||!y||!b){t.render(r,a);return}function x(){y&&(y.material=e),b&&(b.material=e),t.render(r,a)}let S=m.current;if(!S||h.current){x();return}let{backdrop:C,behindGlass:w,loginLens:T,registerLens:E,size:D,eye:ee}=S,O=n?.current,A=1/Math.max(o.width,1),j=1/Math.max(o.height,1);k(i(T.uniforms.uUvPerPixel,`auth-glass.render.ts:93`),v).set(A,j),k(i(E.uniforms.uUvPerPixel,`auth-glass.render.ts:94`),v).set(A,j),k(i(T.uniforms.uLightDir,`auth-glass.render.ts:95`),v).set(-.6+(O?.x??0)*.65,.8+(O?.y??0)*.35),k(E.uniforms.uLightDir,v).copy(k(T.uniforms.uLightDir,v)),y.material=T,b.material=E,t.getDrawingBufferSize(D);let te=d.glass.targetScale,M=Math.max(1,Math.round(D.x*te)),N=Math.max(1,Math.round(D.y*te));C.setSize(M,N),w.setSize(M,N),s.worldToLocal(a.getWorldPosition(ee));let P=ee.x>0,F=P?_:g,I=P?g:_,L=P?E:T,R=P?T:E,z=t.getRenderTarget(),ne=t.debug.onShaderError;t.debug.onShaderError=(...e)=>{h.current=!0,ne?.(...e)};try{F.visible=!1,I.visible=!1,t.setRenderTarget(C),t.render(r,a),I.visible=!0,i(R.uniforms.tBackdrop,`auth-glass.render.ts:128`).value=C.texture,k(i(R.uniforms.uViewport,`auth-glass.render.ts:129`),v).set(M,N),t.setRenderTarget(w),t.render(r,a),F.visible=!0,i(L.uniforms.tBackdrop,`auth-glass.render.ts:134`).value=w.texture,k(i(L.uniforms.uViewport,`auth-glass.render.ts:135`),v).copy(D),k(i(R.uniforms.uViewport,`auth-glass.render.ts:136`),v).copy(D)}catch{h.current=!0}finally{F.visible=!0,I.visible=!0,t.setRenderTarget(z),t.debug.onShaderError=ne}h.current?(console.warn(`Auth glass: using the physical material after a refraction pass failed.`),x()):t.render(r,a)},1),{assembly:c,loginGroup:l,registerGroup:u,loginMesh:f,registerMesh:p}}var{camera:Y,viewport:ge,panels:_e,seamPosition:ve,slab:ye,dragThreshold:be}=d,X=class extends j.Component{state={failed:!1};static getDerivedStateFromError(){return{failed:!0}}componentDidCatch(){this.props.onSceneStatus?.(`failed`)}render(){return this.state.failed?(0,K.jsx)(Z,{}):this.props.children}};function Z(){let e=(0,te.c)(1),t;return e[0]===Symbol.for(`react.memo_cache_sentinel`)?(t=(0,K.jsx)(`p`,{className:`auth-glass-fallback`,children:`Thiết bị không hiển thị được khối 3D.`}),e[0]=t):t=e[0],t}function xe(e){let t=(0,te.c)(96),{onStartDrag:n,pageElement:r,formElement:u,registerElement:d,activePanel:f,low:p,dragLight:m,lensDebug:h,lensThickness:g,onSceneStatus:_}=e,v=C(Ce),y=C(Se),x=(0,j.useRef)(null),w=(0,j.useRef)(null),T=(0,j.useRef)(null),E=(0,j.useRef)(null),D=(0,j.useRef)(f),ee=(0,j.useRef)(!1),O,k,A,M,N;if(t[0]!==p){let e=c();O=p?512:1024;let n=_e.map(t=>{let{name:n,yaw:r,seamSide:i}=t;return{name:n,yaw:r,position:s(e,r,i)}}),r=o(e,n);A=e,M=n,N=r,k=n.map(e=>{let{position:t,yaw:n}=e;return{x:t[0]-r.x,z:t[2]-r.z,yaw:n}}),t[0]=p,t[1]=O,t[2]=k,t[3]=A,t[4]=M,t[5]=N}else O=t[1],k=t[2],A=t[3],M=t[4],N=t[5];let P;t[6]===k?P=t[7]:(P={panels:k,width:ye.width,depth:ye.depth},t[6]=k,t[7]=P);let F;t[8]===Symbol.for(`react.memo_cache_sentinel`)?(F=oe(),t[8]=F):F=t[8];let I;t[9]===O?I=t[10]:(I=ie(`login`,!1,O),t[9]=O,t[10]=I);let L=O/2,R;t[11]===L?R=t[12]:(R=ie(`login`,!0,L),t[11]=L,t[12]=R);let z;t[13]===O?z=t[14]:(z=ie(`register`,!1,O),t[13]=O,t[14]=z);let ne=O/2,B;t[15]===ne?B=t[16]:(B=ie(`register`,!0,ne),t[15]=ne,t[16]=B);let re;t[17]!==z||t[18]!==B||t[19]!==A||t[20]!==M||t[21]!==N||t[22]!==P||t[23]!==I||t[24]!==R?(re={geometry:A,layout:M,footprint:N,footlights:P,fallback:F,loginFront:I,loginBack:R,registerFront:z,registerBack:B},t[17]=z,t[18]=B,t[19]=A,t[20]=M,t[21]=N,t[22]=P,t[23]=I,t[24]=R,t[25]=re):re=t[25];let V=re,H;t[26]!==V.fallback||t[27]!==V.geometry||t[28]!==V.loginBack||t[29]!==V.loginFront||t[30]!==V.registerBack||t[31]!==V.registerFront?(H=()=>()=>{V.geometry.dispose(),V.fallback.dispose();for(let e of[V.loginFront,V.loginBack,V.registerFront,V.registerBack])e?.dispose()},t[26]=V.fallback,t[27]=V.geometry,t[28]=V.loginBack,t[29]=V.loginFront,t[30]=V.registerBack,t[31]=V.registerFront,t[32]=H):H=t[32];let ae;t[33]===V?ae=t[34]:(ae=[V],t[33]=V,t[34]=ae),(0,j.useEffect)(H,ae);let U;t[35]!==y||t[36]!==u?.current||t[37]!==v||t[38]!==_||t[39]!==d?.current?(U=()=>{let e=()=>{for(let e of[u?.current,d?.current])e?.removeAttribute(`data-on-panel`),e?.style.removeProperty(`--auth-glass-form-transform`)},t=()=>v(),n=()=>{e(),_?.(`failed`)};return y.addEventListener(`webglcontextlost`,n),y.addEventListener(`webglcontextrestored`,t),()=>{y.removeEventListener(`webglcontextlost`,n),y.removeEventListener(`webglcontextrestored`,t),e()}},t[35]=y,t[36]=u?.current,t[37]=v,t[38]=_,t[39]=d?.current,t[40]=U):U=t[40];let W;t[41]!==y||t[42]!==u||t[43]!==v||t[44]!==_||t[45]!==d?(W=[y,u,d,v,_],t[41]=y,t[42]=u,t[43]=v,t[44]=_,t[45]=d,t[46]=W):W=t[46],(0,j.useEffect)(U,W);let G;t[47]===v?G=t[48]:(G=()=>v(),t[47]=v,t[48]=G);let ue;t[49]!==f||t[50]!==v?(ue=[f,v],t[49]=f,t[50]=v,t[51]=ue):ue=t[51],(0,j.useEffect)(G,ue);let{assembly:fe,loginGroup:q,registerGroup:J,loginMesh:me,registerMesh:ge}=he(V.fallback,p,m,h,g),be;t[52]!==f||t[53]!==u?.current||t[54]!==q||t[55]!==_||t[56]!==d?.current||t[57]!==J||t[58]!==V.footprint||t[59]!==V.layout?(be=e=>{let{camera:t,size:n,gl:r}=e,a=f===`register`,o=a?d?.current:u?.current,s=a?J.current:q.current;if(!o||!s||!T.current||n.width<=0||n.height<=0||r.getContext().isContextLost())return;let c=D.current!==f;c&&(T.current.rotation.set(0,we(f),0),D.current=f);let l=n.width/n.height<Y.compact.maxAspect,p=l?f:`desktop`;if(t instanceof b&&E.current!==p){let e=Y.compact;if(t.position.set(...l?e.position:Y.loginPosition),l){let[n,,r]=i(V.layout[+!!a],`auth-glass.scene.tsx:154`).position,o=we(f),s=ve[0]+(n-V.footprint.x)*Math.cos(o)+(r-V.footprint.z)*Math.sin(o);t.position.setX(s),t.lookAt(s,e.target[1],e.target[2])}else t.lookAt(...Y.loginTarget);t.fov=l?e.fov:Y.loginFov,t.updateProjectionMatrix(),E.current=p}t.updateMatrixWorld(),s.updateWorldMatrix(!0,!1);let m=de(t,s,n.width,n.height);m?(o.style.setProperty(`--auth-glass-form-transform`,m),o.setAttribute(`data-on-panel`,`true`)):o.hasAttribute(`data-on-panel`)&&o.removeAttribute(`data-on-panel`),x.current&&(x.current.visible=a||!m),w.current&&(w.current.visible=!a||!m),m&&!ee.current&&(ee.current=!0,_?.(`ready`)),c&&m&&Te(o,f)},t[52]=f,t[53]=u?.current,t[54]=q,t[55]=_,t[56]=d?.current,t[57]=J,t[58]=V.footprint,t[59]=V.layout,t[60]=be):be=t[60],S(be);let X;t[61]!==u||t[62]!==V.footprint?(X=u?[-V.footprint.x,ye.height/2-a.sockets.embed,-V.footprint.z]:[0,ve[1],0],t[61]=u,t[62]=V.footprint,t[63]=X):X=t[63];let Z;t[64]!==q||t[65]!==me||t[66]!==J||t[67]!==ge||t[68]!==V.fallback||t[69]!==V.geometry||t[70]!==V.layout||t[71]!==V.loginBack||t[72]!==V.loginFront||t[73]!==V.registerBack||t[74]!==V.registerFront?(Z=V.layout.map(e=>{let{name:t,position:n,yaw:r}=e,i=t===`LoginPanel`,a=i?V.loginFront:V.registerFront,o=i?V.loginBack:V.registerBack;return(0,K.jsxs)(`group`,{ref:i?q:J,name:t,position:n,"rotation-y":r,children:[(0,K.jsx)(`mesh`,{ref:i?me:ge,name:`GlassBody`,geometry:V.geometry,material:V.fallback}),a&&(0,K.jsxs)(`mesh`,{ref:i?x:w,name:`UIFace`,position:[0,ye.height/2,le],children:[(0,K.jsx)(`planeGeometry`,{args:[se,ce]}),(0,K.jsx)(`meshBasicMaterial`,{map:a,transparent:!0,depthWrite:!1,toneMapped:!1})]}),o&&(0,K.jsxs)(`mesh`,{name:`RearArtwork`,position:[0,ye.height/2,-le],"rotation-y":Math.PI,children:[(0,K.jsx)(`planeGeometry`,{args:[se,ce]}),(0,K.jsx)(`meshBasicMaterial`,{map:o,transparent:!0,depthWrite:!1,toneMapped:!1})]})]},t)}),t[64]=q,t[65]=me,t[66]=J,t[67]=ge,t[68]=V.fallback,t[69]=V.geometry,t[70]=V.layout,t[71]=V.loginBack,t[72]=V.loginFront,t[73]=V.registerBack,t[74]=V.registerFront,t[75]=Z):Z=t[75];let xe;t[76]!==fe||t[77]!==X||t[78]!==Z?(xe=(0,K.jsx)(`group`,{ref:fe,name:`PanelSeam`,position:X,children:Z}),t[76]=fe,t[77]=X,t[78]=Z,t[79]=xe):xe=t[79];let Ee=xe,Q;t[80]===r?Q=t[81]:(Q=(0,K.jsx)(pe,{...r===void 0?{}:{pageElement:r}}),t[80]=r,t[81]=Q);let De,Oe,ke,Ae;t[82]===Symbol.for(`react.memo_cache_sentinel`)?(De=(0,K.jsx)(`ambientLight`,{intensity:1.1}),Oe=(0,K.jsx)(`directionalLight`,{position:[-3,6,5],intensity:2}),ke=(0,K.jsx)(`directionalLight`,{position:[4,-2,3],intensity:1.3,color:`#84cfff`}),Ae=[ve[0],0,ve[2]],t[82]=De,t[83]=Oe,t[84]=ke,t[85]=Ae):(De=t[82],Oe=t[83],ke=t[84],Ae=t[85]);let $;t[86]!==u||t[87]!==v||t[88]!==p||t[89]!==n||t[90]!==Ee||t[91]!==V.footlights?($=(0,K.jsx)(`group`,{position:Ae,children:u?(0,K.jsx)(l,{low:p,footlights:V.footlights,turntable:{ref:T,...n?{onPointerDown:e=>n(e,v)}:{}},children:Ee}):Ee}),t[86]=u,t[87]=v,t[88]=p,t[89]=n,t[90]=Ee,t[91]=V.footlights,t[92]=$):$=t[92];let je;return t[93]!==Q||t[94]!==$?(je=(0,K.jsxs)(K.Fragment,{children:[Q,De,Oe,ke,$]}),t[93]=Q,t[94]=$,t[95]=je):je=t[95],je}function Se(e){return e.gl.domElement}function Ce(e){return e.invalidate}function we(e){return e===`register`?-_e[1].yaw:0}function Te(e,t){let n=t===`register`?`familyName`:`email`;(e.querySelector(`input[name="${n}"]:enabled`)??e.querySelector(`[tabindex="-1"]`))?.focus({preventScroll:!0})}function Ee({view:e=`hero`,interactive:t=!1,formElement:n,registerElement:r,activePanel:i=`login`,onPanelChange:a,onRotateStart:o,low:s=!1,lensDebug:c,lensThickness:l,onSceneStatus:u,pageElement:f}){let p=(0,j.useRef)(null),m=(0,j.useRef)(null),h=(0,j.useRef)(new v),g=(0,j.useRef)(null),_=(0,j.useMemo)(()=>{let t=new b(Y.fov,ge.width/ge.height,Y.near,Y.far);return t.position.set(...Y.positions[e]),t.lookAt(...Y.target),t},[e]);function y(e,t){let n=p.current;if(!n||m.current||e.button!==0)return;e.stopPropagation(),n.setPointerCapture(e.pointerId);let r=e.eventObject;g.current={group:r,invalidate:t};let i=e.object.parent?.name;m.current={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,yaw:r.rotation.y,...i===`RegisterPanel`?{panel:`register`}:i===`LoginPanel`?{panel:`login`}:{},moved:!1}}function x(e){let t=m.current,n=g.current;if(!t||!n||e.pointerId!==t.pointerId)return;let r=e.clientX-t.startX;if(!t.moved){if(Math.abs(r)<be)return;t.moved=!0,o?.()}let i=d.dragRadiansPerPixel;n.group.rotation.y=t.yaw+r*i;let a=e.currentTarget.getBoundingClientRect();h.current.set(Math.min(1,Math.max(-1,2*(e.clientX-a.left)/a.width-1)),Math.min(1,Math.max(-1,1-2*(e.clientY-a.top)/a.height))),n.invalidate()}function S(e){let t=m.current;if(!t||e.pointerId!==t.pointerId)return;m.current=null,t.moved&&(h.current.set(0,0),g.current?.invalidate());let n=Math.hypot(e.clientX-t.startX,e.clientY-t.startY);e.type===`pointerup`&&t.panel&&!t.moved&&n<be&&C(t.panel)}function C(e){let t=m.current?.pointerId,o=p.current;m.current=null,h.current.set(0,0),o&&t!==void 0&&o.hasPointerCapture(t)&&o.releasePointerCapture(t);let s=g.current;if(e!==i){a?.(e);return}s?.group.rotation.set(0,we(e),0);let c=e===`register`?r?.current:n?.current;c&&(c.style.getPropertyValue(`--auth-glass-form-transform`)&&c.setAttribute(`data-on-panel`,`true`),Te(c,e)),s?.invalidate()}let w=typeof WebGL2RenderingContext<`u`,E=t&&w;return(0,K.jsxs)(`div`,{className:t?`auth-glass-interactive`:void 0,children:[(0,K.jsx)(`div`,{ref:p,className:E?`auth-glass-stage auth-glass-stage--draggable`:`auth-glass-stage`,role:`img`,"aria-label":`Hai khối 3D Đăng nhập và Đăng ký`,onPointerMove:E?x:void 0,onPointerUp:E?S:void 0,onPointerCancel:E?S:void 0,onLostPointerCapture:E?S:void 0,children:w?(0,K.jsx)(X,{...u===void 0?{}:{onSceneStatus:u},children:(0,K.jsx)(T,{camera:_,frameloop:`demand`,dpr:s?1:[1,1.5],fallback:(0,K.jsx)(Z,{}),children:(0,K.jsx)(xe,{...E?{onStartDrag:y}:{},...f===void 0?{}:{pageElement:f},...n===void 0?{}:{formElement:n},...r===void 0?{}:{registerElement:r},activePanel:i,low:s,dragLight:h,...c===void 0?{}:{lensDebug:c},...l===void 0?{}:{lensThickness:l},...u===void 0?{}:{onSceneStatus:u}})},e)}):(0,K.jsx)(Z,{})}),E&&(0,K.jsxs)(`div`,{className:`auth-glass-interaction`,children:[(0,K.jsx)(`span`,{children:`Kéo ngang để xoay · Chạm panel để nhập`}),(0,K.jsx)(`button`,{type:`button`,onClick:()=>C(i===`login`?`register`:`login`),children:i===`login`?`Đăng ký`:`Đăng nhập`}),(0,K.jsx)(`button`,{type:`button`,onClick:()=>C(i),children:`Về góc nhập liệu`})]})]})}var Q={hero:`Hero`,left:`Trái`,right:`Phải`,top:`Trên`,bottom:`Dưới`};function De(e){let t=(0,te.c)(33),{view:n,overlay:r,low:i}=e,[a,o]=(0,j.useState)(),s,c;t[0]===a?(s=t[1],c=t[2]):(s=()=>()=>{a&&URL.revokeObjectURL(a)},c=[a],t[0]=a,t[1]=s,t[2]=c),(0,j.useEffect)(s,c);let l;t[3]===Symbol.for(`react.memo_cache_sentinel`)?(l=function(e){let t=e.currentTarget.files?.[0];o(t?.type===`image/png`?URL.createObjectURL(t):void 0)},t[3]=l):l=t[3];let u=l,d;t[4]===Symbol.for(`react.memo_cache_sentinel`)?(d=(0,K.jsx)(`a`,{href:`/auth/login`,children:`Về đăng nhập`}),t[4]=d):d=t[4];let p;t[5]!==i||t[6]!==n?(p=f.map(e=>(0,K.jsx)(`a`,{href:`?view=${e}${i?`&quality=low`:``}`,"aria-current":e===n?`page`:void 0,children:Q[e]},e)),t[5]=i,t[6]=n,t[7]=p):p=t[7];let m=r?`?view=hero`:`?view=hero&overlay=1`,h=r?`Ẩn ảnh mẫu`:`Chồng ảnh mẫu`,g;t[8]!==m||t[9]!==h?(g=(0,K.jsx)(`a`,{href:m,children:h}),t[8]=m,t[9]=h,t[10]=g):g=t[10];let _=`?view=${n}${i?``:`&quality=low`}`,v=i?`Kính khúc xạ`:`Kính đơn giản`,y;t[11]!==v||t[12]!==_?(y=(0,K.jsx)(`a`,{href:_,children:v}),t[11]=v,t[12]=_,t[13]=y):y=t[13];let b;t[14]===r?b=t[15]:(b=r&&(0,K.jsxs)(`label`,{children:[`Ảnh hero PNG `,(0,K.jsx)(`input`,{type:`file`,accept:`image/png`,onChange:u})]}),t[14]=r,t[15]=b);let x;t[16]!==y||t[17]!==b||t[18]!==p||t[19]!==g?(x=(0,K.jsxs)(`nav`,{className:`auth-glass-review-controls`,"aria-label":`Góc kiểm tra khối 3D`,children:[d,p,g,y,b]}),t[16]=y,t[17]=b,t[18]=p,t[19]=g,t[20]=x):x=t[20];let S;t[21]!==i||t[22]!==n?(S=(0,K.jsx)(Ee,{view:n,low:i}),t[21]=i,t[22]=n,t[23]=S):S=t[23];let C;t[24]!==r||t[25]!==a?(C=r&&a&&(0,K.jsx)(`img`,{className:`auth-glass-overlay`,src:a,alt:`Ảnh hero tham chiếu`}),t[24]=r,t[25]=a,t[26]=C):C=t[26];let w;t[27]!==S||t[28]!==C?(w=(0,K.jsxs)(`div`,{className:`auth-glass-review-frame`,children:[S,C]}),t[27]=S,t[28]=C,t[29]=w):w=t[29];let T;return t[30]!==x||t[31]!==w?(T=(0,K.jsxs)(`main`,{className:`auth-glass-review`,children:[x,w]}),t[30]=x,t[31]=w,t[32]=T):T=t[32],T}export{De as AuthGlassReview,Ee as AuthGlassStage};