const SIMPLEX_NOISE_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const planetVertexShader = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uDisplacementScale;
uniform float uEnableDisplacement;
uniform float uSeed;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec3 displaced = position;

  if (uEnableDisplacement > 0.5) {
    float lowFreq = snoise(position * (uNoiseScale * 0.42) + vec3(uSeed * 0.5, uTime * 0.03, -uSeed * 0.35));
    float highFreq = snoise(position * (uNoiseScale * 0.78) + vec3(-uSeed, uTime * 0.05, uSeed * 0.4));
    float displacement = lowFreq * 0.68 + highFreq * 0.32;
    displaced += normal * displacement * uDisplacementScale;
  }

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vObjectPosition = displaced;

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const planetFragmentShader = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uDetailScale;
uniform float uBanding;
uniform float uSurfaceType;
uniform float uUseThirdColor;
uniform float uDetailIntensity;
uniform float uEmissiveDetailStrength;
uniform float uHoverBoost;
uniform float uSeed;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform vec3 uOceanColor;
uniform float uLandThreshold;
uniform vec3 uEmissiveDetailColor;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec3 sphereDirection = normalize(vObjectPosition);
  float primaryNoise = snoise(vec3(
    sphereDirection * uNoiseScale
    + vec3(uSeed, uTime * 0.04, -uSeed)
  ));
  float detailNoise = snoise(vec3(
    sphereDirection * uDetailScale
    + vec3(-uSeed * 0.35, uTime * 0.11, uSeed * 1.5)
  ));

  float pattern = primaryNoise * 0.72 + detailNoise * 0.28;
  float terranLandMask = 1.0;

  if (uSurfaceType < 0.5) {
    float ridges = 1.0 - abs(detailNoise);
    pattern += ridges * 0.22;
  } else if (uSurfaceType < 1.5) {
    pattern += sin((sphereDirection.y + detailNoise * 0.18) * (10.0 + uBanding * 6.0)) * 0.26;
  } else if (uSurfaceType < 2.5) {
    pattern += pow(abs(detailNoise), 0.4) * 0.28;
  } else {
    float moisture = snoise(vec3(
      sphereDirection * (uNoiseScale * 0.7)
      + vec3(uTime * 0.02, uSeed, 0.0)
    ));
    pattern += moisture * 0.15;
  }

  float blendAB = smoothstep(-0.62, 0.2, pattern);
  vec3 twoTone = mix(uColorA, uColorB, blendAB);
  float blendC = smoothstep(0.14, 0.78, pattern);
  vec3 triTone = mix(twoTone, uColorC, blendC);
  vec3 baseColor = mix(twoTone, triTone, uUseThirdColor);

  if (uSurfaceType > 2.5) {
    float continentNoise = primaryNoise * 0.74 + detailNoise * 0.26;
    float coastlineNoise = snoise(vec3(
      sphereDirection * (uNoiseScale * 1.45)
      + vec3(uSeed * 0.6, uTime * 0.03, -uSeed * 0.45)
    ));
    terranLandMask = smoothstep(
      uLandThreshold - 0.1,
      uLandThreshold + 0.1,
      continentNoise + coastlineNoise * 0.08
    );

    float foothills = smoothstep(-0.2, 0.35, continentNoise);
    float peaks = smoothstep(0.24, 0.7, detailNoise + continentNoise * 0.35);
    vec3 landColor = mix(uColorA, uColorB, foothills);
    landColor = mix(landColor, uColorC, peaks);

    float oceanDepth = clamp(0.8 + primaryNoise * 0.15, 0.65, 1.05);
    vec3 oceanColor = uOceanColor * oceanDepth;

    baseColor = mix(oceanColor, landColor, terranLandMask);
  }

  vec3 normalDir = normalize(vWorldNormal);
  vec3 lightDir = normalize(-vWorldPosition);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float diffuse = max(dot(normalDir, lightDir), 0.0);
  float detailBoost = uSurfaceType > 2.5 ? 0.55 : 1.0;
  float lit = clamp(
    (0.2 + diffuse * 0.8) + detailNoise * uDetailIntensity * detailBoost,
    0.12,
    1.35
  );

  vec3 finalColor = baseColor * lit;

  float nightMask = 1.0 - smoothstep(-0.2, 0.25, dot(normalDir, lightDir));
  float emissiveMask = smoothstep(0.22, 0.75, abs(detailNoise + primaryNoise * 0.42));
  float emissiveScale = uSurfaceType > 2.5 ? 0.45 : 1.0;
  finalColor +=
    uEmissiveDetailColor *
    emissiveMask *
    nightMask *
    uEmissiveDetailStrength *
    emissiveScale;

  if (uSurfaceType > 2.5) {
    float specular = pow(max(dot(reflect(-lightDir, normalDir), viewDir), 0.0), 34.0);
    float oceanMask = 1.0 - terranLandMask;
    finalColor += vec3(0.4, 0.52, 0.62) * specular * oceanMask * 0.26;
  }

  float rim = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 2.4);
  finalColor += baseColor * rim * 0.14;
  finalColor += vec3(0.06, 0.09, 0.08) * uHoverBoost;

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export const atmosphereVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const atmosphereFragmentShader = `
uniform float uTime;
uniform float uAtmosphereIntensity;
uniform float uHoverBoost;
uniform vec3 uAtmosphereColor;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec3 normalDir = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 2.6);
  float pulse = 0.9 + sin(uTime * 0.65 + vWorldPosition.y * 1.4) * 0.1;
  float alpha = fresnel * uAtmosphereIntensity * pulse + (uHoverBoost * 0.08);
  gl_FragColor = vec4(uAtmosphereColor, clamp(alpha, 0.0, 1.0));
}
`;

export const cloudVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const cloudFragmentShader = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uOpacity;
uniform float uSpeed;
uniform float uSeed;
uniform float uHoverBoost;
uniform vec3 uCloudColor;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

${SIMPLEX_NOISE_GLSL}

void main() {
  vec3 direction = normalize(vWorldPosition);
  float cloudLarge = snoise(vec3(
    direction * uNoiseScale
    + vec3(uTime * uSpeed, 0.0, uSeed)
  ));
  float cloudFine = snoise(vec3(
    direction * (uNoiseScale * 2.1)
    + vec3(-uSeed, uTime * uSpeed * 0.7, 0.0)
  ));

  float density = smoothstep(0.02, 0.55, cloudLarge * 0.68 + cloudFine * 0.32);
  float viewRim = pow(1.0 - abs(dot(normalize(vWorldNormal), normalize(cameraPosition - vWorldPosition))), 1.2);
  float alpha = density * (uOpacity + viewRim * 0.1 + uHoverBoost * 0.04);

  vec3 normalDir = normalize(vWorldNormal);
  vec3 lightDir = normalize(-vWorldPosition);
  float dayShade = clamp(dot(normalDir, lightDir) * 0.5 + 0.5, 0.3, 1.0);
  vec3 color = uCloudColor * (0.72 + density * 0.28) * dayShade;

  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
}
`;
