import "./style.css";
import { Camera } from "./camera";
import { mat4 } from "./math";
import { gui, hexToRgb, initGUI, updateLightDisplay } from "./gui";
import { loadObj } from "./obj-loader";
import { rasterizeMeshToImage } from "./rasterizer";

type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

type LoadedTexture = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const textures = new Map<number, LoadedTexture>();

let mesh: MeshData | null = null;
let modelTransform = mat4.identity();
let currentObjectRadius = 1.0;
let isReady = false;
let needsRender = true;

const canvas = document.querySelector("#gfx-main") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;

type BoundsSphere = {
  center: [number, number, number];
  radius: number;
};

type BoundsBox = {
  center: [number, number, number];
  min: [number, number, number];
  max: [number, number, number];
};

type GuiSnapshot = {
  modelId: number;
  ambient: number;
  diffuse: number;
  specular: number;
  shininess: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  autoRotLight: boolean;
  objectColor: string;
  lightColor: string;
  selectedTexture: number;
  useTexture: boolean;
};

let lastGuiSnapshot: GuiSnapshot | null = null;

function requestRender() {
  needsRender = true;
}

function makeGuiSnapshot(): GuiSnapshot {
  return {
    modelId: gui.modelId,
    ambient: gui.ambient,
    diffuse: gui.diffuse,
    specular: gui.specular,
    shininess: gui.shininess,
    lightX: gui.lightX,
    lightY: gui.lightY,
    lightZ: gui.lightZ,
    autoRotLight: gui.autoRotLight,
    objectColor: gui.objectColor,
    lightColor: gui.lightColor,
    selectedTexture: gui.selectedTexture,
    useTexture: gui.useTexture,
  };
}

function guiChanged(): boolean {
  const current = makeGuiSnapshot();

  if (!lastGuiSnapshot) {
    lastGuiSnapshot = current;
    return true;
  }

  const changed =
    current.modelId !== lastGuiSnapshot.modelId ||
    current.ambient !== lastGuiSnapshot.ambient ||
    current.diffuse !== lastGuiSnapshot.diffuse ||
    current.specular !== lastGuiSnapshot.specular ||
    current.shininess !== lastGuiSnapshot.shininess ||
    current.lightX !== lastGuiSnapshot.lightX ||
    current.lightY !== lastGuiSnapshot.lightY ||
    current.lightZ !== lastGuiSnapshot.lightZ ||
    current.autoRotLight !== lastGuiSnapshot.autoRotLight ||
    current.objectColor !== lastGuiSnapshot.objectColor ||
    current.lightColor !== lastGuiSnapshot.lightColor ||
    current.selectedTexture !== lastGuiSnapshot.selectedTexture ||
    current.useTexture !== lastGuiSnapshot.useTexture;

  if (changed) {
    lastGuiSnapshot = current;
  }

  return changed;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));

    img.src = src;
  });
}

async function loadTexture(id: number): Promise<void> {
  const candidates = [`/${id}.png`, `/${id}.jpg`, `/${id}.jpeg`];

  let img: HTMLImageElement | null = null;

  for (const src of candidates) {
    try {
      img = await loadImage(src);
      break;
    } catch {
      // seguir probando
    }
  }

  if (!img) {
    console.warn(`No se encontró textura ${id} (.png/.jpg/.jpeg)`);
    return;
  }

  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;

  const cctx = c.getContext("2d")!;
  cctx.drawImage(img, 0, 0);

  const imageData = cctx.getImageData(0, 0, img.width, img.height);

  textures.set(id, {
    data: imageData.data,
    width: img.width,
    height: img.height,
  });
}

function resize() {
  const scale = 1.0;

  canvas.width = Math.floor(window.innerWidth * scale);
  canvas.height = Math.floor(window.innerHeight * scale);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  const aspect = canvas.width / canvas.height;
  camera.setArcball([0, 0, 0], currentObjectRadius, (60 * Math.PI) / 180, aspect);

  requestRender();
}
window.addEventListener("resize", resize);

function makeSphereFitTransform(bounds: BoundsSphere, targetRadius = 1.0) {
  const s = targetRadius / bounds.radius;

  return mat4.multiply(
    mat4.scaling(s, s, s),
    mat4.translation(-bounds.center[0], -bounds.center[1], -bounds.center[2])
  );
}

function makeBoxFitTransform(bounds: BoundsBox, targetRadius = 1.0) {
  const halfX = (bounds.max[0] - bounds.min[0]) / 2;
  const halfY = (bounds.max[1] - bounds.min[1]) / 2;
  const halfZ = (bounds.max[2] - bounds.min[2]) / 2;

  const radius = Math.hypot(halfX, halfY, halfZ);
  const s = targetRadius / radius;

  return mat4.multiply(
    mat4.scaling(s, s, s),
    mat4.translation(-bounds.center[0], -bounds.center[1], -bounds.center[2])
  );
}

