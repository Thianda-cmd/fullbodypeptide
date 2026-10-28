import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import landmarks from "@/data/body-landmarks.json";
import type { ZoneId } from "@/lib/catalog";
import type { BodyModel } from "@/lib/store";
import {
  ZONE_ORDER,
  bodyFragment,
  bodyVertex,
  shadowFragment,
  shadowVertex,
} from "./body-shaders";
import { SilhouetteGlow } from "./glow";

type LM = Record<string, number[]>;

/** Camera framing per zone: target height as a fraction of body height, and zoom. */
const FRAMES: Record<ZoneId, { y: number; zoom: number }> = {
  brain: { y: 0.915, zoom: 2.75 },
  skin: { y: 0.5, zoom: 1 },
  digestive: { y: 0.625, zoom: 2.15 },
  immune: { y: 0.64, zoom: 1.3 },
  hormones: { y: 0.84, zoom: 2.7 },
  bones: { y: 0.47, zoom: 1.1 },
  heart: { y: 0.71, zoom: 2.35 },
  sex: { y: 0.53, zoom: 2.15 },
};

const FOV = 24;
const GLOW_CORE = new THREE.Color("#34cf95");
const GLOW_EDGE = new THREE.Color("#cdf5e1");

function heartbeat(t: number) {
  const period = 0.92;
  const ph = t % period;
  const lub = Math.exp(-(((ph - 0.04) / 0.055) ** 2));
  const dub = 0.65 * Math.exp(-(((ph - 0.24) / 0.06) ** 2));
  return Math.max(lub, dub);
}

interface Geometry {
  height: number;
  uniforms: Record<string, THREE.Vector3 | THREE.Vector3[] | number>;
  anchors: Record<ZoneId, [number, number]>;
}

function zoneGeometry(model: BodyModel): Geometry {
  const lm = (landmarks as Record<string, LM>)[model];
  const h = lm.top[1];
  const P = (k: string) => new THREE.Vector3(...(lm[k] as [number, number, number]));
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const eyeY = P("eye.L.head").y;
  const neck = P("neck01.head");
  const sp1 = P("spine01.head");
  const sp2 = P("spine02.head");
  const sp3 = P("spine03.head");
  const sp4 = P("spine04.head");
  const root = P("root.head");
  const hipL = P("upperleg01.L.head");
  const kneeL = P("lowerleg01.L.head");
  const shoulderL = P("upperarm01.L.head");
  const elbowL = P("lowerarm01.L.head");
  const wristL = P("wrist.L.head");
  const ankleL = P("foot.L.head");
  const head = P("head.head").lerp(P("head.tail"), 0.55);
  // depth of the front of the rib cage; the spine sits at different depths per body
  const chestZ = P("breast.L.tail").z;
  const mirror = (p: THREE.Vector3) => v(-p.x, p.y, p.z);

  const nodes = [
    v(0.034 * h, neck.y + 0.012 * h, neck.z + 0.012 * h),
    v(-0.034 * h, neck.y + 0.012 * h, neck.z + 0.012 * h),
    v(shoulderL.x - 0.022 * h, sp1.y - 0.022 * h, sp1.z - 0.004 * h),
    v(-(shoulderL.x - 0.022 * h), sp1.y - 0.022 * h, sp1.z - 0.004 * h),
    v(hipL.x - 0.004 * h, hipL.y - 0.006 * h, hipL.z + 0.032 * h),
    v(-(hipL.x - 0.004 * h), hipL.y - 0.006 * h, hipL.z + 0.032 * h),
    v(0, sp1.y + 0.008 * h, chestZ - 0.028 * h),
    v(0.058 * h, sp3.y + 0.022 * h, 0),
    v(0, P("jaw.head").y - 0.022 * h, P("jaw.head").z),
    v(kneeL.x, kneeL.y, kneeL.z - 0.034 * h),
    v(-kneeL.x, kneeL.y, kneeL.z - 0.034 * h),
  ];
  const joints = [shoulderL, elbowL, wristL, hipL, kneeL, ankleL].flatMap((j) => [j.clone(), mirror(j)]);
  joints.push(neck.clone(), sp4.clone());

  return {
    height: h,
    uniforms: {
      uHeight: h,
      uChest: v(0, sp2.y + 0.01 * h, sp2.z + 0.05 * h),
      uBrain: v(0, head.y, head.z + 0.004 * h),
      uBrainR: v(0.07, 0.066, 0.086),
      uEyeY: eyeY,
      uHeart: v(0.022 * h, sp1.y - 0.046 * h, chestZ - 0.042 * h),
      uThyroid: v(0, neck.y - 0.004 * h, neck.z + 0.038 * h),
      uAdrenal: v(0, sp3.y + 0.01 * h, sp3.z + 0.0 * h),
      uGut: v(0.004 * h, sp4.y + 0.04 * h, sp4.z + 0.03 * h),
      uGutR: v(0.088, 0.088, 0.075),
      uPelvis: v(0, root.y - 0.016 * h, root.z + 0.045 * h),
      uPelvisR: v(0.078, 0.048, 0.075),
      uNodes: nodes,
      uJoints: joints,
    },
    anchors: {
      brain: [0.012 * h, eyeY + 0.05 * h],
      skin: [-0.033 * h, eyeY - 0.036 * h],
      digestive: [0.006 * h, sp4.y + 0.022 * h],
      immune: [shoulderL.x - 0.02 * h, sp1.y - 0.01 * h],
      hormones: [0, neck.y + 0.004 * h],
      bones: [-(hipL.x + 0.012 * h), hipL.y + (kneeL.y - hipL.y) * 0.7],
      heart: [0.028 * h, sp1.y - 0.042 * h],
      sex: [0, root.y - 0.02 * h],
    },
  };
}

