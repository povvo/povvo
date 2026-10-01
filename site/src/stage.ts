import * as THREE from "three";
import type { Entry } from "./catalogue";
import { FIELD } from "./catalogue";
import { drawInsert, drawInsideLeft, drawInsideRight, drawSpine, edgeColour, ensureFonts, shellHex } from "./covers";
import { FRONT_CLEAR, TURN_BLOCK, gateCase } from "./gates";
import { Spring, clamp, easeOutCubic, smoothstep } from "./motion";
import type { State, Store } from "./state";

/**
 * The rack. Coordinate contract (3d-motion-design: transforms and pivots):
 *   world: right-handed, +y up, +z toward the viewer, units of ten centimetres. The floor is
 *     the plane y = FLOOR_Y; it only receives shadows, the heat field behind is the page.
 *   rack group: rotates about +y and translates along y; a case's slot i sits at angle
 *     i * step around the axis and height i * rise. Slot 0 is at the front (+z).
 *   case group: local +x is the case's outward normal while it is on the rack (its spine
 *     faces the viewer); presenting yaws it by a quarter turn so local +z (the cover) faces
 *     the viewer. The hinge pivot is the front edge of the spine.
 *
 * Each case owns three gated springs (recipe/direction-v2.md, mechanism changes):
 *   pull  0..1  straight out along the outward normal, far enough to clear the rack
 *   turn  0..1  the quarter turn and the float up to the presentation spot
 *   open  0..1  the front leaf swings on the hinge
 * Out runs pull, then turn, then open; back runs close, then turn back, then retract. Only
 * one case may be turned at a time. A case that loses the selection runs its own reverse
 * sequence while the rack turns, so nothing ever snaps shut or passes through a neighbour.
 *
 * Reflow (filter, sort, new data) never slides cases past each other: visible cases sink
 * through the floor, the slots change unseen, and the cases rise again from the front out.
 */

const CASE_W = 1.35;
const CASE_H = 1.9;
const CASE_D = 0.15;
const LEAF_D = CASE_D * 0.42;
const SPINE_T = 0.03;
const PULL_OUT = 1.6; // > 1.414, the radius a case sweeps while turning plus the rack's outer edge
const FLOOR_Y = -CASE_H / 2;
const SINK = CASE_H + 0.15;
const WINDOW = THREE.MathUtils.degToRad(100); // cases beyond this angle from the front are not drawn
const WINDOW_FADE = THREE.MathUtils.degToRad(12);
const HINGE_OPEN = -2.55; // radians, how far the front leaf swings
const REST_YAW = 0.14; // the presented case rests slightly turned so its spine edge catches the sun

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

/** Where the callout points on each cover layout, as fractions of the insert from its top left. */
const CALLOUT_AT: Record<Entry["layout"], [number, number]> = {
  quilt: [0.2, 0.928],
  block: [0.2, 0.07],
  horizon: [0.2, 0.735],
  specimen: [0.79, 0.075],
};

interface CaseNode {
  entry: Entry;
  group: THREE.Group;
  front: THREE.Mesh;
  back: THREE.Mesh;
  spine: THREE.Mesh;
  hinge: THREE.Group;
  slot: number;
  alive: boolean;
  pull: Spring;
  turn: Spring;
  open: Spring;
  lift: Spring;
  /** Seconds to wait before rising, for the stagger. */
  liftDelay: number;
  clip: THREE.Plane;
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

let coatRoughness = 0.16;
function physical(opts: THREE.MeshPhysicalMaterialParameters): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    roughness: 0.55,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: coatRoughness,
    envMapIntensity: 1,
    ...opts,
  });
}

/**
 * The environment the gloss reflects: a sky-to-sand dome with a low sun, so the cases
 * pick up the same heat field the page is printed on (look development: environment).
 */
function heatEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        sky: { value: new THREE.Color(FIELD.sky) },
        haze: { value: new THREE.Color(FIELD.paper) },
        sand: { value: new THREE.Color(FIELD.dust) },
      },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader:
        "uniform vec3 sky; uniform vec3 haze; uniform vec3 sand; varying vec3 vDir;" +
        "void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(haze, sky, smoothstep(0.0, 0.55, y)) : mix(haze, sand, smoothstep(0.0, 0.25, -y)); gl_FragColor = vec4(c, 1.0); }",
    }),
  );
  env.add(dome);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) }));
  sun.position.set(-9, 11, 9);
  env.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