function generateCubeIndexed(): MeshData {
  const positions = new Float32Array([
    // Front
    -1, -1,  1,
     1, -1,  1,
     1,  1,  1,
    -1,  1,  1,

    // Back
     1, -1, -1,
    -1, -1, -1,
    -1,  1, -1,
     1,  1, -1,

    // Left
    -1, -1, -1,
    -1, -1,  1,
    -1,  1,  1,
    -1,  1, -1,

    // Right
     1, -1,  1,
     1, -1, -1,
     1,  1, -1,
     1,  1,  1,

    // Top
    -1,  1,  1,
     1,  1,  1,
     1,  1, -1,
    -1,  1, -1,

    // Bottom
    -1, -1, -1,
     1, -1, -1,
     1, -1,  1,
    -1, -1,  1,
  ]);

  const normals = new Float32Array([
    // Front
     0,  0,  1,
     0,  0,  1,
     0,  0,  1,
     0,  0,  1,

    // Back
     0,  0, -1,
     0,  0, -1,
     0,  0, -1,
     0,  0, -1,

    // Left
    -1,  0,  0,
    -1,  0,  0,
    -1,  0,  0,
    -1,  0,  0,

    // Right
     1,  0,  0,
     1,  0,  0,
     1,  0,  0,
     1,  0,  0,

    // Top
     0,  1,  0,
     0,  1,  0,
     0,  1,  0,
     0,  1,  0,

    // Bottom
     0, -1,  0,
     0, -1,  0,
     0, -1,  0,
     0, -1,  0,
  ]);

  const uvs = new Float32Array([
    // Front
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // Back
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // Left
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // Right
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // Top
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // Bottom
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,   0, 2, 3,     // Front
    4, 5, 6,   4, 6, 7,     // Back
    8, 9,10,   8,10,11,     // Left
   12,13,14,  12,14,15,     // Right
   16,17,18,  16,18,19,     // Top
   20,21,22,  20,22,23,     // Bottom
  ]);

  return { positions, normals, uvs, indices };
}

function generateSphereIndexed(stacks: number, slices: number): MeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= stacks; i++) {
    const phi = (Math.PI * i) / stacks;

    for (let j = 0; j <= slices; j++) {
      const theta = (2 * Math.PI * j) / slices;

      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);

      positions.push(x, y, z);
      normals.push(x, y, z);
      uvs.push(j / slices, i / stacks);
    }
  }

  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * (slices + 1) + j;
      const b = a + slices + 1;

      indices.push(a, b, a + 1);
      indices.push(b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

async function setShape(type: string) {
  isReady = false;

  if (type === "beacon") {
    mesh = await loadObj("/beacon.obj", {
      forceGeneratedNormals: true,
      outwardCenter: [125, 125, 125],
    });

    modelTransform = makeSphereFitTransform(
      { center: [125, 125, 125], radius: 125 },
      1.0
    );

    currentObjectRadius = 1.0;
  } else if (type === "teapot") {
    mesh = await loadObj("/teapot.obj", {
      forceGeneratedNormals: true,
      outwardCenter: [0.217, 1.575, 0],
    });

    modelTransform = makeBoxFitTransform(
      {
        center: [0.217, 1.575, 0],
        min: [-3, 0, -2],
        max: [3.434, 3.15, 2.0],
      },
      1.0
    );

    currentObjectRadius = 1.0;
  } else if (type === "cube") {
    mesh = generateCubeIndexed();
    modelTransform = mat4.identity();
    currentObjectRadius = Math.sqrt(3);
  } else {
    mesh = generateSphereIndexed(24, 24);
    modelTransform = mat4.identity();
    currentObjectRadius = 1.0;
  }

  const aspect = canvas.width / canvas.height;
  camera.setArcball([0, 0, 0], currentObjectRadius, (60 * Math.PI) / 180, aspect);

  isReady = true;
  requestRender();
}

const camera = new Camera(canvas, requestRender);

resize();

await Promise.all([
  loadTexture(1),
  loadTexture(2),
  loadTexture(3),
  loadTexture(4),
  loadTexture(5),
  loadTexture(6),
  loadTexture(7),
  loadTexture(8),
]);

await setShape("cube");

function render() {
  if (!isReady || !mesh) return;

  const cameraPos = camera.getPosition();

  const lightPos: [number, number, number] = [
    cameraPos[0],
    cameraPos[1] + 2.0,
    cameraPos[2] + 0.5,
  ];

  updateLightDisplay(lightPos[0], lightPos[2]);

  if (gui.autoRotLight) {
    needsRender = true;
  }

  const aspect = canvas.width / canvas.height;
  const proj = mat4.perspective((60 * Math.PI) / 180, aspect, 0.01, 100.0);
  const view = camera.getViewMatrix();
  const mvp = mat4.multiply(mat4.multiply(proj, view), modelTransform);
  const normM = mat4.normalMatrix(modelTransform);

  const [or, og, ob] = hexToRgb(gui.objectColor);
  const [lr, lg, lb] = hexToRgb(gui.lightColor);

  const selectedTexture = textures.get(gui.selectedTexture) ?? null;

  const result = rasterizeMeshToImage({
    width: canvas.width,
    height: canvas.height,
    mesh,
    mvp,
    model: modelTransform,
    normalMatrix: normM,
    lightPos,
    cameraPos,
    objectColor: [or, og, ob],
    lightColor: [lr, lg, lb],
    ambient: gui.ambient,
    diffuse: gui.diffuse,
    specular: gui.specular,
    shininess: gui.shininess,
    textureData: selectedTexture ? selectedTexture.data : null,
    textureWidth: selectedTexture ? selectedTexture.width : 0,
    textureHeight: selectedTexture ? selectedTexture.height : 0,
    useTexture: gui.useTexture && !!selectedTexture,
    shadingModel: gui.modelId,
  });

  if (gui.modelId === 4) {
    ctx.putImageData(result.normalImage, 0, 0);
  } else {
    ctx.putImageData(result.colorImage, 0, 0);
  }
}

function frame() {
  requestAnimationFrame(frame);

  if (guiChanged()) {
    requestRender();
  }

  if (!needsRender) return;
  needsRender = false;

  render();
}

requestAnimationFrame(frame);

initGUI((shape) => {
  setShape(shape);
  requestRender();
});