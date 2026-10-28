#!/usr/bin/env node
// Builds the 3D body models used on the home page from MakeHuman's CC0 assets
// (https://github.com/makehumancommunity/makehuman, assets released under CC0 1.0).
//
//   node scripts/build-body.mjs
//
// Steps: download base mesh + macro targets + default skeleton (cached in
// .cache/makehuman), blend the targets into idealised female and male bodies,
// lower the arms from MakeHuman's A-pose with linear blend skinning, apply one
// level of Catmull-Clark smoothing, bake ambient occlusion and thickness into
// vertex colours, and write meshopt-compressed GLBs to public/models plus the
// landmark positions the UI anchors hotspots to (src/data/body-landmarks.json).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { meshopt, quantize, reorder } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const root = join(import.meta.dirname, "..");
const cache = join(root, ".cache/makehuman");
const MH = "https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data";

// ---------------------------------------------------------------- download

function fetchCached(rel) {
  const file = join(cache, rel.replaceAll("/", "__"));
  if (!existsSync(file)) {
    mkdirSync(cache, { recursive: true });
    const r = spawnSync("curl", ["-sSfL", "-o", file, `${MH}/${rel}`], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`download failed: ${rel}`);
  }
  return readFileSync(file, "utf8");
}

// ---------------------------------------------------------------- base mesh

function parseObj(text) {
  const pos = [];
  const faces = [];
  let group = "";
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const [, x, y, z] = line.trim().split(/\s+/);
      pos.push(+x, +y, +z);
    } else if (line.startsWith("g ")) group = line.slice(2).trim();
    else if (line.startsWith("f ")) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1);
      faces.push({ group, idx });
    }
  }
  return { pos: new Float64Array(pos), faces };
}

function applyTarget(pos, rel, weight) {
  if (Math.abs(weight) < 1e-6) return;
  for (const line of fetchCached(`targets/${rel}`).split("\n")) {
    if (!line || line[0] === "#") continue;
    const [i, dx, dy, dz] = line.trim().split(/\s+/);
    const k = +i * 3;
    pos[k] += weight * +dx;
    pos[k + 1] += weight * +dy;
    pos[k + 2] += weight * +dz;
  }
}

// MakeHuman's macro modifier: targets are blended bilinearly over muscle and weight.
function applyMacros(pos, { gender, muscle, weight, proportions, height }) {
  const g = gender; // 'female' | 'male'
  for (const race of ["african", "asian", "caucasian"]) applyTarget(pos, `macrodetails/${race}-${g}-young.target`, 1 / 3);
  const mus = { averagemuscle: 1 - (muscle - 0.5) * 2, maxmuscle: (muscle - 0.5) * 2 };
  const wt = { averageweight: 1 - (0.5 - weight) * 2, minweight: (0.5 - weight) * 2 };
  for (const [mk, mw] of Object.entries(mus))
    for (const [wk, ww] of Object.entries(wt)) {
      const w = mw * ww;
      applyTarget(pos, `macrodetails/universal-${g}-young-${mk}-${wk}.target`, w);
      applyTarget(pos, `macrodetails/proportions/${g}-young-${mk}-${wk}-idealproportions.target`, w * (proportions - 0.5) * 2);
      applyTarget(pos, `macrodetails/height/${g}-young-${mk}-${wk}-maxheight.target`, w * (height - 0.5) * 2);
    }
}

// ---------------------------------------------------------------- skeleton + pose

function jointPositions(pos, skel) {
  const out = {};
  for (const [name, idx] of Object.entries(skel.joints)) {
    const v = new THREE.Vector3();
    for (const i of idx) v.add(new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]));
    out[name] = v.divideScalar(idx.length);
  }
  return out;
}

