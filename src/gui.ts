export const gui = {
  modelId:         1,
  ambient:         0.12,
  diffuse:         0.75,
  specular:        0.60,
  shininess:       32,
  lightX:          3.0,
  lightY:          4.0,
  lightZ:          3.0,
  autoRotLight:    true,
  objectColor:     "#4a9eff",
  lightColor:      "#ffffff",
  selectedTexture: 1,
  useTexture:      true,
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ];
}

const MODEL_DESCS: Record<number, string> = {
  0: "Flat: one lighting value per triangle using the face normal.",
  1: "Gouraud: lighting computed at vertices and interpolated across the triangle.",
  2: "Phong: lighting computed per pixel using interpolated normals.",
  3: "Blinn-Phong: similar to Phong but using the half-vector for specular lighting.",
  4: "Normal Buffer: displays the stored normals as RGB colors.",
  5: "Wireframe: triangle edges only, with hidden surface removal.",
  6: "UV Coords: displays texture coordinates as colors (R = U, G = V).",

};

export function updateLightDisplay(lx: number, lz: number) {
  const lightX = document.getElementById("lightX") as HTMLInputElement | null;
  const lightXVal = document.getElementById("lightX-val");
  const lightZ = document.getElementById("lightZ") as HTMLInputElement | null;
  const lightZVal = document.getElementById("lightZ-val");

  if (lightX) lightX.value = lx.toFixed(1);
  if (lightXVal) lightXVal.textContent = lx.toFixed(1);

  if (lightZ) lightZ.value = lz.toFixed(1);
  if (lightZVal) lightZVal.textContent = lz.toFixed(1);
}

function slider(
  id: string,
  label: string,
  min: number,
  max: number,
  step: number,
  val: number
) {
  return `
  <div class="slider-row">
    <span class="slider-label">${label}</span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
    <span class="slider-val" id="${id}-val">${val}</span>
  </div>`;
}

export function initGUI(onShapeChange: (shape: string) => void) {
  const overlay = document.createElement("div");
  overlay.id = "gui";

  overlay.innerHTML = `
<div class="gui-panel">
  <div class="gui-title">Lighting Assignment</div>

  <div class="gui-section">
    <div class="gui-label">Shading Model</div>
    <div class="model-btns">
      <button class="model-btn" data-id="0">Flat</button>
      <button class="model-btn active" data-id="1">Gouraud</button>
      <button class="model-btn" data-id="2">Phong</button>
      <button class="model-btn" data-id="3">Blinn-Phong</button>
      <button class="model-btn" data-id="4">Normal Buffer</button>
      <button class="model-btn" data-id="5">Wireframe</button>
      <button class="model-btn" data-id="6">UV Coords</button>

    </div>
    <div class="model-desc" id="model-desc"></div>
  </div>

  <div class="gui-section">
    <div class="gui-label">Geometry</div>
    <div class="model-btns">
      <button class="shape-btn active" data-shape="cube">Cube</button>
      <button class="shape-btn" data-shape="sphere">Sphere</button>
      <button class="shape-btn" data-shape="beacon">Beacon</button>
      <button class="shape-btn" data-shape="teapot">Teapot</button>
    </div>
    <div class="model-desc" id="shape-desc">Cube is provided as a reference.</div>
  </div>

  <div class="gui-section">
    <div class="gui-label">Material</div>
    ${slider("ambient", "Ambient (Ka)", 0, 1, 0.01, gui.ambient)}
    ${slider("diffuse", "Diffuse (Kd)", 0, 1, 0.01, gui.diffuse)}
    ${slider("specular", "Specular (Ks)", 0, 1, 0.01, gui.specular)}
    ${slider("shininess", "Shininess (n)", 1, 256, 1, gui.shininess)}
  </div>

  <div class="gui-section">
    <div class="gui-label">Light</div>
    ${slider("lightX", "X", -8, 8, 0.1, gui.lightX)}
    ${slider("lightY", "Y", -8, 8, 0.1, gui.lightY)}
    ${slider("lightZ", "Z", -8, 8, 0.1, gui.lightZ)}
    <label class="checkbox-row">
      <input type="checkbox" id="autoRotLight" checked> Auto-rotate light
    </label>
  </div>

  <div class="gui-section">
    <div class="gui-label">Colors</div>
    <div class="color-row">
      <span>Object</span>
      <input type="color" id="objectColor" value="${gui.objectColor}">
    </div>
    <div class="color-row">
      <span>Light</span>
      <input type="color" id="lightColor" value="${gui.lightColor}">
    </div>
  </div>

  <div class="gui-section">
    <div class="gui-label">Texture</div>
    <div class="model-btns">
      <button class="tex-btn active" data-tex="1">1</button>
      <button class="tex-btn" data-tex="2">2</button>
      <button class="tex-btn" data-tex="3">3</button>
      <button class="tex-btn" data-tex="4">4</button>
      <button class="tex-btn" data-tex="5">5</button>
      <button class="tex-btn" data-tex="6">6</button>
      <button class="tex-btn" data-tex="7">7</button>
      <button class="tex-btn" data-tex="8">8</button>
    </div>
    <label class="checkbox-row">
      <input type="checkbox" id="useTexture" checked> Use texture
    </label>
  </div>

  <div class="gui-hint">Left drag = arcball rotate · Wheel = zoom</div>
</div>
`;

  document.body.appendChild(overlay);

  function updateDesc() {
    const desc = document.getElementById("model-desc");
    if (desc) desc.textContent = MODEL_DESCS[gui.modelId] ?? "";
  }

  updateDesc();

  document.querySelectorAll<HTMLButtonElement>(".model-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      gui.modelId = Number(btn.dataset.id);
      document.querySelectorAll(".model-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updateDesc();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".shape-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const shape = btn.dataset.shape as string;

      document.querySelectorAll(".shape-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const descEl = document.getElementById("shape-desc");
      if (descEl) {
        if (shape === "sphere") descEl.textContent = "Sphere generated via code.";
        else if (shape === "cube") descEl.textContent = "Cube is provided as a reference.";
        else descEl.textContent = `Loading OBJ model: ${shape}...`;
      }

      onShapeChange(shape);
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".tex-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      gui.selectedTexture = Number(btn.dataset.tex);
      document.querySelectorAll(".tex-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  (
    ["ambient", "diffuse", "specular", "shininess", "lightX", "lightY", "lightZ"] as const
  ).forEach((id) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    const valEl = document.getElementById(`${id}-val`);

    if (!el || !valEl) return;

    el.addEventListener("input", () => {
      (gui as Record<string, number>)[id] = parseFloat(el.value);
      valEl.textContent = el.value;
    });
  });

  const autoRotLight = document.getElementById("autoRotLight") as HTMLInputElement | null;
  if (autoRotLight) {
    autoRotLight.addEventListener("change", (e) => {
      gui.autoRotLight = (e.target as HTMLInputElement).checked;
    });
  }

  const useTexture = document.getElementById("useTexture") as HTMLInputElement | null;
  if (useTexture) {
    useTexture.addEventListener("change", (e) => {
      gui.useTexture = (e.target as HTMLInputElement).checked;
    });
  }

  const objectColor = document.getElementById("objectColor") as HTMLInputElement | null;
  if (objectColor) {
    objectColor.addEventListener("input", (e) => {
      gui.objectColor = (e.target as HTMLInputElement).value;
    });
  }

  const lightColor = document.getElementById("lightColor") as HTMLInputElement | null;
  if (lightColor) {
    lightColor.addEventListener("input", (e) => {
      gui.lightColor = (e.target as HTMLInputElement).value;
    });
  }
}