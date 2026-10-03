// app/farewell/journey/three/scene.ts
// สร้างฉาก 3D และวาดตาม progress
// โหลดด้วย dynamic import ฝั่ง client เท่านั้น (three ไม่ถูกรวมใน bundle หลักของเว็บ)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCoffin } from './buildCoffin';
import { buildFurnace } from './buildFurnace';
import { buildStage } from './buildStage';
import { getRig, type ViewportRig } from './camera';
import { createTextures } from './textures';
import { getSceneState } from './timeline';

export interface JourneyScene {
  /** live=false (ลดการเคลื่อนไหว) = ไฟนิ่ง ไม่กะพริบ ไม่มีประกายไฟลอย */
  render(p: number, live?: boolean): void;
  /** ช่วงที่ไฟลุก ต้องวาดทุกเฟรมแม้ไม่ได้เลื่อน */
  needsFrames(p: number): boolean;
  resize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

const IVORY = new THREE.Color('#f3eee6');
const CHARCOAL = new THREE.Color('#15120f');

export async function createJourneyScene(
  canvas: HTMLCanvasElement,
  opts: { pixelRatio: number; onContextLost: () => void },
): Promise<JourneyScene> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(opts.pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ให้โทนสีตรงกับที่ render ไว้ใน Blender (AgX)
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const handleLost = (event: Event) => {
    event.preventDefault();
    opts.onContextLost();
  };
  canvas.addEventListener('webglcontextlost', handleLost);

  const scene = new THREE.Scene();
  scene.background = IVORY.clone();
  scene.fog = new THREE.Fog(IVORY.clone(), 6, 9);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = envMap;
  scene.environmentIntensity = 0.6;

  const tex = await createTextures(renderer.capabilities.getMaxAnisotropy());
  const coffin = buildCoffin(tex);
  const furnace = buildFurnace(tex);
  const stage = buildStage(tex);
  for (const group of [coffin.group, furnace.group]) {
    group.traverse((object) => {
      if (object instanceof THREE.Mesh && (Array.isArray(object.material) || !object.material.transparent)) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }
  scene.add(stage.group, furnace.group, coffin.group);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  let rig: ViewportRig = getRig(1, 1);
  let width = 1;
  let height = 1;
  const color = new THREE.Color();
  const target = new THREE.Vector3();

  function resize(w: number, h: number) {
    width = Math.max(1, Math.round(w));
    height = Math.max(1, Math.round(h));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    rig = getRig(width, height);
    // เลื่อนภาพให้วัตถุหลบการ์ดข้อความ (offset ลบ = ภาพเลื่อนไปทางบวก)
    const [sx, sy] = rig.shift;
    if (sx || sy) camera.setViewOffset(width, height, -sx * width, sy * height, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  /** ไฟลุกอยู่ในจอ = ต้องวาดต่อเนื่อง (กะพริบ/ประกายไฟ) แม้ไม่ได้เลื่อน */
  const needsFrames = (p: number) => getSceneState(p, rig).fire > 0;

  function render(p: number, live = true) {
    const s = getSceneState(p, rig);

    coffin.lidHinge.rotation.x = -s.lidRotX;
    coffin.lidHinge.position.y = 0.542 + s.lidDip;
    coffin.group.rotation.y = s.coffinRotY;
    coffin.group.position.z = s.coffinZ;

    furnace.group.visible = s.furnaceVisible;
    furnace.doorHinge.rotation.y = s.doorRotY;
    furnace.latches.position.x = s.latchX;
    // ไฟไหม้ช้า ๆ: แสงหายใจเข้า-ออกช้า (คาบ ~4–9 วิ ผสมกันให้ไม่เป็นจังหวะเดียว) ไม่กะพริบถี่
    const now = performance.now() / 1000;
    const burn = !live ? 0.9 : 0.86 + 0.09 * Math.sin(now * 1.4) + 0.05 * Math.sin(now * 0.7 + 1.3);
    furnace.peephole.emissiveIntensity = (s.peephole * 1.6 + s.fire * 2.4) * burn;
    furnace.interiorLight.intensity = s.interior * 12;
    furnace.fire.seam.opacity = s.fire * burn;

    stage.hemi.intensity = 0.45 * s.ambient;
    stage.key.intensity = 3.5 * Math.max(0.45, s.ambient);
    stage.rim.intensity = 2.4 * Math.max(0.5, s.ambient);
    scene.environmentIntensity = 0.28 * s.ambient;

    color.copy(IVORY).lerp(CHARCOAL, s.darkness);
    (scene.background as THREE.Color).copy(color);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(color);
    fog.near = s.fogNear;
    fog.far = s.fogFar;

    camera.position.set(...s.camera.pos);
    target.set(...s.camera.target);
    camera.lookAt(target);
    if (camera.fov !== s.camera.fov) {
      camera.fov = s.camera.fov;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
  }

  function dispose() {
    canvas.removeEventListener('webglcontextlost', handleLost);
    const textures = new Set<THREE.Texture>(Object.values(tex));
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh | THREE.Points;
      if (!(mesh as THREE.Mesh).isMesh && !(mesh as THREE.Points).isPoints) return;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        // texture ที่สร้างใน builder (แสงไฟเตา/ประกายไฟ) ไม่อยู่ใน tex — เก็บจาก material ด้วย
        const map = (mat as THREE.MeshBasicMaterial).map;
        if (map) textures.add(map);
        mat.dispose();
      }
    });
    textures.forEach((t) => t.dispose());
    envMap.dispose();
    renderer.dispose();
  }

  return {
    render,
    needsFrames,
    resize,
    setPixelRatio: (ratio) => {
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
    },
    dispose,
  };
}
