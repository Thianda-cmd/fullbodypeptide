#!/usr/bin/env node
// Renders the peptide artwork pool: liquid-glass forms drawn by a WebGL shader in
// headless Chromium, saved as grayscale WebP. The site tints them per status with
// CSS/canvas blend modes, so one pool serves every category.
//
//   node scripts/build-art.cjs            # all 48
//   node scripts/build-art.cjs 0 3        # a range, for previews
//
// Output: public/art/{tall,wide,thumb}/NN.webp

const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const POOL = 48;
const SIZES = {
  tall: [720, 960],
  wide: [520, 116],
  thumb: [96, 96],
};
const out = path.join(__dirname, "..", "public", "art");

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uSeed;
uniform vec2 uCenter;   // which part of the composition this crop shows
uniform float uZoom;

float h1(float n) { return fract(sin(n * 91.345) * 43758.5453); }
vec2 h2(float n) { return fract(sin(vec2(n * 12.989, n * 78.233)) * 43758.5453); }

// Soft blobs, stretched and rotated, summed into a metaball field.
float field(vec2 p) {
  float f = 0.0;
  for (int i = 0; i < 6; i++) {
    float k = float(i) * 1.618 + uSeed * 7.31;
    vec2 c = h2(k) * vec2(1.6, 1.9) - vec2(0.3, 0.45);
    float r = mix(0.16, 0.42, h1(k + 3.3));
    float a = h1(k + 5.1) * 6.2832;
    vec2 d = mat2(cos(a), -sin(a), sin(a), cos(a)) * (p - c);
    d.x *= mix(0.45, 1.25, h1(k + 7.7));
    f += r * r / (dot(d, d) + 0.002);
  }
  return f;
}

vec2 warp(vec2 p) {
  float s = uSeed * 2.7;
  p += 0.045 * vec2(sin(p.y * 6.0 + s), cos(p.x * 5.0 - s));
  p += 0.02 * vec2(sin(p.y * 13.0 - s * 1.3), cos(p.x * 11.0 + s));
  return p;
}

