import{P as e,V as t,et as n}from"./react-three-fiber.esm-Bf-eOBUg.js";var r=e=>e instanceof t,i=r=>r instanceof t||r instanceof n||r instanceof e;function a(e,t){let n=e?.value;if(!(n instanceof t))throw Error(`Shader uniform has an unexpected value type`);return n}var o=`
  float convexLensSlope(float profile) {
    return smoothstep(0.0, 0.15, profile) * profile / sqrt(1.0 - 0.75 * profile * profile);
  }
  float refractedRayX(vec3 lensNormal, float ior) {
    return refract(vec3(0.0, 0.0, -1.0), lensNormal, 1.0 / ior).x;
  }
`;export{a as i,i as n,r,o as t};