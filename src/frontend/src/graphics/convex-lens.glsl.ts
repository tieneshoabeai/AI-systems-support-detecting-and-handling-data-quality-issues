// Shared optical profile: used by the Login slabs and screen-space Project glass.
export const CONVEX_LENS_GLSL = /* glsl */ `
  float convexLensSlope(float profile) {
    return smoothstep(0.0, 0.15, profile) * profile / sqrt(1.0 - 0.75 * profile * profile);
  }
  float refractedRayX(vec3 lensNormal, float ior) {
    return refract(vec3(0.0, 0.0, -1.0), lensNormal, 1.0 / ior).x;
  }
`
