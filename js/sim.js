/* =========================================================
   sim.js — Moteur de simulation dynamique de la CTA et de la salle
   Modèle pédagogique à paramètres localisés (pas de CFD) :
   - ventilateur : courbe parabolique + lois de similitude, réseau ΔP = K·Q²
   - batteries : efficacité fonction de l'ouverture de vanne + inertie du 1er ordre
   - salle : bilans thermique, hydrique et de masse (fuites ∝ √ΔP)
   - régulation : boucles PI (débit, T salle → T soufflage, split-range, HR)
   ========================================================= */
(function () {
  const PH = window.PH;
  const lp = (x, target, tau, dt) => x + (target - x) * Math.min(1, dt / Math.max(tau, 1e-6));
  const ramp = (x, target, rate, dt) => x + PH.clamp(target - x, -rate * dt, rate * dt);

  let KREG = 25;
  const SIM = {
    speed: 10,
    p: {
      Text: 32, RHext: 45, spT: 21, spRH: 50, spQocc: 2600, spQveille: 1300, occupied: true, dQ: 550, recirc: false, oaMin: 30,
      people: 8, loadW: 2500, Qnom: 3000, Ptnom: 1200, dPfnom: 350, eta: 0.6, Aleak: 0.055, Vroom: 127,
      alarmDPf: 650, alarmP: 10, Tcw: 7, Thw: 60,
      Kp_s: 0.03, Ti_s: 90, Kp_r: 1.2, Ti_r: 900, Kp_q: 0.0003, Ti_q: 25, Kp_h: 0.04, Ti_h: 400
    },
    faults: {},
    listeners: [],
    hist: []
  };

  function freshState() {
    const w0 = PH.w(21, 50);
    return {
      t: 0, seq: 'marche', seqT: 0, sCmd: 0.85, s: 0.85, Q: 2600, Qm: 2600, Qroom: 2600, Qe: 2050,
      oaCmd: 1, oaPos: 1, recCmd: 0, recPos: 0, f: 1,
      TM: 25, wM: w0, TB: 12, wB: w0, TC: 17, wD: w0, TS: 18, TSm: 18, wS: w0,
      Tr: 21, wr: w0, RH: 50, proom: 15, vc: 0.8, vcCmd: 0.8, vh: 0.2, vhCmd: 0.2, vhum: 0, vhumCmd: 0,
      Ts_sp: 18, I_s: 0, I_r: 0, I_q: 0.85, I_h: 0, I_d: 0, dpf: 350, dpfan: 1200, pw: 1700, pexp: 1700, clog: 0,
      alarms: {}, timers: {}, log: [], osc: { last: 0, n: 0, win: [] }, gelLatched: false
    };
  }
  SIM.x = freshState();

  SIM.log = function (msg) {
    const t = SIM.x.t, hh = Math.floor(t / 3600), mm = Math.floor(t / 60) % 60, ss = Math.floor(t) % 60;
    SIM.x.log.unshift(`T+${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}  ${msg}`);
    if (SIM.x.log.length > 120) SIM.x.log.pop();
  };

  SIM.cmd = function (c) {
    const x = SIM.x;
    if (c === 'start' && (x.seq === 'arret')) { x.seq = 'demarrage'; x.seqT = 0; SIM.log('Ordre de marche reçu — séquence de démarrage'); SIM.log('Étape 1 : ouverture des registres air neuf / rejet'); }
    if (c === 'stop' && (x.seq === 'marche' || x.seq === 'demarrage')) { x.seq = 'arret_n'; x.seqT = 0; SIM.log('Ordre d\'arrêt — fermeture des vannes, décélération ventilateur'); }
    if (c === 'reset') {
      if (x.seq === 'antigel') { if (x.TC > 8 || SIM.p.Text > 5) { x.seq = 'arret'; x.gelLatched = false; SIM.log('Réarmement antigel accepté — CTA à l\'arrêt, prête à redémarrer'); } else SIM.log('Réarmement refusé : température batterie encore trop basse'); }
      for (const k in x.alarms) if (!x.alarms[k].active) delete x.alarms[k];
    }
    if (c === 'ack') for (const k in x.alarms) x.alarms[k].ack = true;
    if (c === 'filters') { x.clog = 0; SIM.faults.filtre = false; SIM.log('Remplacement des filtres effectué (ΔP revenue à l\'état initial)'); }
    if (c === 'occ') { SIM.p.occupied = !SIM.p.occupied; SIM.log(SIM.p.occupied ? 'Passage en mode OCCUPÉ (débit nominal)' : 'Passage en mode VEILLE (débit réduit, surpression maintenue par asservissement de la reprise)'); }
  };

  SIM.setFault = function (id, on) {
    SIM.faults[id] = on; SIM.log((on ? 'PANNE INJECTÉE : ' : 'Panne supprimée : ') + (window.FAULTS.find(f => f.id === id) || { nom: id }).nom);
  };

  function alarm(id, cond, delay, label, prio, dt) {
    const x = SIM.x; x.timers[id] = cond ? (x.timers[id] || 0) + dt : 0;
    const a = x.alarms[id];
    if (cond && x.timers[id] >= delay) {
      if (!a || !a.active) { x.alarms[id] = { label, prio, active: true, ack: false, since: x.t }; SIM.log('ALARME P' + prio + ' : ' + label); }
    } else if (a && a.active && !cond) { a.active = false; SIM.log('Fin d\'alarme : ' + label); }
  }

  SIM.step = function (dt) {
    const p = SIM.p, x = SIM.x, F = SIM.faults;
    x.t += dt; x.seqT += dt;
    const spQ = p.occupied ? p.spQocc : p.spQveille;
    const dQ = p.dQ; // écart soufflage − reprise maintenu en veille → surpression conservée
    const fd = p.recirc ? p.oaMin / 100 : 1;

    /* ---------- Séquences ---------- */
    let regul = false, fanEnable = false;
    switch (x.seq) {
      case 'arret': x.oaCmd = 0; x.recCmd = 0; x.sCmd = 0; x.vcCmd = 0; x.vhCmd = p.Text < 5 ? 0.3 : 0; x.vhumCmd = 0; break;
      case 'demarrage':
        x.oaCmd = 1; x.recCmd = p.recirc ? 1 : 0; x.vhCmd = p.Text < 10 ? 1 : 0; // préchauffage batterie avant démarrage
        if (x.seqT > 15) { fanEnable = true; if (x.seqT - dt <= 15) SIM.log('Étape 2 : registres ouverts (fins de course) — démarrage ventilateur sur rampe'); }
        if (x.seqT > 15 && x.Qm > 0.8 * spQ) { x.seq = 'marche'; SIM.log('Étape 3 : débit atteint — boucles de régulation T / HR activées'); }
        if (x.seqT > 180 && x.seq === 'demarrage') { x.seq = 'marche'; SIM.log('Démarrage : débit non atteint après 180 s — passage en régulation, vérifier les alarmes'); }
        break;
      case 'marche': x.oaCmd = 1; x.recCmd = p.recirc ? 1 : 0; fanEnable = true; regul = true; break;
      case 'arret_n':
        x.vcCmd = 0; x.vhCmd = p.Text < 5 ? 0.3 : 0; x.vhumCmd = 0; x.sCmd = 0;
        if (x.s < 0.02) { x.oaCmd = 0; x.recCmd = 0; if (x.oaPos < 0.05) { x.seq = 'arret'; SIM.log('CTA à l\'arrêt — registres fermés'); } }
        break;
      case 'antigel': x.oaCmd = 0; x.recCmd = 0; x.sCmd = 0; x.vhCmd = 1; x.vcCmd = 0; x.vhumCmd = 0; break;
    }

    /* ---------- Registres ---------- */
    x.oaPos = F.registre ? 0 : ramp(x.oaPos, x.oaCmd, 1 / 15, dt);
    x.recPos = ramp(x.recPos, x.recCmd, 1 / 15, dt);
    const openA = x.oaPos * fd, openR = x.recPos * (1 - fd);
    const open = p.recirc ? openA + openR : x.oaPos;
    x.f = p.recirc ? openA / Math.max(openA + openR, 1e-6) : 1;
    const Kmult = 1 / Math.pow(Math.max(open, 0.08), 2);

    /* ---------- Filtres ---------- */
    if (F.filtre) x.clog = Math.min(2.2, x.clog + 0.004 * dt); else x.clog += 1e-6 * dt;

    /* ---------- Ventilateur / réseau ---------- */
    const Kclean = p.Ptnom / (p.Qnom * p.Qnom);
    const K = (p.Ptnom + p.dPfnom * x.clog) / (p.Qnom * p.Qnom) * Kmult * (F.fuite ? 0.82 : 1);
    const P0 = 1.4 * p.Ptnom, a = 0.4 * p.Ptnom / (p.Qnom * p.Qnom);
    if (fanEnable) {
      if (regul || x.seq === 'demarrage') {
        const e = spQ - x.Qm;
        x.I_q = PH.clamp(x.I_q + p.Kp_q / p.Ti_q * e * dt, 0, 1.1);
        x.sCmd = PH.clamp(p.Kp_q * e + x.I_q, 0, 1.1);
        if (x.seq === 'demarrage') x.sCmd = Math.min(x.sCmd, 0.2 + (x.seqT - 15) * 0.02);
      }
    } else if (x.seq !== 'arret_n') { x.I_q = 0.3; }
    x.s = F.vev ? 0 : ramp(x.s, x.sCmd, 0.04, dt);          // rampe variateur ≈ 25 s pour 0→100 %
    const slip = F.courroie ? 0.72 : 1;
    const se = x.s * slip * (F.ventil ? 0 : 1);
    x.Q = se * Math.sqrt(P0 / (a + K)) * Math.sqrt(1);       // m³/h
    x.Qm = x.Q;                                               // mesure à l'ouïe (au ventilateur)
    x.dpfan = K * x.Q * x.Q;
    x.dpf = p.dPfnom * (1 + x.clog) * Math.pow(x.Q / p.Qnom, 2);
    const Pwheel = x.Q / 3600 * x.dpfan / p.eta;
    x.pw = F.ventil ? 0 : Pwheel / slip;
    const Q1 = x.s * Math.sqrt(P0 / (a + K)); x.pexp = Q1 / 3600 * K * Q1 * Q1 / p.eta;
    x.Qroom = x.Q * (F.fuite ? 0.8 : 1);
    x.Qe = (x.seq === 'marche' || x.seq === 'demarrage' || x.seq === 'arret_n') ? Math.max(0, x.Qm - dQ) : 0;

    /* ---------- Pression salle ---------- */
    const rho = PH.rho(x.Tr, x.wr);
    const A = p.Aleak * (F.surpression ? 7 : 1);
    const net = x.Qroom - x.Qe;
    const dp = Math.sign(net) * rho / 2 * Math.pow(Math.abs(net) / 3600 / (0.61 * A), 2);
    x.proom = lp(x.proom, dp, 3, dt);

    /* ---------- Traitement d'air ---------- */
    const wext = PH.w(p.Text, p.RHext);
    x.TM = x.f * p.Text + (1 - x.f) * x.Tr; x.wM = x.f * wext + (1 - x.f) * x.wr;

    /* Régulation température : T salle → consigne de soufflage → split-range */
    if (regul) {
      const er = p.spT - x.Tr;
      x.I_r = PH.clamp(x.I_r + p.Kp_r / p.Ti_r * er * dt, -8, 10);
      x.Ts_sp = PH.clamp(p.spT - 3.5 + p.Kp_r * er + x.I_r, 12, 32);
      const kp = F.regul ? p.Kp_s * KREG : p.Kp_s, ti = F.regul ? p.Ti_s / 6 : p.Ti_s;
      const es = x.Ts_sp - x.TSm;
      x.I_s = PH.clamp(x.I_s + kp / ti * es * dt, -1, 1);
      const u = PH.clamp(kp * es + x.I_s, -1, 1);
      const vcT = Math.max(0, -u); x.vhCmd = Math.max(0, u);
      /* Régulation hygrométrique */
      const eh = p.spRH - x.RH;
      x.I_h = PH.clamp(x.I_h + p.Kp_h / p.Ti_h * eh * dt, 0, 1);
      x.vhumCmd = eh > -2 ? PH.clamp(p.Kp_h * eh + x.I_h, 0, 1) : 0;
      const ed = x.RH - (p.spRH + 3);
      x.I_d = PH.clamp(x.I_d + 0.0004 * ed * dt, 0, 1);
      const d = PH.clamp(0.04 * ed + x.I_d, 0, 1);
      x.vcCmd = Math.max(vcT, d);
      /* détection de pompage : passages par zéro de l'erreur de soufflage avec amplitude > 0,8 K */
      const sg = Math.sign(es);
      if (Math.abs(es) > 0.8 && sg !== x.osc.last && x.osc.last !== 0) x.osc.win.push(x.t);
      if (Math.abs(es) > 0.8) x.osc.last = sg;
      x.osc.win = x.osc.win.filter(t => x.t - t < 600);
    }
    x.vc = F.vanne ? 0 : lp(x.vc, x.vcCmd, 15, dt);
    x.vh = lp(x.vh, x.vhCmd, 15, dt);
    x.vhum = lp(x.vhum, x.vhumCmd, 30, dt);
    const flowOK = x.Q > 150;
    const effc = 0.85 * (F.bf ? 0.3 : 1) * x.vc * (2 - x.vc);
    const TBt = flowOK ? x.TM - effc * (x.TM - p.Tcw) : x.TM;
    x.TB = lp(x.TB, TBt, 25, dt);
    x.wB = Math.min(x.wM, PH.w(x.TB, 95));
    const effh = 0.7 * x.vh * (2 - x.vh);
    const TCt = flowOK ? x.TB + effh * (p.Thw - x.TB) : x.TB + effh * 0.6 * (p.Thw - x.TB); // air stagnant réchauffé par la batterie
    x.TC = lp(x.TC, TCt, 25, dt);
    const dwmax = Math.min(0.012, 0.006 * p.Qnom / Math.max(x.Q, 300));
    x.wD = Math.min(x.wB + (F.humid ? 0 : x.vhum) * dwmax * (flowOK ? 1 : 0), PH.w(x.TC, 90));
    const dTfan = flowOK ? x.dpfan / (p.eta * rho * PH.CP_A) : 0;
    x.TS = x.TC + dTfan; x.wS = x.wD;
    x.TSm = lp(x.TSm, x.TS + (F.sonde ? 6 : 0) + (Math.random() - 0.5) * 0.06, 8, dt); // constante de temps sonde ≈ 8 s + bruit de mesure

    /* ---------- Antigel ---------- */
    if (x.TC < 5 && x.Q > 100 && x.seq !== 'antigel') { x.seq = 'antigel'; x.gelLatched = true; SIM.log('SÉCURITÉ ANTIGEL : T aval batterie < 5 °C — arrêt ventilateur, fermeture air neuf, vanne chaude 100 %'); }

    /* ---------- Salle ---------- */
    const m = rho * x.Qroom / 3600;
    const occ = p.occupied ? p.people : 0;
    const Ps = (p.occupied ? p.loadW : p.loadW * 0.15) + occ * 75;
    const gen = occ * 55 / 2.45e6;
    const C = p.Vroom * 1.2 * 1006 * 10;
    const Tn = 0.3 * p.Text + 0.7 * 24;
    x.Tr += dt * (m * PH.CP_A * (x.TS - x.Tr) + Ps + 150 * (Tn - x.Tr)) / C;
    x.wr += dt * (m * (x.wS - x.wr) + gen + 0.002 * (x.Qroom < 100 ? wext - x.wr : 0)) / (rho * p.Vroom);
    x.wr = Math.max(0.0005, x.wr);
    x.RH = PH.clamp(PH.rh(x.Tr, x.wr), 0, 100);

    /* ---------- Alarmes ---------- */
    const run = x.seq === 'marche';
    alarm('dpf', x.dpf > p.alarmDPf, 5, `Colmatage filtres : ΔP ${PH.f(x.dpf, 0)} Pa > seuil ${p.alarmDPf} Pa`, 2, dt);
    alarm('qlow', run && x.Qm < 0.85 * spQ, 20, 'Débit de soufflage bas (< 85 % consigne)', 1, dt);
    alarm('fan', run && x.s > 0.2 && x.dpfan < 50, 5, 'Défaut ventilateur : pressostat retombé (pas de ΔP)', 1, dt);
    alarm('vev', run && F.vev, 1, 'Défaut variateur : déclenchement surintensité (code OC)', 1, dt);
    alarm('gel', x.seq === 'antigel', 0, 'Protection antigel déclenchée — réarmement requis', 1, dt);
    alarm('plow', run && x.proom < p.alarmP, 10, `Surpression salle basse (< ${p.alarmP} Pa)`, 1, dt);
    alarm('tdev', run && Math.abs(x.Tr - p.spT) > 2, 60, 'Température salle hors plage (±2 K)', 3, dt);
    alarm('rhdev', run && Math.abs(x.RH - p.spRH) > 10, 60, 'Humidité salle hors plage (±10 % HR)', 3, dt);
    alarm('belt', run && x.s > 0.3 && x.pexp > 100 && x.pw / x.pexp < 0.7, 15, 'Puissance anormalement basse pour la fréquence : suspicion glissement courroie', 2, dt);
    alarm('valve', Math.abs(x.vcCmd - x.vc) > 0.25, 30, 'Discordance vanne BF : commande ≠ recopie de position', 2, dt);
    alarm('damper', Math.abs(x.oaCmd - x.oaPos) > 0.3, 25, 'Discordance registre air neuf : commande ≠ fin de course', 2, dt);
    alarm('hum', run && x.vhumCmd > 0.9 && x.RH < p.spRH - 8, 90, 'Défaut humidification : HR basse malgré commande 100 %', 2, dt);
    alarm('osc', run && x.osc.win.length >= 6, 0, 'Pompage détecté sur la boucle de température de soufflage', 3, dt);
  };

  SIM.snapshot = function () { const x = SIM.x; return { t: x.t, Tr: x.Tr, TS: x.TS, TSm: x.TSm, RH: x.RH, P: x.proom, Q: x.Qm, dpf: x.dpf, pw: x.pw, pwk: x.pw / 1000 }; };

  /* Préchauffage du modèle jusqu'au régime établi */
  SIM.warmup = function (sec) { for (let i = 0; i < sec / 0.5; i++) SIM.step(0.5); SIM.x.log = []; SIM.x.alarms = {}; SIM.x.timers = {}; SIM.hist = []; SIM.log('Simulation initialisée — CTA en marche, régime établi'); };

  let acc = 0;
  SIM.loop = function () {
    const simdt = SIM.speed * 0.1; const n = Math.ceil(simdt / 0.5);
    for (let i = 0; i < n; i++) SIM.step(simdt / n);
    acc += simdt;
    if (acc >= 5) { acc = 0; SIM.hist.push(SIM.snapshot()); if (SIM.hist.length > 360) SIM.hist.shift(); }
    SIM.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  };
  SIM.setKreg = k => KREG = k;
  SIM.reinit = function () { SIM.faults = {}; SIM.x = freshState(); SIM.warmup(3600); };
  window.SIM = SIM;
})();