export interface HotspotState {
  x: number;
  y: number;
  visible: number;
}

export interface BodySceneOptions {
  onReady?: (model: BodyModel) => void;
  onError?: (err: unknown) => void;
  onFrame?: () => void;
  reducedMotion?: boolean;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glbCache = new Map<BodyModel, Promise<THREE.BufferGeometry>>();
function loadBody(model: BodyModel) {
  let p = glbCache.get(model);
  if (!p) {
    p = loader.loadAsync(`/models/${model}.glb`).then((gltf) => {
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh;
      });
      if (!mesh) throw new Error("no mesh in body model");
      // Positions are quantized and dequantized by the node transform. Bake that
      // transform into float attributes so the mesh lives in body units (height 1),
      // which is what the zone volumes in the shader are defined in.
      const m = mesh as THREE.Mesh;
      gltf.scene.updateMatrixWorld(true);
      const src = m.geometry;
      const pos = src.getAttribute("position");
      const nor = src.getAttribute("normal");
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const P = new Float32Array(pos.count * 3);
      const N = new Float32Array(pos.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        P[i * 3] = v.x;
        P[i * 3 + 1] = v.y;
        P[i * 3 + 2] = v.z;
        v.fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize();
        N[i * 3] = v.x;
        N[i * 3 + 1] = v.y;
        N[i * 3 + 2] = v.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(P, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(N, 3));
      geo.setAttribute("color", src.getAttribute("color"));
      geo.setIndex(src.getIndex());
      geo.computeBoundingSphere();
      src.dispose();
      return geo;
    });
    p.catch(() => glbCache.delete(model));
    glbCache.set(model, p);
  }
  return p;
}
export const preloadBody = (model: BodyModel) => void loadBody(model).catch(() => {});