// rotations: { boneName: Quaternion in rest/world frame, pivoting at the bone head }
function poseMesh(pos, skel, weights, rotations) {
  const joints = jointPositions(pos, skel);
  const global = {};
  const order = [];
  const visit = (name) => {
    if (global[name]) return;
    const parent = skel.bones[name].parent;
    if (parent) visit(parent);
    const head = joints[`${name}____head`];
    const local = new THREE.Matrix4();
    const q = rotations[name];
    if (q) {
      local
        .makeTranslation(head.x, head.y, head.z)
        .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
        .multiply(new THREE.Matrix4().makeTranslation(-head.x, -head.y, -head.z));
    }
    global[name] = parent ? global[parent].clone().multiply(local) : local;
    order.push(name);
  };
  for (const name of Object.keys(skel.bones)) visit(name);

  const n = pos.length / 3;
  const acc = new Float64Array(n * 3);
  const wsum = new Float64Array(n);
  const v = new THREE.Vector3();
  for (const [bone, list] of Object.entries(weights)) {
    const m = global[bone];
    if (!m) continue;
    for (const [i, w] of list) {
      v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(m);
      acc[i * 3] += v.x * w;
      acc[i * 3 + 1] += v.y * w;
      acc[i * 3 + 2] += v.z * w;
      wsum[i] += w;
    }
  }
  const out = new Float64Array(pos);
  for (let i = 0; i < n; i++)
    if (wsum[i] > 1e-6) {
      out[i * 3] = acc[i * 3] / wsum[i];
      out[i * 3 + 1] = acc[i * 3 + 1] / wsum[i];
      out[i * 3 + 2] = acc[i * 3 + 2] / wsum[i];
    }
  return { pos: out, joints: jointPositions(out, skel) };
}

// ---------------------------------------------------------------- mesh ops

function extract(pos, faces, groups) {
  const keep = faces.filter((f) => groups.includes(f.group));
  const remap = new Map();
  const P = [];
  const F = keep.map((f) =>
    f.idx.map((i) => {
      if (!remap.has(i)) {
        remap.set(i, remap.size);
        P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      }
      return remap.get(i);
    }),
  );
  return { pos: new Float64Array(P), faces: F, remap };
}

function catmullClark({ pos, faces }) {
  const nv = pos.length / 3;
  const P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

  const facePts = faces.map((f) => scale(f.reduce((acc, i) => add(acc, P(i)), [0, 0, 0]), 1 / f.length));
  const edges = new Map(); // key -> {a, b, faces: []}
  const ekey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const a = f[k];
      const b = f[(k + 1) % f.length];
      const key = ekey(a, b);
      if (!edges.has(key)) edges.set(key, { a: Math.min(a, b), b: Math.max(a, b), faces: [] });
      edges.get(key).faces.push(fi);
    }
  });

  const out = [];
  const push = (p) => (out.push(p[0], p[1], p[2]), out.length / 3 - 1);
  // vertex points first, so original indices are preserved
  const vFaces = Array.from({ length: nv }, () => []);
  const vEdges = Array.from({ length: nv }, () => []);
  faces.forEach((f, fi) => f.forEach((i) => vFaces[i].push(fi)));
  for (const e of edges.values()) {
    vEdges[e.a].push(e);
    vEdges[e.b].push(e);
  }
  for (let i = 0; i < nv; i++) {
    const p = P(i);
    const boundary = vEdges[i].filter((e) => e.faces.length === 1);
    if (boundary.length >= 2) {
      const nb = boundary.map((e) => P(e.a === i ? e.b : e.a));
      push(scale(add(add(scale(p, 6), nb[0]), nb[1]), 1 / 8));
      continue;
    }
    const n = vFaces[i].length;
    if (n < 3 || vEdges[i].length !== n) {
      push(p);
      continue;
    }
    const F = scale(vFaces[i].reduce((acc, fi) => add(acc, facePts[fi]), [0, 0, 0]), 1 / n);
    const R = scale(vEdges[i].reduce((acc, e) => add(acc, scale(add(P(e.a), P(e.b)), 0.5)), [0, 0, 0]), 1 / n);
    push(scale(add(add(F, R, 2), p, n - 3), 1 / n));
  }
  const fIndex = facePts.map((fp) => push(fp));
  const eIndex = new Map();
  for (const [key, e] of edges) {
    const mid = add(P(e.a), P(e.b));
    if (e.faces.length === 2) {
      eIndex.set(key, push(scale(add(add(mid, facePts[e.faces[0]]), facePts[e.faces[1]]), 1 / 4)));
    } else eIndex.set(key, push(scale(mid, 0.5)));
  }
  const newFaces = [];
  faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const prev = f[(k + f.length - 1) % f.length];
      const cur = f[k];
      const next = f[(k + 1) % f.length];
      newFaces.push([cur, eIndex.get(ekey(cur, next)), fIndex[fi], eIndex.get(ekey(prev, cur))]);
    }
  });
  return { pos: new Float64Array(out), faces: newFaces };
}

