export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

type Vec3 = [number, number, number];
type Vec2 = [number, number];

type TempVertex = {
  v: number;
  vt: number;
  vn: number;
};

type BuildOptions = {
  forceGeneratedNormals?: boolean;
  outwardCenter?: Vec3;
};

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
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

function lengthVec3(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v: Vec3): Vec3 {
  const len = lengthVec3(v);
  if (len === 0) return [0, 1, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
function sphericalUVFromPosition(p: Vec3): Vec2 {
  const x = p[0];
  const y = p[1];
  const z = p[2];

  const r = Math.hypot(x, y, z) || 1;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;

  const theta = Math.atan2(nz, nx);
  const phi = Math.acos(Math.max(-1, Math.min(1, ny)));

  const u = (theta + Math.PI) / (2 * Math.PI);
  const v = phi / Math.PI;

  return [u, v];
}

function parseIndex(value: string, length: number): number {
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return -1;
  return n > 0 ? n - 1 : length + n;
}

function parseOBJ(text: string): {
  rawPositions: Vec3[];
  rawUVs: Vec2[];
  rawNormals: Vec3[];
  faces: TempVertex[][];
} {
  const rawPositions: Vec3[] = [];
  const rawUVs: Vec2[] = [];
  const rawNormals: Vec3[] = [];
  const faces: TempVertex[][] = [];

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parts = trimmed.split(/\s+/);
    const tag = parts[0];

    if (tag === "v") {
      rawPositions.push([
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      ]);
    } else if (tag === "vt") {
      rawUVs.push([
        Number(parts[1] ?? 0),
        Number(parts[2] ?? 0),
      ]);
    } else if (tag === "vn") {
      rawNormals.push([
        Number(parts[1]),
        Number(parts[2]),
        Number(parts[3]),
      ]);
    } else if (tag === "f") {
      const verts = parts.slice(1).map((token) => {
        const [vStr, vtStr, vnStr] = token.split("/");

        return {
          v: parseIndex(vStr, rawPositions.length),
          vt: vtStr ? parseIndex(vtStr, rawUVs.length) : -1,
          vn: vnStr ? parseIndex(vnStr, rawNormals.length) : -1,
        };
      });

      if (verts.length >= 3) {
        for (let i = 1; i < verts.length - 1; i++) {
          faces.push([verts[0], verts[i], verts[i + 1]]);
        }
      }
    }
  }

  return { rawPositions, rawUVs, rawNormals, faces };
}

function buildIndexedMesh(
  parsed: ReturnType<typeof parseOBJ>,
  options?: BuildOptions
): MeshData {
  const { rawPositions, rawUVs, rawNormals, faces } = parsed;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const vertexMap = new Map<string, number>();

  const useGeneratedNormals =
    options?.forceGeneratedNormals === true || rawNormals.length === 0;

  const outwardCenter: Vec3 = options?.outwardCenter ?? [0, 0, 0];

  for (const tri of faces) {
    for (const vert of tri) {
      const key = `${vert.v}/${vert.vt}/${vert.vn}`;
      let index = vertexMap.get(key);

      if (index === undefined) {
        index = positions.length / 3;
        vertexMap.set(key, index);

        const p = rawPositions[vert.v];
        positions.push(p[0], p[1], p[2]);

        const sphericalUV = sphericalUVFromPosition(p);
        uvs.push(sphericalUV[0], sphericalUV[1]);

        if (!useGeneratedNormals && vert.vn >= 0 && rawNormals[vert.vn]) {
          const n = normalize(rawNormals[vert.vn]);
          normals.push(n[0], n[1], n[2]);
        } else {
          normals.push(0, 0, 0);
        }
      }

      indices.push(index);
    }
  }

  if (useGeneratedNormals) {
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];

      const p0: Vec3 = [
        positions[i0 * 3 + 0],
        positions[i0 * 3 + 1],
        positions[i0 * 3 + 2],
      ];
      const p1: Vec3 = [
        positions[i1 * 3 + 0],
        positions[i1 * 3 + 1],
        positions[i1 * 3 + 2],
      ];
      const p2: Vec3 = [
        positions[i2 * 3 + 0],
        positions[i2 * 3 + 1],
        positions[i2 * 3 + 2],
      ];

      const e1 = sub(p1, p0);
      const e2 = sub(p2, p0);

      let faceNormal = cross(e1, e2);
      faceNormal = normalize(faceNormal);

      const centroid = scale(add(add(p0, p1), p2), 1 / 3);
      const outward = sub(centroid, outwardCenter);

      if (lengthVec3(outward) > 0 && dot(faceNormal, outward) < 0) {
        faceNormal = [-faceNormal[0], -faceNormal[1], -faceNormal[2]];
      }

      normals[i0 * 3 + 0] += faceNormal[0];
      normals[i0 * 3 + 1] += faceNormal[1];
      normals[i0 * 3 + 2] += faceNormal[2];

      normals[i1 * 3 + 0] += faceNormal[0];
      normals[i1 * 3 + 1] += faceNormal[1];
      normals[i1 * 3 + 2] += faceNormal[2];

      normals[i2 * 3 + 0] += faceNormal[0];
      normals[i2 * 3 + 1] += faceNormal[1];
      normals[i2 * 3 + 2] += faceNormal[2];
    }

    for (let i = 0; i < normals.length; i += 3) {
      const n = normalize([
        normals[i + 0],
        normals[i + 1],
        normals[i + 2],
      ]);

      normals[i + 0] = n[0];
      normals[i + 1] = n[1];
      normals[i + 2] = n[2];
    }
  }

  if (positions.length / 3 > 65535) {
    throw new Error(
      "La malla tiene más de 65535 vértices únicos y el pipeline actual usa uint16."
    );
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

export async function loadObj(url: string, options?: BuildOptions): Promise<MeshData> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No se pudo cargar el archivo OBJ: ${url}`);
  }

  const text = await response.text();
  const parsed = parseOBJ(text);
  return buildIndexedMesh(parsed, options);
}