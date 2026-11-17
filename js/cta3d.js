/* =========================================================
   cta3d.js — Vue 3D interactive de la CTA (Three.js r128)
   Contrôles orbitaux maison (souris + tactile), sélection par raycasting,
   vue éclatée, particules d'air colorées pilotées par la simulation.
   ========================================================= */
(function () {
  const C3 = {};
  let scene, camera, renderer, ray, mouse, host, tip, groups = {}, pickables = [], particles = [], blades = { reg_an: [], reg_rec: [], reg_rejet: [], reg_reglage: [] };
  let wheel, filterMats = [], selected = null, hovered = null, explode = 0, explodeTarget = 0, casingMat, labels = [], started = false, tourTimer = null;
  const V3 = (x, y, z) => window.THREE ? new THREE.Vector3(x, y, z) : null;
  const orbit = { theta: -0.55, phi: 1.1, r: 21, target: V3(10, 1.6, 0), tTarget: V3(10, 1.6, 0) };
  const COL = { an: 0x3b82f6, mel: 0xa855f7, tra: 0x22c55e, sou: 0x67e8f9, rep: 0xf59e0b, rej: 0xef4444 };
  const EXPLODE = {}; // id -> Vector3 offset

  function grp(id) {
    if (!groups[id]) { const g = new THREE.Group(); g.userData.id = id; scene.add(g); groups[id] = g; }
    return groups[id];
  }
  function mat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, metalness: 0.35, roughness: 0.55 }, o)); }
  function add(id, geo, color, x, y, z, o = {}) {
    const m = new THREE.Mesh(geo, o.material || mat(color, o.mat || {}));
    m.position.set(x, y, z); if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
    m.userData.id = id; grp(id).add(m); if (id) pickables.push(m); return m;
  }
  const box = (id, w, h, d, x, y, z, c, o) => add(id, new THREE.BoxGeometry(w, h, d), c, x, y, z, o);
  const cyl = (id, r, h, x, y, z, c, o) => add(id, new THREE.CylinderGeometry(r, r, h, 24), c, x, y, z, o);
  /* gaine droite axe-alignée entre deux points, section s×s */
  function duct(id, a, b, s, c) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const L = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
    const w = Math.abs(dx) > 0 ? L + s : s, h = Math.abs(dy) > 0 ? L + s : s, d = Math.abs(dz) > 0 ? L + s : s;
    return box(id, w, h, d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, c, { mat: { transparent: true, opacity: 0.35, metalness: 0.6, roughness: 0.4 } });
  }
  function ductPath(id, pts, s, c) { for (let i = 0; i < pts.length - 1; i++) duct(id, pts[i], pts[i + 1], s, c); }
  function damper(id, x, y, z, w, h, axis = 'x', n = 4) {
    const frame = box(id, axis === 'x' ? 0.08 : w, axis === 'y' ? 0.08 : h, axis === 'x' ? w : (axis === 'y' ? h : 0.08), x, y, z, 0x8899aa);
    frame.material.transparent = true; frame.material.opacity = 0.25;
    for (let i = 0; i < n; i++) {
      let m;
      if (axis === 'x') m = box(id, 0.03, h / n * 0.95, w * 0.96, x, y - h / 2 + (i + 0.5) * h / n, z, 0xc9d3df);
      else if (axis === 'y') m = box(id, w * 0.96, 0.03, h / n * 0.95, x, y, z - h / 2 + (i + 0.5) * h / n, 0xc9d3df);
      blades[id] && blades[id].push({ m, axis });
    }
  }

  function build() {
    /* sol et repères */
    const grid = new THREE.GridHelper(60, 60, 0x1e3a66, 0x14264a); grid.position.set(10, 0, 0); scene.add(grid);
    /* Caisson CTA */
    casingMat = new THREE.MeshStandardMaterial({ color: 0x9fb6d9, transparent: true, opacity: 0.12, metalness: 0.3, roughness: 0.6, depthWrite: false });
    const cas = new THREE.Mesh(new THREE.BoxGeometry(13, 2, 1.8), casingMat); cas.position.set(6.5, 1, 0); scene.add(cas);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(13, 2, 1.8)), new THREE.LineBasicMaterial({ color: 0x4f7bd1 }));
    edges.position.copy(cas.position); scene.add(edges);
    [1.4, 3.1, 5.8, 7.8, 9.3, 11.3].forEach(x => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.01, 2, 1.8)), new THREE.LineBasicMaterial({ color: 0x2f4f86 })); e.position.set(x, 1, 0); scene.add(e); });
    /* socle */
    const base = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.12, 2), mat(0x2a3a55)); base.position.set(6.5, -0.06, 0); scene.add(base);

    /* A — air neuf */
    for (let i = 0; i < 7; i++) box('prise_air', 0.05, 0.22, 1.7, -0.75, 0.25 + i * 0.25, 0, 0xb0bcc9, { rot: [0, 0, -0.6] });
    box('prise_air', 0.1, 1.95, 1.8, -0.75, 1, 0, 0x6d7f99, { mat: { transparent: true, opacity: 0.2 } });
    for (let i = 0; i < 9; i++) box('grille', 0.02, 1.8, 0.015, -0.4, 1, -0.8 + i * 0.2, 0x8899aa);
    for (let i = 0; i < 9; i++) box('grille', 0.02, 0.015, 1.7, -0.4, 0.15 + i * 0.21, 0, 0x8899aa);
    damper('reg_an', 0.25, 1, 0, 1.7, 1.85, 'x', 5);
    box('reg_an', 0.25, 0.25, 0.3, 0.25, 1, 1.07, 0xffb020);
    box('filtre_prim', 0.12, 1.85, 1.7, 0.85, 1, 0, 0xe8e2c8);
    cyl('sonde_text', 0.06, 0.4, -1.4, 2.4, 0.6, 0xff6b6b); add('sonde_text', new THREE.SphereGeometry(0.11, 16, 16), 0xff6b6b, -1.4, 2.65, 0.6);
    cyl('sonde_hext', 0.06, 0.4, -1.4, 2.4, -0.6, 0x7dd3fc); add('sonde_hext', new THREE.SphereGeometry(0.11, 16, 16), 0x7dd3fc, -1.4, 2.65, -0.6);
    cyl(null, 0.03, 2.4, -1.4, 1.2, 0, 0x55657f, { rot: [Math.PI / 2, 0, 0] });

    /* B — mélange */
    box('caisson_mel', 1.6, 1.96, 1.76, 2.25, 1, 0, 0x5b8def, { mat: { transparent: true, opacity: 0.08, depthWrite: false } });
    damper('reg_rec', 2.45, 2.05, -0.5, 0.75, 0.75, 'y', 4);
    add('sonde_mel', new THREE.SphereGeometry(0.09, 16, 16), 0xe879f9, 2.95, 1.6, 0.6);
    /* gaine de reprise / rejet au-dessus */
    ductPath('gaine_rep', [[16.6, 2.9, -0.5], [2.45, 2.9, -0.5]], 0.8, 0xf5a524);
    duct('gaine_rep', [2.45, 2.9, -0.5], [2.45, 2.15, -0.5], 0.75, 0xf5a524);
    ductPath('extraction', [[2.45, 2.9, -0.5], [1.5, 2.9, -0.5], [1.5, 4.7, -0.5]], 0.7, 0xef4444);
    add('extraction', new THREE.ConeGeometry(0.75, 0.4, 4), 0x9aa8bb, 1.5, 5.25, -0.5, { rot: [0, Math.PI / 4, 0] });
    cyl('extraction', 0.55, 0.9, 9, 2.9, -0.5, 0xd36b6b, { rot: [0, 0, Math.PI / 2] });
    damper('reg_rejet', 1.5, 3.8, -0.5, 0.65, 0.65, 'y', 3);

    /* C — filtration */
    box('prefiltre', 0.14, 1.85, 1.7, 3.45, 1, 0, 0xe8e2c8);
    for (let i = 0; i < 4; i++) box('filtre_inter', 0.9, 0.38, 1.6, 4.25, 0.3 + i * 0.47, 0, 0xf2f0e6, { rot: [0, 0, 0] });
    box('filtre_inter', 0.06, 1.9, 1.75, 3.78, 1, 0, 0x8a95a8);
    box('filtre_he', 0.3, 1.85, 1.7, 5.35, 1, 0, 0xf5f3ea);
    [0.85, 3.45, 4.25, 5.35].forEach(x => { cyl('manometre', 0.14, 0.05, x, 1.55, 0.95, 0xe2e8f0, { rot: [Math.PI / 2, 0, 0] }); });
    box('detect_colmat', 0.22, 0.22, 0.12, 4.8, 1.55, 0.97, 0x2f8cff);
    filterMats = ['filtre_prim', 'prefiltre', 'filtre_inter', 'filtre_he'].map(id => groups[id].children.filter(m => m.material.color.getHex() !== 0x8a95a8).map(m => m.material)).flat();

    /* D — thermique */
    box('bat_froide', 0.35, 1.7, 1.6, 6.25, 1.05, 0, 0x3b82f6, { mat: { metalness: 0.7, roughness: 0.3 } });
    for (let i = 0; i < 12; i++) box('bat_froide', 0.37, 0.02, 1.62, 6.25, 0.25 + i * 0.14, 0, 0x93c5fd);
    box('bac_cond', 0.9, 0.06, 1.7, 6.45, 0.08, 0, 0xcbd5e1);
    add('siphon', new THREE.TorusGeometry(0.18, 0.04, 12, 24, Math.PI), 0x94a3b8, 6.6, -0.35, 0.7, { rot: [0, 0, Math.PI] });
    cyl('siphon', 0.04, 0.35, 6.42, -0.15, 0.7, 0x94a3b8); cyl('siphon', 0.04, 0.3, 6.78, -0.3, 0.7, 0x94a3b8);
    for (let i = 0; i < 6; i++) box('separ_goutt', 0.04, 1.7, 0.05, 6.75 + (i % 2) * 0.05, 1, -0.75 + i * 0.3, 0xa3b1c6);
    box('separ_goutt', 0.1, 1.75, 1.7, 6.77, 1, 0, 0xa3b1c6, { mat: { transparent: true, opacity: 0.25 } });
    box('bat_chaude', 0.3, 1.7, 1.6, 7.3, 1.05, 0, 0xef4444, { mat: { metalness: 0.7, roughness: 0.3 } });
    for (let i = 0; i < 12; i++) box('bat_chaude', 0.32, 0.02, 1.62, 7.3, 0.25 + i * 0.14, 0, 0xfca5a5);
    cyl('sonde_antigel', 0.02, 1.6, 7.62, 0.6, 0, 0x67e8f9, { rot: [Math.PI / 2, 0, 0] });
    cyl('sonde_antigel', 0.02, 1.6, 7.62, 1.4, 0, 0x67e8f9, { rot: [Math.PI / 2, 0, 0] });
    /* circuit hydraulique (côté arrière) */
    const pipe = (id, a, b, c) => { const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const L = v.length(); const m = cyl(id, 0.06, L, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, c); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); };
    pipe('circuit_hydr', [6.15, 0.5, -0.9], [6.15, 0.5, -2.4], 0x2563eb); pipe('circuit_hydr', [6.35, 1.6, -0.9], [6.35, 1.6, -2.4], 0x60a5fa);
    pipe('circuit_hydr', [6.15, 0.5, -2.4], [4.5, 0.5, -2.4], 0x2563eb); pipe('circuit_hydr', [6.35, 1.6, -2.4], [4.5, 1.6, -2.4], 0x60a5fa);
    pipe('circuit_hydr', [7.2, 0.5, -0.9], [7.2, 0.5, -2.6], 0xdc2626); pipe('circuit_hydr', [7.4, 1.6, -0.9], [7.4, 1.6, -2.6], 0xf87171);
    pipe('circuit_hydr', [7.2, 0.5, -2.6], [8.8, 0.5, -2.6], 0xdc2626); pipe('circuit_hydr', [7.4, 1.6, -2.6], [8.8, 1.6, -2.6], 0xf87171);
    box('vanne3v', 0.25, 0.25, 0.25, 6.35, 1.6, -1.5, 0x94a3b8); box('vanne3v', 0.2, 0.25, 0.2, 6.35, 1.87, -1.5, 0xffb020);
    box('vanne3v', 0.25, 0.25, 0.25, 7.4, 1.6, -1.5, 0x94a3b8); box('vanne3v', 0.2, 0.25, 0.2, 7.4, 1.87, -1.5, 0xffb020);
    cyl('pompe', 0.22, 0.35, 5.2, 0.5, -2.4, 0x1d4ed8, { rot: [0, 0, Math.PI / 2] }); box('pompe', 0.4, 0.3, 0.3, 5.6, 0.5, -2.4, 0x334155);
    cyl('pompe', 0.22, 0.35, 8.2, 0.5, -2.6, 0xb91c1c, { rot: [0, 0, Math.PI / 2] }); box('pompe', 0.4, 0.3, 0.3, 7.8, 0.5, -2.6, 0x334155);

    /* E — hygrométrie */
    for (let i = 0; i < 3; i++) cyl('humidif', 0.05, 1.6, 8.2, 0.5 + i * 0.5, 0, 0xe2e8f0, { rot: [Math.PI / 2, 0, 0] });
    box('humidif', 0.6, 0.8, 0.5, 8.2, 0.5, -1.35, 0xcbd5e1); pipeHum();
    function pipeHum() { cyl('humidif', 0.05, 0.5, 8.2, 1.1, -1.05, 0xe2e8f0, { rot: [Math.PI / 2, 0, 0] }); }
    add('sonde_hum', new THREE.SphereGeometry(0.09, 16, 16), 0x38bdf8, 9.1, 1.7, 0.6);
    box('regul_hygro', 0.7, 0.9, 0.25, 9.2, 0.9, 1.25, 0x1e293b); box('regul_hygro', 0.5, 0.25, 0.02, 9.2, 1.1, 1.38, 0x22c55e, { mat: { emissive: 0x115533 } });

    /* F — ventilation */
    wheel = new THREE.Group(); wheel.position.set(10.2, 1.2, 0); wheel.userData.id = 'ventil'; grp('ventil').add(wheel);
    const wmat = mat(0x9fb3c8, { metalness: 0.8, roughness: 0.25 });
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 32), wmat); disk.rotation.x = Math.PI / 2; disk.position.z = 0.25; disk.userData.id = 'ventil'; wheel.add(disk); pickables.push(disk);
    for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.5), wmat); const a = i / 10 * Math.PI * 2; b.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0); b.rotation.z = a + 0.6; b.userData.id = 'ventil'; wheel.add(b); pickables.push(b); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 24), wmat); ring.position.z = -0.25; ring.userData.id = 'ventil'; wheel.add(ring); pickables.push(ring);
    box('ventil', 1.6, 0.06, 1.6, 10.2, 0.32, 0, 0x475569);
    add('mes_debit', new THREE.TorusGeometry(0.36, 0.04, 8, 32), 0xffb020, 10.2, 1.2, -0.42);
    cyl('moteur', 0.24, 0.55, 10.95, 0.62, 0.05, 0x64748b, { rot: [Math.PI / 2, 0, 0] });
    cyl('transmission', 0.3, 0.06, 10.2, 1.2, 0.62, 0x1f2937, { rot: [Math.PI / 2, 0, 0] });
    cyl('transmission', 0.12, 0.06, 10.95, 0.62, 0.62, 0x1f2937, { rot: [Math.PI / 2, 0, 0] });
    { const pa = new THREE.Vector3(10.2, 1.2, 0.62), pb = new THREE.Vector3(10.95, 0.62, 0.62); const v = pb.clone().sub(pa); const L = v.length(); const n = new THREE.Vector3(-v.y, v.x, 0).normalize();
      [[0.3, 0.12], [-0.3, -0.12]].forEach(([r1, r2]) => { const a = pa.clone().addScaledVector(n, r1), b = pb.clone().addScaledVector(n, r2); const d = b.clone().sub(a); const m = box('transmission', d.length(), 0.03, 0.05, (a.x + b.x) / 2, (a.y + b.y) / 2, 0.62, 0x111827); m.rotation.z = Math.atan2(d.y, d.x); }); }
    [[9.55, -0.6], [10.85, -0.6], [9.55, 0.6], [10.85, 0.6]].forEach(([x, z]) => cyl('antivib', 0.07, 0.2, x, 0.2, z, 0x84cc16));
    box('vev', 0.5, 0.8, 0.25, 11.1, 1.3, 1.25, 0x0f172a); box('vev', 0.32, 0.16, 0.02, 11.1, 1.5, 1.38, 0x22c55e, { mat: { emissive: 0x115533 } });
    box('mes_pression', 0.25, 0.18, 0.18, 10.2, 2.1, 0.5, 0x2f8cff);
    for (let i = 0; i < 4; i++) box('silencieux', 0.8, 1.85, 0.16, 11.9, 1, -0.6 + i * 0.4, 0x475569);

    /* G — réseau et salle */
    ductPath('gaine_souf', [[13, 1, 0.6], [14.2, 1, 0.6], [14.2, 4.2, 0.6], [19.2, 4.2, 0.6]], 0.8, 0x67e8f9);
    ductPath('gaines_sec', [[19.2, 4.2, 0.6], [19.2, 3.6, 0.6]], 0.5, 0x67e8f9); ductPath('gaines_sec', [[19.2, 4.2, 0.6], [20.8, 4.2, 0.6], [20.8, 3.6, 0.6]], 0.5, 0x67e8f9);
    damper('reg_reglage', 20.8, 3.85, 0.6, 0.45, 0.45, 'y', 3);
    box('hepa', 2.8, 0.25, 2.8, 20, 3.38, 0, 0xf8fafc, { mat: { transparent: true, opacity: 0.85 } });
    box('diffuseur', 3, 0.04, 3, 20, 3.2, 0, 0xcfe8ff, { mat: { transparent: true, opacity: 0.6, emissive: 0x0b3954 } });
    /* salle */
    const roomEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 3.3, 6)), new THREE.LineBasicMaterial({ color: 0x67e8f9 }));
    roomEdges.position.set(20, 1.65, 0); scene.add(roomEdges);
    const roomM = new THREE.Mesh(new THREE.BoxGeometry(6, 3.3, 6), new THREE.MeshStandardMaterial({ color: 0x0e7490, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })); roomM.position.set(20, 1.65, 0); scene.add(roomM);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.7), mat(0x94a3b8)); table.position.set(20, 0.9, 0); scene.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.85, 16), mat(0x64748b)); leg.position.set(20, 0.42, 0); scene.add(leg);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.15, 24), mat(0xe2e8f0, { emissive: 0x333322 })); lamp.position.set(20.6, 2.3, 0.4); scene.add(lamp);
    [[19, 0.9], [21, -0.9], [21.2, 0.8]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.6, 12), mat(0x22c55e, { transparent: true, opacity: 0.5 })); p.position.set(x, 0.8, z); scene.add(p); });
    [[-2.6], [2.6]].forEach(([z]) => { box('bouche_rep', 0.06, 0.4, 0.7, 17.05, 0.35, z, 0xf59e0b); ductPath('gaine_rep', [[16.6, 0.35, z], [16.6, 2.9, z]], 0.5, 0xf5a524); });
    ductPath('gaine_rep', [[16.6, 2.9, -2.6], [16.6, 2.9, 2.6]], 0.5, 0xf5a524);

    /* étiquettes de sections */
    [['A', -0.3], ['B', 2.25], ['C', 4.4], ['D', 6.8], ['E', 8.5], ['F', 10.6], ['G', 16]].forEach(([s, x]) => {
      const d = document.createElement('div'); d.className = 'badge'; d.style.cssText = 'position:absolute;pointer-events:none;background:rgba(8,14,28,.8);color:#cfe3ff'; d.textContent = s; host.appendChild(d);
      labels.push({ d, p: new THREE.Vector3(x, 2.25, 1.0) });
    });

    /* décalages de la vue éclatée (composants internes C→F) */
    const inner = ['filtre_prim', 'reg_an', 'prefiltre', 'filtre_inter', 'filtre_he', 'bat_froide', 'separ_goutt', 'bat_chaude', 'sonde_antigel', 'humidif', 'ventil', 'moteur', 'transmission', 'mes_debit', 'antivib', 'silencieux', 'bac_cond', 'siphon', 'reg_rec', 'manometre', 'detect_colmat', 'vev', 'mes_pression', 'sonde_mel', 'sonde_hum', 'regul_hygro'];
    inner.forEach((id, i) => { EXPLODE[id] = new THREE.Vector3(0, (i % 3) * 0.35 + 0.2, 2.6 + (i % 2) * 0.6); });
    ['vanne3v', 'circuit_hydr', 'pompe'].forEach(id => EXPLODE[id] = new THREE.Vector3(0, 0, -1.2));
  }

  /* ---------- Particules ---------- */
  function addFlow(key, pts, n, color, room) {
    const P = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    const seg = []; let L = 0; for (let i = 0; i < P.length - 1; i++) { const l = P[i].distanceTo(P[i + 1]); seg.push(l); L += l; }
    const geo = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.13, transparent: true, opacity: 0.95, depthWrite: false }));
    scene.add(pm);
    const u = Array.from({ length: n }, () => Math.random());
    const jit = Array.from({ length: n }, () => [(Math.random() - .5) * 0.5, (Math.random() - .5) * 0.5]);
    particles.push({ key, P, seg, L, pm, u, jit, n, room });
  }
  function flows() {
    addFlow('an', [[-3, 1, 0], [-0.75, 1, 0], [2.25, 1, 0]], 40, COL.an);
    addFlow('rec', [[2.45, 2.9, -0.5], [2.45, 1.4, -0.3], [2.6, 1.0, 0]], 18, COL.rep);
    addFlow('mel', [[2.25, 1, 0], [5.9, 1, 0]], 40, COL.mel);
    addFlow('tra', [[5.9, 1, 0], [10.0, 1.15, 0], [12.95, 1, 0.3]], 55, COL.tra);
    addFlow('sou', [[12.95, 1, 0.6], [14.2, 1, 0.6], [14.2, 4.2, 0.6], [19.2, 4.2, 0.6], [19.2, 3.5, 0.6]], 55, COL.sou);
    /* air dans la salle : descente sous plafond puis reprise basse */
    const g = new THREE.BufferGeometry(); const n = 90; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pm = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, depthWrite: false }));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); scene.add(pm);
    const st = Array.from({ length: n }, () => ({ x: 18.6 + Math.random() * 2.8, y: 3.1 * Math.random(), z: -1.4 + Math.random() * 2.8, ph: 0 }));
    particles.push({ key: 'room', pm, st, n });
    addFlow('rep', [[17.05, 0.35, -2.6], [16.6, 0.35, -2.6], [16.6, 2.9, -2.6], [16.6, 2.9, -0.5], [2.45, 2.9, -0.5]], 50, COL.rep);
    addFlow('rep2', [[17.05, 0.35, 2.6], [16.6, 0.35, 2.6], [16.6, 2.9, 2.6], [16.6, 2.9, -0.5]], 20, COL.rep);
    addFlow('rej', [[2.45, 2.9, -0.5], [1.5, 2.9, -0.5], [1.5, 5.6, -0.5]], 30, COL.rej);
  }
  function pointAt(f, u) {
    let d = u * f.L; for (let i = 0; i < f.seg.length; i++) { if (d <= f.seg[i]) return f.P[i].clone().lerp(f.P[i + 1], d / f.seg[i]); d -= f.seg[i]; }
    return f.P[f.P.length - 1].clone();
  }
  function updateFlows(dt) {
    const x = window.SIM.x, Qr = x.Qm / 2600, rec = window.SIM.p.recirc && x.recPos > 0.05;
    const cS = new THREE.Color(COL.sou), cR = new THREE.Color(COL.rep);
    particles.forEach(f => {
      if (f.key === 'room') {
        const pos = f.pm.geometry.attributes.position.array, col = f.pm.geometry.attributes.color.array;
        f.st.forEach((p, i) => {
          if (p.ph === 0) { p.y -= dt * 0.35 * Qr * 2.2; if (p.y < 0.45) p.ph = 1; }
          else { const tz = p.z < 0 ? -2.6 : 2.6; p.x += (17.1 - p.x) * dt * 0.6 * Qr; p.z += (tz - p.z) * dt * 0.6 * Qr; p.y = Math.max(0.3, p.y - dt * 0.05); if (p.x < 17.3) { p.x = 18.6 + Math.random() * 2.8; p.z = -1.4 + Math.random() * 2.8; p.y = 3.1; p.ph = 0; } }
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
          const c = p.ph ? cR : cS; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        });
        f.pm.geometry.attributes.position.needsUpdate = true; f.pm.geometry.attributes.color.needsUpdate = true; f.pm.visible = Qr > 0.02; return;
      }
      let speed = 2.2 * Qr; if (f.key === 'rec') speed *= rec ? 0.7 : 0; if (f.key === 'rej') speed *= rec ? 0.6 : 1;
      if (f.key === 'an') speed *= window.SIM.x.f;
      f.pm.visible = speed > 0.01;
      const pos = f.pm.geometry.attributes.position.array;
      for (let i = 0; i < f.n; i++) {
        f.u[i] = (f.u[i] + speed * dt / f.L) % 1;
        const p = pointAt(f, f.u[i]);
        pos[i * 3] = p.x + (f.key === 'an' || f.key === 'mel' || f.key === 'tra' ? 0 : 0); pos[i * 3 + 1] = p.y + f.jit[i][0] * 0.8; pos[i * 3 + 2] = p.z + f.jit[i][1] * 1.2;
        if (['an', 'mel', 'tra'].includes(f.key)) { pos[i * 3 + 1] = p.y + f.jit[i][0] * 2.6; pos[i * 3 + 2] = p.z + f.jit[i][1] * 2.6; }
      }
      f.pm.geometry.attributes.position.needsUpdate = true;
    });
  }

  /* ---------- Caméra ---------- */
  function updateCam() {
    orbit.target.lerp(orbit.tTarget, 0.08);
    const t = orbit.target, r = orbit.r;
    camera.position.set(t.x + r * Math.sin(orbit.phi) * Math.sin(orbit.theta), t.y + r * Math.cos(orbit.phi), t.z + r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
    camera.lookAt(t);
  }
  function controls(el) {
    let drag = null, pinch = null, moved = 0;
    el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, b: e.button, sh: e.shiftKey }; moved = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      onHover(e);
      if (!drag || pinch) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
      if (drag.b === 2 || drag.sh) { const k = orbit.r * 0.0015; const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0); const up = new THREE.Vector3(0, 1, 0); orbit.tTarget.addScaledVector(right, -dx * k).addScaledVector(up, dy * k); orbit.target.copy(orbit.tTarget); }
      else { orbit.theta -= dx * 0.006; orbit.phi = PH.clamp(orbit.phi - dy * 0.006, 0.15, 1.55); }
    });
    el.addEventListener('pointerup', e => { if (drag && moved < 6) onClick(e); drag = null; });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); orbit.r = PH.clamp(orbit.r * (1 + Math.sign(e.deltaY) * 0.1), 4, 60); }, { passive: false });
    el.addEventListener('touchstart', e => { if (e.touches.length === 2) { drag = null; pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); } }, { passive: true });
    el.addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); orbit.r = PH.clamp(orbit.r * pinch / d, 4, 60); pinch = d; } }, { passive: true });
    el.addEventListener('touchend', () => { pinch = null; });
  }
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(pickables.filter(m => m.visible), false)[0];
    return hit ? hit.object.userData.id : null;
  }
  function setEmissive(id, hex) { if (!id || !groups[id]) return; groups[id].traverse(m => { if (m.isMesh) { if (m.userData.e0 === undefined) m.userData.e0 = m.material.emissive.getHex(); m.material.emissive.setHex(hex === null ? m.userData.e0 : hex); } }); }
  function onHover(e) {
    const id = pick(e);
    if (id !== hovered) { if (hovered && hovered !== selected) setEmissive(hovered, null); hovered = id; if (id && id !== selected) setEmissive(id, 0x1d4ed8); }
    if (id) { const r = host.getBoundingClientRect(); tip.style.display = 'block'; tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top + 12) + 'px'; tip.textContent = window.COMPONENTS[id].nom; renderer.domElement.style.cursor = 'pointer'; }
    else { tip.style.display = 'none'; renderer.domElement.style.cursor = 'grab'; }
  }
  function onClick(e) { const id = pick(e); if (id) C3.select(id, false); }

  C3.select = function (id, focus = true) {
    if (selected) setEmissive(selected, null);
    selected = id; setEmissive(id, 0x0ea5e9);
    if (focus && groups[id]) { const b = new THREE.Box3().setFromObject(groups[id]); const c = b.getCenter(new THREE.Vector3()); orbit.tTarget.copy(c); orbit.r = Math.min(orbit.r, 12); }
    C3.onSelect && C3.onSelect(id);
  };
  C3.setExplode = on => explodeTarget = on ? 1 : 0;
  C3.setCasing = v => { casingMat.opacity = v; };
  C3.reset = () => { orbit.tTarget.set(10, 1.6, 0); orbit.r = 21; orbit.theta = -0.55; orbit.phi = 1.1; };
  C3.tour = function (btn) {
    if (tourTimer) { clearInterval(tourTimer); tourTimer = null; btn.textContent = '▶ Visite guidée'; return; }
    const order = Object.keys(window.COMPONENTS); let i = 0; btn.textContent = '■ Arrêter la visite';
    const go = () => { C3.select(order[i % order.length], true); i++; };
    go(); tourTimer = setInterval(go, 6000);
  };

  function animate() {
    requestAnimationFrame(animate);
    if (!host.offsetParent) return; // vue masquée → pas de rendu
    const dt = 1 / 60, x = window.SIM.x;
    explode += (explodeTarget - explode) * 0.08;
    for (const id in EXPLODE) groups[id] && groups[id].position.copy(EXPLODE[id]).multiplyScalar(explode);
    const slip = window.SIM.faults.courroie ? 0.72 : 1, run = window.SIM.faults.ventil ? 0 : 1;
    wheel.rotation.z -= x.s * slip * run * 0.5;
    const ang = { reg_an: x.oaPos, reg_rec: x.recPos, reg_rejet: window.SIM.p.recirc ? x.oaPos * window.SIM.p.oaMin / 100 + 0.1 : x.oaPos, reg_reglage: 0.7 };
    for (const id in blades) blades[id].forEach(b => { const a = PH.clamp(ang[id], 0, 1) * Math.PI / 2 * 0.92; if (b.axis === 'x') b.m.rotation.z = a; else b.m.rotation.x = a; });
    const k = PH.clamp(x.clog / 2.2, 0, 1); const cc = new THREE.Color(0xe8e2c8).lerp(new THREE.Color(0x5b4a33), k);
    filterMats.forEach(m => m.color.copy(cc));
    updateFlows(dt); updateCam();
    labels.forEach(l => { const v = l.p.clone().add(new THREE.Vector3(0, 0, 0)).project(camera); l.d.style.left = ((v.x + 1) / 2 * host.clientWidth) + 'px'; l.d.style.top = ((1 - v.y) / 2 * host.clientHeight) + 'px'; l.d.style.display = v.z < 1 ? 'block' : 'none'; });
    renderer.render(scene, camera);
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }

  C3.init = function (el) {
    if (started) { resize(); return; } started = true; host = el;
    if (!window.THREE) { el.innerHTML = '<div class="note r" style="margin:20px">Three.js n\'a pas pu être chargé (connexion au CDN requise). Les autres modules restent utilisables.</div>'; return; }
    scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x070d19, 40, 90);
    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x0b1220, 0.9));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(5, 12, 8); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x88aaff, 0.35); dl2.position.set(-8, 6, -6); scene.add(dl2);
    ray = new THREE.Raycaster(); mouse = new THREE.Vector2();
    tip = document.createElement('div'); tip.className = 'tip3d'; el.appendChild(tip);
    build(); flows(); controls(renderer.domElement);
    window.addEventListener('resize', resize); setTimeout(resize, 50); resize(); animate();
  };
  window.C3 = C3;
})();
