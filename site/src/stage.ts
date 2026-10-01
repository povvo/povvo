import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Entry } from "./catalogue";
import { drawInsert, drawInsideLeft, drawInsideRight, drawSpine, edgeColour, ensureFonts, inkOf } from "./covers";
import { Spring, clamp, easeOutCubic } from "./motion";
import type { State, Store } from "./state";

/**
 * The rack. Coordinate contract (3d-motion-design: transforms and pivots):
 *   world: right-handed, +y up, +z toward the viewer, units of ten centimetres.
 *   rack group: rotates about +y and translates along y; a case's slot i sits at
 *     angle i * STEP around the axis and height i * RISE. Slot 0 is at the front (+z).
 *   case group: local +x is the case's outward normal while it is on the rack (its
 *     spine faces the viewer); extraction yaws it by a quarter turn so local +z (the
 *     front cover) faces the viewer. The hinge pivot is the front edge of the spine.
 *
 * Springs own every continuous value; the store owns the committed selection.
 */

const CASE_W = 1.35;
const CASE_H = 1.9;
const CASE_D = 0.15;
const LEAF_D = CASE_D * 0.42;
const SPINE_T = 0.03;
const PULL = 1.3; // extraction travel along the outward normal
const WINDOW = THREE.MathUtils.degToRad(100); // cases beyond this angle from the front are not drawn
const WINDOW_FADE = THREE.MathUtils.degToRad(12);

interface RackGeometry {
  step: number;
  radius: number;
  rise: number;
}

/**
 * An arc, not a ring: twelve degrees per case for small collections, tightening to five
 * degrees so that sixty cases span three hundred degrees without the first case wrapping
 * round to sit beside the last. Beyond sixty the arc becomes a helix at five degrees per
 * case. The inner radius keeps neighbouring spines from intersecting.
 */
export function rackGeometry(count: number): RackGeometry {
  const maxStep = THREE.MathUtils.degToRad(12);
  const minStep = THREE.MathUtils.degToRad(5);
  const arc = THREE.MathUtils.degToRad(300);
  const helix = count > 60;
  const step = helix ? minStep : clamp(arc / Math.max(1, count - 1), minStep, maxStep);
  const inner = Math.max(0.77, CASE_D / (2 * Math.sin(step / 2)) + 0.05);
  const perTurn = (Math.PI * 2) / step;
  return { step, radius: inner + CASE_W + SPINE_T, rise: helix ? (CASE_H * 1.18) / perTurn : 0 };
}
const HINGE_OPEN = -2.55; // radians, how far the front leaf swings
const REST_YAW = 0.16; // the extracted case rests slightly turned so its spine edge catches the light

interface CaseNode {
  entry: Entry;
  group: THREE.Group;
  front: THREE.Mesh;
  back: THREE.Mesh;
  spine: THREE.Mesh;
  hinge: THREE.Group;
  slot: Spring;
  presence: Spring;
  materials: THREE.MeshPhysicalMaterial[];
  frontMat: THREE.MeshPhysicalMaterial;
  spineMat: THREE.MeshPhysicalMaterial;
  insideLeftMat: THREE.MeshPhysicalMaterial;
  insideRightMat: THREE.MeshPhysicalMaterial;
  hero: boolean;
}

export interface StageHandle {
  dispose(): void;
}

function texture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

let coatRoughness = 0.25;
function physical(opts: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    roughness: 0.6,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: coatRoughness,
    envMapIntensity: 0.9,
    ...opts,
  });
}

