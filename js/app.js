/* =========================================================
   app.js — Navigation, modes, accueil pédagogique, vue 3D,
   psychrométrie en direct, scénario de dimensionnement, normes, QCM.
   ========================================================= */
(function () {
  const PH = window.PH, f = PH.f, $ = s => document.querySelector(s), S = window.SIM;
  const VIEWS = [['accueil', 'Accueil'], ['cta', 'CTA 3D', 'N1'], ['bloc', 'Bloc opératoire', 'N2'], ['psy', 'Psychrométrie', 'N2'], ['calculs', 'Calculs', 'N3'], ['dim', 'Dimensionnement', 'N3'], ['gtc', 'GTC & régulation', 'N2–4'], ['pannes', 'Pannes', 'N4'], ['normes', 'Normes'], ['qcm', 'QCM & exercices']];
  const MODES = { app: ['Apprentissage', ['accueil', 'cta', 'bloc', 'psy', 'qcm']], dim: ['Dimensionnement', ['calculs', 'dim', 'psy']], diag: ['Diagnostic', ['gtc', 'pannes', 'cta']], exp: ['Expert', VIEWS.map(v => v[0])] };
  const inited = {};

  function nav() {
    $('#tabs').innerHTML = VIEWS.map(v => `<a href="#${v[0]}" data-v="${v[0]}">${v[1]}${v[2] ? `<span class="lv">${v[2]}</span>` : ''}</a>`).join('');
    $('#modes').innerHTML = Object.entries(MODES).map(([k, m]) => `<button data-m="${k}">${m[0]}</button>`).join('');
    $('#modes').querySelectorAll('button').forEach(b => b.onclick = () => setMode(b.dataset.m, true));
    window.addEventListener('hashchange', route);
  }
  function setMode(m, go) {
    document.body.className = 'm-' + (m === 'exp' ? 'expert' : m);
    $('#modes').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('#tabs').querySelectorAll('a').forEach(a => a.classList.toggle('hl', MODES[m][1].includes(a.dataset.v)));
    try { localStorage.setItem('cta_mode', m); } catch (e) { }
    if (go) location.hash = MODES[m][1][m === 'app' ? 0 : 0];
  }
  function route() {
    const h = (location.hash || '#accueil').slice(1), id = VIEWS.some(v => v[0] === h) ? h : 'accueil';
    document.querySelectorAll('section.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + id));
    $('#tabs').querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.v === id));
    init(id); window.scrollTo(0, 0);
  }
  function init(id) {
    if (id === 'cta') { initCTA(); window.C3.init($('#cta3d')); }
    if (inited[id]) { if (id === 'calculs') { } return; } inited[id] = true;
    if (id === 'calculs') window.CALC.init($('#v-calculs'));
    if (id === 'bloc') window.BLOC.init($('#v-bloc'));
    if (id === 'gtc') window.GTC.init($('#v-gtc'));
    if (id === 'pannes') window.FAULTUI.init($('#v-pannes'));
    if (id === 'psy') initPsy();
    if (id === 'dim') initDim();
    if (id === 'normes') initNormes();
    if (id === 'qcm') initQuiz();
  }

  /* ---------------- Accueil ---------------- */
  function initHome() {
    const L = [
      ['1', 'Découverte', 'Comprendre les composants et le principe de fonctionnement.', [['cta', 'Explorer la CTA en 3D, lancer la visite guidée'], ['cta', 'Suivre le parcours de l\'air (couleurs des flux)'], ['qcm', 'QCM niveau 1']]],
      ['2', 'Compréhension', 'Comprendre les phénomènes physiques, thermiques et aérauliques.', [['psy', 'Lire les évolutions de l\'air sur le diagramme psychrométrique'], ['bloc', 'Comprendre la cascade de pression et l\'effet d\'une porte ouverte'], ['gtc', 'Observer les boucles de régulation'], ['qcm', 'QCM niveau 2']]],
      ['3', 'Ingénierie', 'Réaliser les calculs et dimensionner les composants.', [['calculs', 'Débits, vitesses, gaines, pertes de charge, ventilateur, thermique, filtres'], ['dim', 'Dimensionner une CTA de bloc complète'], ['qcm', 'Exercices de calcul générés']]],
      ['4', 'Expertise & maintenance', 'Diagnostiquer, interpréter les mesures, optimiser.', [['pannes', 'Injecter les 12 pannes et analyser les symptômes'], ['pannes', 'Relever le défi « panne mystère »'], ['gtc', 'Mode expert : régler les gains PI, provoquer un pompage'], ['qcm', 'QCM niveau 4']]]
    ];
    $('#v-accueil').innerHTML = `<div class="card" style="background:linear-gradient(135deg,#12264a,#0f1a2e)"><h2>Laboratoire virtuel — Centrale de traitement d'air de bloc opératoire</h2>
      <p>De la prise d'air extérieur jusqu'au soufflage sur le champ opératoire : composants, physique, calculs, régulation et maintenance. Tous les résultats sont calculés à partir des valeurs saisies ; la simulation dynamique est partagée entre la vue 3D, la GTC et le module de pannes.</p>
      <div class="row"><span class="badge calc">Calcul</span><span class="badge hyp">Hypothèse pédagogique</span><span class="badge fab">Donnée fabricant</span><span class="badge norm">Exigence normative à vérifier</span></div>
      <div class="note w">Outil pédagogique : il ne remplace ni une étude d'exécution, ni les exigences du référentiel et du CCTP applicables, ni la procédure de qualification d'une salle propre.</div></div>
      <div class="grid g4" style="margin-top:14px">${L.map(l => `<div class="card lvcard" data-go="${l[3][0][0]}"><div class="lvnum">${l[0]}</div><h3>${l[1]}</h3><p class="small muted">${l[2]}</p><ul class="small">${l[3].map(s => `<li><a href="#${s[0]}">${s[1]}</a></li>`).join('')}</ul></div>`).join('')}</div>
      <div class="grid g3" style="margin-top:14px">
        <div class="card"><h3>Le parcours de l'air</h3><p class="small"><span style="color:var(--an)">●</span> air neuf → <span style="color:var(--mel)">●</span> air mélangé → <span style="color:var(--tra)">●</span> air traité → <span style="color:var(--sou)">●</span> air soufflé → <span style="color:var(--rep)">●</span> air repris → <span style="color:var(--rej)">●</span> air rejeté</p><p class="small muted">Ces couleurs sont utilisées dans la vue 3D, les schémas et le synoptique GTC.</p></div>
        <div class="card"><h3>Simulation en cours</h3><div class="res" id="home_kpi"></div></div>
        <div class="card"><h3>Modes</h3><p class="small"><b>Apprentissage</b> : découverte guidée. <b>Dimensionnement</b> : calculateurs. <b>Diagnostic</b> : GTC et pannes. <b>Expert</b> : tous les modules et paramètres avancés (gains PI, fuites…).</p></div></div>`;
    $('#v-accueil').querySelectorAll('.lvcard').forEach(c => c.onclick = e => { if (e.target.tagName !== 'A') location.hash = c.dataset.go; });
    S.listeners.push(() => { if (!$('#v-accueil').offsetParent) return; const x = S.x; $('#home_kpi').innerHTML = [['Salle', f(x.Tr, 1), '°C'], ['HR', f(x.RH, 0), '%'], ['Pression', f(x.proom, 1), 'Pa'], ['Débit', f(x.Qm, 0), 'm³/h']].map(k => `<div class="kpi"><div class="l">${k[0]}</div><span class="n">${k[1]}</span><span class="u">${k[2]}</span></div>`).join(''); });
  }

  /* ---------------- Vue CTA 3D ---------------- */
  const LIVEMAP = { filtre_prim: ['dpf'], prefiltre: ['dpf'], filtre_inter: ['dpf'], filtre_he: ['dpf'], manometre: ['dpf'], detect_colmat: ['dpf'], reg_an: ['oa'], reg_rec: ['rec'], reg_rejet: ['oa'], caisson_mel: ['tm'], sonde_mel: ['tm'], bat_froide: ['tb', 'vcr'], bat_chaude: ['tc', 'vhc'], vanne3v: ['vc', 'vcr', 'vhc'], humidif: ['vh', 'rh'], sonde_hum: ['rh'], regul_hygro: ['rh', 'vh'], ventil: ['qs', 'dpfan', 'speed', 'pw'], moteur: ['pw', 'speed'], vev: ['speed', 'pw'], transmission: ['speed', 'qs', 'pw'], mes_debit: ['qs'], mes_pression: ['dpfan'], sonde_text: ['text'], sonde_hext: ['rhext'], sonde_antigel: ['tc'], gaine_souf: ['qs', 'qroom'], gaines_sec: ['qroom'], diffuseur: ['qroom', 'proom'], hepa: ['qroom'], bouche_rep: ['qe'], gaine_rep: ['qe'], extraction: ['qe'], prise_air: ['text', 'oa'] };
  let ctaDone = false, curComp = null;
  function initCTA() {
    if (ctaDone) return; ctaDone = true;
    const C = window.COMPONENTS, secs = window.SECTIONS;
    $('#complist').innerHTML = Object.keys(secs).map(s => `<div class="sec">${secs[s]}</div>` + Object.entries(C).filter(([, c]) => c.s === s).map(([id, c]) => `<button data-id="${id}">${c.nom.split('(')[0]}</button>`).join('')).join('');
    $('#complist').querySelectorAll('button').forEach(b => b.onclick = () => window.C3.select(b.dataset.id, true));
    window.C3.onSelect = id => {
      curComp = id; const c = C[id];
      $('#complist').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
      const ul = a => `<ul>${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
      $('#sheet').innerHTML = `<span class="badge">${secs[c.s]}</span><h2 style="margin-top:6px">${c.nom}</h2><div class="illu">${window.ILLU(c.ty)}</div>
        <div id="sheet_live" class="res"></div>
        <dl><dt>Fonction</dt><dd>${c.fon}</dd><dt>Principe physique</dt><dd>${c.pri}</dd><dt>Caractéristiques techniques</dt><dd>${ul(c.car)}</dd><dt>Paramètres de fonctionnement</dt><dd>${ul(c.par)}</dd>
        <dt>Pannes fréquentes</dt><dd>${ul(c.pan)}</dd><dt>Maintenance préventive</dt><dd>${ul(c.mnt)}</dd><dt>Méthodes de diagnostic</dt><dd>${ul(c.dia)}</dd><dt>Conséquences d'une défaillance sur le bloc</dt><dd>${c.cons}</dd></dl>
        <p class="small muted">Valeurs chiffrées : ordres de grandeur indicatifs (<span class="badge hyp">Hypothèse</span>/<span class="badge fab">Fabricant</span>), à confirmer sur la documentation de l'équipement installé.</p>`;
    };
    S.listeners.push(() => { if (!curComp || !$('#v-cta').offsetParent) return; const keys = LIVEMAP[curComp]; const el = $('#sheet_live'); if (!el) return; if (!keys) { el.innerHTML = ''; return; } const L = window.GTC_LIVE(); el.innerHTML = keys.map(k => `<div class="kpi"><div class="l">${L[k][0]} (simulation)</div><span class="n">${f(L[k][1], L[k][3])}</span><span class="u">${L[k][2]}</span></div>`).join(''); });
    $('#t_exp').onchange = e => window.C3.setExplode(e.target.checked);
    $('#t_cas').oninput = e => window.C3.setCasing(+e.target.value);
    $('#t_rst').onclick = () => window.C3.reset();
    $('#t_tour').onclick = e => window.C3.tour(e.target);
    $('#t_rec').onchange = e => { S.p.recirc = e.target.checked; };
    setTimeout(() => window.C3.select('ventil', false), 300);
  }

  /* ---------------- Psychrométrie en direct ---------------- */
  function initPsy() {
    $('#v-psy').innerHTML = `<div class="grid pgrid"><div class="card"><h3>Diagramme psychrométrique — états de l'air de la simulation (temps réel)</h3><canvas class="psy" id="psyL"></canvas><div class="small mono muted" id="psyLr" style="min-height:18px">Survolez le diagramme pour lire l'état de l'air.</div>
      <div class="row small" style="margin-top:6px">Conditions extérieures : <input type="number" id="psy_te" value="${S.p.Text}" style="width:70px"> °C <input type="number" id="psy_rh" value="${S.p.RHext}" style="width:70px"> % HR <button class="b sec" id="psy_s">Été</button><button class="b sec" id="psy_w">Hiver</button></div></div>
      <div class="card"><h3>Lire les évolutions</h3><div id="psy_tab"></div>
      <dl class="small" style="margin-top:8px"><dt>Chauffage (batterie chaude)</dt><dd>Horizontale vers la droite : w constant, HR diminue, h augmente.</dd><dt>Refroidissement sec</dt><dd>Horizontale vers la gauche tant que la surface reste au-dessus du point de rosée.</dd>
      <dt>Refroidissement avec déshumidification</dt><dd>Vers le bas à gauche, en direction du point de surface de la batterie (ADP) ; condensation de (wM − wB) par kg d'air.</dd><dt>Humidification vapeur</dt><dd>Quasi verticale (isotherme) : w augmente à T ≈ constante.</dd>
      <dt>Humidification adiabatique (pulvérisation)</dt><dd>Le long d'une isenthalpe : w augmente, T diminue (non utilisée ici).</dd><dt>Mélange</dt><dd>Point sur le segment reliant les deux états, au prorata des débits massiques.</dd></dl></div></div>`;
    const cv = $('#psyL'); window.PSY.readout(cv, $('#psyLr'));
    const setE = (t, r) => { S.p.Text = t; S.p.RHext = r; $('#psy_te').value = t; $('#psy_rh').value = r; };
    $('#psy_te').onchange = e => S.p.Text = +e.target.value; $('#psy_rh').onchange = e => S.p.RHext = +e.target.value;
    $('#psy_s').onclick = () => setE(32, 45); $('#psy_w').onclick = () => setE(2, 70);
    let n = 0;
    S.listeners.push(() => {
      if (!cv.offsetParent || (n++ % 5)) return;
      const x = S.x, p = S.p, we = PH.w(p.Text, p.RHext);
      const one = x.f > 0.999; const pts = [{ T: p.Text, w: we, label: one ? '' : 'E', color: '#3b82f6' }, { T: x.TM, w: x.wM, label: one ? 'E = M' : 'M', color: '#a855f7' }, { T: x.TB, w: x.wB, label: 'B', color: '#22d3ee' }, { T: x.TC, w: x.wB, label: 'C', color: '#ef4444' }, { T: x.TC, w: x.wD, label: 'D', color: '#e2e8f0' }, { T: x.TS, w: x.wS, label: 'S', color: '#67e8f9' }, { T: x.Tr, w: x.wr, label: 'Salle', color: '#2ecc8f' }];
      window.PSY.draw(cv, { points: pts, lines: [[0, 1, '#64748b', true], [1, 2, '#3b82f6'], [2, 3, '#ef4444'], [3, 4, '#e2e8f0'], [4, 5, '#94a3b8', true], [5, 6, '#2ecc8f', true]], zone: { T1: p.spT - 1, T2: p.spT + 1, RH1: p.spRH - 5, RH2: p.spRH + 5 } });
      const row = (l, T, w) => `<tr><td>${l}</td><td class="mono">${f(T, 1)}</td><td class="mono">${f(w * 1000, 2)}</td><td class="mono">${f(PH.rh(T, w), 0)}</td><td class="mono">${f(PH.h(T, w), 1)}</td></tr>`;
      $('#psy_tab').innerHTML = `<table class="t"><thead><tr><th>Point</th><th>T °C</th><th>w g/kg</th><th>HR %</th><th>h kJ/kg</th></tr></thead><tbody>${row('E — extérieur', p.Text, we)}${row('M — mélange', x.TM, x.wM)}${row('B — après BF', x.TB, x.wB)}${row('C — après BC', x.TC, x.wB)}${row('D — après humidif.', x.TC, x.wD)}${row('S — soufflage', x.TS, x.wS)}${row('Salle', x.Tr, x.wr)}</tbody></table>`;
    });
  }

  /* ---------------- Scénario de dimensionnement ---------------- */
  function initDim() {
    const I = (id, l, v, u, b = 'hyp') => `<label class="f"><span>${l} <span class="small">(${u})</span> <span class="badge ${b}" style="font-size:9px;padding:0 5px">${b === 'hyp' ? 'H' : b === 'fab' ? 'F' : b === 'norm' ? 'N' : 'D'}</span></span><input type="number" id="${id}" value="${v}" step="any"></label>`;
    $('#v-dim').innerHTML = `<div class="card"><h2>Exemple complet : CTA d'une salle d'opération</h2><p class="small muted">Toutes les valeurs proposées sont des <span class="badge hyp">hypothèses pédagogiques</span> (H) ou des données à prendre chez le <span class="badge fab">fabricant</span> (F). Les exigences de performance (classe, cinétique, différence de pression, taux de renouvellement…) doivent être lues dans le référentiel et le programme applicables (N) : aucune n'est imposée ici.</p>
      <div class="grid g3"><div><h4>Local</h4><div class="form">${I('s_L', 'Longueur', 7, 'm', 'd')}${I('s_l', 'Largeur', 6.5, 'm', 'd')}${I('s_h', 'Hauteur sous plafond', 3, 'm', 'd')}${I('s_p', 'Personnes', 8, 'pers.', 'd')}${I('s_ld', 'Apports équipements + éclairage', 2500, 'W')}${I('s_su', 'Surface plafond soufflant (0 = sans)', 9, 'm²')}</div></div>
      <div><h4>Air</h4><div class="form">${I('s_n', 'Renouvellements souhaités', 20, 'vol/h', 'norm')}${I('s_qan', "Débit d'air neuf", 2600, 'm³/h', 'norm')}${I('s_qs', 'Débit de soufflage', 2600, 'm³/h')}${I('s_qr', 'Débit de reprise', 2050, 'm³/h')}${I('s_af', 'Surface de fuite de la salle (portes fermées)', 550, 'cm²')}${I('s_dpt', 'ΔP cible du concepteur', 15, 'Pa', 'norm')}</div></div>
      <div><h4>Climat et équipements</h4><div class="form">${I('s_te', 'T ext. été', 32, '°C')}${I('s_rhe', 'HR ext. été', 45, '%')}${I('s_tw', 'T ext. hiver', 2, '°C')}${I('s_rhw', 'HR ext. hiver', 70, '%')}${I('s_ti', 'T intérieure de consigne', 21, '°C', 'norm')}${I('s_rhi', 'HR souhaitée', 50, '%', 'norm')}
        ${I('s_dpr', 'ΔP réseau + composants hors filtres', 700, 'Pa')}${I('s_dpff', 'Σ ΔP finales des filtres', 750, 'Pa', 'fab')}${I('s_eta', 'Rendement global ventilateur', 0.55, '—', 'fab')}${I('s_v', 'Vitesse en gaine principale', 5, 'm/s')}</div></div></div></div>
      <div class="grid g2" style="margin-top:12px"><div class="card"><h3>Résultats</h3><div id="s_out"></div></div><div class="card"><h3>Évolutions de l'air</h3><h4>Été</h4><canvas class="psy" id="psyS1"></canvas><h4 style="margin-top:10px">Hiver</h4><canvas class="psy" id="psyS2"></canvas><p class="small muted">D = donnée du projet · H = hypothèse · F = fabricant · N = valeur à fixer selon le référentiel / programme.</p></div></div>`;
    $('#v-dim').addEventListener('input', runDim); runDim();
  }
  function runDim() {
    const g = id => parseFloat($('#' + id).value);
    const L = g('s_L'), l = g('s_l'), h = g('s_h'), np = g('s_p'), ld = g('s_ld'), Su = g('s_su'), N = g('s_n'), Qan = g('s_qan'), Qs = g('s_qs'), Qr = g('s_qr'), Af = g('s_af') / 1e4, dpt = g('s_dpt');
    const Te = g('s_te'), RHe = g('s_rhe'), Tw = g('s_tw'), RHw = g('s_rhw'), Ti = g('s_ti'), RHi = g('s_rhi'), dpr = g('s_dpr'), dpff = g('s_dpff'), eta = g('s_eta'), vg = g('s_v');
    const V = L * l * h, QN = N * V, Nr = Qs / V, Ps = ld + np * 75, Pl = np * 55, rho = PH.rho(17, 0.008), m = rho * Qs / 3600;
    const dTs = Ps / (m * PH.CP_A), Ts = Ti - dTs, x = PH.clamp(Qan / Qs * 100, 0, 100);
    const dp = window.BLOC.solveFor(Qs, Qr, Af);
    const Pt = dpr + dpff, Pel = Qs / 3600 * Pt / eta;
    const Sg = Qs / 3600 / vg, D = Math.sqrt(4 * Sg / Math.PI), ncell = Math.ceil(Qs / 3400);
    const vu = Su > 0 ? Qs / 3600 / Su : 0;
    const dTv = Pt / (eta * rho * PH.CP_A);
    const E = window.CALC.process({ Q: Qs, x, Te, RHe, Ti, RHi, Ts, Pl, dTv, RHb: 95 });
    const W = window.CALC.process({ Q: Qs, x, Te: Tw, RHe: RHw, Ti, RHi, Ts: Ti - dTs * 0.6, Pl, dTv, RHb: 95 });
    const tag = (t) => `<span class="badge ${t}">${{ calc: 'Calcul', hyp: 'Hypothèse', fab: 'Fabricant', norm: 'À vérifier (norme)' }[t]}</span>`;
    const row = (l, v, u, t, c) => `<tr><td>${l}</td><td class="mono"><b>${v}</b> ${u}</td><td>${tag(t)}</td><td class="small muted">${c || ''}</td></tr>`;
    $('#s_out').innerHTML = `<table class="t"><thead><tr><th>Grandeur</th><th>Valeur</th><th>Origine</th><th>Commentaire</th></tr></thead><tbody>
      ${row('Volume de la salle', f(V, 1), 'm³', 'calc', 'V = L × l × H')}
      ${row('Débit pour N souhaité', f(QN, 0), 'm³/h', 'calc', `Q = N × V = ${N} × ${f(V, 1)}`)}
      ${row('Renouvellement obtenu avec Qs', f(Nr, 1), 'vol/h', 'calc', Qs < QN ? '⚠ inférieur au taux souhaité' : 'conforme au taux souhaité')}
      ${row('Décroissance théorique de 90 %', f(2.303 / Nr * 60, 1), 'min', 'calc', 'Dilution idéale ; la cinétique réelle se mesure en qualification.')}
      ${row('Apports sensibles', f(Ps, 0), 'W', 'hyp', `équipements ${ld} W + ${np} pers. × 75 W`)}
      ${row('Apports latents', f(Pl, 0), 'W', 'hyp', `${np} pers. × 55 W`)}
      ${row('Écart de soufflage nécessaire (été)', f(dTs, 1), 'K', 'calc', `ΔT = Ps/(ṁ·Cp) → T soufflage = ${f(Ts, 1)} °C`)}
      ${row("Taux d'air neuf", f(x, 0), '%', 'calc', x < 100 ? `recyclage ${f(100 - x, 0)} % — à justifier par la conception` : 'CTA tout air neuf')}
      ${row('Air neuf par personne', f(Qan / Math.max(np, 1), 0), 'm³/h/pers', 'calc')}
      ${row('Écart soufflage − reprise', f(Qs - Qr, 0), 'm³/h', 'calc')}
      ${row('Surpression estimée (salle → extérieur)', f(dp, 1), 'Pa', 'calc', `ΔP = (ρ/2)(Q/(Cd·A))², A = ${f(Af * 1e4, 0)} cm² ; ${dp >= dpt ? '≥' : '<'} cible ${dpt} Pa`)}
      ${Su > 0 ? row('Vitesse moyenne sous plafond soufflant', f(vu, 2), 'm/s', 'calc', `si tout le débit passe par le plafond — débit nécessaire pour 0,30 m/s : ${f(Su * 0.3 * 3600, 0)} m³/h (souvent atteint par recyclage local)`) : ''}
      ${row('Batterie froide (été)', f(E.P.bf / 1000, 2), 'kW', 'calc', `sensible ${f(E.P.bfs / 1000, 1)} / latente ${f(E.P.bfl / 1000, 1)} kW · condensats ${f(E.P.cond, 1)} kg/h`)}
      ${row('Post-chauffage (été)', f(E.P.bc / 1000, 2), 'kW', 'calc')}
      ${row('Débit eau glacée (ΔT 5 K)', f(E.P.bf / (1000 * 4186 * 5) * 3600, 2), 'm³/h', 'calc')}
      ${row('Batterie chaude (hiver)', f(W.P.bc / 1000, 2), 'kW', 'calc', `T soufflage hiver ${f(Ti - dTs * 0.6, 1)} °C (apports réduits, hyp.)`)}
      ${row('Débit eau chaude (ΔT 20 K)', f(W.P.bc / (1000 * 4186 * 20) * 3600, 2), 'm³/h', 'calc')}
      ${row('Humidification (hiver)', f(Math.max(0, W.P.humkg || 0), 1), 'kg/h vapeur', 'calc', `≈ ${f(Math.max(0, W.P.humkg || 0) * 0.75, 1)} kW électriques`)}
      ${row('Pression ventilateur (filtres en fin de vie)', f(Pt, 0), 'Pa', 'calc', `${dpr} + ${dpff}`)}
      ${row('Puissance électrique ventilateur', f(Pel / 1000, 2), 'kW', 'calc', `P = Q·ΔP/η ; SFP = ${f(Pel / (Qs / 3600) / 1000, 2)} kW/(m³/s)`)}
      ${row('Échauffement dû au ventilateur', f(dTv, 2), 'K', 'calc', 'moteur dans le flux d\'air')}
      ${row('Section de gaine principale', f(Sg, 3), 'm²', 'calc', `Ø ${f(D * 1000, 0)} mm ou ${f(Sg / 0.3 * 1000, 0)} × 300 mm`)}
      ${row('Cellules filtrantes 592 × 592', ncell, 'u. / étage', 'fab', 'base 3 400 m³/h par cellule (à vérifier fabricant)')}
      </tbody></table>`;
    window.PSY.draw($('#psyS1'), { points: E.pts, lines: E.lines, zone: { T1: Ti - 1, T2: Ti + 1, RH1: RHi - 5, RH2: RHi + 5 } });
    window.PSY.draw($('#psyS2'), { points: W.pts, lines: W.lines, zone: { T1: Ti - 1, T2: Ti + 1, RH1: RHi - 5, RH2: RHi + 5 } });
  }

  /* ---------------- Normes ---------------- */
  function initNormes() {
    $('#v-normes').innerHTML = `<div class="note w">Ce simulateur ne reproduit aucune exigence chiffrée de ces textes comme obligation. Les éditions indiquées sont celles connues à la date de préparation : vérifier l'édition en vigueur et son statut (homologuée, contractuelle, retirée) auprès de l'organisme de normalisation (ISO, CEN, AFNOR, IMANOR) et dans les pièces du marché.</div>
      <div class="grid g2">${window.NORMS.map(n => `<div class="card"><h3>${n.ref}</h3><p class="small"><span class="badge norm">${n.ed}</span></p><p class="small"><b>Statut :</b> ${n.st}</p><p><b>Domaine d'application :</b> ${n.dom}</p><p class="small muted"><b>Usage dans ce simulateur :</b> ${n.use}</p></div>`).join('')}</div>
      <div class="card" style="margin-top:12px"><h3>Hiérarchie des sources utilisées dans l'outil</h3><table class="t"><tbody>
      <tr><td><span class="badge calc">Calcul</span></td><td>Lois physiques : conservation de la masse et de l'énergie, Darcy-Weisbach, Colebrook/Haaland, loi d'orifice, lois de similitude, psychrométrie (Magnus).</td></tr>
      <tr><td><span class="badge hyp">Hypothèse</span></td><td>Valeurs pédagogiques par défaut (charges, vitesses usuelles, coefficients ζ, courbe ventilateur modélisée, gains PI). À remplacer par les données du projet.</td></tr>
      <tr><td><span class="badge fab">Fabricant</span></td><td>Pertes de charge des composants, ΔP initiale / finale des filtres, courbes ventilateur, rendements, coefficient k de l'anneau de mesure.</td></tr>
      <tr><td><span class="badge norm">Norme</span></td><td>Classes de filtres (ISO 16890, EN 1822), méthodes d'essai (ISO 14644-3, EN 12599), exigences de performance des zones (référentiel de santé applicable, CCTP).</td></tr></tbody></table></div>`;
  }

  /* ---------------- QCM et exercices ---------------- */
  function initQuiz() {
    let score = 0, done = 0;
    $('#v-qcm').innerHTML = `<div class="grid g2"><div class="card"><div class="row" style="justify-content:space-between"><h3>QCM avec correction détaillée</h3><span class="badge" id="q_sc">0 / ${window.QUIZ.length}</span></div>
      <div class="row small" style="margin-bottom:8px">Niveau : ${['Tous', 1, 2, 3, 4].map(l => `<button class="b sec" data-l="${l}" style="padding:3px 9px">${l}</button>`).join('')}</div><div id="q_list"></div></div>
      <div class="card"><div class="row" style="justify-content:space-between"><h3>Exercices de calcul (valeurs aléatoires)</h3><button class="b" id="x_new">Nouvelles valeurs</button></div><div id="x_list"></div></div></div>`;
    const draw = lv => {
      $('#q_list').innerHTML = window.QUIZ.map((q, i) => (lv === 'Tous' || q.lv == lv) ? `<div class="q" data-i="${i}"><p><span class="badge">N${q.lv}</span> <b>${q.q}</b></p>${q.o.map((o, j) => `<span class="opt" data-j="${j}">${String.fromCharCode(65 + j)}. ${o}</span>`).join('')}<div class="exp note">${q.e}</div></div>` : '').join('');
      $('#q_list').querySelectorAll('.q').forEach(d => d.querySelectorAll('.opt').forEach(o => o.onclick = () => {
        if (d.classList.contains('done')) return; const q = window.QUIZ[+d.dataset.i], j = +o.dataset.j; d.classList.add('done');
        d.querySelectorAll('.opt')[q.a].classList.add('good'); if (j !== q.a) o.classList.add('badc'); else score++; done++; $('#q_sc').textContent = `${score} / ${done} (sur ${window.QUIZ.length})`;
      }));
    };
    $('#v-qcm').querySelectorAll('button[data-l]').forEach(b => b.onclick = () => draw(b.dataset.l)); draw('Tous');
    const R = (a, b, s = 1) => Math.round((a + Math.random() * (b - a)) / s) * s;
    function gen() {
      const L = R(5, 8, 0.5), l = R(5, 7, 0.5), h = R(2.8, 3.2, 0.1), N = R(15, 30, 5);
      const Q = R(2000, 5000, 100), a = R(400, 800, 50), b = R(250, 400, 50);
      const Qh = R(2000, 4000, 100), dT = R(8, 20, 1);
      const Qf = R(1, 2, 0.1), dP = R(800, 1400, 50), eta = R(0.5, 0.65, 0.01);
      const lam = 0.02, Lg = R(10, 40, 5), D = R(0.3, 0.6, 0.05), vv = R(3, 7, 0.5);
      const ex = [
        { q: `Salle de ${L} × ${l} × ${h} m, ${N} vol/h. Débit en m³/h ?`, r: N * L * l * h, u: 'm³/h', c: `V = ${L}×${l}×${h} = ${f(L * l * h, 2)} m³ ; Q = N×V = ${N}×${f(L * l * h, 2)} = ${f(N * L * l * h, 0)} m³/h` },
        { q: `Q = ${Q} m³/h dans une gaine ${a} × ${b} mm. Vitesse en m/s ?`, r: Q / 3600 / (a * b / 1e6), u: 'm/s', c: `Q = ${f(Q / 3600, 3)} m³/s ; S = ${f(a * b / 1e6, 3)} m² ; v = Q/S = ${f(Q / 3600 / (a * b / 1e6), 2)} m/s` },
        { q: `Batterie chaude : Q = ${Qh} m³/h, ΔT = ${dT} K, ρ = 1,2 kg/m³, Cp = 1006 J/(kg·K). Puissance en kW ?`, r: 1.2 * 1006 * Qh / 3600 * dT / 1000, u: 'kW', c: `P = ρ·Cp·Q·ΔT = 1,2×1006×${f(Qh / 3600, 3)}×${dT} = ${f(1.2 * 1006 * Qh / 3600 * dT / 1000, 2)} kW` },
        { q: `Ventilateur : Q = ${f(Qf, 1)} m³/s, ΔP = ${dP} Pa, η = ${f(eta, 2)}. Puissance absorbée en kW ?`, r: Qf * dP / eta / 1000, u: 'kW', c: `P = Q·ΔP/η = ${f(Qf, 1)}×${dP}/${f(eta, 2)} = ${f(Qf * dP / eta / 1000, 2)} kW` },
        { q: `Gaine circulaire Ø ${f(D * 1000, 0)} mm, L = ${Lg} m, v = ${f(vv, 1)} m/s, λ = 0,02, ρ = 1,2. Perte de charge en Pa ?`, r: lam * Lg / D * 1.2 * vv * vv / 2, u: 'Pa', c: `ΔP = λ·(L/D)·ρv²/2 = 0,02×(${Lg}/${f(D, 2)})×1,2×${f(vv, 1)}²/2 = ${f(lam * Lg / D * 1.2 * vv * vv / 2, 1)} Pa` }
      ];
      $('#x_list').innerHTML = ex.map((e, i) => `<div class="q" data-i="${i}"><p><b>${i + 1}.</b> ${e.q}</p><div class="row"><input type="number" step="any" style="width:140px" placeholder="réponse"> <span class="small">${e.u}</span><button class="b sec">Vérifier</button></div><div class="xr"></div></div>`).join('');
      $('#x_list').querySelectorAll('.q').forEach(d => d.querySelector('button').onclick = () => { const e = ex[+d.dataset.i], val = parseFloat(d.querySelector('input').value.replace(',', '.')), ok = Math.abs(val - e.r) / e.r < 0.02; d.querySelector('.xr').innerHTML = `<div class="note ${ok ? '' : 'r'}">${ok ? '✔ Correct (tolérance ±2 %)' : `✘ Attendu ≈ ${f(e.r, 2)} ${e.u}`}<br><span class="mono small">${e.c}</span></div>`; });
    }
    $('#x_new').onclick = gen; gen();
  }

  /* ---------------- Démarrage ---------------- */
  document.addEventListener('DOMContentLoaded', () => {
    S.warmup(3600);
    setInterval(S.loop, 100);
    nav(); initHome();
    let m = 'app'; try { m = localStorage.getItem('cta_mode') || 'app'; } catch (e) { }
    setMode(m, false); route();
  });
})();
