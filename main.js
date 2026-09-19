gsap.registerPlugin(ScrollTrigger);

let layers = [
  { selector: '.yellow', x: 1.0, y: 0.5 },
  { selector: '.black', x: -0.7, y: -0.8 },
  { selector: '.lightblue', x: 0.5, y: 1.0 },
  { selector: '.pink', x: -1.0, y: -0.4 },
  { selector: '.darkblue', x: 0.8, y: 0.7 },
];

let strength = 8;
let els = [];

function init() {
  els = layers.map(l => ({ el: document.querySelector(l.selector), ...l }));
}

function buildGUI() {
  const gui = document.createElement('div');
  gui.id = 'gui';
  gui.innerHTML = `
    <div class="gui-title">Parallax Controls</div>
    <label>Strength <span id="strength-val">${strength}</span>
      <input type="range" id="strength" min="0" max="40" step="0.5" value="${strength}">
    </label>
    ${layers.map((l, i) => `
    <label>${l.selector.replace('.', '')}
      X <span id="x-val-${i}">${l.x}</span>
      <input type="range" id="x-${i}" min="-3" max="3" step="0.1" value="${l.x}">
      Y <span id="y-val-${i}">${l.y}</span>
      <input type="range" id="y-${i}" min="-3" max="3" step="0.1" value="${l.y}">
    </label>`).join('')}
    <div class="gui-title" style="margin-top:.5rem">Tunnel Door</div>
    <label>Scale <span id="door-scale-val">4</span>
      <input type="range" id="door-scale" min="0.1" max="8" step="0.05" value="4">
    </label>
    <label>Y offset <span id="door-y-val">0</span>px
      <input type="range" id="door-y" min="-500" max="2000" step="1" value="0">
    </label>
    <label>X offset <span id="door-x-val">0</span>px
      <input type="range" id="door-x" min="-500" max="500" step="1" value="0">
    </label>
    <label>Camera radius <span id="door-radius-val">120</span>px
      <input type="range" id="door-radius" min="10" max="600" step="1" value="120">
    </label>
  `;
  document.body.appendChild(gui);

  document.getElementById('strength').addEventListener('input', e => {
    strength = parseFloat(e.target.value);
    document.getElementById('strength-val').textContent = strength;
  });

  layers.forEach((l, i) => {
    document.getElementById(`x-${i}`).addEventListener('input', e => {
      l.x = parseFloat(e.target.value);
      document.getElementById(`x-val-${i}`).textContent = l.x;
    });
    document.getElementById(`y-${i}`).addEventListener('input', e => {
      l.y = parseFloat(e.target.value);
      document.getElementById(`y-val-${i}`).textContent = l.y;
    });
  });

  const door = document.getElementById('tunnel-door');

  document.getElementById('door-scale').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('door-scale-val').textContent = v;
    doorConfig.startScale = v;
    door.style.setProperty('--door-scale', v);
  });

  document.getElementById('door-y').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('door-y-val').textContent = v;
    door.style.setProperty('--door-y', v + 'px');
  });

  document.getElementById('door-x').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('door-x-val').textContent = v;
    door.style.setProperty('--door-x', v + 'px');
  });

  document.getElementById('door-radius').addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    document.getElementById('door-radius-val').textContent = v;
    doorConfig.radius = v;
  });
}

document.addEventListener('mousemove', e => {
  const dx = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
  const dy = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);

  els.forEach(({ el, x, y }) => {
    gsap.to(el, {
      x: dx * x * strength,
      y: dy * y * strength,
      duration: 1.6,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  });
});

// Scroll-driven zoom-out — pin the scene, animate on scroll
let home_tl = gsap.timeline({
  scrollTrigger: {
    trigger: '#tunnel-stage',
    start: 'top top',
    end: '+=200%',
    pin: true,
    scrub: 1.5,
    anticipatePin: 1,
  }
})

home_tl
  .to("#hero-scene",
    { scale: 0.05, autoAlpha: 1, ease: 'none', stagger: 0 }
  )
  .to("#hero-wrapper",
    { clipPath: 'circle(0vw at 50vw 50vh)', ease: 'none' },
    "0"
  )
  .to('#tunnel-door',
    { scale: 0.5, ease: 'none' }, '0')

init();
buildGUI();