export function createStage(canvas: HTMLCanvasElement, field: HTMLElement, store: Store): StageHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const small = Math.min(innerWidth, innerHeight) < 700;
  const params = new URLSearchParams(location.search);
  let quality: "high" | "low" = params.get("quality") === "low" ? "low" : "high";
  // Look wedges (review only): ?key=<intensity> and ?coat=<clearcoat roughness>.
  const wedgeKey = Number(params.get("key"));
  const wedgeCoat = Number(params.get("coat"));
  renderer.setPixelRatio(quality === "low" ? 1 : Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  function applyQuality(): void {
    renderer.setPixelRatio(quality === "low" ? 1 : Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.shadowMap.enabled = quality === "high";
    for (const n of nodes.values()) for (const m of n.materials) m.needsUpdate = true;
    dirty = true;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);

  if (wedgeCoat > 0) coatRoughness = wedgeCoat;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const camBase = new THREE.Vector3(0, 0.7, 8.8);
  camera.position.copy(camBase);
  const lookAt = new THREE.Vector3(0, 0.1, 0);

  // Light rig (look development record): one warm key with shadows, environment fill, a weak cool rim.
  const key = new THREE.DirectionalLight(0xfff4e6, wedgeKey > 0 ? wedgeKey : 2.4);
  key.position.set(-3.2, 5.2, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -4.5;
  key.shadow.camera.right = 4.5;
  key.shadow.camera.top = 4.5;
  key.shadow.camera.bottom = -4.5;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  scene.add(key.target);
  const rim = new THREE.DirectionalLight(0xdde6ff, 0.6);
  rim.position.set(3.5, 1.5, -3);
  scene.add(rim);

  const rack = new THREE.Group();
  scene.add(rack);

  // Depth: far cases fade toward the stock so the near arc reads as the shelf. Range set on resize.
  const fog = new THREE.Fog(0xe9e5dd, 8, 12);
  scene.fog = fog;

  // Shared geometry for every case.
  const leafGeo = new THREE.BoxGeometry(CASE_W, CASE_H, LEAF_D);
  const spineGeo = new THREE.BoxGeometry(SPINE_T, CASE_H, CASE_D);

  const nodes = new Map<string, CaseNode>();
  let order: Entry[] = [];
  let total = 1;
  let geo = rackGeometry(11);

  // Continuous rack position in slots; the committed target is store.state.current.
  const pos = new Spring(0, { stiffness: 120, ratio: 1 });
  const extract = new Spring(0, { stiffness: 110, ratio: 0.96 });
  const openness = new Spring(0, { stiffness: 55, ratio: 1 });
  const camPush = new Spring(0, { stiffness: 40, ratio: 1 });
  const inspectYaw = new Spring(0, { stiffness: 60, ratio: 0.9 });
  const inspectPitch = new Spring(0, { stiffness: 60, ratio: 0.9 });

  let reduced = store.state.motion === "reduced";
  let dragging: null | { kind: "rack" | "inspect"; startX: number; startY: number; startPos: number; lastX: number; lastT: number; velocity: number; moved: boolean; pointerId: number } = null;
  let settledFor = -1;
  let arrivalT = reduced ? 1 : 0;
  let dirty = true;
  let frame = 0;
  let lastTime = performance.now();
  let disposed = false;
  let hovered: CaseNode | null = null;
  let currentNode: CaseNode | null = null;
  const heroCache = new Map<string, { front: THREE.CanvasTexture; left: THREE.CanvasTexture; right: THREE.CanvasTexture }>();

  function slotAngle(i: number): number {
    return i * geo.step;
  }

  function buildNode(entry: Entry): CaseNode {
    const ink = new THREE.Color(inkOf(entry));
    const edge = new THREE.Color(edgeColour(entry));
    const frontMat = physical({ color: ink });
    const insideLeftMat = physical({ color: 0xf2efe9, clearcoat: 0.2, roughness: 0.85 });
    const insideRightMat = physical({ color: ink, clearcoat: 0.6 });
    const backMat = physical({ color: ink });
    const spineMat = physical({ color: ink });
    const edgeMat = physical({ color: edge, clearcoat: 0.8, roughness: 0.5 });

    // Box material order: +x, -x, +y, -y, +z, -z
    const front = new THREE.Mesh(leafGeo, [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, insideLeftMat]);
    const back = new THREE.Mesh(leafGeo, [edgeMat, edgeMat, edgeMat, edgeMat, insideRightMat, backMat]);
    const spine = new THREE.Mesh(spineGeo, [edgeMat, spineMat, edgeMat, edgeMat, edgeMat, edgeMat]);
    for (const m of [front, back, spine]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    const group = new THREE.Group();
    // Assemble: spine on the left (-x), back leaf behind (-z), front leaf in front (+z).
    spine.position.set(-CASE_W / 2 - SPINE_T / 2, 0, 0);
    back.position.set(0, 0, -(CASE_D / 2 - LEAF_D / 2));
    const hinge = new THREE.Group();
    hinge.position.set(-CASE_W / 2, 0, CASE_D / 2 - LEAF_D / 2);
    front.position.set(CASE_W / 2, 0, 0);
    hinge.add(front);
    group.add(spine, back, hinge);

    // On the rack the spine faces outward: a +90 degree yaw sends local -x along the rack's +z.
    group.rotation.y = Math.PI / 2;

    const node: CaseNode = {
      entry,
      group,
      front,
      back,
      spine,
      hinge,
      slot: new Spring(0, { stiffness: 60, ratio: 1 }),
      presence: new Spring(0, { stiffness: 50, ratio: 1 }),
      materials: [frontMat, insideLeftMat, insideRightMat, backMat, spineMat, edgeMat],
      frontMat,
      spineMat,
      insideLeftMat,
      insideRightMat,
      hero: false,
    };
    for (const m of [front, back, spine]) m.userData.node = node;
    return node;
  }

  async function paintRackTextures(node: CaseNode): Promise<void> {
    await ensureFonts();
    if (disposed) return;
    const insert = texture(drawInsert(node.entry, total, small ? 256 : 320), renderer);
    const spine = texture(drawSpine(node.entry, small ? 48 : 64), renderer);
    node.frontMat.map = insert;
    node.frontMat.color.set(0xffffff);
    node.frontMat.needsUpdate = true;
    node.spineMat.map = spine;
    node.spineMat.color.set(0xffffff);
    node.spineMat.needsUpdate = true;
    dirty = true;
  }

  async function paintHero(node: CaseNode): Promise<void> {
    await ensureFonts();
    if (disposed || currentNode !== node) return;
    let hero = heroCache.get(node.entry.name);
    if (!hero) {
      hero = {
        front: texture(drawInsert(node.entry, total, small ? 640 : 1024), renderer),
        left: texture(drawInsideLeft(node.entry, total, small ? 512 : 768), renderer),
        right: texture(drawInsideRight(node.entry, small ? 512 : 768), renderer),
      };
      heroCache.set(node.entry.name, hero);
      if (heroCache.size > 6) {
        const oldest = heroCache.keys().next().value as string;
        const dropped = heroCache.get(oldest)!;
        heroCache.delete(oldest);
        for (const t of [dropped.front, dropped.left, dropped.right]) t.dispose();
      }
    }
    node.frontMat.map = hero.front;
    node.insideLeftMat.map = hero.left;
    node.insideLeftMat.color.set(0xffffff);
    node.insideRightMat.map = hero.right;
    node.insideRightMat.color.set(0xffffff);
    for (const m of [node.frontMat, node.insideLeftMat, node.insideRightMat]) m.needsUpdate = true;
    node.hero = true;
    dirty = true;
  }

  function dropHero(node: CaseNode): void {
    if (!node.hero) return;
    node.hero = false;
    node.insideLeftMat.map = null;
    node.insideLeftMat.color.set(0xf2efe9);
    node.insideRightMat.map = null;
    node.insideRightMat.color.set(inkOf(node.entry));
    for (const m of [node.insideLeftMat, node.insideRightMat]) m.needsUpdate = true;
    // The rack-resolution insert is repainted lazily.
    void paintRackTextures(node);
  }

  function syncCatalogue(state: State): void {
    order = state.visible;
    total = Math.max(1, state.all.length);
    const next = rackGeometry(Math.max(order.length, 1));
    if (next.step !== geo.step || next.radius !== geo.radius || next.rise !== geo.rise) {
      geo = next;
      resize();
    }
    const alive = new Set<string>();
    order.forEach((entry, i) => {
      alive.add(entry.name);
      let node = nodes.get(entry.name);
      if (!node) {
        node = buildNode(entry);
        node.slot.snap(i);
        node.presence.x = reduced ? 1 : 0;
        node.presence.target = 1;
        nodes.set(entry.name, node);
        rack.add(node.group);
        void paintRackTextures(node);
      }
      node.slot.target = i;
      node.presence.target = 1;
      if (reduced) {
        node.slot.snap(i);
        node.presence.snap(1);
      }
    });
    for (const [name, node] of nodes) {
      if (!alive.has(name)) {
        node.presence.target = 0;
        if (reduced) node.presence.snap(0);
      }
    }
    dirty = true;
  }

  function placeNode(node: CaseNode, isCurrent: boolean): void {
    const i = node.slot.x;
    const a = slotAngle(i);
    const p = node.presence.x;
    const g = node.group;
    // Only the front arc is drawn; cases fade out at the sides where they are edge-on.
    // The angle is not wrapped, so the two ends of the arc never see each other.
    const phi = pos.x * geo.step;
    const rel = a - phi;
    const arc = isCurrent ? 1 : clamp((WINDOW - Math.abs(rel)) / WINDOW_FADE, 0, 1);
    const visible = p * arc;
    g.visible = visible > 0.005;
    if (!g.visible) return;
    const e = isCurrent ? extract.x : 0;
    const o = isCurrent ? openness.x : 0;
    const r = geo.radius + e * PULL;
    // The rack is rotated by -phi, so a sideways offset wanted in world x must be expressed
    // in the rack's frame: local = R_y(phi) * world.
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    // On wide stages the extracted case moves to the right so the rack and the caption keep the left.
    // When it opens, the spread (hinge at the case's left edge) is centred on layout.openX.
    const worldX = e * layout.extractX * (1 - o) + (layout.openX - layout.rackX + CASE_W / 2) * o;
    const baseX = Math.sin(a) * r;
    const baseZ = Math.cos(a) * r;
    const x = (1 - o) * baseX + o * (Math.sin(a) * geo.radius) + worldX * cos;
    const z = (1 - o) * baseZ + o * (Math.cos(a) * (geo.radius + PULL)) - worldX * sin;
    g.position.set(x, i * geo.rise + e * layout.extractY + o * 0.05, z);
    // Base orientation: spine outward (yaw +90). Extraction yaws the cover toward the viewer.
    const yaw = a + (Math.PI / 2) * (1 - e) + REST_YAW * e * (1 - o) + (isCurrent ? inspectYaw.x : 0);
    const pitch = isCurrent ? inspectPitch.x : 0;
    g.rotation.set(pitch, yaw, 0, "YXZ");
    // Opening: the front leaf swings on the spine hinge.
    node.hinge.rotation.y = HINGE_OPEN * o;
    const s = 0.001 + visible * 0.999;
    g.scale.setScalar(s);
  }

  const layout = { extractX: 0.5, extractY: 0.12, lookY: 0.1, openX: 0.1, rackX: 0 };
  function resize(): void {
    const w = Math.max(1, field.clientWidth);
    const h = Math.max(1, field.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const wide = camera.aspect > 1.15;
    // Wide: the case comes out to the right of the rack. Narrow: it stays centred and sits high,
    // above the caption, and the camera backs off so the whole case fits.
    // The rack sits left of centre on wide stages; the extracted case comes out to the right of it.
    layout.rackX = wide ? -0.8 : 0;
    layout.extractX = wide ? 1.35 : 0;
    layout.extractY = wide ? 0.05 : 0.5;
    layout.lookY = wide ? -0.5 : -0.3;
    layout.openX = wide ? 0.3 : 0;
    rack.position.x = layout.rackX;
    lookAt.y = layout.lookY;
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const needed = (wide ? 2.4 : 1.45) / (halfV * camera.aspect) + geo.radius + 0.6;
    camBase.z = Math.max(wide ? 8.4 : 9.4, needed);
    fog.near = camBase.z - geo.radius + 1.0;
    fog.far = camBase.z + geo.radius * 0.5;
    camera.updateProjectionMatrix();
    dirty = true;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(field);
  resize();

  // ---------- input ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function hit(x: number, y: number): CaseNode | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const meshes: THREE.Object3D[] = [];
    for (const n of nodes.values()) if (n.group.visible) meshes.push(n.front, n.back, n.spine);
    const found = raycaster.intersectObjects(meshes, false);
    return found.length ? (found[0].object.userData.node as CaseNode) : null;
  }

  function pxPerSlot(): number {
    // Screen pixels of rack travel per slot at the front of the drum.
    const rect = canvas.getBoundingClientRect();
    const dist = camera.position.z - geo.radius;
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const unitsPerPx = (2 * halfV * dist) / rect.height;
    return (geo.step * geo.radius) / unitsPerPx;
  }

  let wheelAccum = 0;
  let wheelTimer = 0;
  function onWheel(e: WheelEvent): void {
    if (store.state.mode === "loading" || store.state.mode === "failed") return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
    const delta = (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) * unit;
    wheelAccum += delta;
    const threshold = 90;
    const steps = Math.trunc(wheelAccum / threshold);
    if (steps !== 0) {
      wheelAccum -= steps * threshold;
      store.step(steps, "wheel");
    }
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => (wheelAccum = 0), 240);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (store.state.mode === "loading" || store.state.mode === "failed") return;
    const target = hit(e.clientX, e.clientY);
    const inspecting = target !== null && target === currentNode && store.state.mode === "settled";
    dragging = { kind: inspecting ? "inspect" : "rack", startX: e.clientX, startY: e.clientY, startPos: pos.x, lastX: e.clientX, lastT: performance.now(), velocity: 0, moved: false, pointerId: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) {
      const target = hit(e.clientX, e.clientY);
      if (target !== hovered) {
        hovered = target;
        canvas.style.cursor = target ? "pointer" : "grab";
        dirty = true;
      }
      return;
    }
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    if (!dragging.moved && Math.hypot(dx, dy) > 6) {
      dragging.moved = true;
      if (dragging.kind === "rack") store.unsettle();
    }
    if (!dragging.moved) return;
    const now = performance.now();
    if (dragging.kind === "rack") {
      const slots = -dx / pxPerSlot();
      const next = dragging.startPos + slots;
      const dt = Math.max(1, now - dragging.lastT) / 1000;
      dragging.velocity = (next - pos.x) / dt;
      pos.x = next;
      pos.target = next;
      pos.v = 0;
    } else {
      inspectYaw.target = clamp(dx / 260, -0.9, 0.9);
      inspectPitch.target = clamp(dy / 320, -0.5, 0.5);
    }
    dragging.lastX = e.clientX;
    dragging.lastT = now;
    dirty = true;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    const d = dragging;
    dragging = null;
    canvas.releasePointerCapture(d.pointerId);
    canvas.style.cursor = "grab";
    if (!d.moved) {
      // A tap: open the current case, or select the tapped one.
      const target = hit(e.clientX, e.clientY);
      if (target && target === currentNode) {
        if (store.state.mode === "settled") store.open();
      } else if (target) {
        const idx = order.indexOf(target.entry);
        if (idx >= 0) store.select(idx, "drag");
      }
      return;
    }
    if (d.kind === "rack") {
      // Release: keep the gesture velocity and settle on the nearest slot the fling reaches.
      const v = clamp(d.velocity, -40, 40);
      const projected = pos.x + v * 0.12;
      const target = Math.round(clamp(projected, 0, Math.max(0, order.length - 1)));
      pos.v = v;
      store.select(target, "drag");
    } else {
      inspectYaw.target = 0;
      inspectPitch.target = 0;
    }
    dirty = true;
  }

  function onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const mode = store.state.mode;
    if (mode === "loading" || mode === "failed") return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        store.step(1, "keys");
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        store.step(-1, "keys");
        break;
      case "Home":
        e.preventDefault();
        store.select(0, "keys");
        break;
      case "End":
        e.preventDefault();
        store.select(order.length - 1, "keys");
        break;
      case "Enter":
      case " ":
        if (t && (t.tagName === "BUTTON" || t.tagName === "A")) return;
        e.preventDefault();
        if (mode === "settled" || mode === "browsing") store.open();
        break;
      case "Escape":
        if (mode === "open") {
          e.preventDefault();
          store.close();
        }
        break;
    }
  }

  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", () => {
    if (!dragging && hovered) {
      hovered = null;
      dirty = true;
    }
  });
  window.addEventListener("keydown", onKey);
  canvas.style.cursor = "grab";

  // ---------- state coupling ----------
  const unsubscribe = store.on((state, previous) => {
    reduced = state.motion === "reduced";
    if (state.visible !== previous.visible || state.all !== previous.all) syncCatalogue(state);
    if (state.current !== previous.current || state.selectionTick !== previous.selectionTick || state.visible !== previous.visible) {
      pos.target = Math.max(0, state.current);
      if (state.via === "init" && previous.mode === "loading") {
        // Arrival: start a few slots away and turn into place once.
        pos.x = reduced ? pos.target : pos.target + THREE.MathUtils.degToRad(70) / geo.step;
        pos.v = 0;
      }
      if (reduced) pos.snap(pos.target);
      settledFor = -1;
      const next = state.current >= 0 ? nodes.get(state.visible[state.current]?.name) ?? null : null;
      if (next !== currentNode) {
        if (currentNode) dropHero(currentNode);
        currentNode = next;
        extract.x = 0;
        extract.v = 0;
        openness.snap(0);
        inspectYaw.snap(0);
        inspectPitch.snap(0);
      }
    }
    if (state.mode !== previous.mode) {
      if (state.mode === "settled" && currentNode) {
        extract.target = 1;
        openness.target = 0;
        camPush.target = 0;
        void paintHero(currentNode);
        if (reduced) extract.snap(1);
      } else if (state.mode === "open" && currentNode) {
        extract.target = 1;
        openness.target = 1;
        camPush.target = 1;
        inspectYaw.target = 0;
        inspectPitch.target = 0;
        void paintHero(currentNode);
        if (reduced) {
          extract.snap(1);
          openness.snap(1);
          camPush.snap(1);
        }
      } else if (state.mode === "browsing") {
        extract.target = 0;
        openness.target = 0;
        camPush.target = 0;
        if (reduced) {
          extract.snap(0);
          openness.snap(0);
          camPush.snap(0);
        }
      }
    }
    dirty = true;
  });

  // ---------- frame loop ----------
  let slowFrames = 0;
  let sampled = 0;
  let renderedLastFrame = false;
  function tick(now: number): void {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const rawDt = (now - lastTime) / 1000;
    const dt = Math.min(0.05, rawDt);
    lastTime = now;
    // Degraded-condition detection: sustained slow frames while rendering drop to the low tier once.
    if (quality === "high" && renderedLastFrame) {
      sampled++;
      if (rawDt > 0.045) slowFrames++;
      if (sampled >= 40) {
        if (slowFrames > 24) {
          quality = "low";
          applyQuality();
        }
        sampled = 0;
        slowFrames = 0;
      }
    }
    renderedLastFrame = false;

    let moving = false;
    if (!dragging || dragging.kind !== "rack") {
      pos.step(dt);
      if (!pos.settled(0.0015, 0.004)) moving = true;
    } else moving = true;
    for (const s of [extract, openness, camPush, inspectYaw, inspectPitch]) {
      s.step(dt);
      if (!s.settled(0.001, 0.003)) moving = true;
    }
    for (const n of nodes.values()) {
      n.slot.step(dt);
      n.presence.step(dt);
      if (!n.slot.settled(0.001, 0.003) || !n.presence.settled(0.001, 0.003)) moving = true;
    }
    if (arrivalT < 1) {
      arrivalT = Math.min(1, arrivalT + dt / 1.1);
      moving = true;
    }

    // Settle detection: the rack has stopped on the committed case.
    const state = store.state;
    if (!dragging && state.mode === "browsing" && state.current >= 0 && pos.settled(0.004, 0.02) && settledFor !== state.selectionTick) {
      settledFor = state.selectionTick;
      store.settle();
    }

    if (!moving && !dirty) return;
    dirty = false;
    renderedLastFrame = true;

    rack.rotation.y = -pos.x * geo.step;
    rack.position.y = -pos.x * geo.rise;

    const arrival = easeOutCubic(arrivalT);
    camera.position.set(camBase.x + openness.x * layout.openX, camBase.y + (1 - arrival) * 0.3, camBase.z + (1 - arrival) * 1.2 - camPush.x * 0.5);
    camera.lookAt(lookAt.x + openness.x * layout.openX, lookAt.y + extract.x * 0.08, lookAt.z + extract.x * 1.2);

    for (const n of nodes.values()) {
      const isCurrent = n === currentNode;
      placeNode(n, isCurrent);
      const hover = n === hovered && !isCurrent ? 0.07 : 0;
      if (n.spineMat.emissive.r !== hover) {
        n.spineMat.emissive.setScalar(hover);
        n.frontMat.emissive.setScalar(hover);
      }
    }
    // The current case leaves the rack frame: keep the key light's shadow target on the drum.
    key.target.position.set(layout.rackX, -pos.x * geo.rise + 0.2, 0);
    key.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(tick);

  function onVisibility(): void {
    if (document.hidden) cancelAnimationFrame(frame);
    else {
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  if (params.get("review")) {
    (window as unknown as { __rack: unknown }).__rack = {
      snap() {
        for (const sp of [pos, extract, openness, camPush, inspectYaw, inspectPitch]) sp.snap();
        for (const n of nodes.values()) {
          n.slot.snap();
          n.presence.snap();
        }
        arrivalT = 1;
        dirty = true;
      },
    };
  }

  syncCatalogue(store.state);
  if (store.state.current >= 0) {
    pos.target = store.state.current;
    pos.x = reduced ? pos.target : pos.target + THREE.MathUtils.degToRad(70) / geo.step;
    currentNode = nodes.get(store.state.visible[store.state.current].name) ?? null;
  }

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      unsubscribe();
      ro.disconnect();
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.dispose();
    },
  };
}
