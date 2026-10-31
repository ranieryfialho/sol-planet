"use client";

import { useEffect, useRef } from "react";
// só tipos: o three em si é carregado sob demanda (import dinâmico), quando a cena aparece na tela
import type * as THREE from "three";

export interface SceneLabel {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tone: "mint" | "sun";
}

export interface House3DProps {
  pvW: number;
  /** 0..1, geração em relação à capacidade (velocidade da luz nos fios) */
  ratio: number;
  isDay: boolean;
  inverterOk: boolean;
  /** em cima: solar (painéis) e inversor; embaixo: casa/hoje (oitão) e rede/total (chegada da rede) */
  labels: { left: SceneLabel; solar: SceneLabel; inverter: SceneLabel; bottom: SceneLabel };
  address: string | null;
  sunLine: string | null;
  compact?: boolean;
  /** pré-visualização (?simular=1): mostra a cena de dia, gerando */
  preview?: boolean;
  ariaLabel: string;
}

// ---------- medidas (metros): x = comprimento (oitão envidraçado em -x), z = profundidade (parede lateral em +z), y = altura
const LEN = 6.6;
const DEP = 6;
const WALL = 3.3;
const RIDGE = 6.3; // telhado a 45°, como na referência
const PITCH = Math.atan((RIDGE - WALL) / (DEP / 2));
const SLOPE = Math.hypot(DEP / 2, RIDGE - WALL);
const EAVE = 0.25;
const ROOF_T = 0.32;
const FRAME = 0.42; // espessura da moldura do oitão
const FRAME_D = 0.55; // quanto a moldura avança
const ANNEX = { x0: LEN / 2, x1: LEN / 2 + 3, z0: -1.6, z1: 2.7, h: 2.6 };
const INV = { x: 1.2, y: 1.75, w: 0.85, h: 1.05, d: 0.2 };
const WZ = DEP / 2 + 0.012; // linhas embutidas na parede lateral
const GRID_PT: [number, number, number] = [INV.x, 0.02, DEP / 2 + 2.4];

type V3 = [number, number, number];
const SOLAR_WIRE: V3[] = [
  [INV.x, WALL - 0.02, WZ],
  [INV.x, INV.y + INV.h / 2, WZ],
];
const HOME_WIRE: V3[] = [
  [INV.x - INV.w / 2, INV.y, WZ],
  [-LEN / 2 + 0.02, INV.y, WZ],
];
const ANNEX_WIRE: V3[] = [
  [INV.x + INV.w / 2, INV.y, WZ],
  [LEN / 2 - 0.02, INV.y, WZ],
];
const GRID_WIRE: V3[] = [
  [INV.x, INV.y - INV.h / 2, WZ],
  [INV.x, 0.02, WZ],
  GRID_PT,
];

/**
 * Casa em 3D no estilo "maquete branca" (referência: design/referencia-pinterest.png): oitão envidraçado com o
 * interior aceso, telhado a 45° com painéis, anexo ao lado, inversor na parede e linhas verde-menta embutidas que
 * ficam sempre acesas; quando há geração, a energia corre por elas (painel → inversor → casa), mais rápido quanto
 * maior a geração. Carrega só quando aparece na tela, pausa fora dela e respeita "reduzir movimento".
 */
