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
  // A 360-degree line room: the camera remains at its center and scroll rotates its view.
  const radius = 14, roomHeight = 12, columns = 32, rows = 6;
  const wallPoint = (angle, y, r = radius) => [Math.sin(angle) * r, y, -Math.cos(angle) * r];
  const horizontalRing = (r, y, tone) => path(
    Array.from({ length: 129 }, (_, i) => wallPoint(i / 128 * Math.PI * 2, y, r)),
    tone
  );
  for (let row = 0; row <= rows; row++) {
    horizontalRing(radius, row * 2, row === 0 || row === rows ? 'structure' : 'muted');
  }
  for (let col = 0; col < columns; col++) {
    const angle = col / columns * Math.PI * 2;
    line(wallPoint(angle, 0), wallPoint(angle, roomHeight), 'structure');
    line([0, 0, 0], wallPoint(angle, 0), 'grid');
    line([0, roomHeight, 0], wallPoint(angle, roomHeight), 'grid');
    for (let row = 0; row < rows; row++) {
      const centerAngle = angle + Math.PI / columns;
      const y = row * 2 + 1;
      const accent = (col + row * 3) % 11 === 0;
      const circle = (size, tone) => path(Array.from({ length: 33 }, (_, i) => {
        const t = i / 32 * Math.PI * 2;
        return wallPoint(centerAngle + Math.cos(t) * size / radius, y + Math.sin(t) * size);
      }), tone);
      circle(.78, accent ? 'accent' : 'muted');
      if (accent) circle(.4, 'accent');
    }
  }
  for (let r = 2; r < radius; r += 2) {
    horizontalRing(r, 0, 'grid');
    horizontalRing(r, roomHeight, 'grid');
  }
  const travel = { yaw: 0, pitch: 0 };
  const look = { yaw: 0, pitch: 0, zoom: 0 };
  const memoryPlanes = [
    ['assets/img/tunnel-01-cassette-.png', 3.2, 3.2],
    ['assets/img/tunnel-02-walkman-.png', 7.1, 3.5],
    ['assets/img/tunnel-03-ipod.png', 4.4, 3.05],
    ['assets/img/tunnel-04-crt-tv.png', 8.8, 3.8],
    ['assets/img/tunnel-05-smartphone.png', 1.8, 2.7],
  ].map(([src, y, size]) => {
    const image = new Image();
    const plane = { image, y, size, phase: 0 };
    image.addEventListener('load', () => invalidate());
    image.src = src;
    return plane;
  });
  const stage = document.getElementById('line-space');
  const camera = { cy: 1, sy: 0, cp: 1, sp: 0, focal: 1 };

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let active = false;

  // Camera-space clipping prevents huge strokes when a line crosses the lens.
  function cameraPoint([x, y, z]) {
    y -= 4.5;
    const rx = x * camera.cy + z * camera.sy;
    const rz = -x * camera.sy + z * camera.cy;
    return [rx, y * camera.cp + rz * camera.sp, y * camera.sp - rz * camera.cp];
  }
  function project(point) {
    return [width / 2 + point[0] * camera.focal / point[2], height / 2 - point[1] * camera.focal / point[2]];
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
    grid: '#82877912', detail: '#99917d20', muted: '#b0a58c29',
    structure: '#c2b79842', accent: '#d4b68485',
  };
  const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));
  function drawMemoryPlanes(yaw) {
    for (const plane of memoryPlanes) {
      if (!plane.image.complete || !plane.image.naturalWidth) continue;
      const delta = -1.24 + plane.phase * 2.48;
      const point = cameraPoint(wallPoint(yaw + Math.PI + delta, plane.y, radius - 3.2));
      if (point[2] <= .3) continue;
      const [x, y] = project(point);
      const scale = camera.focal / point[2];
      const height = plane.size * scale;
      const width = height * plane.image.naturalWidth / plane.image.naturalHeight;
      const side = Math.max(.22, Math.cos(wrapAngle(delta)));
      const edgeFade = .78 + Math.pow(Math.sin(Math.PI * plane.phase), .32) * .22;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(side, 1);
      ctx.globalAlpha = .96 * edgeFade;
      ctx.shadowColor = '#d4b88a8a';
      ctx.shadowBlur = 12;
      ctx.drawImage(plane.image, -width / 2, -height / 2, width, height);
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-atop';
      const vignette = ctx.createRadialGradient(0, 0, height * .12, 0, 0, height * .72);
      vignette.addColorStop(0, '#06070700');
      vignette.addColorStop(.72, '#06070720');
      vignette.addColorStop(1, '#020304b8');
      ctx.fillStyle = vignette;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.restore();
    }
  }
  function draw() {
    frame = 0;
    if (!visible || !active) return;
    const yaw = (reducedMotion.matches ? 0 : travel.yaw) + look.yaw;
    const pitch = (reducedMotion.matches ? 0 : travel.pitch) + look.pitch;
    camera.cy = Math.cos(yaw);
    camera.sy = Math.sin(yaw);
    camera.cp = Math.cos(pitch);
    camera.sp = Math.sin(pitch);
    camera.focal = height * .85 * Math.exp(-look.zoom * .08);
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
      // A small warm halo only around the luminous rings.
      ctx.shadowColor = tone === 'accent' ? '#d9b98580' : 'transparent';
      ctx.shadowBlur = tone === 'accent' ? 6 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    drawMemoryPlanes(yaw);
  }
  function invalidate() {
    if (visible && active && !frame) frame = requestAnimationFrame(draw);
  }
  new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    invalidate();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;

    invalidate();
  }).observe(stage);

  // Reveal at the midpoint of the original entrance, then share its scroll timeline.
  if (window.gsap && typeof home_tl !== 'undefined') {
    const duration = home_tl.duration();
    const midpoint = duration * .5;
    const domMemories = gsap.utils.toArray('.tunnel-memory');
    const memoryFlow = gsap.timeline({ defaults: { ease: 'none' } });
    const passDuration = duration * .62;
    const cadence = duration * .52;
    // Planes sweep across the interior wall from right to left without pausing.
    memoryPlanes.forEach((plane, i) => {
      const at = i * cadence;
      memoryFlow.fromTo(plane, { phase: 0 }, {
        phase: 1,
        duration: passDuration,
        onUpdate: invalidate,
      }, at);
    });
    // Visible projected cards: kept in the same viewport as the canvas so they share the tunnel.
    domMemories.forEach((memory, i) => {
      const at = i * cadence;
      memoryFlow.fromTo(memory, {
        autoAlpha: 1,
        x: () => window.innerWidth * .72,
        y: 0,
        rotationY: -34,
        rotationZ: i % 2 ? 7 : -7,
        scale: .9,
      }, {
        x: () => -window.innerWidth * 1.18,
        y: i % 2 ? -24 : 22,
        rotationY: 34,
        rotationZ: i % 2 ? -7 : 7,
        scale: 1.25,
        duration: passDuration,
        ease: 'none',
      }, at);
    });
    function syncScene() {
      const revealed = home_tl.time() >= midpoint;
      if (active !== revealed) {
        active = revealed;
        stage.inert = !revealed;
        document.body.classList.toggle('space-in-view', revealed);
      }
      if (active) invalidate();
    }

    home_tl
      .addLabel('space-reveal', midpoint)
      .fromTo(stage, { autoAlpha: 0 }, {
        autoAlpha: 1, duration: duration * .18, ease: 'none',
      }, midpoint)
      .to(travel, {
        yaw: Math.PI * 2, pitch: 0,
        duration: duration * 3, ease: 'none',
      }, midpoint)
      .add(memoryFlow, midpoint)
      .to('#tunnel-door', {
        rotate: 80, duration: duration * 3, ease: 'none',
      }, "<")
    // .to('#tunnel-door', {
    //   y: '-30vh', duration: duration * 2, ease: 'none'
    // }, '<0.25')
    home_tl.eventCallback('onUpdate', syncScene);
    syncScene();
    reducedMotion.addEventListener('change', invalidate);
    window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  } else {
    active = true;
    stage.style.visibility = 'visible';
    stage.style.opacity = '1';
    stage.inert = false;
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
