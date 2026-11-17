/* =========================================================
   bloc.js — Cascade de pression du bloc opératoire
   Réseau de locaux reliés par des fuites (portes) : Q = Cd·A·√(2ΔP/ρ).
   Résolution des pressions par bilan de masse (Gauss-Seidel + bissection).
   ========================================================= */
(function () {
  const PH = window.PH, f = PH.f, $ = s => document.querySelector(s);
  const ROOMS = {
    or: { n: "Salle d'opération", S: 2600, E: 2050, rk: 4, r: [210, 110, 400, 270] },
    sas: { n: "Sas d'entrée", S: 300, E: 300, rk: 3, r: [20, 110, 170, 120] },
    prep: { n: 'Salle de préparation', S: 400, E: 400, rk: 3, r: [20, 250, 170, 130] },
    lav: { n: 'Lavage des mains', S: 250, E: 260, rk: 3, r: [630, 110, 170, 120] },
    ann: { n: 'Locaux annexes (arsenal)', S: 300, E: 300, rk: 3, r: [630, 250, 170, 130] },
    circ: { n: 'Circulation propre', S: 650, E: 620, rk: 2, r: [20, 20, 780, 70] },
    sor: { n: 'Zone de sortie / circuit retour', S: 150, E: 320, rk: 1, r: [210, 400, 400, 70] }
  };
  const DOORS = [
    ['or', 'sas', 0.012, 210, 170], ['or', 'prep', 0.012, 210, 315], ['or', 'lav', 0.012, 610, 170], ['or', 'ann', 0.012, 610, 315], ['or', 'sor', 0.012, 410, 380],
    ['sas', 'circ', 0.015, 105, 100], ['prep', 'sas', 0.012, 105, 240], ['lav', 'circ', 0.015, 715, 100], ['ann', 'lav', 0.012, 715, 240],
    ['circ', 'ext', 0.06, 20, 55], ['sor', 'ext', 0.03, 610, 435]
  ].map(d => ({ a: d[0], b: d[1], A: d[2], x: d[3], y: d[4], open: false }));
  const B = { Cd: 0.61, rho: 1.2, Adiff: 0.002, Aopen: 1.8, target: 15, P: {}, flows: [] };

  function flowQ(A, dp) { return Math.sign(dp) * B.Cd * A * Math.sqrt(2 * Math.abs(dp) / B.rho) * 3600; }
  function area(d) { return d.open ? B.Aopen : d.A; }
  function solve() {
    const P = { ext: 0 }; Object.keys(ROOMS).forEach(k => P[k] = B.P[k] ?? 5);
    const bal = (k, pk) => { let s = ROOMS[k].S - ROOMS[k].E; DOORS.forEach(d => { if (d.a === k) s -= flowQ(area(d), pk - P[d.b]); else if (d.b === k) s -= flowQ(area(d), pk - P[d.a]); }); s -= flowQ(B.Adiff, pk); return s; };
    for (let it = 0; it < 120; it++) Object.keys(ROOMS).forEach(k => { let lo = -400, hi = 400; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; bal(k, m) > 0 ? lo = m : hi = m; } P[k] = (lo + hi) / 2; });
    B.P = P;
    B.flows = DOORS.map(d => ({ d, q: flowQ(area(d), P[d.a] - P[d.b]), dp: P[d.a] - P[d.b] }));
  }
  const rk = k => k === 'ext' ? 0 : ROOMS[k].rk;
  function color(p) { const t = PH.clamp((p + 10) / 50, 0, 1); return `rgba(${Math.round(30 + 20 * t)},${Math.round(80 + 120 * t)},${Math.round(160 - 40 * t)},.35)`; }
  function draw() {
    let s = `<defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#52d1ff"/></marker><marker id="ahr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ff4d5e"/></marker></defs>`;
    s += `<rect x="630" y="400" width="170" height="100" fill="none" stroke="#475569" stroke-dasharray="5 4"/><text x="715" y="455" fill="#93a6c8" font-size="12" text-anchor="middle">Hors bloc (réf. 0 Pa)</text>`;
    for (const k in ROOMS) {
      const r = ROOMS[k].r, p = B.P[k];
      s += `<rect x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="${color(p)}" stroke="#4f7bd1" stroke-width="1.5" rx="4"/>`;
      const ty = k === 'or' ? r[1] + 26 : r[1] + r[3] / 2 - 6;
      s += `<text x="${r[0] + r[2] / 2}" y="${ty}" fill="#e6eefc" font-size="${k === 'or' ? 15 : 12}" text-anchor="middle" font-weight="600">${ROOMS[k].n}</text>`;
      s += `<text x="${r[0] + r[2] / 2}" y="${ty + 20}" fill="${p < 0 ? '#ff8a96' : '#9fe2ff'}" font-size="${k === 'or' ? 18 : 13}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700">${p >= 0 ? '+' : ''}${f(p, 1)} Pa</text>`;
    }
    /* zone FU + table dans la salle */
    s += `<rect x="330" y="175" width="160" height="150" fill="none" stroke="#67e8f9" stroke-dasharray="3 4"/><rect x="380" y="225" width="60" height="40" fill="#334155" stroke="#94a3b8"/><text x="410" y="335" fill="#67e8f9" font-size="10" text-anchor="middle">zone sous plafond soufflant</text>`;
    B.flows.forEach(({ d, q, dp }) => {
      const from = q >= 0 ? d.a : d.b, to = q >= 0 ? d.b : d.a, bad = rk(to) > rk(from) && Math.abs(q) > 1;
      const ra = d.a === 'ext' ? null : ROOMS[d.a].r;
      /* direction de la flèche : vers le centre du local aval */
      const tr = to === 'ext' ? [d.x + (d.x < 300 ? -60 : 60), d.y] : [ROOMS[to].r[0] + ROOMS[to].r[2] / 2, ROOMS[to].r[1] + ROOMS[to].r[3] / 2];
      const vx = tr[0] - d.x, vy = tr[1] - d.y, L = Math.hypot(vx, vy) || 1, ux = vx / L, uy = vy / L;
      const w = PH.clamp(1 + Math.log10(1 + Math.abs(q)) * 1.6, 1, 7);
      s += `<line class="flow" x1="${d.x - ux * 22}" y1="${d.y - uy * 22}" x2="${d.x + ux * 26}" y2="${d.y + uy * 26}" stroke="${bad ? '#ff4d5e' : '#52d1ff'}" stroke-width="${w}" marker-end="url(#${bad ? 'ahr' : 'ah'})"/>`;
      s += `<g class="door" data-i="${DOORS.indexOf(d)}"><rect x="${d.x - 9}" y="${d.y - 9}" width="18" height="18" rx="3" fill="${d.open ? '#ffb020' : '#0b1220'}" stroke="${d.open ? '#ffb020' : '#93a6c8'}"/><text x="${d.x}" y="${d.y + 4}" font-size="10" text-anchor="middle" fill="${d.open ? '#000' : '#93a6c8'}">${d.open ? 'O' : 'P'}</text></g>`;
      s += `<text x="${d.x + ux * 30 + 4}" y="${d.y + uy * 30 - 6}" fill="${bad ? '#ff8a96' : '#cfe3ff'}" font-size="10" font-family="JetBrains Mono">${f(Math.abs(q), 0)} m³/h</text>`;
    });
    $('#blocsvg').innerHTML = s;
    $('#blocsvg').querySelectorAll('.door').forEach(g => g.onclick = () => { const d = DOORS[+g.dataset.i]; d.open = !d.open; update(); });
  }
  function tables() {
    let h = `<table class="t"><thead><tr><th>Local</th><th>Soufflage (m³/h)</th><th>Reprise (m³/h)</th><th>Écart</th><th>P (Pa)</th></tr></thead><tbody>`;
    for (const k in ROOMS) h += `<tr><td>${ROOMS[k].n}</td><td><input type="number" data-k="${k}" data-f="S" value="${ROOMS[k].S}" style="width:80px"></td><td><input type="number" data-k="${k}" data-f="E" value="${ROOMS[k].E}" style="width:80px"></td><td class="mono">${f(ROOMS[k].S - ROOMS[k].E, 0)}</td><td class="mono">${f(B.P[k], 1)}</td></tr>`;
    h += '</tbody></table>';
    $('#bloctab').innerHTML = h;
    $('#bloctab').querySelectorAll('input').forEach(i => i.onchange = () => { ROOMS[i.dataset.k][i.dataset.f] = +i.value; update(); });
    let d = `<table class="t"><thead><tr><th>Passage</th><th>A fuite (cm²)</th><th>ΔP (Pa)</th><th>Débit</th><th>Sens</th><th>Écart / cible</th></tr></thead><tbody>`;
    B.flows.forEach(({ d: dr, q, dp }, i) => {
      const from = q >= 0 ? dr.a : dr.b, to = q >= 0 ? dr.b : dr.a, bad = rk(to) > rk(from) && Math.abs(q) > 1;
      const nm = k => k === 'ext' ? 'Hors bloc' : ROOMS[k].n;
      d += `<tr><td>${nm(dr.a)} ↔ ${nm(dr.b)} <button class="b sec" data-o="${i}" style="padding:1px 6px;font-size:11px">${dr.open ? 'Fermer' : 'Ouvrir'}</button></td><td>${dr.open ? `<b>porte ouverte</b> (${f(B.Aopen, 1)} m²)` : `<input type="number" data-a="${i}" value="${Math.round(dr.A * 1e4)}" style="width:70px">`}</td><td class="mono">${f(Math.abs(dp), 1)}</td><td class="mono">${f(Math.abs(q), 0)} m³/h</td><td>${nm(from)} → ${nm(to)} ${bad ? '<span class="badge bad">vers zone plus propre</span>' : ''}</td><td>${dr.open ? `<span class="small">v porte = ${f(Math.abs(q) / 3600 / B.Aopen, 2)} m/s</span>` : (Math.abs(dp) >= B.target ? '<span class="badge ok">≥ cible</span>' : '<span class="badge warn">< cible</span>')}</td></tr>`;
    });
    $('#bloctab2').innerHTML = d + '</tbody></table>';
    $('#bloctab2').querySelectorAll('input[data-a]').forEach(i => i.onchange = () => { DOORS[+i.dataset.a].A = Math.max(1, +i.value) / 1e4; update(); });
    $('#bloctab2').querySelectorAll('button[data-o]').forEach(b => b.onclick = () => { DOORS[+b.dataset.o].open = !DOORS[+b.dataset.o].open; update(); });
  }
  function explain() {
    const open = DOORS.filter(d => d.open), por = B.P.or;
    let h = `<div class="res">${['or', 'sas', 'circ', 'sor'].map(k => `<div class="kpi ${B.P[k] < (k === 'or' ? B.target : 0) ? 'alarm' : ''}"><div class="l">${ROOMS[k].n}</div><span class="n">${f(B.P[k], 1)}</span><span class="u">Pa</span></div>`).join('')}</div>`;
    const net = ROOMS.or.S - ROOMS.or.E;
    h += `<div class="steps" style="margin-top:8px"><div class="s"><span class="k">Bilan de masse de la salle</span> : Qsoufflé − Qrepris = Σ Qfuites = <span class="v">${f(net, 0)} m³/h</span><div class="c">C'est cet excédent de soufflage qui « pressurise » la salle : il s'échappe par les défauts d'étanchéité et les détalonnages de portes.</div></div>
      <div class="s"><span class="k">Loi d'orifice</span> : Q = Cd·A·√(2ΔP/ρ) ⇒ ΔP = (ρ/2)·(Q/(Cd·A))² <div class="c">La pression varie comme le carré du débit de fuite : doubler l'écart soufflage − reprise quadruple ΔP ; doubler la surface de fuite la divise par 4.</div></div></div>`;
    if (open.length) h += `<div class="note r"><b>Porte(s) ouverte(s)</b> : la section de passage passe de quelques dizaines de cm² à ≈ ${f(B.Aopen, 1)} m². Les pressions de part et d'autre s'égalisent presque (salle : ${f(por, 1)} Pa). Le débit excédentaire s'écoule alors à faible vitesse dans la baie ; les mouvements de la porte, des personnes et les différences de température provoquent des échanges d'air dans les deux sens. D'où l'intérêt des sas, de portes fermées pendant l'intervention et d'un comportement maîtrisé.</div>`;
    const bad = B.flows.filter(({ d, q }) => { const to = q >= 0 ? d.b : d.a, from = q >= 0 ? d.a : d.b; return rk(to) > rk(from) && Math.abs(q) > 1; });
    if (bad.length) h += `<div class="note w"><b>Inversion de cascade</b> sur ${bad.length} passage(s) : l'air s'écoule vers un local plus exigeant (flèches rouges). Rééquilibrer les débits soufflage / reprise.</div>`;
    $('#blocexp').innerHTML = h;
  }
  function update() { solve(); draw(); tables(); explain(); }

  const COMP = [
    ['Soufflage turbulent (dilution)', 'Air soufflé à vitesse élevée par diffuseurs à induction ; mélange de tout le volume, la contamination est diluée.', 'Locaux annexes, salles à risque modéré selon le référentiel et l\'analyse de risque.', 'Simple, peu coûteux, peu sensible au positionnement des équipements, débits modérés.', 'Pas de protection préférentielle du champ opératoire ; efficacité dépendant du taux de renouvellement ; cinétique de décontamination plus lente.'],
    ['Soufflage unidirectionnel (flux laminaire)', 'Écoulement « piston » d\'air filtré à vitesse faible et homogène, qui chasse les particules hors de la zone protégée.', 'Chirurgie à haut risque infectieux (orthopédie prothétique, etc.) selon le référentiel applicable.', 'Protection directe et rapide de la zone opératoire et des instruments.', 'Débits élevés (énergie), sensible aux obstacles (scialytiques, têtes, bras), au positionnement de l\'équipe et aux gradients thermiques ; nécessite qualification et discipline.'],
    ['Diffuseur plafonnier classique', 'Diffuseurs (plafonniers, à jet hélicoïdal, à fentes) répartis en plafond, souvent avec filtre terminal intégré.', 'Salles en dilution ; locaux de soins ; arsenal.', 'Bonne homogénéité thermique, facile à intégrer, maintenance simple.', 'Ne crée pas de zone protégée ; les jets peuvent remettre en suspension et transporter les particules vers la table.'],
    ['Plafond à flux unidirectionnel', 'Plenum filtrant de grande surface (filtres HEPA) au-dessus de la table, parfois avec jupes / rideaux d\'air périphériques.', 'Salles d\'opération ultra-propres ; dimensionnement selon la surface à protéger.', 'Zone ultra-propre centrée sur la table ; débit concentré là où le risque est maximal.', 'Investissement, poids et encombrement en faux-plafond, contraintes d\'éclairage ; maintenance des filtres HEPA et tests d\'intégrité.']
  ];
  function flowsSVG(type) {
    let s = `<svg viewBox="0 0 260 150" width="100%" height="150"><rect x="5" y="5" width="250" height="140" fill="#0a1426" stroke="#22385f"/><rect x="100" y="110" width="60" height="10" fill="#475569"/>`;
    if (type === 0) { [50, 210].forEach(x => { s += `<rect x="${x - 15}" y="5" width="30" height="6" fill="#67e8f9"/>`; for (let i = 0; i < 4; i++) s += `<path class="flow" d="M${x} 12 q ${(i - 1.5) * 30} 40 ${(i - 1.5) * 50 + (x > 100 ? -20 : 20)} 70 t ${(i % 2 ? 30 : -30)} 50" fill="none" stroke="#67e8f9" stroke-width="1.5"/>`; }); }
    else { s += `<rect x="70" y="5" width="120" height="8" fill="#67e8f9"/>`; for (let i = 0; i < 7; i++) s += `<line class="flow" x1="${78 + i * 17}" y1="14" x2="${78 + i * 17}" y2="105" stroke="#67e8f9" stroke-width="1.5"/>`; s += `<path class="flow" d="M75 108 q -30 10 -55 25 M185 108 q 30 10 55 25" fill="none" stroke="#f59e0b" stroke-width="1.5"/>`; }
    return s + `<text x="130" y="140" fill="#93a6c8" font-size="10" text-anchor="middle">${type === 0 ? 'Mélange : l\'air balaie tout le volume' : 'Piston : l\'air descend sur la zone protégée'}</text></svg>`;
  }

  window.BLOC = {
    init(root) {
      root.innerHTML = `<div class="grid g2">
        <div class="card"><div class="row" style="justify-content:space-between"><h3>Plan du bloc et cascade de pression</h3><div class="row"><label class="row small"><input type="checkbox" id="bloc3d"> vue perspective</label><button class="b sec" id="blocReset">Réinitialiser</button></div></div>
        <svg class="bloc-svg" id="blocsvg" viewBox="0 0 820 510"></svg>
        <p class="small muted">Cliquez sur un repère <b>P</b> (porte fermée) pour l'ouvrir (<b>O</b>). Flèches : sens et débit des transferts d'air ; rouge = transfert vers une zone plus exigeante.</p>
        <div class="form"><label class="f">ΔP cible entre locaux saisie par le concepteur (Pa)<input type="number" id="bloctg" value="${B.target}"></label><label class="f">Coefficient de décharge Cd<input type="number" id="bloccd" value="${B.Cd}" step="0.01"></label><label class="f">Fuites diffuses par local (cm²)<input type="number" id="blocad" value="${B.Adiff * 1e4}"></label><label class="f">Section porte ouverte (m²)<input type="number" id="blocao" value="${B.Aopen}" step="0.1"></label></div>
        <p class="small muted"><span class="badge norm">Norme</span> la valeur cible de différence de pression et la hiérarchie des zones sont à prendre dans le référentiel applicable (ex. NF S 90-351) et le programme ; la valeur saisie ici sert uniquement à comparer. <span class="badge hyp">Hypothèse</span> surfaces de fuite des portes fermées (détalonnage, joints) de l'ordre de 100–200 cm².</p></div>
        <div class="card"><h3>Conséquences et explications</h3><div id="blocexp"></div><h4 style="margin-top:12px">Débits par local</h4><div id="bloctab" class="scroll"></div></div></div>
        <div class="card" style="margin-top:12px"><h3>Transferts d'air entre locaux</h3><div id="bloctab2" class="scroll"></div></div>
        <div class="card" style="margin-top:12px"><h3>Comparaison pédagogique des modes de diffusion</h3><div class="grid g2"><div>${flowsSVG(0)}</div><div>${flowsSVG(1)}</div></div>
        <div class="scroll"><table class="t"><thead><tr><th>Système</th><th>Principe</th><th>Conditions d'utilisation</th><th>Avantages</th><th>Limites</th></tr></thead><tbody>${COMP.map(r => `<tr>${r.map((c, i) => `<td>${i ? c : '<b>' + c + '</b>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="small muted">Le choix du mode de diffusion pour une salle donnée relève du classement de la zone à risque par l'établissement (équipe opérationnelle d'hygiène, programme) et du référentiel retenu.</p></div>`;
      $('#bloc3d').onchange = e => $('#blocsvg').classList.toggle('bloc-3d', e.target.checked);
      $('#bloctg').onchange = e => { B.target = +e.target.value; update(); };
      $('#bloccd').onchange = e => { B.Cd = +e.target.value; update(); };
      $('#blocad').onchange = e => { B.Adiff = +e.target.value / 1e4; update(); };
      $('#blocao').onchange = e => { B.Aopen = +e.target.value; update(); };
      $('#blocReset').onclick = () => { DOORS.forEach(d => d.open = false); update(); };
      update();
    },
    solveFor(S, E, A) { /* utilisé par le module de dimensionnement : salle seule vers l'extérieur */ const net = S - E; return Math.sign(net) * B.rho / 2 * Math.pow(Math.abs(net) / 3600 / (B.Cd * A), 2); }
  };
})();
