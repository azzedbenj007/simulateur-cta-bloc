/* =========================================================
   psychro.js — Diagramme psychrométrique (type Carrier) sur canvas
   Abscisse : température sèche (°C) ; ordonnée : humidité absolue (g/kg as)
   Courbes HR 10…100 %, droites d'enthalpie, zone de consigne optionnelle.
   ========================================================= */
(function () {
  const PH = window.PH;
  const PSY = {};
  /* draw(canvas, {points:[{T,w,label,color}], lines:[[i,j,color]], zone:{T1,T2,RH1,RH2}}) */
  PSY.draw = function (cv, opt = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 700, H = Math.round(W * 0.62);
    cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T0 = opt.T0 ?? -10, T1 = opt.T1 ?? 45, W1 = opt.W1 ?? 25;
    const m = { l: 44, r: 48, t: 14, b: 34 };
    const X = T => m.l + (T - T0) / (T1 - T0) * (W - m.l - m.r);
    const Y = w => H - m.b - (w * 1000) / W1 * (H - m.t - m.b);
    g.clearRect(0, 0, W, H);
    g.font = '10px Inter, sans-serif';
    /* grille T */
    for (let T = T0; T <= T1; T += 5) { g.strokeStyle = '#16294a'; g.beginPath(); g.moveTo(X(T), Y(0)); g.lineTo(X(T), m.t); g.stroke(); g.fillStyle = '#7d8fb0'; g.fillText(T, X(T) - 6, H - m.b + 14); }
    for (let w = 0; w <= W1; w += 5) { g.strokeStyle = '#16294a'; g.beginPath(); g.moveTo(X(T0), Y(w / 1000)); g.lineTo(W - m.r, Y(w / 1000)); g.stroke(); g.fillStyle = '#7d8fb0'; g.fillText(w, W - m.r + 6, Y(w / 1000) + 3); }
    g.fillStyle = '#93a6c8'; g.fillText('Température sèche (°C)', W / 2 - 50, H - 6);
    g.save(); g.translate(W - 8, H / 2 + 40); g.rotate(-Math.PI / 2); g.fillText('Humidité absolue w (g/kg air sec)', 0, 0); g.restore();
    /* enthalpie */
    g.setLineDash([3, 4]);
    for (let h = 0; h <= 110; h += 10) {
      g.strokeStyle = '#2a3f66'; g.beginPath(); let first = true;
      for (let T = T0; T <= T1; T += 0.5) { const w = (h - 1.006 * T) / (2501 + 1.86 * T); if (w < 0) continue; if (w > PH.w(T, 100)) continue; const px = X(T), py = Y(w); if (py < m.t) continue; first ? g.moveTo(px, py) : g.lineTo(px, py); first = false; }
      g.stroke();
      const Ts = (() => { let lo = -20, hi = 50; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; PH.h(mid, PH.w(mid, 100)) > h ? hi = mid : lo = mid; } return lo; })();
      if (Ts > T0 && Ts < T1 && PH.w(Ts, 100) * 1000 < W1) { g.fillStyle = '#4a6491'; g.fillText(h + ' kJ/kg', X(Ts) - 38, Y(PH.w(Ts, 100)) - 2); }
    }
    g.setLineDash([]);
    /* HR */
    for (let rh = 10; rh <= 100; rh += 10) {
      g.strokeStyle = rh === 100 ? '#52d1ff' : '#24508f'; g.lineWidth = rh === 100 ? 2 : 1; g.beginPath(); let first = true, lx = 0, ly = 0;
      for (let T = T0; T <= T1; T += 0.25) { const w = PH.w(T, rh); const py = Y(w); if (py < m.t) break; first ? g.moveTo(X(T), py) : g.lineTo(X(T), py); first = false; lx = X(T); ly = py; }
      g.stroke(); g.fillStyle = rh === 100 ? '#52d1ff' : '#4a77b8';
      { let Tl = Math.min(T1 - 6, 38); while (Tl > T0 && PH.w(Tl, rh) * 1000 > W1 * (0.9 - (100 - rh) * 0.004)) Tl -= 0.25; g.fillText(rh + '%', X(Tl) + 3, Y(PH.w(Tl, rh)) + 3); }
    }
    g.lineWidth = 1;
    /* zone de consigne */
    if (opt.zone) {
      const z = opt.zone; g.fillStyle = 'rgba(46,204,143,.12)'; g.strokeStyle = '#2ecc8f'; g.beginPath();
      g.moveTo(X(z.T1), Y(PH.w(z.T1, z.RH1))); g.lineTo(X(z.T2), Y(PH.w(z.T2, z.RH1))); g.lineTo(X(z.T2), Y(PH.w(z.T2, z.RH2))); g.lineTo(X(z.T1), Y(PH.w(z.T1, z.RH2))); g.closePath(); g.fill(); g.stroke();
    }
    /* transformations */
    (opt.lines || []).forEach(([i, j, c, dash]) => { const a = opt.points[i], b = opt.points[j]; if (!a || !b) return; g.strokeStyle = c || '#fff'; g.lineWidth = 2.2; g.setLineDash(dash ? [5, 4] : []); g.beginPath(); g.moveTo(X(a.T), Y(a.w)); g.lineTo(X(b.T), Y(b.w)); g.stroke(); arrowHead(g, X(a.T), Y(a.w), X(b.T), Y(b.w), c || '#fff'); });
    g.setLineDash([]); g.lineWidth = 1;
    (opt.points || []).forEach(p => { if (!p) return; g.fillStyle = p.color || '#fff'; g.beginPath(); g.arc(X(p.T), Y(p.w), 5, 0, 7); g.fill(); g.strokeStyle = '#0b1220'; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 11px Inter'; g.fillText(p.label, X(p.T) + 7, Y(p.w) - 6); g.font = '10px Inter'; });
    cv._map = { X, Y, T0, T1, W1, m, W, H };
  };
  function arrowHead(g, x1, y1, x2, y2, c) {
    const a = Math.atan2(y2 - y1, x2 - x1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    g.fillStyle = c; g.beginPath(); g.moveTo(mx + 7 * Math.cos(a), my + 7 * Math.sin(a)); g.lineTo(mx - 6 * Math.cos(a) + 4 * Math.sin(a), my - 6 * Math.sin(a) - 4 * Math.cos(a)); g.lineTo(mx - 6 * Math.cos(a) - 4 * Math.sin(a), my - 6 * Math.sin(a) + 4 * Math.cos(a)); g.fill();
  }
  /* Lecture interactive : renvoie l'état de l'air sous le curseur */
  PSY.readout = function (cv, out) {
    cv.addEventListener('mousemove', e => {
      const M = cv._map; if (!M) return; const r = cv.getBoundingClientRect(); const px = e.clientX - r.left, py = e.clientY - r.top;
      const T = M.T0 + (px - M.m.l) / (M.W - M.m.l - M.m.r) * (M.T1 - M.T0);
      const w = (M.H - M.m.b - py) / (M.H - M.m.t - M.m.b) * M.W1 / 1000;
      if (T < M.T0 || T > M.T1 || w < 0) { out.textContent = ''; return; }
      const rh = PH.rh(T, w);
      out.textContent = rh > 100 ? 'Zone de sursaturation (brouillard)' : `T = ${PH.f(T, 1)} °C · w = ${PH.f(w * 1000, 2)} g/kg · HR = ${PH.f(rh, 0)} % · h = ${PH.f(PH.h(T, w), 1)} kJ/kg · T rosée = ${PH.f(PH.tdew(PH.pv(w)), 1)} °C · T humide = ${PH.f(PH.twb(T, w), 1)} °C`;
    });
  };
  window.PSY = PSY;
})();
