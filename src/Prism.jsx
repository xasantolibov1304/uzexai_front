import { lazy, Suspense, useEffect, useRef, useState } from "react";

const PrismTuner = lazy(() => import("./PrismTuner.jsx"));

// The look of the ribbon. Open the site with ?tune to adjust these live,
// then paste the copied values here to make them permanent.
export const PRISM_DEFAULTS = {
  speed: 4,
  height: 0.51,
  tilt: 0.28,
  waves: 0.95,
  width: 0.24,
  softness: 0.4,
  strength: 0.19,
  haze: 0,
  twist: 0.48,
  dim: 0.34,
  colors: ["#3399f2", "#9edbfa", "#ffeb94", "#fa9e4d", "#f5758f"],
};

const TUNE_KEY = "uzex_prism_tune";

const isTuning = () => new URLSearchParams(window.location.search).has("tune");

function loadSettings() {
  if (!isTuning()) return PRISM_DEFAULTS;
  try {
    return { ...PRISM_DEFAULTS, ...JSON.parse(localStorage.getItem(TUNE_KEY)) };
  } catch {
    return PRISM_DEFAULTS;
  }
}

// A soft sheet of light that folds through a pinch, split into prism bands.
// Rendered small and scaled up: the blur is part of the look, and it keeps the GPU cost low.
const FRAGMENT = `
precision mediump float;
uniform vec2 res;
uniform float t;
uniform float uHeight;
uniform float uTilt;
uniform float uWaves;
uniform float uWidth;
uniform float uSoftness;
uniform float uStrength;
uniform float uHaze;
uniform float uTwist;
uniform vec3 uColors[5];

float wave(float x, float phase) {
  return uWaves * (0.085 * sin(x * 2.2 + t * 0.13 + phase)
       + 0.040 * sin(x * 4.7 - t * 0.19 + phase * 1.7)
       + 0.012 * sin(x * 10.0 + t * 0.11 + phase * 2.3));
}

vec3 palette(float s) {
  if (s < 0.25) return mix(uColors[0], uColors[1], s / 0.25);
  if (s < 0.50) return mix(uColors[1], uColors[2], (s - 0.25) / 0.25);
  if (s < 0.75) return mix(uColors[2], uColors[3], (s - 0.50) / 0.25);
  return mix(uColors[3], uColors[4], (s - 0.75) / 0.25);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  float nx = uv.x * 2.0 - 1.0;
  float y = uv.y - uHeight - nx * uTilt;

  vec3 col = vec3(0.969, 0.969, 0.965);

  // Pale haze rising above the ribbon.
  float above = y - wave(nx, 0.0);
  float haze = smoothstep(0.0, 0.22, above) * (1.0 - smoothstep(0.18, 0.62, above));
  col = mix(col, vec3(0.74, 0.89, 0.97), haze * uHaze * (1.0 + 0.29 * sin(nx * 3.0 + t * 0.1)));

  // Bands swap order at the pinch, which is what reads as a twist.
  float pinch = uTwist + 0.10 * sin(t * 0.07);
  float spread = (nx - pinch) * uWidth;
  for (int i = 0; i < 7; i++) {
    float s = float(i) / 6.0;
    float phase = s * 0.9;
    float d = y - wave(nx, phase * 0.35) - (s - 0.5) * 2.0 * spread;
    float w = 0.005 + abs(spread) * uSoftness;
    // A small per-channel shift gives the prism fringe.
    vec3 dc = vec3(d - w * 0.28, d, d + w * 0.28);
    vec3 a = exp(-(dc * dc) / (w * w));
    col = mix(col, palette(s), a * uStrength);
  }

  // Dither to avoid banding in the soft gradients.
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(col + (grain - 0.5) / 255.0, 1.0);
}`;

const VERTEX = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

const RENDER_SCALE = 0.5;
const MAX_WIDTH = 900;
const FRAME_MS = 1000 / 30;
const START_TIME = 40;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Prism shader:", gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

export default function Prism() {
  const canvasRef = useRef(null);
  const [settings, setSettings] = useState(loadSettings);
  const settingsRef = useRef(settings);
  const redrawRef = useRef(null);
  const [tuning] = useState(isTuning);

  useEffect(() => {
    settingsRef.current = settings;
    redrawRef.current?.();
    if (tuning) {
      try {
        localStorage.setItem(TUNE_KEY, JSON.stringify(settings));
      } catch {
        // Only the panel's memory is lost; the sliders still work.
      }
    }
  }, [settings, tuning]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return undefined; // No WebGL: the plain sheet colour shows instead.

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return undefined;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniform = (name) => gl.getUniformLocation(program, name);
    const u = {
      res: uniform("res"),
      t: uniform("t"),
      height: uniform("uHeight"),
      tilt: uniform("uTilt"),
      waves: uniform("uWaves"),
      width: uniform("uWidth"),
      softness: uniform("uSoftness"),
      strength: uniform("uStrength"),
      haze: uniform("uHaze"),
      twist: uniform("uTwist"),
      colors: uniform("uColors"),
    };

    let time = START_TIME;

    const draw = () => {
      const s = settingsRef.current;
      gl.uniform1f(u.t, time);
      gl.uniform1f(u.height, s.height);
      gl.uniform1f(u.tilt, s.tilt);
      gl.uniform1f(u.waves, s.waves);
      gl.uniform1f(u.width, s.width);
      gl.uniform1f(u.softness, s.softness);
      gl.uniform1f(u.strength, s.strength);
      gl.uniform1f(u.haze, s.haze);
      gl.uniform1f(u.twist, s.twist);
      gl.uniform3fv(u.colors, s.colors.flatMap(hexToRgb));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    redrawRef.current = draw;

    const resize = () => {
      const width = Math.min(Math.round(window.innerWidth * RENDER_SCALE), MAX_WIDTH);
      const height = Math.round((width * window.innerHeight) / window.innerWidth);
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.res, width, height);
    };

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      // Advancing by elapsed time keeps the speed slider from making the ribbon jump.
      time += (Math.min(now - last, 100) / 1000) * settingsRef.current.speed;
      last = now;
      draw();
    };

    const onResize = () => {
      resize();
      draw();
    };

    onResize();
    window.addEventListener("resize", onResize);
    if (!still) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      redrawRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="prism"
        style={{ opacity: settings.dim }}
        aria-hidden="true"
      />
      {tuning && (
        <Suspense fallback={null}>
          <PrismTuner settings={settings} defaults={PRISM_DEFAULTS} onChange={setSettings} />
        </Suspense>
      )}
    </>
  );
}
