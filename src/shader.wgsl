struct Uniforms {
  mvp        : mat4x4<f32>,
  model      : mat4x4<f32>,
  normalMat  : mat4x4<f32>,
  lightPos   : vec3<f32>,
  _p0        : f32,
  lightColor : vec3<f32>,
  _p1        : f32,
  ambient    : f32,
  diffuse    : f32,
  specular   : f32,
  shininess  : f32,
  camPos     : vec3<f32>,
  model_id   : u32,
  objectColor: vec3<f32>,
  time       : f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VSInput {
  @location(0) position : vec3<f32>,
  @location(1) normal   : vec3<f32>,
  @location(2) uv       : vec2<f32>,
};

struct VSOut {
  @builtin(position) clipPos : vec4<f32>,
  @location(0) worldPos      : vec3<f32>,
  @location(1) worldNormal   : vec3<f32>,
  @location(2) uv            : vec2<f32>,
  @location(3) gouraudColor  : vec3<f32>,
};

fn calculateLighting(N_in: vec3<f32>, worldPos: vec3<f32>, isBlinn: bool) -> vec3<f32> {
  let N = normalize(N_in);
  let L = normalize(u.lightPos - worldPos);
  let V = normalize(u.camPos - worldPos);

  let ambientTerm = u.ambient * u.lightColor;
  let ndotl = max(dot(N, L), 0.0);
  let diffuseTerm = u.diffuse * ndotl * u.lightColor;

  var specTerm: f32 = 0.0;
  if (ndotl > 0.0) {
    if (isBlinn) {
      let H = normalize(L + V);
      specTerm = pow(max(dot(N, H), 0.0), u.shininess);
    } else {
      let R = reflect(-L, N);
      specTerm = pow(max(dot(R, V), 0.0), u.shininess);
    }
  }

  let specularTerm = u.specular * specTerm * u.lightColor;
  return (ambientTerm + diffuseTerm + specularTerm) * u.objectColor;
}

@vertex
fn vs_main(input: VSInput) -> VSOut {
  var out: VSOut;

  let worldPos4 = u.model * vec4<f32>(input.position, 1.0);
  let N = normalize((u.normalMat * vec4<f32>(input.normal, 0.0)).xyz);

  out.clipPos = u.mvp * vec4<f32>(input.position, 1.0);
  out.worldPos = worldPos4.xyz;
  out.worldNormal = N;
  out.uv = input.uv;

  if (u.model_id == 1u) {
    out.gouraudColor = calculateLighting(N, worldPos4.xyz, false);
  } else {
    out.gouraudColor = vec3<f32>(0.0, 0.0, 0.0);
  }

  return out;
}

@fragment
fn fs_main(input: VSOut) -> @location(0) vec4<f32> {
  var color: vec3<f32>;
  let N = normalize(input.worldNormal);

  switch u.model_id {
    case 0u: {
      let fN = normalize(cross(dpdx(input.worldPos), dpdy(input.worldPos)));
      color = calculateLighting(fN, input.worldPos, false);
    }
    case 1u: {
      color = input.gouraudColor;
    }
    case 2u: {
      color = calculateLighting(N, input.worldPos, false);
    }
    case 3u: {
      color = calculateLighting(N, input.worldPos, true);
    }
    default: {
      color = vec3<f32>(1.0, 1.0, 1.0);
    }
  }

  return vec4<f32>(color, 1.0);
}