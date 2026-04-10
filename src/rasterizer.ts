type Mat4Like = ArrayLike<number>;
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];
type Vec2 = [number, number];

export type MeshData = {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
};

type RasterParams = {
  width: number;
  height: number;
  mesh: MeshData;
  mvp: Mat4Like;
  model: Mat4Like;
  normalMatrix: Mat4Like;
  lightPos: Vec3;
  cameraPos: Vec3;
  objectColor: Vec3;
  lightColor: Vec3;
  ambient: number;
  diffuse: number;
  specular: number;
  shininess: number;
  textureData: Uint8ClampedArray | null;
  textureWidth: number;
  textureHeight: number;
  useTexture: boolean;
  shadingModel: number; // 0 flat, 1 gouraud, 2 phong, 3 blinn, 4 normal buffer, 5 wireframe, 6 uv coords

};

type VertexOut = {
  clip: Vec4;
  worldPos: Vec3;
  normal: Vec3;
  uv: Vec2;
  sx: number;
  sy: number;
  depth: number;
  invW: number;
};

type RasterResult = {
  colorImage: ImageData;
  normalImage: ImageData;
};

type ClipVertex = {
  clip: Vec4;
  worldPos: Vec3;
  normal: Vec3;
  uv: Vec2;
};

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function mixVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function mixVec4(a: Vec4, b: Vec4, t: number): Vec4 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function mixVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len === 0) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function mulMat4Vec4(m: Mat4Like, v: Vec4): Vec4 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

function encodeNormalToRGB(n: Vec3): [number, number, number] {
  return [
    Math.round((n[0] * 0.5 + 0.5) * 255),
    Math.round((n[1] * 0.5 + 0.5) * 255),
    Math.round((n[2] * 0.5 + 0.5) * 255),
  ];
}

function decodeRGBToNormal(r: number, g: number, b: number): Vec3 {
  return normalize([
    (r / 255) * 2 - 1,
    (g / 255) * 2 - 1,
    (b / 255) * 2 - 1,
  ]);
}

function wrapUV(u: number): number {
  u = u - Math.floor(u);
  if (u < 0) u += 1;
  return u;
}

function sampleTexture(
  tex: Uint8ClampedArray | null,
  w: number,
  h: number,
  u: number,
  v: number
): Vec3 {
  if (!tex || w <= 0 || h <= 0) return [1, 1, 1];

  const uu = wrapUV(u);
  const vv = wrapUV(v);

  const x = Math.min(w - 1, Math.floor(uu * (w - 1)));
  const y = Math.min(h - 1, Math.floor((1 - vv) * (h - 1)));
  const idx = (y * w + x) * 4;

  return [
    tex[idx + 0] / 255,
    tex[idx + 1] / 255,
    tex[idx + 2] / 255,
  ];
}

function interpolatePerspectiveVec3(
  b0: number,
  b1: number,
  b2: number,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  invW0: number,
  invW1: number,
  invW2: number
): Vec3 {
  const w0 = b0 * invW0;
  const w1 = b1 * invW1;
  const w2 = b2 * invW2;
  const sum = w0 + w1 + w2;

  return [
    (v0[0] * w0 + v1[0] * w1 + v2[0] * w2) / sum,
    (v0[1] * w0 + v1[1] * w1 + v2[1] * w2) / sum,
    (v0[2] * w0 + v1[2] * w1 + v2[2] * w2) / sum,
  ];
}

function interpolatePerspectiveScalar(
  b0: number,
  b1: number,
  b2: number,
  s0: number,
  s1: number,
  s2: number,
  invW0: number,
  invW1: number,
  invW2: number
): number {
  const w0 = b0 * invW0;
  const w1 = b1 * invW1;
  const w2 = b2 * invW2;
  const sum = w0 + w1 + w2;
  return (s0 * w0 + s1 * w1 + s2 * w2) / sum;
}

