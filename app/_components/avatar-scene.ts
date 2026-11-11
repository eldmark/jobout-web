/**
 * Escena three.js del entrevistador (cabeza y hombros low-poly, estilo caricatura).
 * Este módulo es el único que importa `three`; se carga con import() dinámico desde
 * InterviewerAvatar para que no entre en el JS inicial de ninguna página.
 */
import {
  AmbientLight,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three";
import type { AvatarPalette, AvatarState } from "@/lib/avatar/palette";

export type AvatarScene = {
  setState(state: AvatarState): void;
  /** Dibuja un fotograma; `t` en segundos. */
  render(t: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
};

export function createAvatarScene(canvas: HTMLCanvasElement, palette: AvatarPalette): AvatarScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.35, 7);
  camera.lookAt(0, 0.2, 0);
  scene.add(new AmbientLight(0xffffff, 1.4));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 3, 5);
  scene.add(sun);

  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const mat = (color: string) => {
    const m = new MeshStandardMaterial({ color: new Color(color), roughness: 0.8, flatShading: true });
    mats.push(m);
    return m;
  };
  const mesh = <G extends BufferGeometry>(geo: G, m: Material, parent: Group) => {
    geos.push(geo);
    const x = new Mesh(geo, m);
    parent.add(x);
    return x;
  };

  const skin = mat(palette.skin);
  const hair = mat(palette.hair);
  const dark = mat("#26202e");
  const white = mat("#ffffff");
  const mouthMat = mat("#7a1f33");
  const dotMat = mat("#7c6cf0");

  const root = new Group();
  scene.add(root);
  // Hombros y cuello (fijos, solo respiran).
  const body = new Group();
  root.add(body);
  const torso = mesh(new CapsuleGeometry(1.0, 0.9, 4, 10), mat(palette.shirt), body);
  torso.rotation.z = Math.PI / 2;
  torso.scale.set(1, 1, 0.7);
  torso.position.y = -1.55;
  mesh(new SphereGeometry(0.28, 10, 8), skin, body).position.set(0, -0.85, 0);

  // Cabeza.
  const head = new Group();
  head.position.y = 0.2;
  root.add(head);
  mesh(new SphereGeometry(0.95, 16, 12), skin, head);
  for (const s of [-1, 1]) mesh(new SphereGeometry(0.2, 8, 6), skin, head).position.set(s * 0.95, -0.05, 0);
  const nose = mesh(new ConeGeometry(0.1, 0.25, 6), skin, head);
  nose.position.set(0, -0.1, 0.95);
  nose.rotation.x = Math.PI / 2;

  // Pelo según estilo.
  const cap = mesh(new SphereGeometry(1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, head);
  cap.position.set(0, 0.05, -0.05);
  cap.rotation.x = -0.25;
  if (palette.hairStyle === "long") {
    for (const s of [-1, 1]) {
      const side = mesh(new CapsuleGeometry(0.22, 1.1, 4, 8), hair, head);
      side.position.set(s * 0.92, -0.45, -0.15);
    }
  } else if (palette.hairStyle === "bun") {
    mesh(new SphereGeometry(0.34, 10, 8), hair, head).position.set(0, 1.0, -0.2);
  }

  // Ojos (con párpado para el parpadeo) y cejas.
  const eyes: Group[] = [];
  const pupils: Mesh[] = [];
  for (const s of [-1, 1]) {
    const eye = new Group();
    eye.position.set(s * 0.36, 0.1, 0.8);
    head.add(eye);
    mesh(new SphereGeometry(0.2, 12, 10), white, eye);
    pupils.push(mesh(new SphereGeometry(0.1, 8, 8), dark, eye));
    pupils[pupils.length - 1]!.position.z = 0.15;
    eyes.push(eye);
    const brow = mesh(new CapsuleGeometry(0.035, 0.26, 3, 6), hair, head);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
    brow.position.set(s * 0.36, 0.42, 0.82);
  }

  // Boca: una esfera achatada que se abre y se cierra.
  const mouth = mesh(new SphereGeometry(0.2, 12, 8), mouthMat, head);
  mouth.position.set(0, -0.42, 0.84);
  const smile = mesh(new TorusGeometry(0.22, 0.03, 6, 14, Math.PI), dark, head);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.3, 0.88);

  // Tres puntos que rebotan sobre la cabeza mientras piensa.
  const dots = new Group();
  dots.position.set(0, 1.55, 0);
  root.add(dots);
  const dotMeshes = [-0.4, 0, 0.4].map((x) => {
    const d = mesh(new SphereGeometry(0.12, 8, 8), dotMat, dots);
    d.position.x = x;
    return d;
  });

  let state: AvatarState = "idle";
  let mouthOpen = 0;
  let tilt = 0;
  let eyeUp = 0;

  return {
    setState(s) {
      state = s;
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    },
    render(t) {
      const thinking = state === "thinking";
      const speaking = state === "speaking";
      body.scale.y = 1 + Math.sin(t * 1.8) * 0.012;
      // Parpadeo cada ~3.2 s, 0.14 s de duración.
      const ph = t % 3.2;
      const blink = ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : 0;
      for (const e of eyes) e.scale.y = Math.max(0.08, 1 - blink * 0.92);
      eyeUp += ((thinking ? 1 : 0) - eyeUp) * 0.15;
      for (const p of pupils) {
        p.position.y = eyeUp * 0.08;
        p.position.x = thinking ? Math.sin(t * 1.2) * 0.04 : 0;
      }
      tilt += ((thinking ? 0.22 : 0) - tilt) * 0.1;
      head.rotation.z = tilt + Math.sin(t * 0.9) * 0.03;
      head.rotation.y = Math.sin(t * 0.6) * 0.1;
      head.rotation.x = speaking ? Math.sin(t * 6) * 0.03 : Math.sin(t * 1.1) * 0.02;
      // Boca: ritmo caricaturesco con dos senos desfasados.
      const target = speaking ? Math.abs(Math.sin(t * 9)) * 0.6 + Math.abs(Math.sin(t * 5.3)) * 0.4 : 0;
      mouthOpen += (target - mouthOpen) * 0.35;
      mouth.scale.set(1.1 - mouthOpen * 0.2, 0.08 + mouthOpen * 1.1, 0.5);
      smile.visible = mouthOpen < 0.12;
      mouth.visible = !smile.visible;
      dots.visible = thinking;
      dotMeshes.forEach((d, i) => {
        d.position.y = Math.abs(Math.sin(t * 4 + i * 0.7)) * 0.25;
      });
      renderer.render(scene, camera);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