float bubbles(vec2 p, float px) {
  float v = 0.0;
  for (int i = 0; i < 9; i++) {
    float k = float(i) * 3.17 + uSeed * 11.1;
    vec2 c = h2(k + 40.0) * vec2(1.3, 1.5) - vec2(0.15, 0.25);
    float r = mix(0.006, 0.03, h1(k + 41.0) * h1(k + 42.0));
    float d = length(p - c);
    float ring = smoothstep(1.4 * px, 0.0, abs(d - r));
    float spec = smoothstep(r * 0.35, 0.0, length(p - c - vec2(-0.35, 0.4) * r));
    v += ring * 0.55 + spec * 0.8;
  }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = frag / uRes - 0.5;
  vec2 p = uCenter + uv * vec2(aspect, 1.0) / uZoom;
  float px = 1.0 / (uRes.y * uZoom);
  p = warp(p);

  float e = 0.0015;
  float f = field(p);
  vec2 g = vec2(field(p + vec2(e, 0.0)) - field(p - vec2(e, 0.0)), field(p + vec2(0.0, e)) - field(p - vec2(0.0, e))) / (2.0 * e);
  float gl = length(g) + 1e-3;
  vec2 n = g / gl;
  vec2 L = normalize(vec2(-0.55, 0.85));
  float lit = dot(n, L);

  // 0.5 is neutral under an overlay blend: darker deepens the status colour, lighter turns white
  float v = 0.5;
  // broad volume: liquid bodies are lit from the upper left
  float inside = smoothstep(1.0, 2.6, f);
  v += inside * (0.05 + 0.05 * (uv.y - uv.x));

  int count = 1 + int(h1(uSeed + 9.0) * 2.99);
  for (int i = 0; i < 3; i++) {
    if (i >= count) break;
    float T = 1.4 + float(i) * (0.8 + h1(uSeed + float(i)) * 0.9);
    float s = (f - T) / gl;                       // signed distance to the surface, + inside
    float w = mix(0.008, 0.026, h1(uSeed * 3.0 + float(i))) * (0.7 + 0.6 * sin(p.x * 3.0 + p.y * 2.0 + uSeed));
    float strand = exp(-pow(s / w, 2.0));
    float shade = strand * (0.2 + 0.16 * (1.0 - lit));
    float spec = smoothstep(1.6 * px, 0.0, abs(s - 0.32 * w * sign(lit + 0.2))) * (0.25 + 0.45 * max(lit, 0.0));
    float bloom = exp(-pow(s / (w * 3.5), 2.0)) * 0.08 * max(lit, 0.0);
    float fadeOut = i == 0 ? 1.0 : 0.65;
    v += fadeOut * (spec + bloom - shade);
  }

  // bubbles: refractive rims with a specular dot
  for (int i = 0; i < 8; i++) {
    float k = float(i) * 3.17 + uSeed * 11.1;
    vec2 c = h2(k + 40.0) * vec2(1.3, 1.5) - vec2(0.15, 0.25);
    float r = mix(0.005, 0.028, h1(k + 41.0) * h1(k + 42.0));
    float d = length(p - c);
    float rim = exp(-pow((d - r) / (r * 0.18 + px), 2.0));
    vec2 q = (p - c) / max(d, 1e-4);
    float side = dot(q, L);
    v += rim * (0.22 * side - 0.08);
    v += smoothstep(r * 0.32, 0.0, length(p - c - vec2(-0.32, 0.38) * r)) * 0.45;
  }

  float grain = fract(sin(dot(frag + uSeed, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  v += grain * 0.014;
  gl_FragColor = vec4(vec3(clamp(v, 0.0, 1.0)), 1.0);
}`;

const PAGE = `<!doctype html><html><body style="margin:0;background:#888">
<canvas id="c"></canvas>
<script>
const c = document.getElementById('c');
const gl = c.getContext('webgl', { preserveDrawingBuffer: true });
const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
const prog = gl.createProgram();
gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'));
gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(FRAG)}));
gl.linkProgram(prog); gl.useProgram(prog);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
// share of pixels that move away from neutral grey: how much is going on in a crop
window.score = (w, h, seed, cx, cy, zoom) => {
  window.render(w, h, seed, cx, cy, zoom, 0);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let busy = 0, left = 0, right = 0;
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(px[i * 4] - 128) > 22 ? 1 : 0;
    busy += d;
    if (i % w < w / 2) left += d; else right += d;
  }
  return { busy: busy / (w * h), balance: Math.min(left, right) / Math.max(1, Math.max(left, right)) };
};
window.render = (w, h, seed, cx, cy, zoom, quality) => {
  c.width = w; c.height = h; gl.viewport(0, 0, w, h);
  gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), w, h);
  gl.uniform1f(gl.getUniformLocation(prog, 'uSeed'), seed);
  gl.uniform2f(gl.getUniformLocation(prog, 'uCenter'), cx, cy);
  gl.uniform1f(gl.getUniformLocation(prog, 'uZoom'), zoom);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return c.toDataURL('image/webp', quality);
};
</script></body></html>`;

(async () => {
  const [from = 0, to = POOL - 1] = process.argv.slice(2).map(Number);
  for (const dir of Object.keys(SIZES)) fs.mkdirSync(path.join(out, dir), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(PAGE);
  // Pick the 48 liveliest compositions out of a larger set of candidate seeds.
  const candidates = [];
  for (let k = 0; k < 160; k++) {
    const seed = 1 + k * 0.731;
    const sc = await page.evaluate((a) => window.score(...a), [180, 240, seed, 0.5, 0.5, 1.15]);
    if (sc.busy > 0.035 && sc.busy < 0.3) candidates.push({ seed, rank: sc.busy * (0.5 + sc.balance) });
  }
  candidates.sort((a, b) => b.rank - a.rank);
  const seeds = candidates.slice(0, POOL).map((c) => c.seed);
  console.log(`picked ${seeds.length} of ${candidates.length} usable candidates`);
  for (let i = from; i <= to; i++) {
    const seed = seeds[i % seeds.length];
    const name = `${String(i).padStart(2, "0")}.webp`;
    const jobs = {
      tall: [...SIZES.tall, seed, 0.5, 0.5, 1.15, 0.84],
      wide: [...SIZES.wide, seed, 0.5, 0.42, 1.6, 0.8],
      thumb: [...SIZES.thumb, seed, 0.46, 0.5, 2.2, 0.8],
    };
    for (const [dir, args] of Object.entries(jobs)) {
      const url = await page.evaluate((a) => window.render(...a), args);
      fs.writeFileSync(path.join(out, dir, name), Buffer.from(url.split(",")[1], "base64"));
    }
    process.stdout.write(`${name} `);
  }
  await browser.close();
  console.log("\ndone");
})();