function calculateLighting(
  Ninput: Vec3,
  worldPos: Vec3,
  lightPos: Vec3,
  cameraPos: Vec3,
  baseColor: Vec3,
  lightColor: Vec3,
  ambient: number,
  diffuse: number,
  specular: number,
  shininess: number,
  isBlinn: boolean
): Vec3 {
  const N = normalize(Ninput);
  const L = normalize(sub(lightPos, worldPos));
  const V = normalize(sub(cameraPos, worldPos));

  const ambientTerm: Vec3 = [
    ambient * lightColor[0],
    ambient * lightColor[1],
    ambient * lightColor[2],
  ];

  const ndotl = Math.max(dot(N, L), 0);
  const diffuseTerm: Vec3 = [
    diffuse * ndotl * lightColor[0],
    diffuse * ndotl * lightColor[1],
    diffuse * ndotl * lightColor[2],
  ];

  let specTerm = 0;
  if (ndotl > 0) {
    if (isBlinn) {
      const H = normalize(add(L, V));
      specTerm = Math.pow(Math.max(dot(N, H), 0), shininess);
    } else {
      const R = sub(scale(N, 2 * dot(N, L)), L);
      specTerm = Math.pow(Math.max(dot(normalize(R), V), 0), shininess);
    }
  }

  const specularTerm: Vec3 = [
    specular * specTerm * lightColor[0],
    specular * specTerm * lightColor[1],
    specular * specTerm * lightColor[2],
  ];

  return [
    clamp01((ambientTerm[0] + diffuseTerm[0] + specularTerm[0]) * baseColor[0]),
    clamp01((ambientTerm[1] + diffuseTerm[1] + specularTerm[1]) * baseColor[1]),
    clamp01((ambientTerm[2] + diffuseTerm[2] + specularTerm[2]) * baseColor[2]),
  ];
}

function vertexStage(
  mesh: MeshData,
  mvp: Mat4Like,
  model: Mat4Like,
  normalMatrix: Mat4Like,
  width: number,
  height: number
): VertexOut[] {
  const count = mesh.positions.length / 3;
  const out: VertexOut[] = new Array(count);

  for (let i = 0; i < count; i++) {
    const pos: Vec4 = [
      mesh.positions[i * 3 + 0],
      mesh.positions[i * 3 + 1],
      mesh.positions[i * 3 + 2],
      1,
    ];

    const n4: Vec4 = [
      mesh.normals[i * 3 + 0],
      mesh.normals[i * 3 + 1],
      mesh.normals[i * 3 + 2],
      0,
    ];

    const world4 = mulMat4Vec4(model, pos);
    const clip = mulMat4Vec4(mvp, pos);
    const worldNormal4 = mulMat4Vec4(normalMatrix, n4);

    let sx = -1e9;
    let sy = -1e9;
    let depth = Infinity;
    let invW = 0;

    if (Math.abs(clip[3]) >= 1e-8) {
      invW = 1 / clip[3];
      const ndcX = clip[0] * invW;
      const ndcY = clip[1] * invW;
      const ndcZ = clip[2] * invW;

      sx = (ndcX * 0.5 + 0.5) * (width - 1);
      sy = (1 - (ndcY * 0.5 + 0.5)) * (height - 1);
      depth = ndcZ * 0.5 + 0.5;
    }

    out[i] = {
      clip,
      worldPos: [world4[0], world4[1], world4[2]],
      normal: normalize([worldNormal4[0], worldNormal4[1], worldNormal4[2]]),
      uv: [
        mesh.uvs[i * 2] ?? 0,
        mesh.uvs[i * 2 + 1] ?? 0,
      ],
      sx,
      sy,
      depth,
      invW,
    };
  }

  return out;
}

function clipVertexToScreen(v: ClipVertex, width: number, height: number): VertexOut {
  const invW = 1 / v.clip[3];
  const ndcX = v.clip[0] * invW;
  const ndcY = v.clip[1] * invW;
  const ndcZ = v.clip[2] * invW;

  return {
    clip: v.clip,
    worldPos: v.worldPos,
    normal: normalize(v.normal),
    uv: v.uv,
    sx: (ndcX * 0.5 + 0.5) * (width - 1),
    sy: (1 - (ndcY * 0.5 + 0.5)) * (height - 1),
    depth: ndcZ * 0.5 + 0.5,
    invW,
  };
}

function insideClipPlane(v: ClipVertex, plane: number): boolean {
  const [x, y, z, w] = v.clip;
  switch (plane) {
    case 0: return x >= -w;
    case 1: return x <=  w;
    case 2: return y >= -w;
    case 3: return y <=  w;
    case 4: return z >= -w;
    case 5: return z <=  w;
    default: return true;
  }
}