export function House3D(props: House3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const propsRef = useRef(props);
  propsRef.current = props;
  const redrawRef = useRef<() => void>(() => {});

  useEffect(() => {
    redrawRef.current();
  }, [props.pvW, props.ratio, props.isDay, props.inverterOk]);

  useEffect(() => {
    const host = hostRef.current!;
    const canvas = canvasRef.current!;
    let disposed = false;
    let visible = false;
    let started = false;
    let raf = 0;
    let teardown: (() => void) | undefined;
    let kick: (() => void) | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function start() {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = env;

      const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 300);
      const target = new THREE.Vector3(1.1, propsRef.current.compact ? 2.9 : 3.35, 0.4);
      // ~35° fora da normal da parede lateral: oitão envidraçado à esquerda, parede e anexo à direita
      const camBase = Math.atan2(Math.cos(0.6), -Math.sin(0.6));
      let camDist = 30;

      const hemi = new THREE.HemisphereLight(0xffffff, 0xe3e7ee, 1.6);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(-8, 16, 12);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
      key.shadow.radius = 10;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.02;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe6eeff, 0.6);
      fill.position.set(12, 8, 4);
      scene.add(fill);

      // chão: sombra projetada + sombra de contato suave (gradiente radial)
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShadowMaterial({ opacity: 0.13 }));
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      const cs = document.createElement("canvas");
      cs.width = cs.height = 128;
      const csx = cs.getContext("2d")!;
      const csg = csx.createRadialGradient(64, 64, 0, 64, 64, 64);
      csg.addColorStop(0, "rgba(40,50,70,0.42)");
      csg.addColorStop(0.55, "rgba(40,50,70,0.16)");
      csg.addColorStop(1, "rgba(40,50,70,0)");
      csx.fillStyle = csg;
      csx.fillRect(0, 0, 128, 128);
      const contactTex = new THREE.CanvasTexture(cs);
      const contact = new THREE.Mesh(new THREE.PlaneGeometry(15, 11), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }));
      contact.rotation.x = -Math.PI / 2;
      contact.position.set(1.2, 0.005, 0.3);
      scene.add(contact);

      const clay = (color = 0xf3f4f6, envMapIntensity = 0.3) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, envMapIntensity });
      const add = <T extends THREE.Object3D>(o: T, cast = true, receive = true) => {
        o.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = cast;
            c.receiveShadow = receive;
          }
        });
        scene.add(o);
        return o;
      };
      const rbox = (w: number, h: number, d: number, r = 0.05) => new RoundedBoxGeometry(w, h, d, 3, r);
      const gableShape = (inset: number) =>
        [
          [-DEP / 2 + inset, inset],
          [DEP / 2 - inset, inset],
          [DEP / 2 - inset, WALL - inset * 0.41],
          [0, RIDGE - inset * 1.41],
          [-DEP / 2 + inset, WALL - inset * 0.41],
        ].map(([x, y]) => new THREE.Vector2(x, y));

      // corpo da casa
      const bodyGeo = new THREE.ExtrudeGeometry(new THREE.Shape(gableShape(0)), { depth: LEN, bevelEnabled: false });
      bodyGeo.rotateY(Math.PI / 2);
      bodyGeo.translate(-LEN / 2, 0, 0);
      add(new THREE.Mesh(bodyGeo, clay(0xeef0f3)));
      // juntas verticais da fachada (frisos)
      for (const x of [-1.2, 2.4]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.03, WALL - 0.1, 0.02), clay(0xd9dde3)), false).position.set(x, WALL / 2, DEP / 2 + 0.005);
      }

      // oitão: moldura grossa (cantos arredondados) avançando + vidro com o interior aceso
      const ring = new THREE.Shape(gableShape(-0.04));
      ring.holes.push(new THREE.Path(gableShape(FRAME)));
      const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: FRAME_D, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
      ringGeo.rotateY(-Math.PI / 2);
      ringGeo.translate(-LEN / 2 + 0.05, 0, 0);
      add(new THREE.Mesh(ringGeo, clay(0xf7f8f9)));

      const glowCanvas = document.createElement("canvas");
      glowCanvas.width = 256;
      glowCanvas.height = 256;
      const g = glowCanvas.getContext("2d")!;
      const lin = g.createLinearGradient(0, 0, 0, 256);
      lin.addColorStop(0, "#ffe2a0");
      lin.addColorStop(0.5, "#f8bb4c");
      lin.addColorStop(1, "#e48d24");
      g.fillStyle = lin;
      g.fillRect(0, 0, 256, 256);
      const rad = g.createRadialGradient(128, 170, 10, 128, 170, 140);
      rad.addColorStop(0, "rgba(255,247,222,0.8)");
      rad.addColorStop(1, "rgba(255,247,222,0)");
      g.fillStyle = rad;
      g.fillRect(0, 0, 256, 256);
      const glowTex = new THREE.CanvasTexture(glowCanvas);
      glowTex.colorSpace = THREE.SRGBColorSpace;
      const glassGeo = new THREE.ShapeGeometry(new THREE.Shape(gableShape(FRAME)));
      const uv = glassGeo.attributes.uv!;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + DEP / 2) / DEP, uv.getY(i) / RIDGE);
      glassGeo.rotateY(-Math.PI / 2);
      glassGeo.translate(-LEN / 2 - 0.01, 0, 0);
      const glassMat = new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false });
      scene.add(new THREE.Mesh(glassGeo, glassMat));
      // montantes do vidro
      for (const z of [-1.05, 1.05]) {
        add(new THREE.Mesh(rbox(0.07, RIDGE - 1.6, 0.1, 0.02), clay(0xf7f8f9)), true, false).position.set(-LEN / 2 - 0.05, (RIDGE - 1.2) / 2 + 0.25, z);
      }

      // telhado: duas águas brancas com espessura e cantos suaves, cumeeira arredondada
      const roofMat = clay(0xf1f2f4);
      const slabLen = SLOPE + EAVE;
      const roofW = LEN + FRAME_D + 0.15;
      const mkSlab = (side: 1 | -1) => {
        const grp = new THREE.Group();
        const slab = new THREE.Mesh(rbox(roofW, ROOF_T, slabLen, 0.07), roofMat);
        slab.position.set(-FRAME_D / 2 + 0.02, 0, slabLen / 2);
        grp.add(slab);
        grp.position.set(0, RIDGE + (ROOF_T / 2) * Math.cos(PITCH), 0);
        grp.rotation.x = side * PITCH;
        if (side === -1) grp.rotation.y = Math.PI;
        return grp;
      };
      const front = add(mkSlab(1));
      add(mkSlab(-1));
      const ridge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, roofW, 20), roofMat));
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(-FRAME_D / 2 + 0.02, RIDGE + 0.2, 0);

      // painéis: vidro escuro esverdeado com reflexo, moldura clara
      const cell = document.createElement("canvas");
      cell.width = 240;
      cell.height = 260;
      const c = cell.getContext("2d")!;
      const pg = c.createLinearGradient(0, 0, 240, 260);
      pg.addColorStop(0, "#2f6b5e");
      pg.addColorStop(0.5, "#21524a");
      pg.addColorStop(1, "#173d37");
      c.fillStyle = pg;
      c.fillRect(0, 0, 240, 260);
      c.strokeStyle = "rgba(150,235,205,0.22)";
      c.lineWidth = 1.2;
      for (let i = 1; i < 6; i++) {
        c.beginPath();
        c.moveTo((i * 240) / 6, 0);
        c.lineTo((i * 240) / 6, 260);
        c.stroke();
      }
      for (let j = 1; j < 10; j++) {
        c.beginPath();
        c.moveTo(0, (j * 260) / 10);
        c.lineTo(240, (j * 260) / 10);
        c.stroke();
      }
      c.strokeStyle = "#e3e9e7";
      c.lineWidth = 7;
      c.strokeRect(0, 0, 240, 260);
      const panelTex = new THREE.CanvasTexture(cell);
      panelTex.colorSpace = THREE.SRGBColorSpace;
      panelTex.anisotropy = 8;
      const panelTop = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.18, metalness: 0.3, envMapIntensity: 1.2 });
      const panelSide = clay(0xdfe4e8);
      const panelMats = [panelSide, panelSide, panelTop, panelSide, panelSide, panelSide];
      const COLS = 5;
      const ROWS = 3;
      const PW = (LEN - 0.35) / COLS - 0.05;
      const PH = (SLOPE - 0.45) / ROWS - 0.05;
      const panelGeo = new THREE.BoxGeometry(PW, 0.07, PH);
      for (let r = 0; r < ROWS; r++) {
        for (let k = 0; k < COLS; k++) {
          const p = new THREE.Mesh(panelGeo, panelMats);
          p.position.set((k - (COLS - 1) / 2) * (PW + 0.05) + 0.05, ROOF_T / 2 + 0.05, 0.22 + PH / 2 + r * (PH + 0.05));
          p.castShadow = true;
          front.add(p);
        }
      }
      front.updateMatrixWorld(true);
      const panelMid = front.localToWorld(new THREE.Vector3(-0.9, ROOF_T / 2 + 0.1, 0.22 + 1.5 * PH));

      // anexo baixo ao lado (como a garagem da referência), com laje avançando
      const ax = (ANNEX.x0 + ANNEX.x1) / 2;
      const az = (ANNEX.z0 + ANNEX.z1) / 2;
      add(new THREE.Mesh(rbox(ANNEX.x1 - ANNEX.x0, ANNEX.h, ANNEX.z1 - ANNEX.z0, 0.06), clay(0xeceef1))).position.set(ax, ANNEX.h / 2, az);
      add(new THREE.Mesh(rbox(ANNEX.x1 - ANNEX.x0 + 0.3, 0.28, ANNEX.z1 - ANNEX.z0 + 0.5, 0.07), clay(0xf6f7f8))).position.set(ax + 0.1, ANNEX.h + 0.14, az + 0.15);
      // vão da garagem
      add(new THREE.Mesh(rbox(2.2, 1.9, 0.06, 0.03), clay(0xcfd4da)), false).position.set(ax + 0.1, 1.0, ANNEX.z1 + 0.01);

      // inversor na parede lateral (com visor e luz de status)
      const inv = add(new THREE.Mesh(rbox(INV.w, INV.h, INV.d, 0.05), clay(0xfbfbfc, 0.5)));
      inv.position.set(INV.x, INV.y, DEP / 2 + INV.d / 2);
      const screen = new THREE.Mesh(rbox(0.34, 0.2, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.25 }));
      screen.position.set(INV.x, INV.y + 0.2, DEP / 2 + INV.d + 0.005);
      scene.add(screen);
      const ledMat = new THREE.MeshBasicMaterial({ color: 0x1db98a, toneMapped: false });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.02), ledMat);
      led.position.set(INV.x, INV.y - 0.22, DEP / 2 + INV.d + 0.005);
      scene.add(led);

      // linhas de energia: trilho menta aceso (com halo) sempre + pulso de luz correndo quando há geração
      const vert = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
      const frag = `uniform float uHead; uniform float uAlpha; uniform vec3 uColor; varying vec2 vUv;
        void main(){ float t = uHead - vUv.x; float a = (t >= 0.0 && t < 0.4) ? pow(1.0 - t / 0.4, 1.4) : 0.0;
        a *= uAlpha; if (a < 0.01) discard; gl_FragColor = vec4(uColor, a); }`;
      const railMat = new THREE.MeshBasicMaterial({ color: 0x3fdcaa, toneMapped: false });
      const railHalo = new THREE.MeshBasicMaterial({ color: 0x7ff0c8, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
      const flows: { mats: THREE.ShaderMaterial[]; phase: number; on: () => boolean }[] = [];
      const wire = (pts: V3[], phase: number, on: () => boolean) => {
        const path = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...pts[i - 1]!), new THREE.Vector3(...pts[i]!)));
        scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.028, 6), railMat));
        scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 120, 0.08, 8), railHalo));
        const mats = (
          [
            [0.055, 1, 0xffffff],
            [0.16, 0.55, 0x3ff5bd],
          ] as const
        ).map(([radius, alpha, color]) => {
          const m = new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: { uHead: { value: -1 }, uAlpha: { value: alpha }, uColor: { value: new THREE.Color(color) } },
            transparent: true,
            depthWrite: false,
            toneMapped: false,
          });
          scene.add(new THREE.Mesh(new THREE.TubeGeometry(path, 200, radius, 10), m));
          return m;
        });
        flows.push({ mats, phase, on });
      };
      const generating = () => propsRef.current.pvW > 0;
      wire(SOLAR_WIRE, 0, generating);
      wire(HOME_WIRE, 0.4, generating);
      wire(ANNEX_WIRE, 0.55, generating);
      wire(GRID_WIRE, 0, () => false); // sem medidor não sabemos o sentido da rede: só o trilho aceso

      const targets = [
        panelMid,
        new THREE.Vector3(INV.x, INV.y + INV.h / 2, DEP / 2 + INV.d / 2),
        new THREE.Vector3(-LEN / 2 - FRAME_D, 2.0, -0.4),
        new THREE.Vector3(...GRID_PT),
      ];

      // de noite, a mesma maquete clara (como a referência), só com a luz um pouco mais baixa
      const applyMood = () => {
        const p = propsRef.current;
        hemi.intensity = p.isDay ? 1.6 : 1.15;
        key.intensity = p.isDay ? 1.5 : 0.9;
        key.color.set(p.isDay ? 0xffffff : 0xdfe6ff);
        ledMat.color.set(p.inverterOk ? 0x1db98a : 0xf28c28);
      };
      applyMood();

      let w = 0;
      let h = 0;
      const resize = () => {
        w = host.clientWidth;
        h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // enquadra a casa na faixa do meio (rótulos em cima e embaixo), em qualquer proporção
        const vHalf = Math.tan((camera.fov * Math.PI) / 360);
        const band = propsRef.current.compact ? 0.5 : 0.46;
        camDist = Math.max(8 / (vHalf * band * 2), 7.4 / (vHalf * camera.aspect));
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const v = new THREE.Vector3();
      const t0 = performance.now();
      const frame = (now: number) => {
        const p = propsRef.current;
        const t = reduced ? 0 : (now - t0) / 1000;
        const ang = camBase + (reduced ? 0 : Math.sin(t * 0.22) * 0.05);
        const elev = 0.24;
        camera.position.set(
          target.x + Math.cos(ang) * Math.cos(elev) * camDist,
          target.y + Math.sin(elev) * camDist,
          target.z + Math.sin(ang) * Math.cos(elev) * camDist,
        );
        camera.lookAt(target);

        const period = 3 - 1.7 * Math.min(1, Math.max(0, p.ratio));
        for (const f of flows) {
          const head = f.on() ? (reduced ? 0.7 : ((t / period + f.phase) % 1) * 1.45) : -1;
          for (const m of f.mats) m.uniforms.uHead!.value = head;
        }
        renderer.render(scene, camera);

        if (w && h) {
          // rótulos acompanham a casa: x do alvo projetado, afastados se ficarem colados
          const pts = targets.map((tg) => {
            v.copy(tg).project(camera);
            return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h] as const;
          });
          const gap = p.compact ? 125 : 160;
          const xs = pts.map(([x]) => x);
          for (const [a, b] of [
            [0, 1],
            [2, 3],
          ] as const) {
            if (xs[b]! - xs[a]! < gap) {
              const mid = (xs[a]! + xs[b]!) / 2;
              xs[a] = mid - gap / 2;
              xs[b] = mid + gap / 2;
            }
          }
          const margin = p.compact ? 56 : 72;
          pts.forEach(([x, y], i) => {
            const lx = Math.min(w - margin, Math.max(margin, xs[i]!));
            const el = labelRefs.current[i];
            if (el) el.style.left = `${lx}px`;
            const line = lineRefs.current[i];
            if (!line || !el) return;
            const edge = i < 2 ? el.offsetTop + el.offsetHeight + 4 : el.offsetTop - 4;
            line.setAttribute("x1", String(lx));
            line.setAttribute("y1", String(edge));
            line.setAttribute("x2", String(x));
            line.setAttribute("y2", String(y));
          });
        }
      };

      const loop = (now: number) => {
        frame(now);
        raf = visible && document.visibilityState === "visible" && !reduced ? requestAnimationFrame(loop) : 0;
      };
      redrawRef.current = () => {
        applyMood();
        if (!raf) requestAnimationFrame(frame);
      };
      kick = () => {
        if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(loop);
      };
      document.addEventListener("visibilitychange", kick);
      kick();
      if (reduced) requestAnimationFrame(frame);
      host.dataset.ready = "1";

      teardown = () => {
        cancelAnimationFrame(raf);
        if (kick) document.removeEventListener("visibilitychange", kick);
        ro.disconnect();
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[] | undefined;
          (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
        });
        panelTex.dispose();
        glowTex.dispose();
        contactTex.dispose();
        env.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    }

    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible && !started) {
        started = true;
        start().catch((err) => console.error("cena 3D falhou:", err));
      } else if (visible) kick?.();
    });
    io.observe(host);

    return () => {
      disposed = true;
      io.disconnect();
      teardown?.();
    };
  }, []);

  const { labels, isDay, compact, address, sunLine, preview } = props;
  const order = [labels.solar, labels.inverter, labels.left, labels.bottom];
  return (
    <div ref={hostRef} className="absolute inset-0" role="img" aria-label={props.ariaLabel}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #dbe7f7 0%, #edf2f9 50%, #f6f7fa 100%)" }} />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {order.map((_, i) => (
          <line
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            stroke="#6b7280"
            strokeOpacity={0.6}
            strokeWidth={1}
          />
        ))}
      </svg>

      {order.map((l, i) => (
        <div
          key={i}
          ref={(el) => {
            labelRefs.current[i] = el;
          }}
          className={`absolute -translate-x-1/2 text-center ${i < 2 ? "top-16" : "bottom-4"}`}
          style={{ left: `${[30, 70, 30, 60][i]}%` }}
        >
          <Label l={l} compact={compact} />
        </div>
      ))}

      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
        {(address || sunLine) && (
          <div className={`flex min-w-0 items-center gap-1.5 bg-white/75 px-3 py-1.5 text-[12px] text-ink-2 backdrop-blur ${compact ? "rounded-2xl" : "rounded-full"}`}>
            <span className="material-symbols-outlined icon-fill shrink-0 text-[15px] text-sun" aria-hidden>
              location_on
            </span>
            {compact ? (
              <span className="min-w-0 leading-4">
                {address && <span className="block truncate">{address}</span>}
                {sunLine && <span className="block text-[11px] opacity-80">{sunLine}</span>}
              </span>
            ) : (
              <span className="truncate">
                {address}
                {address && sunLine ? " · " : ""}
                {sunLine}
              </span>
            )}
          </div>
        )}
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/75 px-2.5 py-1.5 text-[12px] text-ink-2 backdrop-blur">
          <span className="material-symbols-outlined icon-fill text-[15px]" style={{ color: isDay ? "#f28c28" : "#6366f1" }} aria-hidden>
            {isDay ? "light_mode" : "dark_mode"}
          </span>
          {preview ? "simulação" : isDay ? "dia" : "noite"}
        </span>
      </div>
    </div>
  );
}

function Label({ l, compact }: { l: SceneLabel; compact?: boolean }) {
  return (
    <div className="whitespace-nowrap">
      <p className="flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
        <span className={`h-2 w-2 rounded-full ${l.tone === "mint" ? "bg-mint" : "bg-sun"}`} />
        {l.label}
      </p>
      <p className={`${compact ? "text-[19px]" : "text-[22px]"} font-bold leading-7 text-ink`}>
        {l.value}
        {l.unit && <span className="ml-1 text-xs font-medium text-ink-3">{l.unit}</span>}
      </p>
      {l.note && !compact && <p className="text-[11px] text-ink-3">{l.note}</p>}
    </div>
  );
}