export class BodyScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 50);
  private group = new THREE.Group();
  private body: THREE.Mesh | null = null;
  private shadow: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private glow = new SilhouetteGlow();
  private geometry: Geometry;
  private model: BodyModel | null = null;
  private loadToken = 0;

  private w = 1;
  private h = 1;
  private raf = 0;
  private last = 0;
  private time = 0;
  private active = true;
  private zone: ZoneId | null = null;
  private weights = new Float32Array(8);
  private reveal = 0;
  private revealing = false;
  private mobile = false;

  // camera state (current and target)
  private camY = 0.5;
  private camZoom = 1;
  private targetY = 0.5;
  private targetZoom = 1;

  // rotation
  private yaw = 0;
  private yawVel = 0;
  private dragging = false;
  private lastPointerX = 0;
  private lastInteraction = -10;

  private anchors: Partial<Record<ZoneId, { p: THREE.Vector3; n: THREE.Vector3 }>> = {};
  readonly hotspots: Partial<Record<ZoneId, HotspotState>> = {};

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: BodySceneOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xffffff, 0);
    this.geometry = zoneGeometry("female");

    this.material = new THREE.ShaderMaterial({
      vertexShader: bodyVertex,
      fragmentShader: bodyFragment,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uBreath: { value: 0 },
        uCamPos: { value: new THREE.Vector3() },
        uW: { value: Array.from(this.weights) },
        uReveal: { value: 0 },
        uPulse: { value: 0 },
        uGlowCore: { value: GLOW_CORE },
        uGlowEdge: { value: GLOW_EDGE },
        ...Object.fromEntries(Object.entries(this.geometry.uniforms).map(([k, value]) => [k, { value }])),
      },
    });

    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.32),
      new THREE.ShaderMaterial({
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { uOpacity: { value: 0 } },
      }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.001;
    this.scene.add(this.shadow);
    this.scene.add(this.group);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.raf = requestAnimationFrame(this.tick);
  }

  // ---------------------------------------------------------------- public API

  async setModel(model: BodyModel) {
    if (model === this.model) return;
    this.model = model;
    const token = ++this.loadToken;
    try {
      const geo = await loadBody(model);
      if (token !== this.loadToken) return;
      this.geometry = zoneGeometry(model);
      for (const [k, value] of Object.entries(this.geometry.uniforms)) this.material.uniforms[k].value = value;
      if (this.body) this.group.remove(this.body);
      this.body = new THREE.Mesh(geo, this.material);
      this.group.add(this.body);
      this.computeAnchors();
      this.reveal = this.opts.reducedMotion ? 1 : 0;
      this.revealing = !this.opts.reducedMotion;
      this.applyFrame(true);
      this.opts.onReady?.(model);
    } catch (err) {
      if (token === this.loadToken) this.opts.onError?.(err);
    }
  }

  setZone(zone: ZoneId | null) {
    if (zone === this.zone) return;
    this.zone = zone;
    this.applyFrame(false);
  }

  setMobile(mobile: boolean) {
    if (mobile === this.mobile) return;
    this.mobile = mobile;
    this.applyFrame(true);
  }

  setActive(active: boolean) {
    this.active = active;
    if (active) this.last = 0;
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    const pr = this.renderer.getPixelRatio();
    this.glow.setSize(this.w * pr, this.h * pr);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.applyFrame(true);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    this.material.dispose();
    this.glow.dispose();
    this.shadow.geometry.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.renderer.dispose();
  }

  // ---------------------------------------------------------------- framing

  private applyFrame(instant: boolean) {
    const h = this.geometry.height;
    const f = this.zone ? FRAMES[this.zone] : null;
    let y = f ? f.y : 0.5;
    let zoom = f ? f.zoom : 1;
    if (this.mobile) {
      // the body sits in a short band on phones: default to head and torso
      if (f) zoom *= 1.3;
      else {
        y = 0.7;
        zoom = 2.1;
      }
    }
    // keep the head from drifting below the top edge, and the feet above the bottom
    const visible = this.visibleHeight(zoom);
    y = Math.min(y * h, h + 0.03 * h - visible / 2);
    y = Math.max(y, visible / 2 - 0.06 * h);
    this.targetY = y;
    this.targetZoom = zoom;
    if (instant) {
      this.camY = y;
      this.camZoom = zoom;
    }
  }

  private visibleHeight(zoom: number) {
    const h = this.geometry.height;
    const aspect = this.w / this.h;
    // full body needs ~1.12 of its height vertically and ~0.62 horizontally
    const byHeight = (1.12 * h) / zoom;
    const byWidth = (0.62 * h) / zoom / Math.max(aspect, 0.2);
    return Math.max(byHeight, byWidth);
  }

  private updateCamera() {
    const visible = this.visibleHeight(this.camZoom);
    const dist = visible / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.position.set(0, this.camY + dist * 0.035, dist);
    this.camera.lookAt(0, this.camY, 0);
  }

  // ---------------------------------------------------------------- hotspots

  private computeAnchors() {
    if (!this.body) return;
    const ray = new THREE.Raycaster();
    this.group.rotation.y = 0;
    this.group.updateMatrixWorld(true);
    this.anchors = {};
    for (const zone of ZONE_ORDER) {
      const [x, y] = this.geometry.anchors[zone];
      ray.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(this.body, false)[0];
      const p = hit ? hit.point.clone() : new THREE.Vector3(x, y, 0.08);
      const n = hit?.face ? hit.face.normal.clone() : new THREE.Vector3(0, 0, 1);
      this.anchors[zone] = { p, n };
    }
  }

  private updateHotspots() {
    const toCam = new THREE.Vector3();
    const wp = new THREE.Vector3();
    const wn = new THREE.Vector3();
    const m3 = new THREE.Matrix3().getNormalMatrix(this.group.matrixWorld);
    for (const zone of ZONE_ORDER) {
      const a = this.anchors[zone];
      if (!a) continue;
      wp.copy(a.p).applyMatrix4(this.group.matrixWorld);
      wn.copy(a.n).applyMatrix3(m3).normalize();
      toCam.copy(this.camera.position).sub(wp).normalize();
      const facing = wn.dot(toCam);
      const ndc = wp.clone().project(this.camera);
      const reveal = this.reveal >= 0.999 ? 1 : 0;
      this.hotspots[zone] = {
        x: (ndc.x * 0.5 + 0.5) * this.w,
        y: (-ndc.y * 0.5 + 0.5) * this.h,
        visible: Math.max(0, Math.min(1, (facing - 0.1) / 0.35)) * reveal,
      };
    }
  }

  // ---------------------------------------------------------------- input

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.lastPointerX = e.clientX;
    this.yawVel = 0;
    this.lastInteraction = this.time;
    this.canvas.style.cursor = "grabbing";
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    const delta = dx * 0.0085;
    this.yaw += delta;
    this.yawVel = delta * 60;
    this.lastInteraction = this.time;
  };

  private onPointerUp = () => {
    if (!this.dragging) return;
    this.dragging = false;
    this.lastInteraction = this.time;
    this.canvas.style.cursor = "";
  };

  // ---------------------------------------------------------------- loop

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    if (!this.active || !this.body) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const animate = !this.opts.reducedMotion;
    if (animate) this.time += dt;
    else this.time += dt * 0.0001;

    // zone weights ease toward the active zone
    const k = 1 - Math.exp(-dt * 4.5);
    ZONE_ORDER.forEach((z, i) => {
      const target = z === this.zone ? 1 : 0;
      this.weights[i] += (target - this.weights[i]) * (animate ? k : 1);
    });

    // camera glides between frames
    const kc = animate ? 1 - Math.exp(-dt * 3.2) : 1;
    this.camY += (this.targetY - this.camY) * kc;
    this.camZoom += (this.targetZoom - this.camZoom) * kc;

    // drag inertia, then drift back to facing forward
    if (!this.dragging) {
      this.yaw += this.yawVel * dt;
      this.yawVel *= Math.exp(-dt * 3.5);
      if (this.time - this.lastInteraction > 2.2) {
        const wrapped = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
        this.yaw = wrapped + (0 - wrapped) * (1 - Math.exp(-dt * 2.2));
      }
    }
    const sway = animate ? Math.sin(this.time * 0.35) * 0.035 : 0;
    this.group.rotation.y = this.yaw + sway;

    if (this.revealing) {
      this.reveal = Math.min(1.02, this.reveal + dt / 1.5);
      if (this.reveal >= 1.02) this.revealing = false;
    }
    const revealEase = 1 - (1 - Math.min(1, this.reveal)) ** 2.2;

    this.updateCamera();
    const u = this.material.uniforms;
    u.uTime.value = this.time;
    u.uBreath.value = animate ? Math.sin(this.time * ((2 * Math.PI) / 4.8)) * 0.5 + 0.5 : 0.5;
    u.uPulse.value = animate ? heartbeat(this.time) : 0.6;
    u.uW.value = Array.from(this.weights);
    u.uReveal.value = this.revealing ? revealEase * 1.02 : 1.02;
    const glowStrength = this.weights[1] * 0.9 * Math.min(1, this.reveal);
    (this.shadow.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.16 * Math.min(1, this.reveal * 3);

    this.group.updateMatrixWorld(true);
    u.uCamPos.value.copy(this.camera.position);
    if (glowStrength > 0.004) {
      // skin: a soft aura drawn behind the body before the body itself
      this.glow.render(this.renderer, this.scene, this.camera, [this.shadow], glowStrength);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
      this.renderer.autoClear = true;
    } else this.renderer.render(this.scene, this.camera);
    this.updateHotspots();
    this.opts.onFrame?.();
  };
}
