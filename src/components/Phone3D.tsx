"use client";

import { useEffect, useRef, useState } from "react";
import type { Swatch } from "@/lib/colors";
import type * as T from "three";

export interface Phone3DProps {
  name: string;
  heightMm: number;
  widthMm: number;
  thicknessMm: number;
  form: string | null;
  lenses: number;
  swatches: Swatch[];
  officialColors: boolean;
}

/**
 * Maquette 3D indicative : proportions réelles (dimensions officielles), nombre d'objectifs de la fiche, teinte
 * approchée du coloris. Aucun logo ni dessin propre à la marque. Three.js n'est chargé qu'à l'ouverture.
 */
export function Phone3D(p: Phone3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const setColor = useRef<(hex: string) => void>(() => {});
  const setView = useRef<(v: "face" | "dos" | "profil") => void>(() => {});
  const [color, setColorState] = useState(0);
  const [state, setState] = useState<"chargement" | "pret" | "erreur">("chargement");
  const swKey = p.swatches.map((s) => s.hex).join(",");

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        if (disposed || !host.current) return;
        const el = host.current;
        const W = () => el.clientWidth;
        const H = () => el.clientHeight;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W(), H());
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        el.appendChild(renderer.domElement);
        renderer.domElement.setAttribute("aria-hidden", "true");

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        // 1 unité = 10 mm.
        const w = p.widthMm / 10, h = p.heightMm / 10, t = Math.max(p.thicknessMm, 5) / 10;
        const radius = Math.min(w * 0.13, t * 0.49);
        const phone = new THREE.Group();

        const bodyMat = new THREE.MeshPhysicalMaterial({ color: p.swatches[0]?.hex ?? "#1d1d20", metalness: 0.35, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 });
        const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, t, 6, radius), bodyMat);
        phone.add(body);

        // Écran : verre noir à coins arrondis, bordure fine.
        const bezel = Math.max(0.12, w * 0.025);
        const sw = w - bezel * 2, sh = h - bezel * 2, sr = Math.max(radius - bezel, 0.2);
        const shape = new THREE.Shape();
        shape.moveTo(-sw / 2 + sr, -sh / 2);
        shape.lineTo(sw / 2 - sr, -sh / 2);
        shape.quadraticCurveTo(sw / 2, -sh / 2, sw / 2, -sh / 2 + sr);
        shape.lineTo(sw / 2, sh / 2 - sr);
        shape.quadraticCurveTo(sw / 2, sh / 2, sw / 2 - sr, sh / 2);
        shape.lineTo(-sw / 2 + sr, sh / 2);
        shape.quadraticCurveTo(-sw / 2, sh / 2, -sw / 2, sh / 2 - sr);
        shape.lineTo(-sw / 2, -sh / 2 + sr);
        shape.quadraticCurveTo(-sw / 2, -sh / 2, -sw / 2 + sr, -sh / 2);
        const canvas = document.createElement("canvas");
        canvas.width = 256; canvas.height = 512;
        const g = canvas.getContext("2d")!;
        const grad = g.createLinearGradient(0, 0, 256, 512);
        grad.addColorStop(0, "#2a0b0d"); grad.addColorStop(0.55, "#120708"); grad.addColorStop(1, "#08080a");
        g.fillStyle = grad; g.fillRect(0, 0, 256, 512);
        g.fillStyle = "rgba(255,52,52,0.85)"; g.beginPath(); g.arc(128, 300, 46, Math.PI * 0.75, Math.PI * 2.25); g.lineWidth = 10; g.strokeStyle = "rgba(255,52,52,0.85)"; g.stroke();
        const screenTex = new THREE.CanvasTexture(canvas);
        screenTex.colorSpace = THREE.SRGBColorSpace;
        const screenGeo = new THREE.ShapeGeometry(shape, 12);
        // UV de la forme : ramenées sur [0,1].
        const uv = screenGeo.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + sw / 2) / sw, (uv.getY(i) + sh / 2) / sh);
        const screen = new THREE.Mesh(screenGeo, new THREE.MeshPhysicalMaterial({ map: screenTex, roughness: 0.08, metalness: 0, clearcoat: 1, emissive: new THREE.Color("#ffffff"), emissiveMap: screenTex, emissiveIntensity: 0.35 }));
        screen.position.z = t / 2 + 0.004;
        phone.add(screen);
        // Caméra avant (poinçon).
        const punch = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * 0.022, 24), new THREE.MeshBasicMaterial({ color: "#000" }));
        punch.position.set(0, sh / 2 - sh * 0.035, t / 2 + 0.006);
        phone.add(punch);

        // Bloc photo au dos : îlot arrondi + objectifs (nombre relevé sur la fiche, 1 à 4).
        const n = Math.max(1, Math.min(4, p.lenses));
        const lensR = Math.min(w * 0.11, 0.62);
        const cols = n > 1 ? 2 : 1, rows = Math.ceil(n / cols);
        const iw = cols * lensR * 2.3 + lensR * 0.6, ih = rows * lensR * 2.3 + lensR * 0.6;
        const island = new THREE.Mesh(new RoundedBoxGeometry(iw, ih, 0.12, 4, Math.min(iw, ih) * 0.28), new THREE.MeshPhysicalMaterial({ color: "#2a2b30", metalness: 0.5, roughness: 0.25, clearcoat: 1 }));
        // Vu de dos, le bloc photo est en haut à gauche (donc à droite dans le repère de la face avant).
        const ix = w / 2 - iw / 2 - w * 0.07, iy = h / 2 - ih / 2 - w * 0.07;
        island.position.set(ix, iy, -t / 2 - 0.05);
        phone.add(island);
        const lensMat = new THREE.MeshPhysicalMaterial({ color: "#050507", metalness: 0.2, roughness: 0.05, clearcoat: 1 });
        const ringMat = new THREE.MeshPhysicalMaterial({ color: "#9a9ca2", metalness: 1, roughness: 0.25 });
        for (let i = 0; i < n; i++) {
          const cx = ix - iw / 2 + lensR * 1.45 + (i % cols) * lensR * 2.3;
          const cy = iy + ih / 2 - lensR * 1.45 - Math.floor(i / cols) * lensR * 2.3;
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(lensR, lensR, 0.16, 40), ringMat);
          ring.rotation.x = Math.PI / 2; ring.position.set(cx, cy, -t / 2 - 0.12);
          const glass = new THREE.Mesh(new THREE.CircleGeometry(lensR * 0.78, 40), lensMat);
          glass.rotation.y = Math.PI; glass.position.set(cx, cy, -t / 2 - 0.205);
          phone.add(ring, glass);
        }
        const flash = new THREE.Mesh(new THREE.CircleGeometry(lensR * 0.28, 20), new THREE.MeshBasicMaterial({ color: "#f3efe2" }));
        flash.rotation.y = Math.PI; flash.position.set(ix - iw / 2 - lensR * 0.55, iy + ih / 2 - lensR * 0.5, -t / 2 - 0.004);
        phone.add(flash);
        // Boutons latéraux.
        const btnMat = bodyMat;
        for (const [y, len] of [[h * 0.2, h * 0.12], [h * 0.04, h * 0.07]] as const) {
          const b = new THREE.Mesh(new RoundedBoxGeometry(0.08, len, t * 0.35, 2, 0.03), btnMat);
          b.position.set(w / 2 + 0.03, y, 0);
          phone.add(b);
        }
        // Pliable / à clapet : charnière visible sur la tranche.
        const hingeMat = new THREE.MeshPhysicalMaterial({ color: "#3a3b40", metalness: 0.9, roughness: 0.3 });
        if (p.form === "pliable") {
          // Dimensions pliées : charnière sur la tranche gauche.
          const hinge = new THREE.Mesh(new THREE.CylinderGeometry(t * 0.5, t * 0.5, h * 0.98, 24), hingeMat);
          hinge.position.set(-w / 2, 0, 0);
          phone.add(hinge);
        } else if (p.form === "clapet") {
          // Dimensions dépliées (clapet ouvert) : pli horizontal au milieu de l'écran et charnière au dos.
          const crease = new THREE.Mesh(new THREE.PlaneGeometry(sw, Math.max(0.05, h * 0.004)), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.55 }));
          crease.position.set(0, 0, t / 2 + 0.008);
          const hinge = new THREE.Mesh(new RoundedBoxGeometry(w * 0.9, h * 0.035, 0.06, 2, 0.02), hingeMat);
          hinge.position.set(0, 0, -t / 2 - 0.02);
          phone.add(crease, hinge);
        }
        phone.rotation.set(0.12, -0.55, 0);
        scene.add(phone);

        const camera = new THREE.PerspectiveCamera(30, W() / H(), 0.1, 200);
        camera.position.set(0, 0, h * 2.35);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = h * 1.4;
        controls.maxDistance = h * 3.5;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        controls.autoRotate = !reduce;
        controls.autoRotateSpeed = 1.6;
        controls.addEventListener("start", () => { controls.autoRotate = false; });

        setColor.current = (hex: string) => { bodyMat.color.set(hex); };
        const dist = h * 2.35;
        setView.current = (v) => {
          controls.autoRotate = false;
          phone.rotation.set(0, 0, 0);
          const pos = v === "face" ? [0, 0, dist] : v === "dos" ? [0, 0, -dist] : [dist, 0, 0];
          camera.position.set(pos[0], pos[1], pos[2]);
          controls.update();
        };

        let raf = 0;
        const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
        loop();
        const ro = new ResizeObserver(() => { renderer.setSize(W(), H()); camera.aspect = W() / H(); camera.updateProjectionMatrix(); });
        ro.observe(el);
        setState("pret");
        cleanup = () => {
          cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose();
          scene.traverse((o) => {
            const m = o as T.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as T.Material | T.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
          });
          screenTex.dispose(); renderer.dispose(); renderer.domElement.remove();
        };
      } catch {
        if (!disposed) setState("erreur");
      }
    })();
    return () => { disposed = true; cleanup(); };
  }, [p.heightMm, p.widthMm, p.thicknessMm, p.form, p.lenses, swKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i: number) => { setColorState(i); setColor.current(p.swatches[i].hex); };
  const dims = `${p.heightMm.toLocaleString("fr-FR")} × ${p.widthMm.toLocaleString("fr-FR")} × ${p.thicknessMm.toLocaleString("fr-FR")} mm`;

  return (
    <div>
      <div className="relative aspect-[4/3] sm:aspect-square cut bg-[radial-gradient(circle_at_50%_40%,#26262c,#0c0c0e_70%)] overflow-hidden">
        <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none" role="img"
          aria-label={`Maquette 3D indicative du ${p.name}, à faire tourner. Proportions réelles : ${dims}.`} />
        {state === "chargement" && <p className="absolute inset-0 grid place-items-center text-sm text-muted" role="status">Chargement de la maquette 3D…</p>}
        {state === "erreur" && <p className="absolute inset-0 grid place-items-center text-sm text-warn p-6 text-center" role="alert">La 3D n&apos;est pas disponible sur cet appareil. La photo reste affichée.</p>}
        <span className="absolute top-2 left-2 tag bg-ink/80 text-text">Maquette 3D indicative</span>
        {state === "pret" && <span className="absolute bottom-2 right-3 text-[11px] text-muted">Fais glisser pour tourner</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Orientation">
        {(["face", "dos", "profil"] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView.current(v)} className="px-3 py-1.5 min-h-[40px] border border-line hover:border-white/40 text-xs font-bold uppercase tracking-wider">
            {v === "face" ? "Face" : v === "dos" ? "Dos" : "Profil"}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Coloris">
        {p.swatches.map((s, i) => (
          <button key={s.name} type="button" role="radio" aria-checked={i === color} onClick={() => pick(i)} title={s.name}
            className={`flex items-center gap-2 px-2.5 py-1.5 min-h-[40px] border text-xs font-semibold ${i === color ? "border-red" : "border-line hover:border-white/40"}`}>
            <span aria-hidden className="w-5 h-5 rounded-full border border-white/30" style={{ background: s.hex }} />
            {s.name}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted mt-2">
        Proportions réelles ({dims}) et nombre d&apos;objectifs d&apos;après la fiche officielle. Forme, bloc photo et teintes
        sont indicatifs{p.officialColors ? " : les noms de coloris sont ceux du fabricant, la teinte est approchée" : " : coloris officiels non relevés, teintes d'exemple"}.
      </p>
    </div>
  );
}
