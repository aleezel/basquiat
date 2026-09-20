// Perspective-projected 3D line geometry; no external runtime required.
(() => {
  const canvas = document.getElementById('space-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const lines = [];
  let width = 1, height = 1, frame = 0;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const line = (a, b, tone = 'structure') => lines.push({ a, b, tone });
  const path = (points, tone, close = false) => {
    points.slice(1).forEach((p, i) => line(points[i], p, tone));
    if (close) line(points.at(-1), points[0], tone);
  };
  const ring = (x, y, z, radius, tone) => {
    path(Array.from({ length: 65 }, (_, i) => {
      const angle = i / 64 * Math.PI * 2;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, z];
    }), tone);
  };
  for (let n = -50; n <= 50; n += 2) line([n, 0, -55], [n, 0, 25], 'grid');
  for (let n = -55; n <= 25; n += 2) line([-50, 0, n], [50, 0, n], 'grid');
  path([[-8, .02, -4], [8, .02, -4], [8, .02, 4], [-8, .02, 4]], 'structure', true);
  path([[-8, -.2, -4], [8, -.2, -4], [8, -.2, 4], [-8, -.2, 4]], 'muted', true);
  // A curved six-by-eight array of circular panels, inspired by the reference.
  for (let row = 0; row < 6; row++) {
    const y = .65 + row * 1.05;
    const z = -1.7 - Math.pow(row / 5, 2) * 1.5;
    for (let col = 0; col < 8; col++) {
      const x = (col - 3.5) * 1.05;
      path([[x - .5, y - .5, z], [x + .5, y - .5, z], [x + .5, y + .5, z], [x - .5, y + .5, z]], 'structure', true);
      const accent = (col + row * 3) % 11 === 0;
      ring(x, y, z + .01, .43, accent ? 'accent' : 'muted');
      if (accent) ring(x, y, z + .02, .24, 'accent');
      line([x, y, z], [x + .3, y + .3, z], 'detail');
    }
  }
  for (const x of [-4.25, 0, 4.25]) path([[x, 0, -1.7], [x, 6.4, -3.25], [x, 0, -4.8]], 'muted', true);
  for (const z of [.7, 1]) path([[5.5, 0, z], [5.5, 4.6, z], [7.4, 4.6, z], [7.4, 0, z]], 'structure');
  for (const x of [5.5, 7.4]) line([x, 4.6, .7], [x, 4.6, 1], 'structure');
  for (const y of [0, .55]) path([[-4, y, 2], [-1.5, y, 2], [-1.5, y, 3], [-4, y, 3]], 'muted', true);
  for (const x of [-4, -1.5]) for (const z of [2, 3]) line([x, 0, z], [x, .55, z], 'muted');


  // Scale the installation to architectural proportions around an eye-level camera.
  lines.forEach(segment => {
    if (segment.tone !== 'grid') {
      segment.a = segment.a.map(value => value * 2.3);
      segment.b = segment.b.map(value => value * 2.3);
    }
  });
  const travel = { z: 14, x: 0, yaw: 0, pitch: .07 };
  const look = { yaw: 0, pitch: 0, zoom: 0 };
  const stage = document.getElementById('line-space');
  const door = stage.querySelector('.chapter-door');
  const layer = stage.querySelector('.space-viewport');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;

  // Camera-space clipping prevents huge strokes when a line crosses the lens.
  function cameraPoint([x, y, z]) {
    x -= travel.x;
    y -= 2.5;
    z -= travel.z + look.zoom;
    const yaw = travel.yaw + look.yaw, pitch = travel.pitch + look.pitch;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const rx = x * cy + z * sy, rz = -x * sy + z * cy;
    return [rx, y * cp + rz * sp, y * sp - rz * cp];
  }
  function project(point) {
    const focal = height * 1.12;
    return [width / 2 + point[0] * focal / point[2], height / 2 - point[1] * focal / point[2]];
  }
  function clip(a, b) {
    const near = .3;
    if (a[2] < near && b[2] < near) return null;
    if (a[2] < near || b[2] < near) {
      const t = (near - a[2]) / (b[2] - a[2]);
      const intersection = a.map((value, i) => value + (b[i] - value) * t);
      if (a[2] < near) a = intersection; else b = intersection;
    }
    return [project(a), project(b)];
  }
  const palette = {
    grid: '#d3cdb526', detail: '#c5bda044', muted: '#d2ceb77a',
    structure: '#e2dfc4b8', accent: '#c7a779df',
  };
  function draw() {
    frame = 0;
    if (!visible) return;
    ctx.clearRect(0, 0, width, height);
    for (const tone of ['grid', 'detail', 'muted', 'structure', 'accent']) {
      ctx.beginPath();
      ctx.strokeStyle = palette[tone];
      ctx.lineWidth = tone === 'accent' ? 1.35 : 1;
      for (const segment of lines) {
        if (segment.tone !== tone) continue;
        const projected = clip(cameraPoint(segment.a), cameraPoint(segment.b));
        if (!projected) continue;
        ctx.moveTo(...projected[0]); ctx.lineTo(...projected[1]);
      }
      ctx.stroke();
    }
  }
  function invalidate() {
    if (visible && !frame) frame = requestAnimationFrame(draw);
  }
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    invalidate();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    document.body.classList.toggle('space-in-view', visible);
    invalidate();
  }).observe(stage);

  // One pinned composition: the door and the world share the same viewport.
  // Only the children and camera move; the pinned section remains stable.
  if (window.gsap && window.ScrollTrigger) {
    const mm = gsap.matchMedia();
    mm.add({ reduced: '(prefers-reduced-motion: reduce)', full: '(prefers-reduced-motion: no-preference)' }, context => {
      Object.assign(travel, { z: 14, x: 0, yaw: 0, pitch: .07 });
      if (context.conditions.reduced) {
        gsap.set(door, { autoAlpha: 0 });
        gsap.set(layer, { opacity: 1 });
        invalidate();
        return;
      }
      const journey = gsap.timeline({
        defaults: { ease: 'none' },
        onUpdate: invalidate,
        scrollTrigger: {
          id: 'door-space', trigger: stage, start: 'top top',
          end: () => '+=' + Math.round(window.innerHeight * 2.4),
          pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
        },
      });
      journey
        .fromTo(layer, { opacity: .28 }, { opacity: 1, duration: .9 }, 0)
        .fromTo(door, { scale: 1, autoAlpha: 1 }, { scale: 7, duration: 1.15 }, 0)
        .to(door, { autoAlpha: 0, duration: .45 }, .35)
        .to(travel, { z: 6, x: .8, yaw: -.08, pitch: .12, duration: 2.8 }, 0)
        .to(travel, { z: 5, duration: .5 }, 2.8);
      return () => invalidate();
    });
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  } else {
    // The scene remains usable if the animation CDN is unavailable.
    door.style.visibility = 'hidden';
    layer.style.opacity = '1';
  }

  function aim(yaw, pitch) {
    const values = { yaw: clamp(yaw, -.9, .9), pitch: clamp(pitch, -.45, .5) };
    if (window.gsap && !reducedMotion.matches) {
      gsap.to(look, { ...values, duration: .45, ease: 'power2.out', overwrite: 'auto', onUpdate: invalidate });
    } else { Object.assign(look, values); invalidate(); }
  }
  function reset() {
    if (window.gsap) gsap.killTweensOf(look);
    Object.assign(look, { yaw: 0, pitch: 0, zoom: 0 });
    invalidate();
  }
  let pointer = null;
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    if (window.gsap) gsap.killTweensOf(look);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: look.yaw, pitch: look.pitch };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('is-dragging');
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId) {
      aim(pointer.yaw - (event.clientX - pointer.x) * .003,
        pointer.pitch + (event.pointerType === 'touch' ? 0 : (event.clientY - pointer.y) * .002));
    }
  });
  const release = () => { pointer = null; canvas.classList.remove('is-dragging'); };
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, release);
  canvas.addEventListener('dblclick', reset);
  canvas.addEventListener('keydown', event => {
    const moves = { ArrowLeft: [-.07, 0], ArrowRight: [.07, 0], ArrowUp: [0, .05], ArrowDown: [0, -.05] };
    if (moves[event.key]) {
      event.preventDefault();
      aim(look.yaw + moves[event.key][0], look.pitch + moves[event.key][1]);
    } else if (['+', '=', '-'].includes(event.key)) {
      event.preventDefault();
      look.zoom = clamp(look.zoom + (event.key === '-' ? .6 : -.6), -2, 7);
      invalidate();
    } else if (event.key === 'Home' || event.key === 'Escape') {
      event.preventDefault(); reset();
    }
  });
})();