function planeValue(v: ClipVertex, plane: number): number {
  const [x, y, z, w] = v.clip;
  switch (plane) {
    case 0: return x + w;
    case 1: return w - x;
    case 2: return y + w;
    case 3: return w - y;
    case 4: return z + w;
    case 5: return w - z;
    default: return 0;
  }
}

function intersectClipPlane(a: ClipVertex, b: ClipVertex, plane: number): ClipVertex {
  const fa = planeValue(a, plane);
  const fb = planeValue(b, plane);
  const denom = fa - fb;
  const t = Math.abs(denom) < 1e-8 ? 0 : fa / denom;

  return {
    clip: mixVec4(a.clip, b.clip, t),
    worldPos: mixVec3(a.worldPos, b.worldPos, t),
    normal: normalize(mixVec3(a.normal, b.normal, t)),
    uv: mixVec2(a.uv, b.uv, t),
  };
}

function clipPolygonAgainstPlane(poly: ClipVertex[], plane: number): ClipVertex[] {
  if (poly.length === 0) return [];

  const out: ClipVertex[] = [];

  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];

    const currIn = insideClipPlane(curr, plane);
    const prevIn = insideClipPlane(prev, plane);

    if (currIn) {
      if (!prevIn) out.push(intersectClipPlane(prev, curr, plane));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersectClipPlane(prev, curr, plane));
    }
  }

  return out;
}

function clipTriangle(v0: VertexOut, v1: VertexOut, v2: VertexOut, width: number, height: number): VertexOut[][] {
  let poly: ClipVertex[] = [
    { clip: v0.clip, worldPos: v0.worldPos, normal: v0.normal, uv: v0.uv },
    { clip: v1.clip, worldPos: v1.worldPos, normal: v1.normal, uv: v1.uv },
    { clip: v2.clip, worldPos: v2.worldPos, normal: v2.normal, uv: v2.uv },
  ];

  for (let plane = 0; plane < 6; plane++) {
    poly = clipPolygonAgainstPlane(poly, plane);
    if (poly.length === 0) return [];
  }

  const tris: VertexOut[][] = [];
  for (let i = 1; i < poly.length - 1; i++) {
    tris.push([
      clipVertexToScreen(poly[0], width, height),
      clipVertexToScreen(poly[i], width, height),
      clipVertexToScreen(poly[i + 1], width, height),
    ]);
  }

  return tris;
}

function drawLineWithDepth(
  v0: VertexOut,
  v1: VertexOut,
  width: number,
  height: number,
  depthBuffer: Float32Array,
  colorPixels: Uint8ClampedArray
) {
  const dx = v1.sx - v0.sx;
  const dy = v1.sy - v0.sy;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));

  if (steps < 1) {
    const x = Math.round(v0.sx);
    const y = Math.round(v0.sy);
    if (x < 0 || x >= width || y < 0 || y >= height) return;

    const idx = y * width + x;
    if (v0.depth > depthBuffer[idx] + 1e-4) return;

    const p = idx * 4;
    colorPixels[p + 0] = 255;
    colorPixels[p + 1] = 255;
    colorPixels[p + 2] = 255;
    colorPixels[p + 3] = 255;
    return;
  }

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(v0.sx + dx * t);
    const y = Math.round(v0.sy + dy * t);
    const z = v0.depth + (v1.depth - v0.depth) * t;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = y * width + x;
    if (z > depthBuffer[idx] + 1e-4) continue;

    const p = idx * 4;
    colorPixels[p + 0] = 255;
    colorPixels[p + 1] = 255;
    colorPixels[p + 2] = 255;
    colorPixels[p + 3] = 255;
  }
}

