import * as THREE from "three";

/**
 * The 3.5" floppy disk and its box (recipe/direction-v4.md, disks), in scene units of ten
 * centimetres. Disk frame: origin at the centre, +y towards the shutter edge, +z out of the
 * label face. Geometry and the plastic and metal materials are shared by every disk; each
 * disk owns only its label material. The body is one extrusion with the clipped corner and the
 * write-protect and density holes cut through it. The head opening is not cut: its walls would
 * be seen exactly edge on, which some rasterisers leak through the shutter in front. Instead a
 * dark recess of exposed media lies under the shutter on each face, and shows once the shutter
 * slides across.
 */

export const DISK = { W: 0.9, H: 0.94, T: 0.033 } as const;
/** How far the shutter slides to open, along +x. */
export const SHUTTER_SLIDE = 0.2;
/** The label's printed area, in disk units. */
export const LABEL = { x0: -0.36, x1: 0.36, y0: -0.45, y1: 0.11 } as const;
const OPENING = { x0: -0.06, x1: 0.06, y0: 0.2, y1: 0.44 };
const SHUTTER = { x0: -0.32, x1: 0.2, y0: 0.15, y1: 0.47 };
const WINDOW = { x0: -0.26, x1: -0.14, y0: 0.2, y1: 0.44 };
const WP_HOLE = { x0: -0.425, x1: -0.38, y0: -0.445, y1: -0.385 };
const HD_HOLE = { x0: 0.38, x1: 0.425, y0: -0.445, y1: -0.385 };

export interface Disk {
  /** The disk frame. */
  group: THREE.Group;
  body: THREE.Mesh;
  shutter: THREE.Group;
  label: THREE.Mesh;
  labelMat: THREE.MeshStandardMaterial;
  /** Parts only seen up close: hidden while the disk is in the box. */
  detail: THREE.Object3D[];
  writeProtect: THREE.Mesh;
}

function rectPath(p: THREE.Path, r: { x0: number; x1: number; y0: number; y1: number }): void {
  p.moveTo(r.x0, r.y0);
  p.lineTo(r.x0, r.y1);
  p.lineTo(r.x1, r.y1);
  p.lineTo(r.x1, r.y0);
  p.lineTo(r.x0, r.y0);
}

function outline(): THREE.Shape {
  const { W, H } = DISK;
  const r = 0.012;
  const c = 0.04;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 + r, -H / 2);
  s.lineTo(W / 2 - r, -H / 2);
  s.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + r);
  s.lineTo(W / 2, H / 2 - c);
  s.lineTo(W / 2 - c, H / 2);
  s.lineTo(-W / 2 + r, H / 2);
  s.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - r);
  s.lineTo(-W / 2, -H / 2 + r);
  s.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + r, -H / 2);
  for (const hole of [WP_HOLE, HD_HOLE]) {
    const h = new THREE.Path();
    rectPath(h, hole);
    s.holes.push(h);
  }
  return s;
}

interface Shared {
  body: THREE.BufferGeometry;
  plate: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
  label: THREE.BufferGeometry;
  opening: THREE.BufferGeometry;
  hub: THREE.BufferGeometry;
  hubHole: THREE.BufferGeometry;
  arrow: THREE.BufferGeometry;
  slider: THREE.BufferGeometry;
  plastic: THREE.MeshPhysicalMaterial;
  metal: THREE.MeshStandardMaterial;
  mediaMat: THREE.MeshStandardMaterial;
  black: THREE.MeshBasicMaterial;
  emboss: THREE.MeshStandardMaterial;
}

let shared: Shared | null = null;