function triangulate(faces) {
  const idx = [];
  for (const f of faces) for (let k = 1; k + 1 < f.length; k++) idx.push(f[0], f[k], f[k + 1]);
  return new Uint32Array(idx);
}

function vertexNormals(pos, index) {
  const n = new Float64Array(pos.length);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < index.length; t += 3) {
    const [i, j, k] = [index[t], index[t + 1], index[t + 2]];
    a.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    b.set(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    c.set(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
    const fn = b.clone().sub(a).cross(c.clone().sub(a)); // area weighted
    for (const v of [i, j, k]) {
      n[v * 3] += fn.x;
      n[v * 3 + 1] += fn.y;
      n[v * 3 + 2] += fn.z;
    }
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
    n[v] /= l;
    n[v + 1] /= l;
    n[v + 2] /= l;
  }
  return n;
}

function neighbours(index, nv) {
  const sets = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < index.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = index[t + k];
      const b = index[t + ((k + 1) % 3)];
      sets[a].add(b);
      sets[b].add(a);
    }
  return sets.map((s) => [...s]);
}

function smoothScalar(values, nbrs, iterations, amount = 0.5) {
  let cur = Float64Array.from(values);
  for (let it = 0; it < iterations; it++) {
    const next = new Float64Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      let s = 0;
      for (const j of nbrs[i]) s += cur[j];
      next[i] = nbrs[i].length ? cur[i] * (1 - amount) + (s / nbrs[i].length) * amount : cur[i];
    }
    cur = next;
  }
  return cur;
}