export function rasterizeMeshToImage(params: RasterParams): RasterResult {
  const {
    width,
    height,
    mesh,
    mvp,
    model,
    normalMatrix,
    lightPos,
    cameraPos,
    objectColor,
    lightColor,
    ambient,
    diffuse,
    specular,
    shininess,
    textureData,
    textureWidth,
    textureHeight,
    useTexture,
    shadingModel,
  } = params;

  const colorImage = new ImageData(width, height);
  const colorPixels = colorImage.data;

  const normalImage = new ImageData(width, height);
  const normalPixels = normalImage.data;

  const depthBuffer = new Float32Array(width * height);
  const worldPosX = new Float32Array(width * height);
  const worldPosY = new Float32Array(width * height);
  const worldPosZ = new Float32Array(width * height);
  const uvX = new Float32Array(width * height);
  const uvY = new Float32Array(width * height);

  depthBuffer.fill(Infinity);

  for (let i = 0; i < colorPixels.length; i += 4) {
    colorPixels[i + 0] = 3;
    colorPixels[i + 1] = 13;
    colorPixels[i + 2] = 30;
    colorPixels[i + 3] = 255;

    normalPixels[i + 0] = 0;
    normalPixels[i + 1] = 0;
    normalPixels[i + 2] = 0;
    normalPixels[i + 3] = 255;
  }

  const vertices = vertexStage(mesh, mvp, model, normalMatrix, width, height);
  const clippedTriangles: VertexOut[][] = [];

  // Pass 1: fill depth + color/normal buffers
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const i0 = mesh.indices[t + 0];
    const i1 = mesh.indices[t + 1];
    const i2 = mesh.indices[t + 2];

    const clippedTris = clipTriangle(vertices[i0], vertices[i1], vertices[i2], width, height);
    for (const tri of clippedTris) {
      clippedTriangles.push(tri);

      const v0 = tri[0];
      const v1 = tri[1];
      const v2 = tri[2];

      const area = edge(v0.sx, v0.sy, v1.sx, v1.sy, v2.sx, v2.sy);
      if (Math.abs(area) < 1e-8) continue;

      const minX = Math.max(0, Math.floor(Math.min(v0.sx, v1.sx, v2.sx)));
      const maxX = Math.min(width - 1, Math.ceil(Math.max(v0.sx, v1.sx, v2.sx)));
      const minY = Math.max(0, Math.floor(Math.min(v0.sy, v1.sy, v2.sy)));
      const maxY = Math.min(height - 1, Math.ceil(Math.max(v0.sy, v1.sy, v2.sy)));

      const faceNormal = normalize(
        cross(sub(v1.worldPos, v0.worldPos), sub(v2.worldPos, v0.worldPos))
      );

      const faceCentroid: Vec3 = [
        (v0.worldPos[0] + v1.worldPos[0] + v2.worldPos[0]) / 3,
        (v0.worldPos[1] + v1.worldPos[1] + v2.worldPos[1]) / 3,
        (v0.worldPos[2] + v1.worldPos[2] + v2.worldPos[2]) / 3,
      ];

      const tex0 = useTexture
        ? sampleTexture(textureData, textureWidth, textureHeight, v0.uv[0], v0.uv[1])
        : objectColor;
      const tex1 = useTexture
        ? sampleTexture(textureData, textureWidth, textureHeight, v1.uv[0], v1.uv[1])
        : objectColor;
      const tex2 = useTexture
        ? sampleTexture(textureData, textureWidth, textureHeight, v2.uv[0], v2.uv[1])
        : objectColor;

      const faceUV: Vec2 = [
        (v0.uv[0] + v1.uv[0] + v2.uv[0]) / 3,
        (v0.uv[1] + v1.uv[1] + v2.uv[1]) / 3,
      ];

      const flatTexColor = useTexture
        ? sampleTexture(textureData, textureWidth, textureHeight, faceUV[0], faceUV[1])
        : objectColor;

      const c0 = calculateLighting(
        v0.normal, v0.worldPos, lightPos, cameraPos,
        tex0, lightColor, ambient, diffuse, specular, shininess, false
      );
      const c1 = calculateLighting(
        v1.normal, v1.worldPos, lightPos, cameraPos,
        tex1, lightColor, ambient, diffuse, specular, shininess, false
      );
      const c2 = calculateLighting(
        v2.normal, v2.worldPos, lightPos, cameraPos,
        tex2, lightColor, ambient, diffuse, specular, shininess, false
      );

      const flatColor = calculateLighting(
        faceNormal, faceCentroid, lightPos, cameraPos,
        flatTexColor, lightColor, ambient, diffuse, specular, shininess, false
      );

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          const py = y + 0.5;

          let b0 = edge(v1.sx, v1.sy, v2.sx, v2.sy, px, py) / area;
          let b1 = edge(v2.sx, v2.sy, v0.sx, v0.sy, px, py) / area;
          let b2 = edge(v0.sx, v0.sy, v1.sx, v1.sy, px, py) / area;

          const eps = -1e-6;
          if (b0 < eps || b1 < eps || b2 < eps) continue;

          if (b0 < 0) b0 = 0;
          if (b1 < 0) b1 = 0;
          if (b2 < 0) b2 = 0;

          const depth = interpolatePerspectiveScalar(
            b0, b1, b2,
            v0.depth, v1.depth, v2.depth,
            v0.invW, v1.invW, v2.invW
          );

          if (depth < 0 || depth > 1) continue;

          const idx = y * width + x;
          if (depth >= depthBuffer[idx]) continue;
          depthBuffer[idx] = depth;

          const worldPos = interpolatePerspectiveVec3(
            b0, b1, b2,
            v0.worldPos, v1.worldPos, v2.worldPos,
            v0.invW, v1.invW, v2.invW
          );

          const normal = normalize(
            interpolatePerspectiveVec3(
              b0, b1, b2,
              v0.normal, v1.normal, v2.normal,
              v0.invW, v1.invW, v2.invW
            )
          );

          const gouraudColor = interpolatePerspectiveVec3(
            b0, b1, b2,
            c0, c1, c2,
            v0.invW, v1.invW, v2.invW
          );

          const u = interpolatePerspectiveScalar(
            b0, b1, b2,
            v0.uv[0], v1.uv[0], v2.uv[0],
            v0.invW, v1.invW, v2.invW
          );

          const v = interpolatePerspectiveScalar(
            b0, b1, b2,
            v0.uv[1], v1.uv[1], v2.uv[1],
            v0.invW, v1.invW, v2.invW
          );

          worldPosX[idx] = worldPos[0];
          worldPosY[idx] = worldPos[1];
          worldPosZ[idx] = worldPos[2];
          uvX[idx] = u;
          uvY[idx] = v;

          const p = idx * 4;
          const [nr, ng, nb] = encodeNormalToRGB(normal);
          normalPixels[p + 0] = nr;
          normalPixels[p + 1] = ng;
          normalPixels[p + 2] = nb;
          normalPixels[p + 3] = 255;

          let finalColor: Vec3 = [0, 0, 0];

    if (shadingModel === 0) {
  finalColor = flatColor;
} else if (shadingModel === 1) {
  finalColor = gouraudColor;
} else if (shadingModel === 4) {
  finalColor = [nr / 255, ng / 255, nb / 255];
} else if (shadingModel === 6) {
  finalColor = [wrapUV(u), wrapUV(v), 0];
}

          colorPixels[p + 0] = Math.round(clamp01(finalColor[0]) * 255);
          colorPixels[p + 1] = Math.round(clamp01(finalColor[1]) * 255);
          colorPixels[p + 2] = Math.round(clamp01(finalColor[2]) * 255);
          colorPixels[p + 3] = 255;
        }
      }
    }
  }

  // Pass 2: phong/blinn from normal buffer
  if (shadingModel === 2 || shadingModel === 3) {
    for (let idx = 0; idx < width * height; idx++) {
      if (!Number.isFinite(depthBuffer[idx])) continue;

      const p = idx * 4;

      const normalFromBuffer = decodeRGBToNormal(
        normalPixels[p + 0],
        normalPixels[p + 1],
        normalPixels[p + 2]
      );

      const worldPos: Vec3 = [
        worldPosX[idx],
        worldPosY[idx],
        worldPosZ[idx],
      ];

      const texColor = useTexture
        ? sampleTexture(textureData, textureWidth, textureHeight, uvX[idx], uvY[idx])
        : objectColor;

      const color = calculateLighting(
        normalFromBuffer,
        worldPos,
        lightPos,
        cameraPos,
        texColor,
        lightColor,
        ambient,
        diffuse,
        specular,
        shininess,
        shadingModel === 3
      );

      colorPixels[p + 0] = Math.round(clamp01(color[0]) * 255);
      colorPixels[p + 1] = Math.round(clamp01(color[1]) * 255);
      colorPixels[p + 2] = Math.round(clamp01(color[2]) * 255);
      colorPixels[p + 3] = 255;
    }
  }

  // Pass 3: wireframe with hidden surface removal
  if (shadingModel === 5) {
    for (const tri of clippedTriangles) {
      drawLineWithDepth(tri[0], tri[1], width, height, depthBuffer, colorPixels);
      drawLineWithDepth(tri[1], tri[2], width, height, depthBuffer, colorPixels);
      drawLineWithDepth(tri[2], tri[0], width, height, depthBuffer, colorPixels);
    }
  }

  return {
    colorImage,
    normalImage,
  };
}