/** A brushed-steel texture: fine streaks along the shutter's slide. */
function brushed(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < c.height; y++) {
    const v = 178 + Math.round(Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, c.width, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

function build(): Shared {
  const { T } = DISK;
  const bevel = 0.0028;
  const body = new THREE.ExtrudeGeometry(outline(), { depth: T - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.0022, bevelSegments: 2, curveSegments: 4 });
  body.translate(0, 0, -(T - 2 * bevel) / 2);
  body.computeVertexNormals();

  const plateShape = new THREE.Shape();
  rectPath(plateShape, SHUTTER);
  const win = new THREE.Path();
  rectPath(win, WINDOW);
  plateShape.holes.push(win);
  const plate = new THREE.ExtrudeGeometry(plateShape, { depth: 0.0012, bevelEnabled: false, curveSegments: 1 });
  const cap = new THREE.BoxGeometry(SHUTTER.x1 - SHUTTER.x0, 0.003, T + 0.0066);
  cap.translate((SHUTTER.x0 + SHUTTER.x1) / 2, DISK.H / 2 + 0.0015, 0);

  const label = new THREE.PlaneGeometry(LABEL.x1 - LABEL.x0, LABEL.y1 - LABEL.y0);
  label.translate(0, (LABEL.y0 + LABEL.y1) / 2, T / 2 + 0.0011);

  const opening = new THREE.PlaneGeometry(OPENING.x1 - OPENING.x0, OPENING.y1 - OPENING.y0);
  opening.translate((OPENING.x0 + OPENING.x1) / 2, (OPENING.y0 + OPENING.y1) / 2, 0);

  const hub = new THREE.CylinderGeometry(0.125, 0.125, 0.0026, 40);
  hub.rotateX(Math.PI / 2);
  hub.translate(0, -0.03, -T / 2 - 0.0013);
  const hubHole = new THREE.PlaneGeometry(0.042, 0.042);
  hubHole.rotateY(Math.PI);
  hubHole.translate(0, -0.03, -T / 2 - 0.0028);

  const tri = new THREE.Shape();
  tri.moveTo(-0.38, 0.44);
  tri.lineTo(-0.36, 0.405);
  tri.lineTo(-0.4, 0.405);
  tri.lineTo(-0.38, 0.44);
  const arrow = new THREE.ShapeGeometry(tri);
  arrow.translate(0, 0, T / 2 + 0.0004);

  const slider = new THREE.BoxGeometry(WP_HOLE.x1 - WP_HOLE.x0 - 0.004, 0.028, T * 0.72);
  slider.translate((WP_HOLE.x0 + WP_HOLE.x1) / 2, 0, 0);

  return {
    body,
    plate,
    cap,
    label,
    opening,
    hub,
    hubHole,
    arrow,
    slider,
    // Black plastic that stays black. Even black reflects about 4% head on, and the studio
    // environment is bright, so the plastic takes only a trace of it and a softened highlight;
    // the side and rim lights do the shaping.
    plastic: new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.42, metalness: 0, specularIntensity: 0.6, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.16 }),
    // Brushed steel: streaks along the slide, a soft sheen, not a mirror.
    metal: new THREE.MeshStandardMaterial({ color: 0xc4c4c4, map: brushed(), metalness: 1, roughness: 0.4, envMapIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    mediaMat: new THREE.MeshStandardMaterial({ color: 0x1c160f, metalness: 0.1, roughness: 0.38, envMapIntensity: 0.25 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    emboss: new THREE.MeshStandardMaterial({ color: 0x232323, roughness: 0.6, envMapIntensity: 0.04 }),
  };
}

export function sharedDisk(): Shared {
  if (!shared) shared = build();
  return shared;
}

let environment: THREE.Texture | null = null;

/**
 * Give the disks (and the box) their reflections. Set on each material rather than on the
 * scene: with only a scene environment, three.js uses the scene's intensity for every
 * material and ignores each one's own `envMapIntensity`, and black plastic needs far less of
 * the room than steel does.
 */
export function applyEnvironment(tex: THREE.Texture): void {
  environment = tex;
  const s = sharedDisk();
  for (const m of [s.plastic, s.metal, s.mediaMat, s.emboss, boxMaterial]) {
    m.envMap = tex;
    m.needsUpdate = true;
  }
}

export function buildDisk(): Disk {
  const s = sharedDisk();
  const { T } = DISK;
  const group = new THREE.Group();
  const body = new THREE.Mesh(s.body, s.plastic);
  const shutter = new THREE.Group();
  // The shutter stands a little proud of the body, enough for coarse depth buffers to keep apart.
  const front = new THREE.Mesh(s.plate, s.metal);
  front.position.z = T / 2 + 0.0012;
  const back = new THREE.Mesh(s.plate, s.metal);
  back.position.z = -T / 2 - 0.0024;
  const cap = new THREE.Mesh(s.cap, s.metal);
  shutter.add(front, back, cap);
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const label = new THREE.Mesh(s.label, labelMat);
  // The exposed media, front and back, under the shutter.
  const media = new THREE.Mesh(s.opening, s.mediaMat);
  media.position.z = T / 2 + 0.0005;
  const mediaBack = new THREE.Mesh(s.opening, s.mediaMat);
  mediaBack.rotation.y = Math.PI;
  mediaBack.position.z = -T / 2 - 0.0005;
  const hub = new THREE.Mesh(s.hub, s.metal);
  const hubHole = new THREE.Mesh(s.hubHole, s.black);
  const arrow = new THREE.Mesh(s.arrow, s.emboss);
  const writeProtect = new THREE.Mesh(s.slider, s.plastic);
  group.add(body, shutter, label, media, mediaBack, hub, hubHole, arrow, writeProtect);
  for (const m of [body, front, back, cap, label]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  // The shutter lies a fraction of a millimetre over the body: too close for the shadow map to
  // tell apart, so it casts but does not receive (no acne along the opening's edges).
  for (const m of [front, back, cap]) m.receiveShadow = false;
  if (environment) labelMat.envMap = environment;
  return { group, body, shutter, label, labelMat, detail: [media, mediaBack, hub, hubHole, arrow, writeProtect], writeProtect };
}

/** Write-protect slider: 0 covers the hole (writable), 1 leaves it open (protected). */
export function setWriteProtect(d: Disk, t: number): void {
  const y0 = WP_HOLE.y0 + 0.016;
  const y1 = WP_HOLE.y1 - 0.016;
  d.writeProtect.position.y = y0 + (y1 - y0) * t;
}

// ---------- the box ----------

export const BOX = { W: 1.0, H: 0.5, wall: 0.018 } as const;

export interface Box {
  group: THREE.Group;
  /** Lay the box out for `count` slots `gap` apart, slot 0 at local z = 0, later slots towards -z. */
  fit(count: number, gap: number): void;
}

const boxMaterial = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.05 });

export function buildBox(): Box {
  const mat = boxMaterial;
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const group = new THREE.Group();
  const floor = new THREE.Mesh(unit, mat);
  const left = new THREE.Mesh(unit, mat);
  const right = new THREE.Mesh(unit, mat);
  const front = new THREE.Mesh(unit, mat);
  const back = new THREE.Mesh(unit, mat);
  for (const m of [floor, left, right, front, back]) {
    m.receiveShadow = true;
    m.castShadow = true;
    group.add(m);
  }
  const { W, H, wall } = BOX;
  return {
    group,
    fit(count: number, gap: number): void {
      const margin = 0.07;
      const L = Math.max(0, count - 1) * gap + margin * 2;
      const zc = -Math.max(0, count - 1) * gap * 0.5;
      floor.scale.set(W + wall * 2, wall, L + wall * 2);
      floor.position.set(0, -wall / 2, zc);
      for (const [m, x] of [[left, -(W + wall) / 2], [right, (W + wall) / 2]] as const) {
        m.scale.set(wall, H, L + wall * 2);
        m.position.set(x, H / 2, zc);
      }
      front.scale.set(W + wall * 2, H * 0.92, wall);
      front.position.set(0, (H * 0.92) / 2, margin + wall / 2);
      back.scale.set(W + wall * 2, H, wall);
      back.position.set(0, H / 2, zc - L / 2 - wall / 2);
    },
  };
}
