// Full-viewport analogue TV noise rendered in a small, independent WebGL pass.
(() => {
  const canvas = document.getElementById('tv-noise');
  if (!canvas) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });

  const useFallback = () => canvas.classList.add('is-css-fallback');
  if (!gl) {
    useFallback();
    return;
  }

  const vertexSource = `
    attribute vec2 a_position;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_frame;

    float random(vec2 point) {
      return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 pixel = gl_FragCoord.xy;
      vec2 uv = pixel / u_resolution;
      float tick = floor(u_time * 24.0) + u_frame;

      // Average several samples so the grain never forms isolated white blocks.
      float fineNoise = (
        random(pixel + vec2(tick * 19.17, tick * 7.31)) +
        random(pixel * 1.37 + vec2(-tick * 5.13, tick * 11.07)) +
        random(pixel * 0.73 + vec2(tick * 8.41, -tick * 3.29))
      ) / 3.0;

      // Tie most of the variation to horizontal rows, like an analogue signal.
      float rowNoise = random(vec2(floor(pixel.y * 0.5), tick * 0.37));
      float scanline = sin(pixel.y * 3.14159265) * 0.075;

      float drift = fract(u_time * 0.085);
      float interference = exp(-pow((uv.y - drift) * 52.0, 2.0)) * 0.12;
      float roll = sin((uv.y + u_time * 0.23) * 84.0) * 0.035;
      float flicker = sin(u_time * 17.0) * 0.012;

      float signal = (fineNoise - 0.5) * 0.62 + (rowNoise - 0.5) * 0.18;
      vec3 colour = vec3(0.5 + signal + scanline + interference + roll + flicker);

      // Chroma follows each scanline instead of appearing as coloured pixels.
      float chroma = (rowNoise - 0.5) * 0.035;
      colour.r += chroma;
      colour.b -= chroma;

      // Avoid pure black/white peaks, which read as random square artefacts.
      gl_FragColor = vec4(clamp(colour, 0.16, 0.84), 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compile(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) {
    useFallback();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    useFallback();
    return;
  }

  const vertices = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     3, -1,
    -1,  3,
  ]), gl.STATIC_DRAW);

  gl.useProgram(program);
  const position = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const resolution = gl.getUniformLocation(program, 'u_resolution');
  const time = gl.getUniformLocation(program, 'u_time');
  const frame = gl.getUniformLocation(program, 'u_frame');

  let width = 0;
  let height = 0;
  let animationFrame = 0;
  let frameCount = 0;
  let scrollResumeTimer = 0;
  function resize() {
    // The texture is intentionally coarse; rendering it below CSS resolution
    // leaves more GPU time for the scroll-linked scene.
    const scale = Math.min(window.devicePixelRatio || 1, 0.6);
    const nextWidth = Math.max(1, Math.round(window.innerWidth * scale));
    const nextHeight = Math.max(1, Math.round(window.innerHeight * scale));
    if (nextWidth === width && nextHeight === height) return;

    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(resolution, width, height);
  }

  function paint(now = 0) {
    animationFrame = 0;
    resize();
    gl.uniform1f(time, now * 0.001);
    gl.uniform1f(frame, frameCount++ % 4096);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function animate(now) {
    // Stay synchronized with the compositor so the overlay never appears to
    // stutter independently from ScrollTrigger.
    paint(now);
    animationFrame = requestAnimationFrame(animate);
  }

  function start() {
    cancelAnimationFrame(animationFrame);
    if (document.hidden || reducedMotion.matches) {
      paint(performance.now());
      return;
    }
    animationFrame = requestAnimationFrame(animate);
  }

  function holdWhileScrolling() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    clearTimeout(scrollResumeTimer);
    scrollResumeTimer = window.setTimeout(start, 120);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', holdWhileScrolling, { passive: true });
  document.addEventListener('visibilitychange', start);
  reducedMotion.addEventListener('change', start);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(animationFrame);
    useFallback();
  });
  canvas.addEventListener('webglcontextrestored', () => window.location.reload());

  start();
})();
