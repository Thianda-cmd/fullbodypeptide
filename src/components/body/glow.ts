import * as THREE from "three";

// A soft aura around the body's silhouette: render the body as a flat mask at a
// quarter of the resolution, blur it twice with a separable Gaussian, and draw it
// behind the body. Screen-space, so concave skin (eye sockets, fingers) can't fold.

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const blurFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(tMap, vUv) * 0.1633;
    s += (texture2D(tMap, vUv + uDir) + texture2D(tMap, vUv - uDir)) * 0.1531;
    s += (texture2D(tMap, vUv + 2.0 * uDir) + texture2D(tMap, vUv - 2.0 * uDir)) * 0.12245;
    s += (texture2D(tMap, vUv + 3.0 * uDir) + texture2D(tMap, vUv - 3.0 * uDir)) * 0.0918;
    s += (texture2D(tMap, vUv + 4.0 * uDir) + texture2D(tMap, vUv - 4.0 * uDir)) * 0.051;
    gl_FragColor = s;
  }
`;

const compositeFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec3 uColor;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float a = texture2D(tMap, vUv).a;
    gl_FragColor = vec4(uColor, clamp(a * uStrength, 0.0, 1.0));
  }
`;

export class SilhouetteGlow {
  private a = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private b = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private mask = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private blur = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: blurFragment,
    uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
  });
  readonly composite = new THREE.ShaderMaterial({
    vertexShader: quadVertex,
    fragmentShader: compositeFragment,
    uniforms: { tMap: { value: null }, uColor: { value: new THREE.Color("#79dfb1") }, uStrength: { value: 0 } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private w = 1;
  private h = 1;

  constructor() {
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(width: number, height: number) {
    this.w = Math.max(1, Math.floor(width / 4));
    this.h = Math.max(1, Math.floor(height / 4));
    this.a.setSize(this.w, this.h);
    this.b.setSize(this.w, this.h);
  }

  private pass(renderer: THREE.WebGLRenderer, from: THREE.WebGLRenderTarget, to: THREE.WebGLRenderTarget, dx: number, dy: number) {
    this.quad.material = this.blur;
    this.blur.uniforms.tMap.value = from.texture;
    this.blur.uniforms.uDir.value.set(dx / this.w, dy / this.h);
    renderer.setRenderTarget(to);
    renderer.render(this.quadScene, this.quadCam);
  }

  /** Draws the glow into the current (screen) target; call before rendering the scene. */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, hide: THREE.Object3D[], strength: number) {
    const clear = renderer.getClearColor(new THREE.Color());
    const clearAlpha = renderer.getClearAlpha();
    const visible = hide.map((o) => o.visible);
    hide.forEach((o) => (o.visible = false));
    scene.overrideMaterial = this.mask;
    renderer.setRenderTarget(this.a);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    hide.forEach((o, i) => (o.visible = visible[i]));

    this.pass(renderer, this.a, this.b, 1.6, 0);
    this.pass(renderer, this.b, this.a, 0, 1.6);
    this.pass(renderer, this.a, this.b, 3.4, 0);
    this.pass(renderer, this.b, this.a, 0, 3.4);

    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearAlpha);
    renderer.clear();
    this.quad.material = this.composite;
    this.composite.uniforms.tMap.value = this.a.texture;
    this.composite.uniforms.uStrength.value = strength;
    renderer.render(this.quadScene, this.quadCam);
  }

  dispose() {
    this.a.dispose();
    this.b.dispose();
    this.mask.dispose();
    this.blur.dispose();
    this.composite.dispose();
    this.quad.geometry.dispose();
  }
}