export function createStage(canvas: HTMLCanvasElement, field: HTMLElement, store: Store): StageHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const stageEl = field.closest<HTMLElement>(".stage") ?? field;
  const small = Math.min(innerWidth, innerHeight) < 700;
  const params = new URLSearchParams(location.search);
  let quality: "high" | "low" = params.get("quality") === "low" ? "low" : "high";
  // Look wedges (review only): ?key=<intensity> and ?coat=<clearcoat roughness>.
  const wedgeKey = Number(params.get("key"));
  const wedgeCoat = Number(params.get("coat"));
  if (wedgeCoat > 0) coatRoughness = wedgeCoat;
  renderer.setPixelRatio(quality === "low" ? 1 : Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral keeps the shells' hues where the direction measured them; ACES shifts orange to yellow.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.environment = heatEnvironment(renderer);
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const camBase = new THREE.Vector3(0, 0.2, 10);
  camera.position.copy(camBase);
  const lookAt = new THREE.Vector3(0, 0.35, 0);

  // Light rig: one hot sun from high front left with hard-ish shadows, a cool sky fill.
  const key = new THREE.DirectionalLight(0xfff1dc, wedgeKey > 0 ? wedgeKey : 2.6);
  key.position.set(-4.2, 6.5, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 2;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.HemisphereLight(0xcfe6df, 0xd8be83, 0.5);
  scene.add(fill);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: 0x3a2a12, opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y - 0.002;
  floor.receiveShadow = true;
  scene.add(floor);

  const rack = new THREE.Group();
  scene.add(rack);

  // Heat haze: far cases fade into the field's off-white. Range set on resize.
  const fog = new THREE.Fog(0xf4ecd6, 9, 16);
  scene.fog = fog;

  const leafGeo = new THREE.BoxGeometry(CASE_W, CASE_H, LEAF_D);
  const spineGeo = new THREE.BoxGeometry(SPINE_T, CASE_H, CASE_D);

  const nodes = new Map<string, CaseNode>();
  let order: Entry[] = [];
  let geo = rackGeometry(11);

  // Continuous rack position in slots; the committed target is store.state.current.
  const pos = new Spring(0, { stiffness: 120, ratio: 1 });
  const inspectYaw = new Spring(0, { stiffness: 60, ratio: 0.9 });
  const inspectPitch = new Spring(0, { stiffness: 60, ratio: 0.9 });

  let reduced = store.state.motion === "reduced";
  let dragging: null | { kind: "rack" | "inspect"; startX: number; startY: number; startPos: number; lastT: number; velocity: number; moved: boolean; pointerId: number } = null;
  let settledFor = -1;
  let arrivalT = reduced ? 1 : 0;
  let dirty = true;
  let frame = 0;
  let lastTime = performance.now();
  let disposed = false;
  let hovered: CaseNode | null = null;
  let currentNode: CaseNode | null = null;
  /** A reflow in progress: visible cases sinking before their slots change. */
  let reflow: null | { phase: "sink" | "rise"; slots: Map<CaseNode, number> } = null;
  const heroCache = new Map<string, { front: THREE.CanvasTexture; left: THREE.CanvasTexture; right: THREE.CanvasTexture }>();

  function buildNode(entry: Entry): CaseNode {
    const shell = new THREE.Color(shellHex(entry));
    const edge = new THREE.Color(edgeColour(entry));
    const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
    const clippingPlanes = [clip];
    const frontMat = physical({ color: shell, clippingPlanes });
    const insideLeftMat = physical({ color: FIELD.bone, clearcoat: 0.2, roughness: 0.85, clippingPlanes });
    const insideRightMat = physical({ color: shell, clearcoat: 0.6, clippingPlanes });
    const backMat = physical({ color: shell, clippingPlanes });
    const spineMat = physical({ color: shell, clippingPlanes });
    const edgeMat = physical({ color: edge, clearcoat: 0.8, roughness: 0.45, clippingPlanes });

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

    const node: CaseNode = {
      entry,
      group,
      front,
      back,
      spine,
      hinge,
      slot: 0,
      alive: true,
      pull: new Spring(0, { stiffness: 200, ratio: 1 }),
      turn: new Spring(0, { stiffness: 150, ratio: 1 }),
      open: new Spring(0, { stiffness: 70, ratio: 1 }),
      lift: new Spring(0, { stiffness: 170, ratio: 1 }),
      liftDelay: 0,
      clip,
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
    const insert = texture(drawInsert(node.entry, small ? 256 : 320), renderer);
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
        front: texture(drawInsert(node.entry, small ? 640 : 1024), renderer),
        left: texture(drawInsideLeft(node.entry, small ? 512 : 768), renderer),
        right: texture(drawInsideRight(node.entry, small ? 512 : 768), renderer),
      };
      heroCache.set(node.entry.name, hero);
      if (heroCache.size > 6) {
        const oldest = heroCache.keys().next().value as string;
        const dropped = heroCache.get(oldest)!;
        heroCache.delete(oldest);
        for (const t of [dropped.front, dropped.left, dropped.right]) t.dispose();
        const owner = nodes.get(oldest);
        if (owner?.hero) dropHero(owner);
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
    node.insideLeftMat.color.set(FIELD.bone);
    node.insideRightMat.map = null;
    node.insideRightMat.color.set(shellHex(node.entry));
    for (const m of [node.insideLeftMat, node.insideRightMat]) m.needsUpdate = true;
    // The rack-resolution insert is repainted lazily.
    void paintRackTextures(node);
  }

  /** Angle of a slot relative to the front, unwrapped so the two ends of the arc never meet. */
  function relAngle(slot: number): number {
    return slot * geo.step - pos.x * geo.step;
  }

  function inView(node: CaseNode): boolean {
    return node.group.visible && Math.abs(relAngle(node.slot)) < WINDOW + WINDOW_FADE;
  }

  function staggerFor(slot: number, front: number): number {
    return reduced ? 0 : Math.min(0.5, Math.abs(slot - front) * 0.035);
  }

  function syncCatalogue(state: State): void {
    const firstLoad = nodes.size === 0;
    order = state.visible;
    const next = rackGeometry(Math.max(order.length, 1));
    const geometryChanged = next.step !== geo.step || next.radius !== geo.radius || next.rise !== geo.rise;
    const front = Math.max(0, state.current);
    const slots = new Map<CaseNode, number>();
    const alive = new Set<string>();
    let visibleChange = false;
    order.forEach((entry, i) => {
      alive.add(entry.name);
      let node = nodes.get(entry.name);
      if (!node) {
        node = buildNode(entry);
        node.slot = i;
        node.lift.snap(0);
        node.alive = false; // rises with the reflow below
        nodes.set(entry.name, node);
        rack.add(node.group);
        void paintRackTextures(node);
      }
      if (node.slot !== i || !node.alive) {
        slots.set(node, i);
        if (node.alive && inView(node)) visibleChange = true;
      }
    });
    for (const node of nodes.values()) {
      if (!alive.has(node.entry.name) && node.alive) {
        node.alive = false;
        if (inView(node)) visibleChange = true;
      }
    }
    if (geometryChanged) visibleChange = visibleChange || !firstLoad;

    if (reduced || firstLoad || (!visibleChange && !reflow)) {
      // Nothing moving in view (or no motion wanted): change slots in place.
      if (geometryChanged) {
        geo = next;
        resize();
      }
      for (const [node, slot] of slots) {
        node.slot = slot;
        node.alive = true;
        node.lift.target = 1;
        node.liftDelay = firstLoad ? 0.15 + staggerFor(slot, front) : staggerFor(slot, front);
        if (reduced) node.lift.snap(1);
      }
      for (const node of nodes.values()) if (!alive.has(node.entry.name)) node.lift.target = 0;
      if (reduced || firstLoad) for (const node of nodes.values()) if (!alive.has(node.entry.name)) node.lift.snap(0);
      if (reduced || firstLoad) pos.snap(front);
    } else {
      // Sink everything in view, re-slot unseen, rise from the front out.
      const all = new Map<CaseNode, number>();
      order.forEach((entry, i) => all.set(nodes.get(entry.name)!, i));
      reflow = { phase: "sink", slots: all };
      pendingGeometry = geometryChanged ? next : pendingGeometry;
      for (const node of nodes.values()) node.lift.target = 0;
    }
    dirty = true;
  }
  let pendingGeometry: RackGeometry | null = null;

  /** Second half of a reflow, once every case in view is under the floor. */
  function completeReflow(): void {
    if (!reflow) return;
    if (pendingGeometry) {
      geo = pendingGeometry;
      pendingGeometry = null;
      resize();
    }
    const front = Math.max(0, store.state.current);
    for (const node of nodes.values()) {
      const slot = reflow.slots.get(node);
      if (slot === undefined) {
        node.alive = false;
        node.lift.snap(0);
        continue;
      }
      node.slot = slot;
      node.alive = true;
      node.pull.snap(0);
      node.turn.snap(0);
      node.open.snap(0);
      node.lift.target = 0;
      node.liftDelay = staggerFor(slot, front);
    }
    pos.snap(front);
    reflow.phase = "rise";
  }

  const layout = { presentX: 0, presentY: 0.45, presentZ: 0, openX: 0, openY: 0.3, push: 0.4, wide: true };
  const tmp = new THREE.Vector3();

  function placeNode(node: CaseNode, isPresented: boolean): void {
    const i = node.slot;
    const rel = relAngle(i);
    const lift = node.lift.x;
    const g = node.group;
    const out = node.pull.x > 0.001 || node.turn.x > 0.001;
    const arc = out ? 1 : clamp((WINDOW - Math.abs(rel)) / WINDOW_FADE, 0, 1);
    g.visible = arc > 0.005 && lift > 0.001;
    if (!g.visible) return;
    const p = node.pull.x;
    const yawT = smoothstep(node.turn.x);
    // The turn is phased. Low in its range the case swings along the arc, just outside the
    // rack, between its slot's angle and the front; high in its range it floats forward and up
    // to the presentation spot. So on the way home it first steps back from the viewer, then
    // swings home close to the rack, and it is at its slot's exact angle whenever it is near
    // enough to the rack to touch a neighbour.
    const swing = smoothstep(clamp((node.turn.x - 0.1) / 0.35, 0, 1));
    const float = smoothstep(clamp((node.turn.x - 0.45) / 0.55, 0, 1));
    const o = node.open.x;
    const phi = pos.x * geo.step;
    // Positions are worked out in the world, then expressed in the rack's frame (local = R_y(phi) world).
    const worldAngle = rel * (1 - swing);
    const radius = geo.radius + p * PULL_OUT + float * layout.presentZ;
    const X = Math.sin(worldAngle) * radius + float * layout.presentX + o * (layout.openX - layout.presentX);
    const Z = Math.cos(worldAngle) * radius;
    const lift3 = float * layout.presentY + o * (layout.openY - layout.presentY);
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    // Sinking clears the floor from wherever the case is, including the presentation spot.
    const sinkY = -(SINK + Math.max(0, lift3)) * (1 - easeOutCubic(lift));
    g.position.set(X * cos + Z * sin, i * geo.rise + lift3 + sinkY, -X * sin + Z * cos);
    // Yaw: spine outward on the rack (+90), cover to the viewer when presented, with a little
    // of the spine edge left in the light.
    const worldYaw = worldAngle + (Math.PI / 2) * (1 - yawT) + REST_YAW * yawT * (1 - o) + (isPresented ? inspectYaw.x : 0);
    const pitch = isPresented ? inspectPitch.x : 0;
    g.rotation.set(pitch, worldYaw + phi, 0, "YXZ");
    node.hinge.rotation.y = HINGE_OPEN * o;
    g.scale.setScalar(0.001 + arc * 0.999);
    // Clip at the floor while the case is below it.
    const baseY = i * geo.rise - pos.x * geo.rise + FLOOR_Y;
    node.clip.constant = lift < 0.999 ? -baseY + 0.001 : 1000;
  }

  function resize(): void {
    const w = Math.max(1, field.clientWidth);
    const h = Math.max(1, field.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    layout.wide = matchMedia("(min-width: 1024px)").matches;
    const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfH = halfV * camera.aspect;
    // Framing by proportion (direction-v2, composition): the presented case fills about two
    // fifths of the stage height and the rack's front case a little over a quarter, so the rack
    // reads as a band on the horizon and the presented case floats well in front of it.
    const presentedShare = layout.wide ? 0.42 : 0.38;
    const rackShare = layout.wide ? 0.27 : 0.25;
    const dPresent = CASE_H / (2 * halfV * presentedShare);
    const dRack = CASE_H / (2 * halfV * rackShare);
    camBase.z = geo.radius + dRack;
    camBase.y = layout.wide ? 0.25 : 0.35;
    lookAt.y = layout.wide ? 0.3 : 0.4;
    layout.presentX = 0;
    layout.presentY = layout.wide ? 0.62 : 0.72;
    layout.presentZ = Math.max(0, camBase.z - dPresent - (geo.radius + PULL_OUT));
    // Open: the spread covers the right of the viewport, so the opened case (whose front leaf
    // swings out to the left) is centred on what remains of the stage.
    const spreadPx = Math.min(760, innerWidth * 0.54);
    const rect = field.getBoundingClientRect();
    const visibleRight = Math.min(rect.right, innerWidth - spreadPx);
    const centrePx = Math.max(0, visibleRight - rect.left) / 2;
    const ndcX = (centrePx / w) * 2 - 1;
    layout.openX = layout.wide ? ndcX * halfH * dPresent + CASE_W * 0.45 : 0;
    layout.openY = layout.wide ? 0.42 : 0.6;
    layout.push = 0;
    fog.near = camBase.z - geo.radius * 0.5;
    fog.far = camBase.z + geo.radius * 2 + 4;
    camera.updateProjectionMatrix();
    placeCamera(0, 1);
    camera.updateMatrixWorld();
    // The page's horizon is the floor's vanishing line, so the printed field and the 3D floor agree.
    tmp.set(camera.position.x, camera.position.y, camera.position.z - 1000).project(camera);
    stageEl.style.setProperty("--horizon", `${(((1 - tmp.y) / 2) * h).toFixed(1)}px`);
    // The giant title sits behind the presentation spot.
    const presentZ = geo.radius + PULL_OUT + layout.presentZ;
    tmp.set(layout.presentX, layout.presentY, presentZ).project(camera);
    stageEl.style.setProperty("--hero-y", `${(((1 - tmp.y) / 2) * h).toFixed(1)}px`);
    const top = tmp.clone().set(layout.presentX, layout.presentY + CASE_H / 2, presentZ).project(camera);
    const bottom = tmp.clone().set(layout.presentX, layout.presentY - CASE_H / 2, presentZ).project(camera);
    stageEl.style.setProperty("--case-h", `${(((top.y - bottom.y) / 2) * h).toFixed(1)}px`);
    dirty = true;
  }

  function placeCamera(openAmount: number, arrival: number): void {
    camera.position.set(camBase.x, camBase.y + (1 - arrival) * 0.25, camBase.z + (1 - arrival) * 0.9 - openAmount * layout.push);
    camera.lookAt(lookAt.x + openAmount * layout.openX * 0.25, lookAt.y, lookAt.z);
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
    for (const n of nodes.values()) if (n.group.visible && n.alive) meshes.push(n.front, n.back, n.spine);
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
    // On narrow layouts the page scrolls vertically; only horizontal wheels turn the rack there.
    const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (!layout.wide && !horizontal) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
    const delta = (horizontal ? e.deltaX : e.deltaY) * unit;
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

  function presented(): CaseNode | null {
    return currentNode && currentNode.turn.x > 0.9 ? currentNode : null;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (store.state.mode === "loading" || store.state.mode === "failed") return;
    const target = hit(e.clientX, e.clientY);
    const inspecting = target !== null && target === presented() && store.state.mode === "settled";
    dragging = { kind: inspecting ? "inspect" : "rack", startX: e.clientX, startY: e.clientY, startPos: pos.x, lastT: performance.now(), velocity: 0, moved: false, pointerId: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) {
      if (e.pointerType !== "mouse") return;
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
      canvas.style.cursor = "grabbing";
      if (dragging.kind === "rack") store.unsettle();
    }
    if (!dragging.moved) return;
    const now = performance.now();
    if (dragging.kind === "rack") {
      const slots = -dx / pxPerSlot();
      const next = clamp(dragging.startPos + slots, -0.6, Math.max(0, order.length - 1) + 0.6);
      const dt = Math.max(1, now - dragging.lastT) / 1000;
      dragging.velocity = (next - pos.x) / dt;
      pos.x = next;
      pos.target = next;
      pos.v = 0;
    } else {
      inspectYaw.target = clamp(dx / 260, -0.9, 0.9);
      inspectPitch.target = clamp(dy / 320, -0.5, 0.5);
    }
    dragging.lastT = now;
    dirty = true;
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    const d = dragging;
    dragging = null;
    if (canvas.hasPointerCapture(d.pointerId)) canvas.releasePointerCapture(d.pointerId);
    canvas.style.cursor = "grab";
    if (!d.moved) {
      if (e.type === "pointercancel") return;
      // A tap: open the presented case, or select the tapped one.
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
    if (t && t.closest("[data-list]")) return; // the tracklist handles its own keys
    const mode = store.state.mode;
    if (mode === "loading" || mode === "failed") return;
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        store.step(1, "keys");
        break;
      case "ArrowLeft":
        e.preventDefault();
        store.step(-1, "keys");
        break;
      case "ArrowDown":
      case "ArrowUp":
        if (!layout.wide) return; // narrow pages scroll
        e.preventDefault();
        store.step(e.key === "ArrowDown" ? 1 : -1, "keys");
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
      if (!reflow) pos.target = Math.max(0, state.current);
      if (reduced) pos.snap(pos.target);
      settledFor = -1;
      const next = state.current >= 0 ? nodes.get(state.visible[state.current]?.name) ?? null : null;
      if (next !== currentNode) {
        // The old case keeps its springs and runs its own way home; nothing is reset here.
        currentNode = next;
        inspectYaw.target = 0;
        inspectPitch.target = 0;
      }
    }
    if (state.mode !== previous.mode && (state.mode === "settled" || state.mode === "open") && currentNode) void paintHero(currentNode);
    dirty = true;
  });

  // ---------- gates ----------
  function gate(node: CaseNode, mode: State["mode"]): void {
    const out = node === currentNode && node.alive && !reflow && node.lift.x > 0.98 && (mode === "settled" || mode === "open");
    let anotherTurned = false;
    let anotherForward = false;
    if (out && node.turn.target < 1)
      for (const other of nodes.values()) {
        if (other === node) continue;
        if (other.turn.x > TURN_BLOCK) anotherTurned = true;
        if (other.turn.x > FRONT_CLEAR) anotherForward = true;
      }
    gateCase(node, out, mode === "open", anotherTurned, anotherForward);
  }

  // ---------- frame loop ----------
  let slowFrames = 0;
  let sampled = 0;
  let renderedLastFrame = false;
  let calloutOn = false;
  function applyQuality(): void {
    renderer.setPixelRatio(quality === "low" ? 1 : Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.shadowMap.enabled = quality === "high";
    for (const n of nodes.values()) for (const m of n.materials) m.needsUpdate = true;
    resize();
  }

  /** Review only: a frozen clock advanced in fixed steps, so sequences can be sampled exactly. */
  let frozen = false;
  function tick(now: number): void {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    if (frozen) return;
    advance(Math.min(0.05, rawDt), rawDt);
  }

  function advance(dt: number, rawDt: number, draw = true): void {
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

    const state = store.state;
    let moving = false;
    if (!dragging || dragging.kind !== "rack") {
      pos.step(dt);
      if (!pos.settled(0.0015, 0.004)) moving = true;
    } else moving = true;
    for (const s of [inspectYaw, inspectPitch]) {
      s.step(dt);
      if (!s.settled(0.001, 0.003)) moving = true;
    }

    // Reflow sequencing.
    if (reflow?.phase === "sink") {
      let down = true;
      for (const n of nodes.values()) if (n.lift.x > 0.02 && n.group.visible) down = false;
      if (down) completeReflow();
      moving = true;
    } else if (reflow?.phase === "rise") {
      let up = true;
      for (const n of nodes.values()) {
        if (!n.alive) continue;
        if (n.liftDelay > 0) {
          n.liftDelay -= dt;
          up = false;
        } else n.lift.target = 1;
        if (n.lift.x < 0.98) up = false;
      }
      if (up) reflow = null;
      moving = true;
    }

    for (const n of nodes.values()) {
      if (!reflow && n.alive) {
        if (n.liftDelay > 0) {
          n.liftDelay -= dt;
          moving = true;
        } else n.lift.target = 1;
      }
      // Under reduced motion the gate sequence resolves within the frame.
      for (let pass = 0; pass < (reduced ? 4 : 1); pass++) {
        gate(n, state.mode);
        if (reduced) {
          n.pull.snap();
          n.turn.snap();
          n.open.snap();
          n.lift.snap();
        }
      }
      for (const s of [n.pull, n.turn, n.open, n.lift]) {
        s.step(dt);
        if (!s.settled(0.001, 0.003)) moving = true;
      }
    }
    if (arrivalT < 1) {
      arrivalT = Math.min(1, arrivalT + dt / 1.4);
      moving = true;
    }

    // Settle detection: the rack has stopped on the committed case.
    if (!dragging && !reflow && state.mode === "browsing" && state.current >= 0 && pos.settled(0.004, 0.02) && settledFor !== state.selectionTick) {
      settledFor = state.selectionTick;
      store.settle();
    }

    if ((!moving && !dirty) || !draw) return;
    dirty = false;
    renderedLastFrame = true;

    rack.rotation.y = -pos.x * geo.step;
    rack.position.y = -pos.x * geo.rise;

    let openAmount = 0;
    for (const n of nodes.values()) openAmount = Math.max(openAmount, n.open.x);
    placeCamera(easeOutCubic(openAmount), easeOutCubic(arrivalT));

    const shown = presented();
    for (const n of nodes.values()) {
      placeNode(n, n === shown);
      const hover = n === hovered && n !== currentNode ? 0.06 : 0;
      if (n.spineMat.emissive.r !== hover) {
        n.spineMat.emissive.setScalar(hover);
        n.frontMat.emissive.setScalar(hover);
      }
    }
    key.target.position.set(0, -pos.x * geo.rise, 0);
    key.target.updateMatrixWorld();

    // The callout follows the capsule code printed on the presented cover.
    const wantCallout = Boolean(shown && shown.turn.x > 0.985 && shown.open.x < 0.02 && state.mode === "settled" && shown.pull.settled(0.01, 0.05));
    if (shown && wantCallout) {
      rack.updateMatrixWorld();
      camera.updateMatrixWorld();
      const [u, v] = CALLOUT_AT[shown.entry.layout];
      tmp.set(-CASE_W / 2 + u * CASE_W, CASE_H / 2 - v * CASE_H, LEAF_D / 2).applyMatrix4(shown.front.matrixWorld).project(camera);
      const w = field.clientWidth;
      const h = field.clientHeight;
      stageEl.style.setProperty("--ax", `${(((tmp.x + 1) / 2) * w).toFixed(1)}px`);
      stageEl.style.setProperty("--ay", `${(((1 - tmp.y) / 2) * h).toFixed(1)}px`);
      stageEl.dataset.calloutSide = u > 0.5 ? "right" : "left";
    }
    if (wantCallout !== calloutOn) {
      calloutOn = wantCallout;
      stageEl.dataset.callout = wantCallout ? "on" : "off";
    }

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
      freeze() {
        frozen = true;
      },
      step(ms: number) {
        const n = Math.max(1, Math.round(ms / (1000 / 60)));
        for (let k = 0; k < n; k++) advance(1 / 60, 1 / 60, k === n - 1);
      },
      snap() {
        if (reflow?.phase === "sink") completeReflow();
        reflow = null;
        for (const sp of [pos, inspectYaw, inspectPitch]) sp.snap();
        for (let pass = 0; pass < 4; pass++) {
          for (const n of nodes.values()) {
            n.liftDelay = 0;
            if (n.alive) n.lift.target = 1;
            gate(n, store.state.mode);
            for (const s of [n.pull, n.turn, n.open, n.lift]) s.snap();
          }
        }
        if (store.state.mode === "browsing") store.settle();
        arrivalT = 1;
        dirty = true;
      },
    };
  }

  syncCatalogue(store.state);
  if (store.state.current >= 0) {
    pos.snap(store.state.current);
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
