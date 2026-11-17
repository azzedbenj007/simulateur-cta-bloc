/* =========================================================
   physics.js — Bibliothèque de calcul (psychrométrie, aéraulique)
   Toutes les fonctions sont en unités SI sauf mention contraire.
   ========================================================= */
(function () {
  const PH = {};
  PH.P_ATM = 101325;      // Pa — pression atmosphérique standard (niveau de la mer)
  PH.R_DA = 287.055;      // J/(kg·K) — constante de l'air sec
  PH.CP_A = 1006;         // J/(kg·K) — chaleur massique de l'air sec
  PH.CP_V = 1860;         // J/(kg·K) — chaleur massique de la vapeur d'eau
  PH.L0 = 2501e3;         // J/kg — chaleur latente de vaporisation à 0 °C
  PH.CP_W = 4186;         // J/(kg·K) — eau liquide
  PH.RHO_W = 1000;        // kg/m³ — eau liquide (approx.)

  /* Pression de vapeur saturante [Pa] — formule de Magnus (Alduchov & Eskridge 1996),
     valable -40…+50 °C sur eau liquide (écart < 0,4 % vs Hyland-Wexler). */
  PH.psat = T => 610.94 * Math.exp(17.625 * T / (T + 243.04));
  /* Inverse : température de rosée [°C] à partir de la pression partielle de vapeur [Pa] */
  PH.tdew = pv => { const a = Math.log(Math.max(pv, 1e-3) / 610.94); return 243.04 * a / (17.625 - a); };
  /* Humidité absolue w [kg/kg air sec] à partir de T [°C] et HR [%] */
  PH.w = (T, RH, p = PH.P_ATM) => { const pv = RH / 100 * PH.psat(T); return 0.621945 * pv / (p - pv); };
  /* Pression partielle de vapeur [Pa] à partir de w */
  PH.pv = (w, p = PH.P_ATM) => w * p / (0.621945 + w);
  /* Humidité relative [%] à partir de T et w */
  PH.rh = (T, w, p = PH.P_ATM) => 100 * PH.pv(w, p) / PH.psat(T);
  /* Enthalpie spécifique [kJ/kg air sec] */
  PH.h = (T, w) => 1.006 * T + w * (2501 + 1.86 * T);
  /* Température [°C] pour w et HR donnés (inverse Magnus) */
  PH.tFromWRH = (w, RH, p = PH.P_ATM) => PH.tdew(PH.pv(w, p) / (RH / 100));
  /* Masse volumique de l'air humide [kg/m³] */
  PH.rho = (T, w = 0.008, p = PH.P_ATM) => {
    const pv = PH.pv(w, p); return (p - pv) / (PH.R_DA * (T + 273.15)) + pv / (461.5 * (T + 273.15));
  };
  /* Température de bulbe humide (itération par bilan enthalpique adiabatique) */
  PH.twb = (T, w) => {
    let lo = -20, hi = T;
    const h0 = PH.h(T, w);
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; const ws = PH.w(m, 100); if (PH.h(m, ws) > h0) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  /* Viscosité cinématique de l'air [m²/s] (Sutherland + ρ) */
  PH.nu = (T = 20) => { const Tk = T + 273.15; const mu = 1.458e-6 * Math.pow(Tk, 1.5) / (Tk + 110.4); return mu / PH.rho(T, 0); };

  /* ---- Aéraulique ---- */
  /* Diamètre hydraulique d'une section rectangulaire a×b [m] : Dh = 4S/P = 2ab/(a+b) */
  PH.dh = (a, b) => 2 * a * b / (a + b);
  /* Diamètre équivalent (même perte de charge à même débit) — Huebscher : De = 1,30 (ab)^0,625/(a+b)^0,25 */
  PH.deq = (a, b) => 1.30 * Math.pow(a * b, 0.625) / Math.pow(a + b, 0.25);
  /* Coefficient de frottement λ — Haaland (approximation explicite de Colebrook, ±2 %) ; laminaire si Re<2300 */
  PH.lambda = (Re, eps, D) => {
    if (Re < 2300) return 64 / Math.max(Re, 1);
    const x = -1.8 * Math.log10(Math.pow(eps / D / 3.7, 1.11) + 6.9 / Re);
    return 1 / (x * x);
  };
  /* Darcy-Weisbach : ΔP = λ (L/Dh) ρ v²/2 */
  PH.darcy = (lambda, L, Dh, rho, v) => lambda * (L / Dh) * rho * v * v / 2;
  /* Pression dynamique ρ v²/2 */
  PH.pdyn = (rho, v) => rho * v * v / 2;

  /* ---- Conversions ---- */
  PH.m3h2s = q => q / 3600; PH.m3s2h = q => q * 3600; PH.m3h2ls = q => q / 3.6;

  /* ---- Formatage ---- */
  PH.f = (x, d = 1) => (x === null || x === undefined || !isFinite(x)) ? '—' : Number(x).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  PH.clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  window.PH = PH;
})();
