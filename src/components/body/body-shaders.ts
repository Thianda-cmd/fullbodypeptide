// Shaders for the body. Zone highlights are computed from the surface position in
// model space (no textures): each zone is a soft volume inside the body, and the
// skin over it glows with a zone-specific motion.

export const ZONE_ORDER = ["brain", "skin", "digestive", "immune", "hormones", "bones", "heart", "sex"] as const;

const common = /* glsl */ `
  uniform float uTime;
  uniform float uHeight;
  uniform float uBreath;
  uniform vec3 uChest;
`;

export const bodyVertex = /* glsl */ `
  ${common}
  varying vec3 vPosM;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vAO;
  varying float vThin;
  varying float vEye;

  void main() {
    vec3 p = position;
    // breathing: the rib cage and belly swell a little along their normals
    vec3 d = (p - uChest) / vec3(0.11, 0.13, 0.12) / uHeight;
    float chest = exp(-dot(d, d) * 1.6);
    p += normal * chest * uBreath * 0.0032 * uHeight;

    vPosM = p;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vAO = color.r;
    vThin = 1.0 - color.g;
    vEye = color.b;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const bodyFragment = /* glsl */ `
  ${common}
  uniform vec3 uCamPos;
  uniform float uW[8];          // zone weights in ZONE_ORDER
  uniform float uReveal;        // 0..1 intro, height fraction revealed
  uniform float uPulse;         // heartbeat envelope 0..1
  uniform vec3 uBrain;  uniform vec3 uBrainR;
  uniform float uEyeY;
  uniform vec3 uHeart;
  uniform vec3 uThyroid;
  uniform vec3 uAdrenal;
  uniform vec3 uGut;    uniform vec3 uGutR;
  uniform vec3 uPelvis; uniform vec3 uPelvisR;
  uniform vec3 uNodes[11];
  uniform vec3 uJoints[14];
  uniform vec3 uGlowCore;
  uniform vec3 uGlowEdge;

  varying vec3 vPosM;
  varying vec3 vPosW;
  varying vec3 vNormalW;
  varying float vAO;
  varying float vThin;
  varying float vEye;

  vec3 hash3(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  float ellipsoid(vec3 p, vec3 c, vec3 r) {
    return length((p - c) / (r * uHeight));
  }

  // a field of small drifting lights over the skin, used for circulation and bone
  float sparkle(vec3 p, float speed, float density) {
    vec3 q = p / uHeight * density;
    float column = hash3(vec3(floor(q.x), 0.0, floor(q.z))).x;
    q.y -= uTime * speed * (0.6 + column * 1.4);
    vec3 cell = floor(q);
    vec3 h = hash3(cell);
    float d = length(fract(q) - (0.25 + h * 0.5));
    float s = smoothstep(0.26, 0.02, d) * step(0.22, h.y);
    return s * (0.55 + 0.45 * sin(uTime * 2.6 + h.z * 6.2832));
  }

  void main() {
    vec3 p = vPosM;
    float hgt = p.y / uHeight;
    if (hgt > uReveal + 0.002) discard;

    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCamPos - vPosW);
    float ndv = max(dot(N, V), 0.0);

    // ---- plaster base: wrapped key + fill, sky/ground ambient, baked occlusion
    vec3 L1 = normalize(vec3(-0.45, 0.85, 0.75));
    vec3 L2 = normalize(vec3(0.8, 0.15, 0.45));
    float key = clamp((dot(N, L1) + 0.4) / 1.4, 0.0, 1.0);
    float fill = clamp((dot(N, L2) + 0.6) / 1.6, 0.0, 1.0);
    float sky = 0.5 + 0.5 * N.y;
    float ao = mix(0.5, 1.0, smoothstep(0.05, 0.95, vAO));
    vec3 base = vec3(0.968, 0.958, 0.935);
    float light = 0.62 + 0.27 * key + 0.08 * fill + 0.05 * sky;
    vec3 col = base * light * ao;
    // soft translucency where the body is thin (fingers, ears), facing away from the key light
    float face = smoothstep(0.82, 0.9, hgt) * smoothstep(0.035, 0.07, abs(p.x));
    float thinMask = max(face, 1.0 - smoothstep(0.75, 0.9, hgt));
    col += vec3(0.04, 0.035, 0.03) * vThin * thinMask * (1.0 - key);
    vec3 H = normalize(L1 + V);
    col += pow(max(dot(N, H), 0.0), 48.0) * 0.045;
    float fres = pow(1.0 - ndv, 3.0);
    col = mix(col, vec3(0.99, 0.985, 0.97), fres * 0.35);

    // ---- engraving: contour lines around the body, finer in light, heavier in shadow.
    // When the camera is close, a second set fills in between to keep the density even.
    float iso = hgt * 190.0;
    float fw = max(fwidth(iso), 1e-4);
    float near = smoothstep(0.12, 0.07, fw);
    float isoN = iso * (1.0 + near);
    float fwN = fw * (1.0 + near);
    float dpx = abs(fract(isoN + 0.5) - 0.5) / fwN;
    float shadow = smoothstep(0.1, 0.9, 1.0 - clamp(key * 0.8 + 0.2 * ao, 0.0, 1.0));
    float wpx = mix(0.3, 1.25, shadow);
    float legible = smoothstep(0.45, 0.2, fwN) * (1.0 - vEye);
    float lines = clamp(wpx * 0.5 + 0.5 - dpx, 0.0, 1.0) * legible;
    vec3 inkC = vec3(0.09, 0.095, 0.13);
    col = mix(col, inkC, lines * mix(0.1, 0.3, shadow));

    // ---- zone highlights
    float g = 0.0;      // glow amount
    float core = 0.0;   // how much of it is the saturated core colour

    // brain: forehead and scalp, a slow wave rolling out from the centre with sparks
    if (uW[0] > 0.001) {
      float e = ellipsoid(p, uBrain, uBrainR);
      float m = smoothstep(1.45, 0.75, e) * smoothstep(uEyeY - 0.004 * uHeight, uEyeY + 0.035 * uHeight, p.y);
      float wave = 0.72 + 0.28 * sin(uTime * 1.5 - e * 9.0);
      float sp = sparkle(p, 0.35, 140.0) * m;
      g += uW[0] * (m * wave * 0.8 + sp * 0.5);
      core += uW[0] * m * smoothstep(1.15, 0.75, e) * 0.55;
    }
    // skin: the whole surface lights up from the rim inward
    if (uW[1] > 0.001) {
      // creases and eye sockets face sideways too: keep the rim to open, convex skin
      float rim = pow(1.0 - ndv, 1.6) * smoothstep(0.45, 0.9, vAO) * (1.0 - vEye);
      float shimmer = 0.85 + 0.15 * sin(uTime * 1.2 + p.y / uHeight * 14.0);
      g += uW[1] * (0.22 + 0.55 * rim) * shimmer;
      core += uW[1] * rim * 0.35;
    }
    // digestive: the abdomen, with a slow peristaltic wave travelling downward
    if (uW[2] > 0.001) {
      float e = ellipsoid(p, uGut, uGutR);
      float m = smoothstep(1.5, 0.7, e);
      float wave = 0.7 + 0.3 * sin(uTime * 1.3 + (p.y / uHeight) * 60.0 + p.x / uHeight * 20.0);
      g += uW[2] * m * wave;
      core += uW[2] * smoothstep(1.15, 0.7, e);
    }
    // immune: lymph nodes and thymus as softly pulsing points
    if (uW[3] > 0.001) {
      float m = 0.0;
      for (int i = 0; i < 11; i++) {
        float d = length(p - uNodes[i]) / uHeight;
        float pulse = 0.75 + 0.25 * sin(uTime * 2.2 + float(i) * 1.7);
        m = max(m, smoothstep(0.05, 0.004, d) * pulse);
      }
      g += uW[3] * m;
      core += uW[3] * m * m;
    }
    // hormones: thyroid at the throat, a fainter glow at the adrenals and pancreas
    if (uW[4] > 0.001) {
      float t = smoothstep(0.045, 0.008, length((p - uThyroid) / vec3(1.4, 1.0, 1.0)) / uHeight);
      float a = smoothstep(0.085, 0.02, length((p - uAdrenal) / vec3(1.6, 1.0, 1.0)) / uHeight) * 0.55;
      float wave = 0.75 + 0.25 * sin(uTime * 1.7 - length(p - uThyroid) / uHeight * 40.0);
      g += uW[4] * max(t, a) * wave;
      core += uW[4] * t;
    }
    // bones and muscles: joints glow, and light drifts along the limbs
    if (uW[5] > 0.001) {
      float m = 0.0;
      for (int i = 0; i < 14; i++) {
        float d = length(p - uJoints[i]) / uHeight;
        m = max(m, smoothstep(0.05, 0.005, d));
      }
      float sp = sparkle(p, 0.9, 105.0);
      g += uW[5] * (0.16 + m * 0.75 + sp * 0.9);
      core += uW[5] * (m * 0.8 + sp * 0.5);
    }
    // heart and blood: a heartbeat at the chest, circulation sparkling everywhere
    if (uW[6] > 0.001) {
      float e = length((p - uHeart) / vec3(0.05, 0.055, 0.05)) / uHeight;
      float m = smoothstep(1.6, 0.45, e);
      float beat = 0.55 + 0.45 * uPulse;
      float ring = smoothstep(0.25, 0.0, abs(e - (0.6 + uPulse * 0.9))) * uPulse;
      float flow = sparkle(p, 1.4, 120.0) * 0.35;
      g += uW[6] * (m * beat + ring * 0.5 + flow);
      core += uW[6] * (smoothstep(1.1, 0.45, e) * beat + flow * 0.4);
    }
    // sexual and reproductive: the pelvic bowl
    if (uW[7] > 0.001) {
      float e = ellipsoid(p, uPelvis, uPelvisR);
      float m = smoothstep(1.5, 0.7, e);
      float wave = 0.72 + 0.28 * sin(uTime * 1.4 - e * 8.0);
      g += uW[7] * m * wave;
      core += uW[7] * smoothstep(1.1, 0.6, e);
    }

    g = clamp(g, 0.0, 1.25) * (1.0 - vEye * 0.7);
    float gg = clamp(g, 0.0, 1.0);
    vec3 glow = mix(uGlowEdge, uGlowCore, clamp(core, 0.0, 1.0));
    // keep the form readable under the glow
    glow *= (0.84 + 0.16 * key) * mix(0.88, 1.0, ao);
    col = mix(col, glow, gg * 0.7);
    col += uGlowCore * max(g - 1.0, 0.0) * 0.4;
    // inside a highlight the contour lines turn cobalt and thicken
    float hl = clamp((wpx + gg * 1.1) * 0.5 + 0.5 - dpx, 0.0, 1.0) * legible;
    col = mix(col, uGlowCore * 0.72, hl * gg * 0.8);

    // ---- intro scan line
    float scan = smoothstep(0.012, 0.0, abs(hgt - uReveal)) * step(uReveal, 0.999);
    col = mix(col, uGlowCore, scan * 0.9);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 c = (vUv - 0.5) * vec2(2.0, 2.0);
    float d = length(c);
    float a = smoothstep(1.0, 0.0, d);
    a = a * a * (0.6 + 0.4 * smoothstep(0.55, 0.0, d));
    gl_FragColor = vec4(vec3(0.16, 0.13, 0.08), a * uOpacity);
  }
`;

export const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
