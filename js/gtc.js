/* =========================================================
   gtc.js — Tableau de bord GTC (supervision) et module de pannes
   ========================================================= */
(function () {
  const PH = window.PH, f = PH.f, $ = s => document.querySelector(s);
  const S = window.SIM;
  const SEQ = { arret: 'ARRÊT', demarrage: 'DÉMARRAGE', marche: 'MARCHE — RÉGULATION', arret_n: 'ARRÊT EN COURS', antigel: 'SÉCURITÉ ANTIGEL' };
  const LIVE = () => {
    const x = S.x, p = S.p;
    return {
      text: ['T extérieure', p.Text, '°C', 1], rhext: ['HR extérieure', p.RHext, '%', 0], wext: ['w extérieure', PH.w(p.Text, p.RHext) * 1000, 'g/kg', 1],
      tm: ['T mélange', x.TM, '°C', 1], tb: ['T après batterie froide', x.TB, '°C', 1], tc: ['T après batterie chaude', x.TC, '°C', 1],
      tsm: ['T soufflage (mesurée)', x.TSm, '°C', 1], ts: ['T soufflage (réelle)', x.TS, '°C', 1], tssp: ['Consigne T soufflage calculée', x.Ts_sp, '°C', 1],
      troom: ['T salle / reprise', x.Tr, '°C', 1], rh: ['HR salle', x.RH, '%', 0], proom: ['Pression salle', x.proom, 'Pa', 1],
      qs: ['Débit soufflage (CTA)', x.Qm, 'm³/h', 0], qroom: ['Débit arrivant en salle', x.Qroom, 'm³/h', 0], qe: ['Débit de reprise', x.Qe, 'm³/h', 0],
      dpf: ['ΔP filtres (total)', x.dpf, 'Pa', 0], dpfan: ['ΔP ventilateur', x.dpfan, 'Pa', 0], speed: ['Fréquence variateur', x.s * 50, 'Hz', 1], pw: ['Puissance absorbée', x.pw / 1000, 'kW', 2],
      oa: ['Registre air neuf (recopie)', x.oaPos * 100, '%', 0], rec: ['Registre recyclage', x.recPos * 100, '%', 0],
      vc: ['Vanne BF — commande', x.vcCmd * 100, '%', 0], vcr: ['Vanne BF — recopie', x.vc * 100, '%', 0], vhc: ['Vanne BC — commande', x.vhCmd * 100, '%', 0], vh: ['Humidificateur — commande', x.vhumCmd * 100, '%', 0]
    };
  };
  window.GTC_LIVE = LIVE;
  const ALIM = { proom: v => v < S.p.alarmP, dpf: v => v > S.p.alarmDPf, qs: v => v < 0.85 * (S.p.occupied ? S.p.spQocc : S.p.spQveille), troom: v => Math.abs(v - S.p.spT) > 2, rh: v => Math.abs(v - S.p.spRH) > 10 };
  function kpis(keys) { const L = LIVE(); return keys.map(k => { const [l, v, u, d] = L[k]; const al = ALIM[k] && ALIM[k](v); return `<div class="kpi ${al ? 'alarm' : ''}"><div class="l">${l}</div><span class="n">${f(v, d)}</span><span class="u">${u}</span></div>`; }).join(''); }

  function synoptic() {
    const x = S.x, p = S.p, F = S.faults, run = x.Qm > 50;
    const b = (X, w, lbl, val, c = '#17284a', st = '#4f7bd1') => `<rect x="${X}" y="70" width="${w}" height="90" rx="4" fill="${c}" stroke="${st}"/><text x="${X + w / 2}" y="62" font-size="10" fill="#93a6c8" text-anchor="middle">${lbl}</text><text x="${X + w / 2}" y="180" font-size="11" fill="#9fe2ff" text-anchor="middle" font-family="JetBrains Mono">${val}</text>`;
    const kc = Math.min(1, x.clog / 2.2), fc = `rgb(${Math.round(232 - 140 * kc)},${Math.round(226 - 150 * kc)},${Math.round(200 - 150 * kc)})`;
    let s = `<rect x="0" y="0" width="900" height="250" fill="#0a1426"/>`;
    s += `<line x1="10" y1="115" x2="790" y2="115" stroke="${run ? '#22c55e' : '#334155'}" stroke-width="3" class="${run ? 'flow' : ''}"/>`;
    s += b(15, 40, 'Air neuf', `${f(p.Text, 1)}°C`, '#0f2a4a') + `<text x="35" y="200" font-size="10" fill="#9fe2ff" text-anchor="middle" font-family="JetBrains Mono">${f(p.RHext, 0)}%</text>`;
    s += b(65, 30, 'Reg. AN', `${f(x.oaPos * 100, 0)}%`, F.registre ? '#3a1520' : '#17284a');
    s += b(105, 30, 'F1', '', fc);
    s += b(145, 60, 'Mélange', `${f(x.TM, 1)}°C`);
    s += b(215, 30, 'F2', `${f(x.dpf, 0)}Pa`, fc);
    s += b(255, 45, 'BF', `${f(x.TB, 1)}°C`, F.bf ? '#3a1520' : '#10264a', '#3b82f6') + `<text x="277" y="215" font-size="10" fill="#93c5fd" text-anchor="middle">V ${f(x.vc * 100, 0)}%</text>`;
    s += b(310, 45, 'BC', `${f(x.TC, 1)}°C`, '#2a1220', '#ef4444') + `<text x="332" y="215" font-size="10" fill="#fca5a5" text-anchor="middle">V ${f(x.vh * 100, 0)}%</text>`;
    s += b(365, 45, 'Humid.', `${f(x.vhum * 100, 0)}%`, F.humid ? '#3a1520' : '#17284a');
    s += `<circle cx="450" cy="115" r="38" fill="${F.ventil || F.vev ? '#3a1520' : '#17284a'}" stroke="#4f7bd1"/><text x="450" y="62" font-size="10" fill="#93a6c8" text-anchor="middle">Ventilateur</text><text x="450" y="119" font-size="12" fill="#e6eefc" text-anchor="middle" font-family="JetBrains Mono">${f(x.s * 50, 1)} Hz</text><text x="450" y="180" font-size="11" fill="#9fe2ff" text-anchor="middle" font-family="JetBrains Mono">${f(x.Qm, 0)} m³/h</text><text x="450" y="200" font-size="10" fill="#93a6c8" text-anchor="middle">${f(x.pw / 1000, 2)} kW</text>`;
    s += b(500, 30, 'F3', '', fc);
    s += `<text x="560" y="105" font-size="10" fill="#93a6c8" text-anchor="middle">T souff.</text><text x="560" y="130" font-size="13" fill="${F.sonde ? '#ffb020' : '#9fe2ff'}" text-anchor="middle" font-family="JetBrains Mono">${f(x.TSm, 1)}°C</text>`;
    s += `<rect x="620" y="40" width="170" height="160" rx="6" fill="#0e2a3a" stroke="#67e8f9"/><text x="705" y="60" font-size="12" fill="#e6eefc" text-anchor="middle" font-weight="600">Salle d'opération</text>
      <text x="705" y="90" font-size="13" fill="#9fe2ff" text-anchor="middle" font-family="JetBrains Mono">${f(x.Tr, 1)} °C · ${f(x.RH, 0)} %</text>
      <text x="705" y="125" font-size="20" fill="${x.proom < p.alarmP ? '#ff8a96' : '#2ecc8f'}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700">${x.proom >= 0 ? '+' : ''}${f(x.proom, 1)} Pa</text>
      <text x="705" y="150" font-size="10" fill="#93a6c8" text-anchor="middle">entrée ${f(x.Qroom, 0)} · reprise ${f(x.Qe, 0)} m³/h</text>
      <text x="705" y="185" font-size="10" fill="#93a6c8" text-anchor="middle">${p.occupied ? 'Mode OCCUPÉ' : 'Mode VEILLE'}</text>`;
    s += `<path d="M705 200 v35 H175 v-65" fill="none" stroke="${x.Qe > 50 ? '#f59e0b' : '#334155'}" stroke-width="2" class="${x.Qe > 50 ? 'flow' : ''}"/><text x="420" y="230" font-size="10" fill="#f59e0b" text-anchor="middle">${p.recirc ? `reprise → recyclage ${f(x.recPos * (1 - p.oaMin / 100) * 100, 0)} % / rejet` : 'reprise → rejet (CTA tout air neuf)'}</text>`;
    s += `<text x="10" y="20" font-size="13" fill="${x.seq === 'antigel' ? '#ff4d5e' : '#52d1ff'}" font-weight="700">${SEQ[x.seq]}</text><text x="890" y="20" font-size="11" fill="#93a6c8" text-anchor="end" font-family="JetBrains Mono">t sim = ${new Date(x.t * 1000).toISOString().substr(11, 8)}</text>`;
    return s;
  }
  let tch1, tch2, tch3;
  function trends() {
    if (!window.Chart) return;
    const H = S.hist, lab = H.map(h => ((h.t - (H[0] ? H[0].t : 0)) / 60).toFixed(1));
    const ds = (l, k, c, ax) => ({ label: l, data: H.map(h => h[k]), borderColor: c, pointRadius: 0, borderWidth: 1.6, yAxisID: ax });
    const opt = (y1, y2, r1, r2) => ({ animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#93a6c8', boxWidth: 10, font: { size: 10 } } } }, scales: { x: { ticks: { color: '#93a6c8', maxTicksLimit: 8 }, grid: { color: '#1b2e52' }, title: { display: true, text: 'minutes simulées', color: '#93a6c8' } }, y: { position: 'left', suggestedMin: r1[0], suggestedMax: r1[1], ticks: { color: '#93a6c8' }, grid: { color: '#1b2e52' }, title: { display: true, text: y1, color: '#93a6c8' } }, y2: { position: 'right', suggestedMin: r2[0], suggestedMax: r2[1], ticks: { color: '#93a6c8' }, grid: { display: false }, title: { display: true, text: y2, color: '#93a6c8' } } } });
    if (!tch1) {
      tch1 = new Chart($('#gtc_ch1'), { type: 'line', data: { labels: lab, datasets: [ds('T salle', 'Tr', '#2ecc8f', 'y'), ds('T soufflage réelle', 'TS', '#67e8f9', 'y'), ds('T soufflage mesurée', 'TSm', '#ffb020', 'y'), ds('HR salle', 'RH', '#a855f7', 'y2')] }, options: opt('°C', '% HR', [10, 30], [0, 100]) });
      tch2 = new Chart($('#gtc_ch2'), { type: 'line', data: { labels: lab, datasets: [ds('Pression salle', 'P', '#2f8cff', 'y'), ds('Débit soufflage', 'Q', '#22c55e', 'y2')] }, options: opt('Pa', 'm³/h', [-5, 30], [0, 3500]) });
      tch3 = new Chart($('#gtc_ch3'), { type: 'line', data: { labels: lab, datasets: [ds('ΔP filtres', 'dpf', '#ff4d5e', 'y'), ds('Puissance', 'pwk', '#ffb020', 'y2')] }, options: opt('Pa', 'kW', [0, 900], [0, 3]) });
    } else {
      [tch1, tch2, tch3].forEach(c => { c.data.labels = lab; c.data.datasets.forEach(d => { const k = { 'T salle': 'Tr', 'T soufflage réelle': 'TS', 'T soufflage mesurée': 'TSm', 'HR salle': 'RH', 'Pression salle': 'P', 'Débit soufflage': 'Q', 'ΔP filtres': 'dpf', 'Puissance': 'pwk' }[d.label]; d.data = H.map(h => h[k]); }); c.update('none'); });
    }
  }
  function alarmsHTML() {
    const A = S.x.alarms, ks = Object.keys(A).sort((a, b) => A[a].prio - A[b].prio);
    if (!ks.length) return '<div class="muted small" style="padding:6px">Aucune alarme.</div>';
    return ks.map(k => { const a = A[k]; return `<div class="a ${a.active ? 'act' : ''}"><span class="p" style="color:${a.prio === 1 ? '#ff4d5e' : a.prio === 2 ? '#ffb020' : '#93a6c8'}">P${a.prio} ${a.active ? '●' : '○'}</span><span style="flex:1">${a.label}</span><span class="small muted">${a.ack ? 'acquittée' : 'non acq.'}</span></div>`; }).join('');
  }
  const ctl = (id, l, v, u, step = 1) => `<label class="f">${l} <span class="small">(${u})</span><input type="number" id="${id}" value="${v}" step="${step}"></label>`;

  window.GTC = {
    init(root) {
      const p = S.p;
      root.innerHTML = `<div class="gtc"><div>
        <div class="card"><div class="row" style="justify-content:space-between"><h3>Synoptique CTA — bloc opératoire</h3><div class="row small">Vitesse de simulation <select id="g_sp" style="width:auto">${[1, 5, 10, 30, 60].map(k => `<option ${k === S.speed ? 'selected' : ''} value="${k}">×${k}</option>`).join('')}</select></div></div>
        <svg viewBox="0 0 900 250" width="100%" id="g_syn" style="border-radius:8px"></svg>
        <div class="row" style="margin-top:8px"><button class="b grn" id="g_start">Marche</button><button class="b red" id="g_stop">Arrêt</button><button class="b sec" id="g_occ">Occupé / Veille</button><button class="b sec" id="g_ack">Acquitter</button><button class="b sec" id="g_rst">Réarmer</button><button class="b sec" id="g_fil">Remplacer filtres</button><button class="b sec" id="g_re">Réinitialiser simulation</button></div></div>
        <div class="card" style="margin-top:12px"><h3>Courbes de tendance</h3><div class="grid g3"><div style="position:relative;height:230px"><canvas id="gtc_ch1"></canvas></div><div style="position:relative;height:230px"><canvas id="gtc_ch2"></canvas></div><div style="position:relative;height:230px"><canvas id="gtc_ch3"></canvas></div></div></div>
        <div class="card" style="margin-top:12px"><h3>Mesures</h3><div class="res" id="g_kpi"></div></div></div>
        <div><div class="card"><h3>Alarmes techniques</h3><div class="alarms" id="g_al"></div></div>
        <div class="card" style="margin-top:12px"><h3>Consignes</h3><div class="form">
          ${ctl('c_spT', 'T salle', p.spT, '°C', 0.5)}${ctl('c_spRH', 'HR salle', p.spRH, '%')}${ctl('c_spQ', 'Débit occupé', p.spQocc, 'm³/h', 50)}${ctl('c_spQv', 'Débit veille', p.spQveille, 'm³/h', 50)}
          ${ctl('c_dQ', 'Écart soufflage − reprise', p.dQ, 'm³/h', 10)}${ctl('c_aP', 'Seuil alarme surpression', p.alarmP, 'Pa')}${ctl('c_aF', 'Seuil alarme ΔP filtres', p.alarmDPf, 'Pa', 10)}
        </div><label class="row small" style="margin-top:8px"><input type="checkbox" id="c_rec" ${p.recirc ? 'checked' : ''}> Recyclage autorisé par la conception — air neuf mini <input type="number" id="c_oa" value="${p.oaMin}" style="width:70px"> %</label>
        <h4 style="margin-top:10px">Conditions extérieures et charges</h4><div class="form">${ctl('c_Te', 'T extérieure', p.Text, '°C', 0.5)}${ctl('c_RHe', 'HR extérieure', p.RHext, '%')}${ctl('c_pp', 'Personnes', p.people, 'pers.')}${ctl('c_ld', 'Apports équipements + éclairage', p.loadW, 'W', 100)}</div>
        <div class="expert"><h4 style="margin-top:10px">Mode expert — paramètres de régulation</h4><div class="form">${ctl('c_kps', 'Kp boucle soufflage', p.Kp_s, '1/K', 0.005)}${ctl('c_tis', 'Ti boucle soufflage', p.Ti_s, 's')}${ctl('c_kpr', 'Kp boucle salle', p.Kp_r, 'K/K', 0.1)}${ctl('c_tir', 'Ti boucle salle', p.Ti_r, 's', 10)}${ctl('c_kpq', 'Kp boucle débit', p.Kp_q, '1/(m³/h)', 0.0001)}${ctl('c_tiq', 'Ti boucle débit', p.Ti_q, 's')}${ctl('c_al', 'Surface de fuite salle', p.Aleak * 1e4, 'cm²', 10)}</div></div>
        <p class="small muted">Valeurs de consigne et seuils : choix d'exploitation à adapter au programme et au référentiel ; aucune n'est une exigence normative.</p></div>
        <div class="card" style="margin-top:12px"><h3>Journal des séquences et événements</h3><div class="log" id="g_log"></div>
        <details style="margin-top:8px"><summary class="small">Logique des séquences programmées</summary><div class="small" style="margin-top:6px">
        <b>Démarrage</b> : (1) ouverture registres AN / rejet, préchauffage batterie si T ext &lt; 10 °C ; (2) après fins de course, démarrage ventilateur sur rampe ; (3) débit &gt; 80 % consigne → activation des boucles T et HR.<br>
        <b>Arrêt normal</b> : fermeture vannes et humidificateur, décélération, fermeture des registres à l'arrêt ventilateur (vanne chaude maintenue entrouverte si T ext &lt; 5 °C).<br>
        <b>Régulation T</b> : cascade T salle → consigne de soufflage → split-range vanne froide / vanne chaude.<br>
        <b>Régulation HR</b> : humidification PI ; déshumidification par ouverture forcée de la vanne froide, la batterie chaude rattrape la température.<br>
        <b>Vitesse ventilateur</b> : boucle débit constant ; mode veille à débit réduit avec écart soufflage − reprise maintenu (surpression conservée).<br>
        <b>Colmatage</b> : alarme sur seuil ΔP. <b>Antigel</b> : T aval batterie &lt; 5 °C → arrêt ventilateur, fermeture AN, vanne chaude 100 %, réarmement manuel.<br>
        <b>Défaut ventilateur</b> : pressostat ventilateur sans ΔP alors que la commande est active. <b>Perte de pression bloc</b> : alarme P1 temporisée.</div></details></div></div></div>`;
      $('#g_sp').onchange = e => S.speed = +e.target.value;
      $('#g_start').onclick = () => S.cmd('start'); $('#g_stop').onclick = () => S.cmd('stop'); $('#g_occ').onclick = () => S.cmd('occ');
      $('#g_ack').onclick = () => S.cmd('ack'); $('#g_rst').onclick = () => S.cmd('reset'); $('#g_fil').onclick = () => S.cmd('filters');
      $('#g_re').onclick = () => { S.reinit(); window.FAULTUI && window.FAULTUI.refresh(); };
      const bind = (id, key, k = 1) => $('#' + id).onchange = e => { S.p[key] = +e.target.value * k; S.log(`Consigne modifiée : ${key} = ${e.target.value}`); };
      bind('c_spT', 'spT'); bind('c_spRH', 'spRH'); bind('c_spQ', 'spQocc'); bind('c_spQv', 'spQveille'); bind('c_dQ', 'dQ'); bind('c_aP', 'alarmP'); bind('c_aF', 'alarmDPf');
      bind('c_Te', 'Text'); bind('c_RHe', 'RHext'); bind('c_pp', 'people'); bind('c_ld', 'loadW'); bind('c_oa', 'oaMin');
      bind('c_kps', 'Kp_s'); bind('c_tis', 'Ti_s'); bind('c_kpr', 'Kp_r'); bind('c_tir', 'Ti_r'); bind('c_kpq', 'Kp_q'); bind('c_tiq', 'Ti_q'); bind('c_al', 'Aleak', 1e-4);
      $('#c_rec').onchange = e => { S.p.recirc = e.target.checked; S.log(e.target.checked ? 'Recyclage activé' : 'CTA en tout air neuf'); };
      let n = 0;
      S.listeners.push(() => {
        if (!root.offsetParent) return; n++;
        if (n % 2 === 0) { $('#g_syn').innerHTML = synoptic(); $('#g_kpi').innerHTML = kpis(['text', 'rhext', 'tm', 'tb', 'tc', 'tsm', 'tssp', 'troom', 'rh', 'proom', 'qs', 'qroom', 'qe', 'dpf', 'dpfan', 'speed', 'pw', 'oa', 'rec', 'vc', 'vcr', 'vhc', 'vh']); $('#g_al').innerHTML = alarmsHTML(); $('#g_log').innerHTML = S.x.log.join('<br>'); }
        if (n % 10 === 0) trends();
      });
    }
  };

  /* ---------------- Module de pannes ---------------- */
  let selF = 'filtre', mystery = null;
  window.FAULTUI = {
    init(root) {
      root.innerHTML = `<div class="grid fgrid">
        <div class="card"><h3>Injecter une anomalie</h3><p class="small muted">Cliquer pour sélectionner ; l'interrupteur active la panne dans la simulation (partagée avec la GTC et la vue 3D).</p><div id="f_list"></div>
        <div class="row" style="margin-top:8px"><button class="b sec" id="f_clear">Supprimer toutes les pannes</button><button class="b sec" id="f_re">Réinitialiser</button></div>
        <h3 style="margin-top:14px">Défi diagnostic</h3><p class="small muted">Une panne mystère est injectée : observez les mesures et alarmes, puis proposez un diagnostic.</p>
        <button class="b" id="f_myst">Lancer une panne mystère</button><div id="f_mq" style="margin-top:8px"></div></div>
        <div><div class="card"><div id="f_det"><p class="muted">Sélectionnez une panne.</p></div></div>
        <div class="card" style="margin-top:12px"><h3>Mesures en direct</h3><div class="res" id="f_kpi"></div><h4 style="margin-top:10px">Alarmes actives</h4><div class="alarms" id="f_al"></div></div></div></div>`;
      this.refresh();
      $('#f_clear').onclick = () => { Object.keys(S.faults).forEach(k => S.faults[k] = false); mystery = null; $('#f_mq').innerHTML = ''; this.refresh(); };
      $('#f_re').onclick = () => { S.reinit(); mystery = null; $('#f_mq').innerHTML = ''; this.refresh(); };
      $('#f_myst').onclick = () => {
        S.reinit(); if (Math.random() < 0.5) { S.p.Text = 2; S.p.RHext = 70; } else { S.p.Text = 32; S.p.RHext = 45; } S.warmup(2400);
        mystery = window.FAULTS[Math.floor(Math.random() * window.FAULTS.length)]; S.faults[mystery.id] = true; S.x.log = []; S.log('Panne mystère injectée — à vous de diagnostiquer');
        S.speed = 30;
        $('#f_mq').innerHTML = `<label class="f">Votre diagnostic<select id="f_guess">${window.FAULTS.map(F => `<option value="${F.id}">${F.nom}</option>`).join('')}</select></label><button class="b" id="f_chk" style="margin-top:6px">Valider</button><div id="f_res"></div><p class="small muted">Conditions : T ext ${S.p.Text} °C. Laissez la simulation tourner quelques minutes (vitesse ×30).</p>`;
        $('#f_chk').onclick = () => { const g = $('#f_guess').value, ok = g === mystery.id; $('#f_res').innerHTML = `<div class="note ${ok ? '' : 'r'}">${ok ? '✔ Bon diagnostic' : '✘ Ce n\'est pas cela'} — la panne était : <b>${mystery.nom}</b>. ${mystery.diag[0]}.</div>`; selF = mystery.id; this.refresh(); };
        this.refresh();
      };
      S.listeners.push(() => { if (!root.offsetParent) return; const F = window.FAULTS.find(x => x.id === selF); const keys = F ? Array.from(new Set([...F.keys, 'proom', 'qs', 'troom', 'rh'])) : ['proom', 'qs', 'troom', 'rh', 'dpf', 'speed', 'pw', 'tsm']; $('#f_kpi').innerHTML = kpis(mystery ? ['proom', 'qs', 'qe', 'troom', 'rh', 'tsm', 'tssp', 'dpf', 'dpfan', 'speed', 'pw', 'oa', 'vc', 'vcr', 'vh'] : keys); const al = Object.values(S.x.alarms).filter(a => a.active); $('#f_al').innerHTML = al.length ? al.map(a => `<div class="a act"><span class="p">P${a.prio}</span>${a.label}</div>`).join('') : '<div class="small muted">Aucune.</div>'; });
    },
    refresh() {
      $('#f_list').innerHTML = window.FAULTS.map((F, i) => `<div class="faultbtn ${S.faults[F.id] && !(mystery && mystery.id === F.id) ? 'on' : ''} ${selF === F.id ? 'sel' : ''}" data-id="${F.id}"><span>${i + 1}. ${F.nom}</span><input type="checkbox" ${S.faults[F.id] && !(mystery && mystery.id === F.id) ? 'checked' : ''} data-t="${F.id}"></div>`).join('');
      $('#f_list').querySelectorAll('.faultbtn').forEach(d => d.onclick = e => { if (e.target.tagName === 'INPUT') return; selF = d.dataset.id; this.refresh(); });
      $('#f_list').querySelectorAll('input').forEach(c => c.onchange = () => { S.setFault(c.dataset.t, c.checked); if (c.dataset.t === 'humid' && c.checked && S.p.Text > 15) S.log('Astuce : passez la T extérieure en hiver (ex. 2 °C) pour observer cette panne'); selF = c.dataset.t; this.refresh(); });
      const F = window.FAULTS.find(x => x.id === selF);
      if (F) $('#f_det').innerHTML = `<div class="row" style="justify-content:space-between"><h2>${F.nom}</h2><span class="badge ${F.crit === 'Critique' ? 'bad' : F.crit === 'Élevé' ? 'warn' : ''}">Criticité : ${F.crit}</span></div>
        <div class="grid g2"><div><h4>Symptômes</h4><ul>${F.sym.map(s => `<li>${s}</li>`).join('')}</ul><h4>Conséquences</h4><p>${F.cons}</p><h4>Impact sécurité et continuité</h4><p>${F.imp}</p></div>
        <div><h4>Méthode de diagnostic</h4><ol>${F.diag.map(s => `<li>${s}</li>`).join('')}</ol><h4>Actions correctives</h4><ol>${F.act.map(s => `<li>${s}</li>`).join('')}</ol></div></div>
        <div class="note w small">Toute intervention sur l'installation d'un bloc en activité suit la procédure de l'établissement (information du cadre de bloc et de l'équipe d'hygiène, décision sur la poursuite de l'activité, requalification si nécessaire).</div>`;
    }
  };
})();
