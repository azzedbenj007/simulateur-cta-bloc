/* =========================================================
   calc.js — Calculateurs d'ingénierie HVAC (modules A à G + conversions)
   Chaque résultat est recalculé à partir des champs saisis ; chaque étape
   est affichée avec la formule, la substitution numérique et le résultat.
   ========================================================= */
(function () {
  const PH = window.PH, f = PH.f;
  const $ = (s, r = document) => r.querySelector(s);
  const v = id => { const e = document.getElementById(id); return e ? parseFloat(String(e.value).replace(',', '.')) : NaN; };
  const inp = (id, label, val, unit, step = 'any') => `<label class="f">${label}${unit ? ` <span class="small">(${unit})</span>` : ''}<input id="${id}" type="number" value="${val}" step="${step}"></label>`;
  const sel = (id, label, opts) => `<label class="f">${label}<select id="${id}">${opts.map(o => `<option value="${o[0]}" ${o[2] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></label>`;
  const st = rows => `<div class="steps">${rows.map(r => `<div class="s"><span class="k">${r[0]}</span> ${r[1] ? `: ${r[1]}` : ''} ${r[2] !== undefined ? `= <span class="v">${r[2]}</span>` : ''}${r[3] ? `<div class="c">${r[3]}</div>` : ''}</div>`).join('')}</div>`;
  const kpi = (l, n, u, cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><span class="n">${n}</span><span class="u">${u}</span></div>`;
  const charts = {};
  function chart(id, cfg) { if (!window.Chart) return; if (charts[id]) charts[id].destroy(); charts[id] = new Chart(document.getElementById(id), cfg); }
  const CH = { color: '#93a6c8', grid: '#1b2e52' };
  const axes = (xt, yt) => ({ x: { type: 'linear', title: { display: true, text: xt, color: CH.color }, ticks: { color: CH.color }, grid: { color: CH.grid } }, y: { title: { display: true, text: yt, color: CH.color }, ticks: { color: CH.color }, grid: { color: CH.grid } } });

  const TABS = [['a', 'A · Débits'], ['b', 'B · Vitesses'], ['c', 'C · Gaines'], ['d', 'D · Pertes de charge'], ['e', 'E · Ventilateur'], ['f', 'F · Thermique & psychrométrie'], ['g', 'G · Filtres'], ['u', 'Conversions']];

  const CALC = {};
  CALC.init = function (root) {
    root.innerHTML = `
    <div class="row" id="ctabs" style="margin-bottom:12px">${TABS.map((t, i) => `<button class="b ${i ? 'sec' : ''}" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="note">Les champs sont modifiables ; les résultats se recalculent immédiatement. Badges : <span class="badge calc">Calcul</span> résultat calculé, <span class="badge hyp">Hypothèse</span> valeur pédagogique à adapter, <span class="badge fab">Fabricant</span> donnée à prendre dans la documentation constructeur, <span class="badge norm">Norme</span> exigence à lire dans le référentiel applicable.</div>
    <div id="cpanes"></div>`;
    const panes = $('#cpanes', root);
    panes.innerHTML = [paneA(), paneB(), paneC(), paneD(), paneE(), paneF(), paneG(), paneU()].join('');
    root.querySelectorAll('#ctabs button').forEach(b => b.onclick = () => show(b.dataset.t));
    function show(t) { root.querySelectorAll('#ctabs button').forEach(b => b.classList.toggle('sec', b.dataset.t !== t)); panes.querySelectorAll('.cpane').forEach(p => p.style.display = p.dataset.p === t ? 'block' : 'none'); RUN[t] && RUN[t](); }
    panes.addEventListener('input', e => { const p = e.target.closest('.cpane'); if (p && RUN[p.dataset.p]) RUN[p.dataset.p](); });
    panes.addEventListener('change', e => { const p = e.target.closest('.cpane'); if (p && RUN[p.dataset.p]) RUN[p.dataset.p](); });
    buildD(); show('a');
    window.PSY.readout($('#psyF'), $('#psyFr'));
    $('#dToE').onclick = () => { $('#e_q').value = $('#d_qref').value; $('#e_dp').value = Math.round(CALC.lastDP || 0); show('e'); };
    $('#f_ete').onclick = () => { $('#f_te').value = 32; $('#f_rhe').value = 45; RUN.f(); };
    $('#f_hiv').onclick = () => { $('#f_te').value = 2; $('#f_rhe').value = 70; RUN.f(); };
    CALC.show = show;
  };

  /* ===================== A. Débits ===================== */
  function paneA() {
    return `<div class="cpane" data-p="a"><div class="grid g2"><div class="card"><h3>Données du local</h3><div class="form">
      ${inp('a_L', 'Longueur', 7, 'm')}${inp('a_l', 'Largeur', 6, 'm')}${inp('a_h', 'Hauteur sous plafond', 3, 'm')}
      ${inp('a_n', 'Taux de renouvellement N', 20, 'vol/h')}${inp('a_p', 'Nombre de personnes', 8, 'pers.')}${inp('a_qp', "Air neuf par personne", 36, 'm³/h/pers')}
      ${inp('a_ps', 'Apports sensibles totaux', 3100, 'W')}${inp('a_ti', 'T intérieure', 21, '°C')}${inp('a_dt', 'Écart T salle − T soufflage', 4, 'K')}
      ${inp('a_qan', "Débit minimal d'air neuf exigé par la conception", 0, 'm³/h')}${inp('a_su', 'Surface du plafond soufflant (flux unidirectionnel)', 9, 'm²')}${inp('a_vu', 'Vitesse sous plafond', 0.3, 'm/s')}
      </div><p class="small muted"><span class="badge hyp">Hypothèse</span> N, l'air neuf par personne, l'écart de soufflage et la vitesse sous plafond sont des données de conception à fixer par le programme et le référentiel retenu ; les valeurs proposées sont pédagogiques. EN 16798-1 propose par exemple ≈ 10 L/s/pers (36 m³/h) en catégorie II pour des locaux courants.</p></div>
      <div class="card"><h3>Calcul pas à pas</h3><div id="a_out"></div></div></div></div>`;
  }
  const RUN = {};
  RUN.a = () => {
    const L = v('a_L'), l = v('a_l'), h = v('a_h'), N = v('a_n'), np = v('a_p'), qp = v('a_qp'), Ps = v('a_ps'), Ti = v('a_ti'), dT = v('a_dt'), qan = v('a_qan'), Su = v('a_su'), vu = v('a_vu');
    const V = L * l * h, Q1 = N * V, rho = PH.rho(Ti, 0.008), Qth = Ps / (rho * PH.CP_A * dT) * 3600, Qp = np * qp, Qu = Su * vu * 3600;
    const cand = [['Renouvellement N×V', Q1], ['Évacuation des apports sensibles', Qth], ['Air neuf hygiénique (personnes)', Qp], ['Air neuf minimal de conception', qan || 0]];
    const max = cand.reduce((a, b) => b[1] > a[1] ? b : a);
    $('#a_out').innerHTML = st([
      ['Volume', `V = L × l × H = ${f(L, 2)} × ${f(l, 2)} × ${f(h, 2)}`, f(V, 1) + ' m³'],
      ['Débit par renouvellement', `Q = N × V = ${f(N, 1)} × ${f(V, 1)}`, f(Q1, 0) + ' m³/h', `soit ${f(Q1 / 3600, 3)} m³/s ou ${f(Q1 / 3.6, 0)} L/s`],
      ['Masse volumique de l\'air', `ρ = (p − pv)/(Ra·T) + pv/(Rv·T) à ${f(Ti, 1)} °C`, f(rho, 3) + ' kg/m³'],
      ['Débit pour les apports sensibles', `Q = Ps / (ρ·Cp·ΔT) = ${f(Ps, 0)} / (${f(rho, 3)} × 1006 × ${f(dT, 1)}) × 3600`, f(Qth, 0) + ' m³/h', 'Plus l\'écart de soufflage est faible, plus le débit nécessaire est élevé.'],
      ['Air neuf hygiénique', `Qan = n × q = ${np} × ${f(qp, 0)}`, f(Qp, 0) + ' m³/h'],
      ['Débit flux unidirectionnel (si plafond soufflant)', `Q = S × v = ${f(Su, 1)} × ${f(vu, 2)} × 3600`, f(Qu, 0) + ' m³/h', 'En flux unidirectionnel, c\'est souvent ce critère qui dimensionne le débit soufflé ; une partie peut être recyclée localement si la conception le prévoit.'],
      ['Critère dimensionnant (hors FU)', max[0], f(max[1], 0) + ' m³/h'],
      ['Taux de renouvellement résultant', `N = Q / V = ${f(max[1], 0)} / ${f(V, 1)}`, f(max[1] / V, 1) + ' vol/h'],
      ['Temps théorique de décroissance de 90 % (mélange parfait)', `t90 = ln(10) / N = 2,303 / ${f(max[1] / V, 1)} h`, f(2.303 / (max[1] / V) * 60, 1) + ' min', 'Modèle de dilution idéale : C(t) = C0·e^(−N·t). Ce n\'est pas la cinétique de décontamination mesurée lors d\'une qualification.']
    ]) + `<div class="res">${kpi('Débit retenu (mélange)', f(max[1], 0), 'm³/h')}${kpi('Débit FU', f(Qu, 0), 'm³/h')}${kpi('Air neuf mini', f(Math.max(Qp, qan || 0), 0), 'm³/h')}${kpi('N résultant', f(max[1] / V, 1), 'vol/h')}</div>`;
  };

  /* ===================== B. Vitesses ===================== */
  const RANGES = { gp: ['Gaine principale', 4, 7], gs: ['Gaine secondaire', 2.5, 4], dif: ['Col de diffuseur', 2, 4], fil: ['Vitesse frontale filtre / batterie', 1.5, 2.5], sou: ['Sous plafond soufflant (FU)', 0.25, 0.45], rep: ['Grille de reprise', 1.5, 2.5] };
  function paneB() {
    return `<div class="cpane" data-p="b"><div class="grid g2"><div class="card"><h3>Vitesse = Q / S</h3><div class="form">
      ${inp('b_q', 'Débit Q', 2600, 'm³/h')}${sel('b_el', 'Élément', Object.entries(RANGES).map(([k, r], i) => [k, r[0], i === 0]))}
      ${sel('b_sh', 'Forme', [['r', 'Rectangulaire', 1], ['c', 'Circulaire']])}${inp('b_a', 'Largeur a (ou Ø)', 500, 'mm')}${inp('b_b', 'Hauteur b', 300, 'mm')}${inp('b_k', 'Coefficient de section libre', 1, '—')}
      </div><p class="small muted">Coefficient de section libre : 1 pour une gaine ; &lt; 1 pour une grille ou un diffuseur (donnée fabricant). <span class="badge hyp">Hypothèse</span> les plages affichées sont des ordres de grandeur usuels (acoustique, pertes de charge), pas des exigences normatives.</p></div>
      <div class="card"><h3>Résultat</h3><div id="b_out"></div><canvas id="b_ch" height="170"></canvas></div></div></div>`;
  }
  RUN.b = () => {
    const Q = v('b_q'), a = v('b_a') / 1000, b = v('b_b') / 1000, k = v('b_k') || 1, sh = $('#b_sh').value, r = RANGES[$('#b_el').value];
    const S = (sh === 'r' ? a * b : Math.PI * a * a / 4) * k, vel = Q / 3600 / S, ok = vel >= r[1] && vel <= r[2];
    $('#b_out').innerHTML = st([
      ['Débit', `Q = ${f(Q, 0)} / 3600`, f(Q / 3600, 4) + ' m³/s'],
      ['Section de passage', sh === 'r' ? `S = a × b × k = ${f(a, 3)} × ${f(b, 3)} × ${f(k, 2)}` : `S = π·D²/4 × k = π × ${f(a, 3)}²/4 × ${f(k, 2)}`, f(S, 4) + ' m²'],
      ['Vitesse', `v = Q / S = ${f(Q / 3600, 4)} / ${f(S, 4)}`, f(vel, 2) + ' m/s'],
      ['Pression dynamique', `Pd = ρ·v²/2 = 1,2 × ${f(vel, 2)}² / 2`, f(PH.pdyn(1.2, vel), 1) + ' Pa']
    ]) + `<p>${r[0]} : plage indicative ${r[1]}–${r[2]} m/s → <span class="badge ${ok ? 'ok' : 'warn'}">${ok ? 'dans la plage' : (vel > r[2] ? 'au-dessus : bruit / pertes accrus' : 'en dessous : section surdimensionnée')}</span></p>`;
    const xs = Array.from({ length: 21 }, (_, i) => S * (0.4 + i * 0.08));
    chart('b_ch', { type: 'line', data: { datasets: [{ label: 'v = Q/S', data: xs.map(s => ({ x: s, y: Q / 3600 / s })), borderColor: '#2f8cff', pointRadius: 0 }, { label: 'Point actuel', data: [{ x: S, y: vel }], borderColor: '#ffb020', backgroundColor: '#ffb020', pointRadius: 6, showLine: false }] }, options: { animation: false, plugins: { legend: { labels: { color: CH.color } } }, scales: axes('Section S (m²)', 'Vitesse (m/s)') } });
  };

  /* ===================== C. Gaines ===================== */
  function paneC() {
    return `<div class="cpane" data-p="c"><div class="grid g2"><div class="card"><h3>Dimensionnement S = Q / v</h3><div class="form">
      ${inp('c_q', 'Débit Q', 2600, 'm³/h')}${inp('c_v', 'Vitesse visée', 5, 'm/s')}${inp('c_b', 'Hauteur imposée (rectangulaire)', 300, 'mm')}
      ${inp('c_ar', 'Largeur retenue a', 500, 'mm')}${inp('c_br', 'Hauteur retenue b', 300, 'mm')}${inp('c_eps', 'Rugosité ε (tôle galvanisée)', 0.15, 'mm')}${inp('c_t', 'T de l\'air', 16, '°C')}
      </div><p class="small muted">Modifiez « largeur / hauteur retenues » (dimensions commerciales) pour observer la vitesse réelle. <span class="badge hyp">Hypothèse</span> ε = 0,15 mm valeur courante pour l'acier galvanisé.</p></div>
      <div class="card"><h3>Calcul</h3><div id="c_out"></div></div></div></div>`;
  }
  RUN.c = () => {
    const Q = v('c_q') / 3600, vv = v('c_v'), bi = v('c_b') / 1000, a = v('c_ar') / 1000, b = v('c_br') / 1000, eps = v('c_eps') / 1000, T = v('c_t');
    const S = Q / vv, ath = S / bi, D = Math.sqrt(4 * S / Math.PI);
    const Sr = a * b, vr = Q / Sr, Dh = PH.dh(a, b), De = PH.deq(a, b), rho = PH.rho(T, 0.008), nu = PH.nu(T), Re = vr * Dh / nu, lam = PH.lambda(Re, eps, Dh), j = PH.darcy(lam, 1, Dh, rho, vr);
    $('#c_out').innerHTML = st([
      ['Section nécessaire', `S = Q / v = ${f(Q, 4)} / ${f(vv, 2)}`, f(S, 4) + ' m²'],
      ['Gaine rectangulaire', `a = S / b = ${f(S, 4)} / ${f(bi, 3)}`, f(ath * 1000, 0) + ' mm', `rapport d'aspect a/b = ${f(ath / bi, 2)} (au-delà de 4:1 les pertes et le bruit augmentent)`],
      ['Gaine circulaire', `D = √(4S/π) = √(4 × ${f(S, 4)} / π)`, f(D * 1000, 0) + ' mm'],
      ['Section retenue', `S = ${f(a, 3)} × ${f(b, 3)}`, f(Sr, 4) + ' m²'],
      ['Vitesse réelle', `v = Q / S = ${f(Q, 4)} / ${f(Sr, 4)}`, f(vr, 2) + ' m/s'],
      ['Diamètre hydraulique', `Dh = 2ab/(a+b)`, f(Dh * 1000, 0) + ' mm', 'Utilisé pour le nombre de Reynolds et Darcy-Weisbach à vitesse réelle.'],
      ['Diamètre équivalent (même ΔP à même débit)', `De = 1,30·(ab)^0,625/(a+b)^0,25`, f(De * 1000, 0) + ' mm'],
      ['Reynolds', `Re = v·Dh/ν = ${f(vr, 2)} × ${f(Dh, 3)} / ${(nu * 1e6).toFixed(2)}·10⁻⁶`, f(Re, 0), Re > 4000 ? 'Écoulement turbulent' : 'Écoulement laminaire / transitoire'],
      ['Coefficient de frottement (Haaland)', `1/√λ = −1,8·log[(ε/Dh/3,7)^1,11 + 6,9/Re]`, f(lam, 4)],
      ['Perte de charge linéaire', `j = λ·(1/Dh)·ρv²/2`, f(j, 2) + ' Pa/m', 'Repère usuel de conception basse vitesse : ≈ 0,8–1,5 Pa/m (hypothèse).']
    ]);
  };

  /* ===================== D. Pertes de charge ===================== */
  const DEF = [
    ['c', "Prise d'air + grille", 1, 2600, 0, 0, 40], ['c', "Registre d'air neuf (ouvert)", 1, 2600, 0, 0, 15],
    ['c', 'Préfiltre ePM10 (ΔP moyenne de vie)', 1, 2600, 0, 0, 90], ['c', 'Filtre à poches ePM1 (ΔP moyenne)', 1, 2600, 0, 0, 160],
    ['c', 'Batterie froide (régime humide)', 1, 2600, 0, 0, 140], ['c', 'Batterie chaude', 1, 2600, 0, 0, 50],
    ['c', 'Humidificateur + séparateur', 1, 2600, 0, 0, 35], ['c', 'Silencieux', 1, 2600, 0, 0, 50], ['c', 'Filtre haute efficacité CTA (ΔP moyenne)', 1, 2600, 0, 0, 180],
    ['l', 'Gaine principale', 1, 2600, 500, 300, 28], ['s', 'Coude 90° (rayon moyen)', 3, 2600, 500, 300, 0.3], ['s', 'Té — passage en dérivation', 1, 2600, 500, 300, 0.9],
    ['s', 'Réduction progressive', 1, 2600, 500, 300, 0.1], ['l', 'Gaines secondaires', 1, 1300, 350, 250, 10], ['s', 'Registre de réglage (ouvert 70 %)', 1, 1300, 350, 250, 1.2],
    ['c', 'Plenum + filtre terminal H13/H14 (ΔP moyenne)', 1, 2600, 0, 0, 220], ['c', 'Diffuseur / plafond soufflant', 1, 2600, 0, 0, 25]
  ];
  function paneD() {
    return `<div class="cpane" data-p="d"><div class="card"><div class="row" style="justify-content:space-between"><h3>Réseau de soufflage — bilan des pertes de charge</h3>
      <div class="row">${inp('d_t', 'T air', 16, '°C')}${inp('d_eps', 'ε', 0.15, 'mm')}${inp('d_qref', 'Q ventilateur', 2600, 'm³/h')}<button class="b sec" id="d_add">+ Ligne</button><button class="b" id="dToE">→ Ventilateur</button></div></div>
      <p class="small muted">Types : <b>L</b> linéaire (valeur = longueur en m, Darcy-Weisbach), <b>S</b> singulière (valeur = ζ, ΔP = ζ·ρv²/2), <b>C</b> composant (valeur = ΔP en Pa à prendre chez le <span class="badge fab">fabricant</span>). b = 0 → gaine circulaire de diamètre a. Les ζ et ΔP proposés sont des <span class="badge hyp">ordres de grandeur</span> à remplacer par les données des catalogues (ASHRAE Duct Fitting Database, fabricants).</p>
      <div class="scroll"><table class="t" id="d_tab"><thead><tr><th>Type</th><th>Désignation</th><th>Qté</th><th>Q (m³/h)</th><th>a (mm)</th><th>b (mm)</th><th>L (m) / ζ / ΔP (Pa)</th><th>v (m/s)</th><th>ΔP unit. (Pa)</th><th>ΔP (Pa)</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="grid g2" style="margin-top:12px"><div id="d_out"></div><div><canvas id="d_ch" height="260"></canvas></div></div></div></div>`;
  }
  function rowHTML(r) {
    return `<tr><td><select class="d_ty">${[['l', 'L'], ['s', 'S'], ['c', 'C']].map(o => `<option value="${o[0]}" ${o[0] === r[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></td>
      <td><input class="d_n" value="${r[1]}" style="min-width:170px"></td><td><input class="d_k" type="number" value="${r[2]}" style="width:50px"></td><td><input class="d_q" type="number" value="${r[3]}" style="width:75px"></td>
      <td><input class="d_a" type="number" value="${r[4]}" style="width:65px"></td><td><input class="d_b" type="number" value="${r[5]}" style="width:65px"></td><td><input class="d_v" type="number" step="any" value="${r[6]}" style="width:75px"></td>
      <td class="mono d_vel"></td><td class="mono d_pu"></td><td class="mono d_p"></td><td><button class="b sec d_del" title="Supprimer">✕</button></td></tr>`;
  }
  function buildD() {
    const tb = $('#d_tab tbody'); tb.innerHTML = DEF.map(rowHTML).join('');
    $('#d_add').onclick = () => { tb.insertAdjacentHTML('beforeend', rowHTML(['s', 'Nouvel élément', 1, 2600, 500, 300, 0.5])); RUN.d(); };
    tb.addEventListener('click', e => { if (e.target.classList.contains('d_del')) { e.target.closest('tr').remove(); RUN.d(); } });
  }
  RUN.d = () => {
    const T = v('d_t'), eps = v('d_eps') / 1000, rho = PH.rho(T, 0.008), nu = PH.nu(T);
    let tot = 0, lin = 0, sing = 0, comp = 0; const lab = [], val = [], colr = [];
    let detail = [];
    document.querySelectorAll('#d_tab tbody tr').forEach(tr => {
      const ty = tr.querySelector('.d_ty').value, n = tr.querySelector('.d_n').value, k = +tr.querySelector('.d_k').value || 1, Q = +tr.querySelector('.d_q').value / 3600, a = +tr.querySelector('.d_a').value / 1000, b = +tr.querySelector('.d_b').value / 1000, x = +tr.querySelector('.d_v').value;
      let vel = NaN, pu = 0;
      if (ty !== 'c') {
        const S = b > 0 ? a * b : Math.PI * a * a / 4, Dh = b > 0 ? PH.dh(a, b) : a; vel = Q / S;
        if (ty === 'l') { const Re = vel * Dh / nu, lam = PH.lambda(Re, eps, Dh); pu = PH.darcy(lam, x, Dh, rho, vel); if (!detail.length) detail = [n, lam, Dh, vel, x, pu, Re]; }
        else pu = x * PH.pdyn(rho, vel);
      } else pu = x;
      const p = pu * k; tot += p; if (ty === 'l') lin += p; else if (ty === 's') sing += p; else comp += p;
      tr.querySelector('.d_vel').textContent = isNaN(vel) ? '—' : f(vel, 2); tr.querySelector('.d_pu').textContent = f(pu, 1); tr.querySelector('.d_p').textContent = f(p, 1);
      lab.push(n); val.push(p); colr.push(ty === 'l' ? '#2f8cff' : ty === 's' ? '#a855f7' : '#ffb020');
    });
    CALC.lastDP = tot;
    $('#d_out').innerHTML = (detail.length ? st([
      [`Exemple — ${detail[0]}`, `Re = ${f(detail[6], 0)} → λ = ${f(detail[1], 4)}`],
      ['Darcy-Weisbach', `ΔP = λ·(L/Dh)·ρv²/2 = ${f(detail[1], 4)} × (${f(detail[4], 1)} / ${f(detail[2], 3)}) × ${f(rho, 3)} × ${f(detail[3], 2)}² / 2`, f(detail[5], 1) + ' Pa'],
      ['Singularité', 'ΔP = ζ·ρ·v²/2 (ζ du catalogue de singularités)']
    ]) : '') + `<div class="res">${kpi('Pertes linéaires', f(lin, 0), 'Pa')}${kpi('Pertes singulières', f(sing, 0), 'Pa')}${kpi('Composants', f(comp, 0), 'Pa')}${kpi('Total réseau', f(tot, 0), 'Pa', 'warnk')}</div>
      <p class="small muted">Le total correspond à la pression que le ventilateur doit fournir au débit considéré (hors pression dynamique de sortie et marge). Les filtres sont pris ici à une ΔP « moyenne de vie » : le dimensionnement du ventilateur se fait usuellement avec la ΔP finale des filtres (voir module E).</p>`;
    chart('d_ch', { type: 'bar', data: { labels: lab, datasets: [{ data: val, backgroundColor: colr }] }, options: { indexAxis: 'y', animation: false, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'ΔP (Pa)', color: CH.color }, ticks: { color: CH.color }, grid: { color: CH.grid } }, y: { ticks: { color: CH.color, font: { size: 10 } }, grid: { display: false } } } } });
  };

  /* ===================== E. Ventilateur ===================== */
  function paneE() {
    return `<div class="cpane" data-p="e"><div class="grid g2"><div class="card"><h3>Point de fonctionnement nominal</h3><div class="form">
      ${inp('e_q', 'Débit nominal Q', 2600, 'm³/h')}${inp('e_dp', 'Pression statique réseau (filtres propres)', 1050, 'Pa')}${inp('e_s', 'Section de refoulement', 0.25, 'm²')}
      ${inp('e_ev', 'Rendement ventilateur ηv', 0.68, '—')}${inp('e_em', 'Rendement moteur ηm', 0.9, '—')}${inp('e_et', 'Rendement transmission ηt', 0.95, '—')}${inp('e_ef', 'Rendement variateur ηvar', 0.97, '—')}
      ${inp('e_h', "Heures de fonctionnement annuelles", 8760, 'h/an')}</div>
      <h3 style="margin-top:12px">Simulation : encrassement des filtres</h3><div class="form">
      <label class="f">Surcroît de ΔP filtres (Pa) : <b id="e_addv">0</b><input id="e_add" type="range" min="0" max="800" step="10" value="300"></label>
      ${sel('e_mode', 'Mode de pilotage', [['fix', 'Vitesse fixe'], ['cst', 'Débit constant (variateur)', 1]])}</div>
      <p class="small muted"><span class="badge hyp">Hypothèse</span> courbe ventilateur modélisée par ΔP = n²·P₀ − a·Q² passant par le point nominal (P₀ = 1,4·ΔPnom). Remplacer par la courbe du <span class="badge fab">fabricant</span> pour une étude réelle. Rendements supposés constants.</p></div>
      <div class="card"><h3>Résultats</h3><div id="e_out"></div><canvas id="e_ch" height="230"></canvas></div></div></div>`;
  }
  RUN.e = () => {
    const Qh = v('e_q'), Q = Qh / 3600, Ps = v('e_dp'), S = v('e_s'), ev = v('e_ev'), em = v('e_em'), et = v('e_et'), ef = v('e_ef'), hrs = v('e_h'), add = v('e_add'), mode = $('#e_mode').value;
    $('#e_addv').textContent = add;
    const vout = Q / S, Pd = PH.pdyn(1.2, vout), Pt = Ps + Pd, Pa = Q * Pt, eg = ev * em * et * ef, Pel = Pa / eg, SFP = Pel / Q;
    const P0 = 1.4 * Pt, a = 0.4 * Pt / (Q * Q), K = Pt / (Q * Q), K2 = (Pt + add) / (Q * Q);
    let Q2, Pt2, n2;
    if (mode === 'fix') { n2 = 1; Q2 = Math.sqrt(P0 / (a + K2)); Pt2 = K2 * Q2 * Q2; } else { Q2 = Q; Pt2 = K2 * Q * Q; n2 = Math.sqrt((Pt2 + a * Q * Q) / P0); }
    const Pel2 = Q2 * Pt2 / eg, dE = (Pel2 - Pel) * hrs / 1000;
    $('#e_out').innerHTML = st([
      ['Vitesse au refoulement', `v = Q/S = ${f(Q, 3)} / ${f(S, 3)}`, f(vout, 2) + ' m/s'],
      ['Pression dynamique', `Pd = ρv²/2`, f(Pd, 1) + ' Pa'],
      ['Pression totale', `Pt = Ps + Pd = ${f(Ps, 0)} + ${f(Pd, 1)}`, f(Pt, 0) + ' Pa'],
      ['Puissance aéraulique', `Pa = Q × Pt = ${f(Q, 3)} × ${f(Pt, 0)}`, f(Pa, 0) + ' W'],
      ['Rendement global', `η = ηv·ηm·ηt·ηvar = ${ev}×${em}×${et}×${ef}`, f(eg, 3)],
      ['Puissance électrique absorbée', `P = Q·ΔP/η = ${f(Pa, 0)} / ${f(eg, 3)}`, f(Pel, 0) + ' W'],
      ['Puissance spécifique SFP', `SFP = P / Q`, f(SFP / 1000, 2) + ' kW/(m³/s)', 'Classes SFP : voir EN 16798-3.'],
      [`Encrassement +${f(add, 0)} Pa — ${mode === 'fix' ? 'vitesse fixe' : 'débit constant'}`, mode === 'fix' ? `Q' = √(P₀/(a+K')) ; n = 100 %` : `n' = √((K'Q²+aQ²)/P₀)`, mode === 'fix' ? f(Q2 * 3600, 0) + ' m³/h' : f(n2 * 100, 1) + ' % vitesse'],
      ['Puissance après encrassement', `P' = Q'·Pt'/η = ${f(Q2, 3)} × ${f(Pt2, 0)} / ${f(eg, 3)}`, f(Pel2, 0) + ' W'],
      ['Surconsommation annuelle', `(P' − P) × h`, f(dE, 0) + ' kWh/an']
    ]) + `<div class="res">${kpi('Débit', f(Q2 * 3600, 0), 'm³/h', Q2 < 0.9 * Q ? 'alarm' : '')}${kpi('Vitesse', f(n2 * 100, 0), '%', n2 > 1.05 ? 'warnk' : '')}${kpi('P abs.', f(Pel2 / 1000, 2), 'kW')}${kpi('Δ débit', f((Q2 / Q - 1) * 100, 1), '%')}</div>
      ${mode === 'fix' ? `<div class="note w">À vitesse fixe, le point de fonctionnement glisse sur la courbe du ventilateur : le débit chute de ${f((1 - Q2 / Q) * 100, 1)} %. Au bloc, cela réduit le taux de renouvellement et la surpression.</div>` : `<div class="note">À débit constant, le variateur accélère (${f(n2 * 100, 0)} %) ; ${n2 > 1 ? '<b>au-delà de 100 %, le ventilateur doit avoir été sélectionné avec cette réserve</b> — d\'où le dimensionnement sur ΔP finale des filtres. ' : ''}La puissance croît avec la pression.</div>`}`;
    const qs = Array.from({ length: 41 }, (_, i) => i / 40 * 1.4 * Q);
    const ds = (lbl, fn, c, d) => ({ label: lbl, data: qs.map(q => ({ x: q * 3600, y: fn(q) })).filter(p => p.y >= 0 && p.y < 3 * Pt), borderColor: c, borderDash: d || [], pointRadius: 0, borderWidth: 2 });
    chart('e_ch', { type: 'line', data: { datasets: [ds('Ventilateur n = 100 %', q => P0 - a * q * q, '#2f8cff'), ...(mode === 'cst' ? [ds(`Ventilateur n = ${f(n2 * 100, 0)} %`, q => n2 * n2 * P0 - a * q * q, '#52d1ff', [5, 4])] : []), ds('Réseau propre', q => K * q * q, '#2ecc8f'), ds('Réseau encrassé', q => K2 * q * q, '#ff4d5e'),
      { label: 'Points', data: [{ x: Qh, y: Pt }, { x: Q2 * 3600, y: Pt2 }], showLine: false, pointRadius: 6, backgroundColor: ['#2ecc8f', '#ff4d5e'], borderColor: '#fff' }] }, options: { animation: false, plugins: { legend: { labels: { color: CH.color, boxWidth: 12 } } }, scales: axes('Débit (m³/h)', 'Pression totale (Pa)') } });
  };

  /* ===================== F. Thermique ===================== */
  function paneF() {
    return `<div class="cpane" data-p="f"><div class="grid g2"><div class="card"><h3>Données</h3><div class="row" style="margin-bottom:8px"><button class="b sec" id="f_ete">Exemple été</button><button class="b sec" id="f_hiv">Exemple hiver</button></div><div class="form">
      ${inp('f_q', 'Débit soufflé Q', 2600, 'm³/h')}${inp('f_x', "Taux d'air neuf", 100, '%')}${inp('f_te', 'T extérieure', 32, '°C')}${inp('f_rhe', 'HR extérieure', 45, '%')}
      ${inp('f_ti', 'T salle (consigne)', 21, '°C')}${inp('f_rhi', 'HR salle (consigne)', 50, '%')}${inp('f_ts', 'T de soufflage', 17, '°C')}${inp('f_pl', 'Apports latents salle', 440, 'W')}
      ${inp('f_dtv', 'Échauffement ventilateur', 1.2, 'K')}${inp('f_rhb', 'HR sortie batterie froide', 95, '%')}${inp('f_ew', 'Eau glacée ΔT (ex. 7→12)', 5, 'K')}${inp('f_hw', 'Eau chaude ΔT (ex. 60→40)', 20, 'K')}
      </div><p class="small muted"><span class="badge hyp">Hypothèse</span> conditions extérieures d'exemple : utiliser les conditions de base de la localité et du programme. Air repris supposé à l'état de consigne de la salle. Mélange calculé en fractions massiques (≈ volumiques).</p></div>
      <div class="card"><h3>Évolutions de l'air</h3><canvas class="psy" id="psyF"></canvas><div class="small mono muted" id="psyFr" style="min-height:18px"></div></div></div>
      <div class="card" style="margin-top:12px"><h3>Calcul pas à pas</h3><div id="f_out"></div></div></div>`;
  }
  CALC.process = function (o) {
    /* o: {Q, x, Te, RHe, Ti, RHi, Ts, Pl, dTv, RHb} → points et puissances */
    const we = PH.w(o.Te, o.RHe), wi = PH.w(o.Ti, o.RHi), xa = o.x / 100;
    const TM = xa * o.Te + (1 - xa) * o.Ti, wM = xa * we + (1 - xa) * wi;
    const rhoS = PH.rho(o.Ts, wi), m = rhoS * o.Q / 3600;
    const ws = Math.max(0.0005, wi - o.Pl / (m * PH.L0));
    const TC = o.Ts - o.dTv;
    const R = { we, wi, TM, wM, m, ws, pts: [], lines: [], P: {} };
    const mix = xa < 0.999;
    if (mix) R.pts.push({ T: o.Te, w: we, label: 'E', color: '#3b82f6' }, { T: o.Ti, w: wi, label: 'R', color: '#f59e0b' });
    R.pts.push({ T: TM, w: wM, label: mix ? 'M' : 'E = M', color: '#a855f7' });
    if (wM > ws + 1e-5) {
      R.mode = 'deshum';
      const TB = PH.tFromWRH(ws, o.RHb);
      const hM = PH.h(TM, wM), hB = PH.h(TB, ws), hC = PH.h(TC, ws);
      /* h en kJ/kg → ×1000 pour obtenir des W */
      R.TB = TB; R.P.bf = m * (hM - hB) * 1000; R.P.bfs = m * (1.006 + 1.86 * wM) * 1000 * (TM - TB); R.P.bfl = R.P.bf - R.P.bfs; R.P.cond = m * (wM - ws) * 3600;
      R.P.bc = Math.max(0, m * (hC - hB) * 1000); R.P.hum = 0;
      R.pts.push({ T: TB, w: ws, label: 'B', color: '#22d3ee' }, { T: TC, w: ws, label: 'C', color: '#ef4444' }, { T: o.Ts, w: ws, label: 'S', color: '#67e8f9' });
      const iM = R.pts.length - 4; R.lines = [[iM + 1, iM + 2, '#ef4444'], [iM + 2, iM + 3, '#94a3b8', true]];
      R.lines.unshift([iM, iM + 1, '#3b82f6']);
    } else {
      R.mode = TC >= TM ? 'chauffage' : 'refroid_sec';
      const hM = PH.h(TM, wM), hC = PH.h(TC, wM);
      if (TC >= TM) { R.P.bc = m * (hC - hM) * 1000; R.P.bf = 0; } else { R.P.bf = m * (hM - hC) * 1000; R.P.bc = 0; }
      R.P.bfs = R.P.bf; R.P.bfl = 0; R.P.cond = 0;
      R.P.humkg = m * (ws - wM) * 3600; R.P.hum = R.P.humkg / 3600 * 2676e3 / 1000 * 1000; // W (vapeur ≈ 2676 kJ/kg à 100 °C)
      R.pts.push({ T: TC, w: wM, label: 'C', color: '#ef4444' }, { T: TC, w: ws, label: 'D', color: '#e2e8f0' }, { T: o.Ts, w: ws, label: 'S', color: '#67e8f9' });
      const iM = R.pts.length - 4; R.lines = [[iM, iM + 1, TC >= TM ? '#ef4444' : '#3b82f6'], [iM + 1, iM + 2, '#e2e8f0'], [iM + 2, iM + 3, '#94a3b8', true]];
    }
    if (mix) R.lines.push([0, 2, '#64748b', true], [1, 2, '#64748b', true]);
    R.Psens = m * PH.CP_A * (o.Ti - o.Ts);
    return R;
  };
  RUN.f = () => {
    const o = { Q: v('f_q'), x: v('f_x'), Te: v('f_te'), RHe: v('f_rhe'), Ti: v('f_ti'), RHi: v('f_rhi'), Ts: v('f_ts'), Pl: v('f_pl'), dTv: v('f_dtv'), RHb: v('f_rhb') };
    const R = CALC.process(o), ew = v('f_ew'), hw = v('f_hw');
    const qw = (P, dT = ew) => P / (PH.RHO_W * PH.CP_W * dT) * 3600; // m³/h
    window.PSY.draw($('#psyF'), { points: R.pts, lines: R.lines, zone: { T1: o.Ti - 1, T2: o.Ti + 1, RH1: o.RHi - 5, RH2: o.RHi + 5 } });
    const rows = [
      ['Humidités absolues', `w = 0,622·pv/(p − pv) ; pv = HR·psat(T)`, `wE = ${f(R.we * 1000, 2)} g/kg ; w salle = ${f(R.wi * 1000, 2)} g/kg`],
      ['Point de mélange M', `TM = x·TE + (1−x)·TR ; wM = x·wE + (1−x)·wR`, `${f(R.TM, 1)} °C ; ${f(R.wM * 1000, 2)} g/kg`],
      ['Débit massique', `ṁ = ρ·Q = ${f(PH.rho(o.Ts, R.wi), 3)} × ${f(o.Q, 0)}/3600`, f(R.m, 3) + ' kg/s'],
      ['Humidité de soufflage', `wS = w salle − Pl/(ṁ·Lv) = ${f(R.wi * 1000, 2)} − ${f(o.Pl, 0)}/(${f(R.m, 3)}×2501)`, f(R.ws * 1000, 2) + ' g/kg', 'L\'air soufflé doit être plus sec pour absorber l\'humidité dégagée dans la salle.']
    ];
    if (R.mode === 'deshum') rows.push(
      ['Sortie batterie froide B', `w = wS à HR = ${o.RHb} % → T = Trosée(wS) corrigée`, f(R.TB, 1) + ' °C', 'Hypothèse : air quasi saturé en sortie de batterie.'],
      ['Puissance froide totale', `P = ṁ·(hM − hB) = ${f(R.m, 3)} × (${f(PH.h(R.TM, R.wM), 1)} − ${f(PH.h(R.TB, R.ws), 1)})`, f(R.P.bf / 1000, 2) + ' kW'],
      ['dont sensible', `Ps = ṁ·cp·(TM − TB)`, f(R.P.bfs / 1000, 2) + ' kW'], ['dont latente', 'Pl = P − Ps', f(R.P.bfl / 1000, 2) + ' kW'],
      ['Condensats', `ṁ·(wM − wB)·3600`, f(R.P.cond, 1) + ' kg/h'],
      ['Débit d\'eau glacée', `qv = P/(ρe·cpe·ΔT) = ${f(R.P.bf, 0)}/(1000×4186×${ew})×3600`, f(qw(R.P.bf, ew), 2) + ' m³/h'],
      ['Post-chauffage B → C', `P = ṁ·(hC − hB) = ρ·Cp·Q·ΔT`, f(R.P.bc / 1000, 2) + ' kW', 'Nécessaire pour remonter la température après déshumidification.'],
      ['Débit d\'eau chaude', `qv = P/(ρe·cpe·ΔT) = ${f(R.P.bc, 0)}/(1000×4186×${hw})×3600`, f(qw(R.P.bc, hw), 2) + ' m³/h']);
    else rows.push(
      [R.mode === 'chauffage' ? 'Batterie chaude M → C' : 'Refroidissement sec M → C', `P = ṁ·|hC − hM| (w constant)`, f((R.P.bc || R.P.bf) / 1000, 2) + ' kW'],
      ['Débit d\'eau', `qv = P/(ρe·cpe·ΔT)`, f(R.P.bc ? qw(R.P.bc, hw) : qw(R.P.bf, ew), 2) + ' m³/h'],
      ['Humidification vapeur C → D', `ṁvap = ṁ·(wS − wM)·3600`, f(Math.max(0, R.P.humkg), 1) + ' kg/h', `Énergie ≈ ${f(Math.max(0, R.P.hum) / 1000, 2)} kW (≈ 0,75 kWh par kg de vapeur produite). Évolution quasi isotherme.`]);
    rows.push(['Puissance sensible disponible en salle', `ṁ·Cp·(T salle − T soufflage) = ${f(R.m, 3)} × 1006 × ${f(o.Ti - o.Ts, 1)}`, f(R.Psens / 1000, 2) + ' kW', 'Doit couvrir les apports sensibles de la salle.']);
    $('#f_out').innerHTML = st(rows) + `<div class="res">${kpi('Batterie froide', f(R.P.bf / 1000, 2), 'kW')}${kpi('Batterie chaude', f(R.P.bc / 1000, 2), 'kW')}${kpi('Vapeur', f(Math.max(0, R.P.humkg || 0), 1), 'kg/h')}${kpi('Condensats', f(R.P.cond, 1), 'kg/h')}${kpi('Eau glacée', f(qw(R.P.bf, ew), 2), 'm³/h')}${kpi('Eau chaude', f(qw(R.P.bc, hw), 2), 'm³/h')}</div>
     <p class="small muted">E : extérieur · R : reprise · M : mélange · B : sortie batterie froide · C : sortie batterie chaude · D : après humidification · S : soufflage (après échauffement ventilateur). Survolez le diagramme pour lire T, w, HR, h, T rosée et T humide.</p>`;
  };

  /* ===================== G. Filtres ===================== */
  const FCL = { coarse: ['ISO coarse 60 %', 0.3, 'ISO 16890'], epm10: ['ISO ePM10 50 %', 0.5, 'ISO 16890'], epm25: ['ISO ePM2,5 65 %', 0.65, 'ISO 16890'], epm1a: ['ISO ePM1 55 %', 0.55, 'ISO 16890'], epm1b: ['ISO ePM1 80 %', 0.8, 'ISO 16890'], e11: ['E11 (≥ 95 %)', 0.95, 'EN 1822'], h13: ['H13 (≥ 99,95 %)', 0.9995, 'EN 1822'], h14: ['H14 (≥ 99,995 %)', 0.99995, 'EN 1822'] };
  function paneG() {
    return `<div class="cpane" data-p="g"><div class="grid g2"><div class="card"><h3>Étage de filtration</h3><div class="form">
      ${sel('g_cl', 'Classe', Object.entries(FCL).map(([k, c]) => [k, c[0], k === 'epm1b']))}${inp('g_q', 'Débit traversant', 2600, 'm³/h')}${inp('g_n', 'Nombre de cellules', 1, '—')}
      ${inp('g_w', 'Largeur frontale cellule', 592, 'mm')}${inp('g_h', 'Hauteur frontale cellule', 592, 'mm')}${inp('g_am', 'Surface filtrante par cellule', 6.5, 'm²')}
      ${inp('g_qn', 'Débit nominal fabricant par cellule', 3400, 'm³/h')}${inp('g_dp0', 'ΔP initiale au débit nominal', 95, 'Pa')}${inp('g_dpf', 'ΔP finale recommandée', 300, 'Pa')}
      ${inp('g_seuil', "Seuil de remplacement (exploitant)", 250, 'Pa')}${inp('g_n_exp', 'Exposant ΔP(Q) du filtre propre', 1.4, '—')}${inp('g_eta', 'Rendement global ventilateur', 0.55, '—')}
      </div><p class="small muted"><span class="badge fab">Fabricant</span> surface filtrante, débit nominal, ΔP initiale et finale. <span class="badge norm">Norme</span> l'efficacité minimale par classe découle d'ISO 16890 (filtres de ventilation générale) ou d'EN 1822 / ISO 29463 (EPA, HEPA, ULPA). L'exposant ΔP(Q) (entre 1 pour un écoulement laminaire dans le média et 2 pour une singularité) est une <span class="badge hyp">hypothèse</span>.</p></div>
      <div class="card"><h3>Filtre propre ↔ filtre colmaté</h3><label class="f">Niveau d'encrassement : <b id="g_kv">40 %</b><input type="range" id="g_k" min="0" max="100" value="40"></label>
      <div class="filtervis" id="g_vis"></div><div id="g_out"></div></div></div></div>`;
  }
  function filterSVG(k, dp, title) {
    const c = `rgb(${Math.round(232 - 140 * k)},${Math.round(226 - 150 * k)},${Math.round(200 - 150 * k)})`;
    let pl = ''; for (let i = 0; i < 9; i++) pl += `<polyline points="${30 + i * 14},20 ${37 + i * 14},120 ${44 + i * 14},20" fill="none" stroke="#475569" stroke-width="1"/>`;
    let dust = ''; const nd = Math.round(k * 140); for (let i = 0; i < nd; i++) dust += `<circle cx="${28 + ((i * 37) % 128)}" cy="${22 + ((i * 53) % 96)}" r="${1 + (i % 3) * 0.6}" fill="#5b4a33" opacity=".75"/>`;
    let arr = ''; const n = Math.max(1, Math.round(6 * (1 - 0.6 * k))); for (let i = 0; i < n; i++) arr += `<line x1="0" y1="${30 + i * 15}" x2="24" y2="${30 + i * 15}" stroke="#52d1ff" stroke-width="2" class="flow"/>`;
    return `<svg viewBox="0 0 200 160" width="200" height="160"><rect x="26" y="16" width="134" height="108" fill="${c}" stroke="#94a3b8"/>${pl}${dust}${arr}<text x="100" y="142" fill="#e6eefc" font-size="11" text-anchor="middle" font-family="Inter">${title}</text><text x="100" y="156" fill="#ffb020" font-size="11" text-anchor="middle" font-family="JetBrains Mono">ΔP = ${f(dp, 0)} Pa</text></svg>`;
  }
  RUN.g = () => {
    const c = FCL[$('#g_cl').value], Q = v('g_q'), n = v('g_n'), Af = v('g_w') * v('g_h') / 1e6, Am = v('g_am'), qn = v('g_qn'), dp0 = v('g_dp0'), dpf = v('g_dpf'), seuil = v('g_seuil'), ex = v('g_n_exp'), eta = v('g_eta'), k = v('g_k') / 100;
    $('#g_kv').textContent = Math.round(k * 100) + ' %';
    const Qc = Q / n, vf = Qc / 3600 / Af, vm = Qc / 3600 / Am, dpi = dp0 * Math.pow(Qc / qn, ex), dpk = dpi + k * (dpf - dpi), pen = 1 - c[1];
    const extra = (dpk - dpi) * Q / 3600 / eta, E = (dpf - dpi) / 2 * Q / 3600 / eta * 8760 / 1000;
    $('#g_vis').innerHTML = filterSVG(0, dpi, 'Filtre propre') + filterSVG(k, dpk, `Encrassé ${Math.round(k * 100)} %`);
    $('#g_out').innerHTML = st([
      ['Débit par cellule', `Q/n = ${f(Q, 0)} / ${n}`, f(Qc, 0) + ' m³/h', Qc > qn ? 'Au-dessus du débit nominal fabricant : ajouter une cellule.' : 'Dans le débit nominal.'],
      ['Vitesse frontale', `v = Q/(n·Sfront) = ${f(Qc / 3600, 3)} / ${f(Af, 3)}`, f(vf, 2) + ' m/s'],
      ['Vitesse dans le média', `v = Q/(n·Sfiltrante) = ${f(Qc / 3600, 3)} / ${f(Am, 2)}`, f(vm * 100, 1) + ' cm/s', 'Une faible vitesse dans le média favorise la capture par diffusion et réduit la ΔP.'],
      ['ΔP initiale au débit réel', `ΔP0 × (Q/Qn)^${ex} = ${f(dp0, 0)} × (${f(Qc, 0)}/${f(qn, 0)})^${ex}`, f(dpi, 0) + ' Pa'],
      ['ΔP actuelle', `ΔPi + k·(ΔPf − ΔPi)`, f(dpk, 0) + ' Pa'],
      ['Efficacité de référence', `${c[0]} (${c[2]})`, `pénétration ≈ ${pen < 0.001 ? (pen * 100).toExponential(1) : f(pen * 100, 2)} %`, c[2] === 'ISO 16890' ? 'ISO 16890 : efficacité moyenne sur la fraction PM considérée.' : 'EN 1822 : efficacité intégrale minimale au MPPS.'],
      ['Puissance ventilateur due à l\'encrassement', `(ΔP − ΔPi)·Q/η`, f(extra, 0) + ' W'],
      ['Énergie « encrassement » sur un an', `≈ (ΔPf − ΔPi)/2 · Q/η · 8760 h`, f(E, 0) + ' kWh/an', 'Hypothèse : montée linéaire de la ΔP sur la durée de vie.']
    ]) + `<div class="res">${kpi('ΔP actuelle', f(dpk, 0), 'Pa', dpk >= seuil ? 'alarm' : '')}${kpi('Seuil remplacement', f(seuil, 0), 'Pa')}${kpi('ΔP finale fab.', f(dpf, 0), 'Pa')}${kpi('Marge', f(seuil - dpk, 0), 'Pa')}</div>
      ${dpk >= seuil ? '<div class="note r">Seuil de remplacement atteint : planifier le changement selon la procédure du bloc.</div>' : ''}${seuil > dpf ? '<div class="note w">Le seuil d\'exploitation dépasse la ΔP finale recommandée par le fabricant.</div>' : ''}`;
  };

  /* ===================== Conversions ===================== */
  const UNITS = {
    debit: [['m³/h', 1], ['m³/s', 3600], ['L/s', 3.6], ['CFM (ft³/min)', 1.699011]],
    pression: [['Pa', 1], ['mmCE', 9.80665], ['mbar', 100], ['inWG', 249.0889], ['kPa', 1000]],
    puissance: [['W', 1], ['kW', 1000], ['kcal/h', 1.163], ['BTU/h', 0.29307107], ['TR (tonne frigorifique)', 3516.853]],
    vitesse: [['m/s', 1], ['km/h', 1 / 3.6], ['ft/min (fpm)', 0.00508]]
  };
  function paneU() {
    return `<div class="cpane" data-p="u"><div class="grid g2">${Object.entries(UNITS).map(([k, u]) => `<div class="card"><h3>${k[0].toUpperCase() + k.slice(1)}</h3><div class="form"><label class="f">Valeur<input type="number" id="u_${k}" value="1" step="any"></label>${sel('u_' + k + 'u', 'Unité', u.map((x, i) => [i, x[0], !i]))}</div><div id="u_${k}o" class="res"></div></div>`).join('')}
      <div class="card"><h3>Température</h3><div class="form"><label class="f">Valeur<input type="number" id="u_t" value="20" step="any"></label>${sel('u_tu', 'Unité', [['c', '°C', 1], ['k', 'K'], ['f', '°F']])}</div><div id="u_to" class="res"></div></div></div></div>`;
  }
  RUN.u = () => {
    for (const k in UNITS) { const x = v('u_' + k), i = +$('#u_' + k + 'u').value, base = x * UNITS[k][i][1]; $('#u_' + k + 'o').innerHTML = UNITS[k].map(u => kpi(u[0], f(base / u[1], base / u[1] < 10 ? 4 : 1), '')).join(''); }
    const t = v('u_t'), uu = $('#u_tu').value, c = uu === 'c' ? t : uu === 'k' ? t - 273.15 : (t - 32) / 1.8;
    $('#u_to').innerHTML = kpi('°C', f(c, 2), '') + kpi('K', f(c + 273.15, 2), '') + kpi('°F', f(c * 1.8 + 32, 2), '');
  };
  CALC.run = RUN;
  window.CALC = CALC;
})();