// Ambient occlusion (cosine-weighted hemisphere) and thickness (distance through the body
// along the inverted normal), both in 0..1.
function bake(pos, normal, index, height) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(pos), 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const bvh = new MeshBVH(geo);
  const ray = new THREE.Ray();
  const samples = process.env.QUICK ? 12 : 72;
  const dirs = [];
  for (let s = 0; s < samples; s++) {
    // cosine-weighted Fibonacci hemisphere around +Z
    const u = (s + 0.5) / samples;
    const r = Math.sqrt(u);
    const phi = s * Math.PI * (3 - Math.sqrt(5));
    dirs.push(new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u)));
  }
  const nv = pos.length / 3;
  const ao = new Float64Array(nv);
  const thick = new Float64Array(nv);
  const maxDist = 0.22 * height;
  const maxThick = 0.09 * height;
  const n = new THREE.Vector3();
  const o = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const t0 = Date.now();
  for (let i = 0; i < nv; i++) {
    n.set(normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2]);
    o.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    q.setFromUnitVectors(zAxis, n);
    const spin = (i * 2.399963) % (Math.PI * 2); // decorrelate sample patterns between vertices
    const qs = new THREE.Quaternion().setFromAxisAngle(zAxis, spin);
    let occ = 0;
    for (const d of dirs) {
      const dir = d.clone().applyQuaternion(qs).applyQuaternion(q);
      ray.origin.copy(o).addScaledVector(n, 0.0015 * height);
      ray.direction.copy(dir);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxDist);
      if (hit) occ += 1 - (hit.distance / maxDist) ** 2;
    }
    ao[i] = 1 - occ / samples;
    // thickness: a small cone of rays into the body
    let tsum = 0;
    for (let s = 0; s < 6; s++) {
      const d = dirs[(s * 11) % samples].clone().applyQuaternion(qs).applyQuaternion(q).multiplyScalar(0.35).addScaledVector(n, -1).normalize();
      ray.origin.copy(o).addScaledVector(n, -0.0015 * height);
      ray.direction.copy(d);
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, maxThick);
      tsum += hit ? hit.distance / maxThick : 1;
    }
    thick[i] = tsum / 6;
    if (i % 10000 === 0 && i) process.stdout.write(`  baked ${i}/${nv} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  return { ao, thick };
}

// ---------------------------------------------------------------- export

async function writeGlb(file, { pos, normal, color, index }) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(pos)).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(Float32Array.from(normal)).setBuffer(buffer))
    .setAttribute(
      "COLOR_0",
      doc.createAccessor().setType("VEC4").setArray(color).setNormalized(true).setBuffer(buffer),
    )
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(index).setBuffer(buffer));
  const mesh = doc.createMesh("body").addPrimitive(prim);
  const node = doc.createNode("body").setMesh(mesh);
  doc.createScene("scene").addChild(node);
  doc.getRoot().getAsset().generator = "fullbodypeptide build-body (MakeHuman CC0 assets)";
  await MeshoptEncoder.ready;
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizePosition: 14, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
  );
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });
  const glb = await io.writeBinary(doc);
  writeFileSync(file, glb);
  return glb.byteLength;
}

// ---------------------------------------------------------------- main

// A relaxed standing pose from MakeHuman's A-pose. Angles in degrees, rotations are
// expressed in the rest frame and pivot at each bone's head.
function poseRotations(rest, p) {
  const side = Math.sign(rest["upperarm01.L____head"].x); // +1 when ".L" is on +X
  const deg = THREE.MathUtils.degToRad;
  const rot = (axis, angle) => new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), deg(angle));
  const J = (n) => rest[`${n}____head`];
  const X = new THREE.Vector3(1, 0, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const out = {};
  for (const [S, s] of [["L", side], ["R", -side]]) {
    out[`clavicle.${S}`] = rot(Z, -s * p.clavicle);
    out[`upperarm01.${S}`] = rot(Z, -s * p.armDrop).multiply(rot(X, p.armForward));
    out[`lowerarm01.${S}`] = rot(X, p.elbow);
    const forearm = J(`wrist.${S}`).clone().sub(J(`lowerarm02.${S}`));
    out[`lowerarm02.${S}`] = rot(forearm, s * p.twist);
    const knuckles = J(`finger5-1.${S}`).clone().sub(J(`finger2-1.${S}`));
    const hand = J(`finger3-1.${S}`).clone().sub(J(`wrist.${S}`));
    out[`wrist.${S}`] = rot(knuckles, s * p.wristBend);
    p.curl.forEach((a, k) => {
      for (const f of [2, 3, 4, 5]) out[`finger${f}-${k + 1}.${S}`] = rot(knuckles, s * a * (1 + (f - 2) * p.curlSpread));
    });
    out[`finger1-2.${S}`] = rot(hand, s * p.thumb);
    out[`finger1-3.${S}`] = rot(knuckles, s * p.thumbCurl);
    out[`upperleg01.${S}`] = rot(Z, -s * p.legIn);
    out[`foot.${S}`] = rot(Z, s * p.legIn);
  }
  return out;
}

const RELAXED = {
  clavicle: 4,
  armDrop: 26, // how far the upper arm comes down from the A-pose
  armForward: -2,
  elbow: 30, // straightens MakeHuman's forward-reaching forearm
  twist: 50, // turns the palms to face the thighs
  wristBend: 0,
  curl: [8, 14, 9],
  curlSpread: 0.15,
  thumb: 0,
  thumbCurl: 0,
  legIn: 2.5,
};

const MODELS = {
  female: {
    gender: "female",
    macros: { muscle: 0.62, weight: 0.38, proportions: 1, height: 0.5 },
    extraTargets: [
      ["breast/nipple-size-decr.target", 1],
      ["breast/nipple-point-decr.target", 1],
      ["armslegs/l-hand-fingers-distance-decr.target", 1],
      ["armslegs/r-hand-fingers-distance-decr.target", 1],
    ],
    pose: RELAXED,
    height: 1,
  },
  male: {
    gender: "male",
    macros: { muscle: 0.66, weight: 0.4, proportions: 1, height: 0.5 },
    extraTargets: [
      ["breast/nipple-point-decr.target", 1],
      ["armslegs/l-hand-fingers-distance-decr.target", 1],
      ["armslegs/r-hand-fingers-distance-decr.target", 1],
    ],
    pose: { ...RELAXED, armDrop: 27, legIn: 3 },
    height: 1.07,
  },
};

const base = parseObj(fetchCached("3dobjs/base.obj"));
const skel = JSON.parse(fetchCached("rigs/default.mhskel"));
const weights = JSON.parse(fetchCached("rigs/default_weights.mhw")).weights;
mkdirSync(join(root, "public/models"), { recursive: true });
const landmarksFile = join(root, "src/data/body-landmarks.json");
const landmarks = existsSync(landmarksFile) ? JSON.parse(readFileSync(landmarksFile, "utf8")) : {};

for (const [name, cfg] of Object.entries(MODELS)) {
  if (process.env.ONLY && process.env.ONLY !== name) continue;
  console.log(`\n${name}`);
  const pos = Float64Array.from(base.pos);
  applyMacros(pos, { gender: cfg.gender, ...cfg.macros });

  for (const [rel, w] of cfg.extraTargets) applyTarget(pos, rel, w);
  const rest = jointPositions(pos, skel);
  const pose = { ...cfg.pose, ...(process.env.POSE ? JSON.parse(process.env.POSE) : {}) };
  const posed = poseMesh(pos, skel, weights, poseRotations(rest, pose));
  const sh = posed.joints["upperarm01.L____head"];
  const wr = posed.joints["wrist.L____head"];
  console.log(
    `  arm angle from vertical: ${THREE.MathUtils.radToDeg(Math.atan2(Math.abs(wr.x - sh.x), sh.y - wr.y)).toFixed(1)}°`,
  );

  const sub = extract(posed.pos, base.faces, ["body", "helper-l-eye", "helper-r-eye"]);
  const smooth = catmullClark(sub);
  const index = triangulate(smooth.faces);

  // normalise: feet on y=0, centred on the pelvis, scaled to the target height
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < smooth.pos.length; i += 3) {
    minY = Math.min(minY, smooth.pos[i]);
    maxY = Math.max(maxY, smooth.pos[i]);
  }
  const s = cfg.height / (maxY - minY);
  const cx = posed.joints["root____head"].x;
  const cz = posed.joints["root____head"].z;
  const P = new Float64Array(smooth.pos.length);
  for (let i = 0; i < P.length; i += 3) {
    P[i] = (smooth.pos[i] - cx) * s;
    P[i + 1] = (smooth.pos[i + 1] - minY) * s;
    P[i + 2] = (smooth.pos[i + 2] - cz) * s;
  }
  const normal = vertexNormals(P, index);
  console.log(`  ${P.length / 3} vertices, ${index.length / 3} triangles`);

  const { ao, thick } = bake(P, normal, index, cfg.height);
  const nbrs = neighbours(index, P.length / 3);
  const aoS = smoothScalar(ao, nbrs, 3);
  const thS = smoothScalar(thick, nbrs, 4);
  const color = new Uint8Array((P.length / 3) * 4);
  for (let i = 0; i < P.length / 3; i++) {
    color[i * 4] = Math.round(Math.min(1, Math.max(0, aoS[i])) * 255);
    color[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, thS[i])) * 255);
    color[i * 4 + 2] = 0;
    color[i * 4 + 3] = 255;
  }
  const bytes = await writeGlb(join(root, `public/models/${name}.glb`), { pos: P, normal, color, index });
  console.log(`  wrote public/models/${name}.glb (${(bytes / 1024).toFixed(0)} KB)`);

  const lm = {};
  for (const [k, v] of Object.entries(posed.joints)) {
    const [bone, end] = k.split("____");
    if (!/^(root|spine0[1-5]|neck0[1-3]|head|clavicle|shoulder01|upperarm01|lowerarm01|wrist|pelvis|upperleg01|lowerleg01|foot|breast|eye|jaw|special0[13456])/.test(bone)) continue;
    lm[`${bone}.${end}`] = [(v.x - cx) * s, (v.y - minY) * s, (v.z - cz) * s].map((x) => +x.toFixed(4));
  }
  lm.top = [0, +((maxY - minY) * s).toFixed(4), 0];
  landmarks[name] = lm;
}

writeFileSync(landmarksFile, JSON.stringify(landmarks, null, 1) + "\n");
console.log("\nwrote src/data/body-landmarks.json");
