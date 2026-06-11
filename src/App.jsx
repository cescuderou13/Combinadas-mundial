import React, { useState, useEffect, useMemo } from "react";

/* ============================================================
   MUNDIAL 2026 · COMBINADAS & BOLA DE NIEVE
   - Fixture real fase de grupos (72 partidos)
   - Motor propio: Poisson + Elo dinámico + factores por país (córners/tarjetas/remates)
   - Combinadas multi-mercado por tramos ×1.5 / ×2 / ×5 / ×10 / ×100
   - Cuotas justas + campos Betano/Epicbet => detecta valor
   - Persistencia localStorage (sirve en Vercel)
   ============================================================ */

// ---------- Ratings base (estilo Elo, calibrados con cuotas WC2026) ----------
const BASE = {
  Spain: 2120, France: 2110, Argentina: 2080, Brazil: 2060, England: 2050, Portugal: 2030,
  Germany: 1980, Netherlands: 1970, Colombia: 1910, Belgium: 1900, Croatia: 1900, Uruguay: 1900,
  Morocco: 1890, Norway: 1880, Senegal: 1860, Switzerland: 1860, Japan: 1850, Mexico: 1820,
  Türkiye: 1820, Austria: 1820, "South Korea": 1810, USA: 1800, Ecuador: 1800, Iran: 1790,
  Czechia: 1780, Sweden: 1780, Egypt: 1780, "Ivory Coast": 1780, Scotland: 1760, Algeria: 1760,
  Paraguay: 1740, "Bosnia and Herzegovina": 1740, Australia: 1740, Ghana: 1730, "Congo DR": 1720,
  Tunisia: 1720, Canada: 1700, Uzbekistan: 1700, Qatar: 1690, "Saudi Arabia": 1690,
  "South Africa": 1680, Panama: 1680, Iraq: 1660, Jordan: 1640, "Cape Verde": 1640,
  "New Zealand": 1620, Curaçao: 1600, Haiti: 1600,
};
const HOSTS = new Set(["USA", "Mexico", "Canada"]);
const HOST_BOOST = 55;

// bases por equipo (para factores de stats)
const COR_TEAM = 5.0, CARD_TEAM = 1.9, SOT_TEAM = 4.1;

const ES = {
  Mexico: "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur", Czechia: "Chequia",
  Canada: "Canadá", "Bosnia and Herzegovina": "Bosnia", USA: "EE.UU.", Paraguay: "Paraguay",
  Haiti: "Haití", Scotland: "Escocia", Australia: "Australia", Türkiye: "Turquía", Brazil: "Brasil",
  Morocco: "Marruecos", Qatar: "Catar", Switzerland: "Suiza", "Ivory Coast": "Costa de Marfil",
  Ecuador: "Ecuador", Germany: "Alemania", Curaçao: "Curazao", Netherlands: "Países Bajos",
  Japan: "Japón", Sweden: "Suecia", Tunisia: "Túnez", "Saudi Arabia": "Arabia Saudita",
  Uruguay: "Uruguay", Spain: "España", "Cape Verde": "Cabo Verde", Iran: "Irán",
  "New Zealand": "Nueva Zelanda", Belgium: "Bélgica", Egypt: "Egipto", France: "Francia",
  Senegal: "Senegal", Iraq: "Irak", Norway: "Noruega", Argentina: "Argentina", Algeria: "Argelia",
  Austria: "Austria", Jordan: "Jordania", Ghana: "Ghana", Panama: "Panamá", England: "Inglaterra",
  Croatia: "Croacia", Portugal: "Portugal", "Congo DR": "RD Congo", Uzbekistan: "Uzbekistán",
  Colombia: "Colombia",
};
const FLAG = {
  Mexico: "🇲🇽", "South Africa": "🇿🇦", "South Korea": "🇰🇷", Czechia: "🇨🇿", Canada: "🇨🇦",
  "Bosnia and Herzegovina": "🇧🇦", USA: "🇺🇸", Paraguay: "🇵🇾", Haiti: "🇭🇹", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Australia: "🇦🇺", Türkiye: "🇹🇷", Brazil: "🇧🇷", Morocco: "🇲🇦", Qatar: "🇶🇦", Switzerland: "🇨🇭",
  "Ivory Coast": "🇨🇮", Ecuador: "🇪🇨", Germany: "🇩🇪", Curaçao: "🇨🇼", Netherlands: "🇳🇱", Japan: "🇯🇵",
  Sweden: "🇸🇪", Tunisia: "🇹🇳", "Saudi Arabia": "🇸🇦", Uruguay: "🇺🇾", Spain: "🇪🇸", "Cape Verde": "🇨🇻",
  Iran: "🇮🇷", "New Zealand": "🇳🇿", Belgium: "🇧🇪", Egypt: "🇪🇬", France: "🇫🇷", Senegal: "🇸🇳",
  Iraq: "🇮🇶", Norway: "🇳🇴", Argentina: "🇦🇷", Algeria: "🇩🇿", Austria: "🇦🇹", Jordan: "🇯🇴",
  Ghana: "🇬🇭", Panama: "🇵🇦", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Croatia: "🇭🇷", Portugal: "🇵🇹", "Congo DR": "🇨🇩",
  Uzbekistan: "🇺🇿", Colombia: "🇨🇴",
};
const es = (t) => ES[t] || t;

// ---------- Fixture real fase de grupos (72) ----------
const RAW = [
  [1, "2026-06-11", "A", "Mexico", "South Africa"], [2, "2026-06-11", "A", "South Korea", "Czechia"],
  [3, "2026-06-12", "B", "Canada", "Bosnia and Herzegovina"], [4, "2026-06-12", "D", "USA", "Paraguay"],
  [5, "2026-06-13", "C", "Haiti", "Scotland"], [6, "2026-06-13", "D", "Australia", "Türkiye"],
  [7, "2026-06-13", "C", "Brazil", "Morocco"], [8, "2026-06-13", "B", "Qatar", "Switzerland"],
  [9, "2026-06-14", "E", "Ivory Coast", "Ecuador"], [10, "2026-06-14", "E", "Germany", "Curaçao"],
  [11, "2026-06-14", "F", "Netherlands", "Japan"], [12, "2026-06-14", "F", "Sweden", "Tunisia"],
  [13, "2026-06-15", "H", "Saudi Arabia", "Uruguay"], [14, "2026-06-15", "H", "Spain", "Cape Verde"],
  [15, "2026-06-15", "G", "Iran", "New Zealand"], [16, "2026-06-15", "G", "Belgium", "Egypt"],
  [17, "2026-06-16", "I", "France", "Senegal"], [18, "2026-06-16", "I", "Iraq", "Norway"],
  [19, "2026-06-16", "J", "Argentina", "Algeria"], [20, "2026-06-16", "J", "Austria", "Jordan"],
  [21, "2026-06-17", "L", "Ghana", "Panama"], [22, "2026-06-17", "L", "England", "Croatia"],
  [23, "2026-06-17", "K", "Portugal", "Congo DR"], [24, "2026-06-17", "K", "Uzbekistan", "Colombia"],
  [25, "2026-06-18", "A", "Czechia", "South Africa"], [26, "2026-06-18", "B", "Switzerland", "Bosnia and Herzegovina"],
  [27, "2026-06-18", "B", "Canada", "Qatar"], [28, "2026-06-18", "A", "Mexico", "South Korea"],
  [29, "2026-06-19", "C", "Brazil", "Haiti"], [30, "2026-06-19", "C", "Scotland", "Morocco"],
  [31, "2026-06-19", "D", "Türkiye", "Paraguay"], [32, "2026-06-19", "D", "USA", "Australia"],
  [33, "2026-06-20", "E", "Germany", "Ivory Coast"], [34, "2026-06-20", "E", "Ecuador", "Curaçao"],
  [35, "2026-06-20", "F", "Netherlands", "Sweden"], [36, "2026-06-20", "F", "Tunisia", "Japan"],
  [37, "2026-06-21", "H", "Uruguay", "Cape Verde"], [38, "2026-06-21", "H", "Spain", "Saudi Arabia"],
  [39, "2026-06-21", "G", "Belgium", "Iran"], [40, "2026-06-21", "G", "New Zealand", "Egypt"],
  [41, "2026-06-22", "I", "Norway", "Senegal"], [42, "2026-06-22", "I", "France", "Iraq"],
  [43, "2026-06-22", "J", "Argentina", "Austria"], [44, "2026-06-22", "J", "Jordan", "Algeria"],
  [45, "2026-06-23", "L", "England", "Ghana"], [46, "2026-06-23", "L", "Panama", "Croatia"],
  [47, "2026-06-23", "K", "Portugal", "Uzbekistan"], [48, "2026-06-23", "K", "Colombia", "Congo DR"],
  [49, "2026-06-24", "C", "Scotland", "Brazil"], [50, "2026-06-24", "C", "Morocco", "Haiti"],
  [51, "2026-06-24", "B", "Switzerland", "Canada"], [52, "2026-06-24", "B", "Bosnia and Herzegovina", "Qatar"],
  [53, "2026-06-24", "A", "Czechia", "Mexico"], [54, "2026-06-24", "A", "South Africa", "South Korea"],
  [55, "2026-06-25", "E", "Curaçao", "Ivory Coast"], [56, "2026-06-25", "E", "Ecuador", "Germany"],
  [57, "2026-06-25", "F", "Japan", "Sweden"], [58, "2026-06-25", "F", "Tunisia", "Netherlands"],
  [59, "2026-06-25", "D", "Türkiye", "USA"], [60, "2026-06-25", "D", "Paraguay", "Australia"],
  [61, "2026-06-26", "I", "Norway", "France"], [62, "2026-06-26", "I", "Senegal", "Iraq"],
  [63, "2026-06-26", "G", "Egypt", "Iran"], [64, "2026-06-26", "G", "New Zealand", "Belgium"],
  [65, "2026-06-26", "H", "Cape Verde", "Saudi Arabia"], [66, "2026-06-26", "H", "Uruguay", "Spain"],
  [67, "2026-06-27", "L", "Panama", "England"], [68, "2026-06-27", "L", "Croatia", "Ghana"],
  [69, "2026-06-27", "J", "Algeria", "Austria"], [70, "2026-06-27", "J", "Jordan", "Argentina"],
  [71, "2026-06-27", "K", "Colombia", "Portugal"], [72, "2026-06-27", "K", "Congo DR", "Uzbekistan"],
];
const FIXTURES = RAW.map(([id, date, group, home, away]) => ({ id, date, group, home, away }));

const DAY_LABEL = (iso) => {
  const [, m, d] = iso.split("-");
  const meses = { "06": "JUN", "07": "JUL" };
  const dias = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
  const dt = new Date(iso + "T12:00:00");
  return `${dias[dt.getDay()]} ${parseInt(d, 10)} ${meses[m]}`;
};

// ---------- Matemática ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fact = (() => { const f = [1]; for (let i = 1; i <= 12; i++) f[i] = f[i - 1] * i; return f; })();
const pois = (k, l) => (Math.exp(-l) * Math.pow(l, k)) / fact[k];
const poisOver = (line, l) => { let cum = 0; const kmax = Math.floor(line); for (let k = 0; k <= kmax; k++) cum += pois(k, l); return 1 - cum; };
const fairOdds = (p) => (p <= 0.001 ? 999 : 1 / p);

function evalMatch(eh, ea, fx) {
  const we = 1 / (1 + Math.pow(10, (ea - eh) / 400));
  const muTotal = 2.62;
  const sup = (we - 0.5) * 4.8;
  let lh = clamp(muTotal / 2 + sup / 2, 0.18, 5);
  let la = clamp(muTotal / 2 - sup / 2, 0.18, 5);

  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const p = pois(i, lh) * pois(j, la);
    if (i > j) pHome += p; else if (i === j) pDraw += p; else pAway += p;
  }
  const s = pHome + pDraw + pAway; pHome /= s; pDraw /= s; pAway /= s;

  const lt = lh + la;
  const pOver25 = poisOver(2.5, lt);
  const pBTTS = (1 - Math.exp(-lh)) * (1 - Math.exp(-la));
  const closeness = 1 - Math.abs(we - 0.5) * 2;

  const muCorners = COR_TEAM * (fx.cH + fx.cA) * (1 + (1 - closeness) * 0.12);
  const muCards = CARD_TEAM * (fx.yH + fx.yA) * (1 + closeness * 0.18);
  const muSot = SOT_TEAM * (fx.sH + fx.sA) * (1 + (1 - closeness) * 0.10);

  return {
    we, lh, la, lt, pHome, pDraw, pAway, pOver25, pUnder25: 1 - pOver25, pBTTS,
    muCorners, pCornersOver: poisOver(9.5, muCorners),
    muCards, pCardsOver: poisOver(3.5, muCards),
    muSot, pSotOver: poisOver(7.5, muSot),
  };
}

// Replica resultados: Elo (goles) + factores por país (córners/tarjetas/remates)
function computeState(results) {
  const r = { ...BASE };
  const fc = {}, fy = {}, fs = {};
  for (const t in BASE) { fc[t] = 1; fy[t] = 1; fs[t] = 1; }
  const played = FIXTURES.filter((f) => results[f.id] && results[f.id].gh != null)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const upd = (F, team, val, base) => {
    if (val == null || val === "" || isNaN(val)) return;
    const exp = base * F[team];
    const ratio = (+val) / Math.max(0.5, exp);
    F[team] = clamp(F[team] * (1 + 0.30 * (ratio - 1)), 0.5, 1.8);
  };
  for (const f of played) {
    const res = results[f.id];
    const eh = r[f.home] + (HOSTS.has(f.home) ? HOST_BOOST : 0);
    const ea = r[f.away] + (HOSTS.has(f.away) ? HOST_BOOST : 0);
    const we = 1 / (1 + Math.pow(10, (ea - eh) / 400));
    const S = res.gh > res.ga ? 1 : res.gh === res.ga ? 0.5 : 0;
    const gd = Math.abs(res.gh - res.ga);
    const mult = gd <= 1 ? 1 : gd === 2 ? 1.5 : 1.75 + (gd - 3) / 8;
    const delta = 28 * mult * (S - we);
    r[f.home] += delta; r[f.away] -= delta;
    upd(fc, f.home, res.ch, COR_TEAM); upd(fc, f.away, res.ca, COR_TEAM);
    upd(fy, f.home, res.yh, CARD_TEAM); upd(fy, f.away, res.ya, CARD_TEAM);
    upd(fs, f.home, res.sh, SOT_TEAM); upd(fs, f.away, res.sa, SOT_TEAM);
  }
  return { r, fc, fy, fs };
}
const effR = (r, t) => r[t] + (HOSTS.has(t) ? HOST_BOOST : 0);

// elige la línea + lado más probable dentro de una banda útil, apuntando a ~target
function bestLine(mu, lines, target) {
  let best = null;
  const consider = (line, side, p) => {
    if (p < 0.55 || p > 0.9) return;
    const score = -Math.abs(p - target);
    if (!best || score > best.score) best = { line, side, p, score };
  };
  for (const L of lines) { const po = poisOver(L, mu); consider(L, "over", po); consider(L, "under", 1 - po); }
  if (!best) { // fallback: la prob más alta por debajo de 0.92
    for (const L of lines) {
      const po = poisOver(L, mu);
      [["over", po], ["under", 1 - po]].forEach(([s, p]) => { if (p <= 0.92 && (!best || p > best.p)) best = { line: L, side: s, p }; });
    }
  }
  return best;
}
// una selección por familia, con la LÍNEA más probable de cada partido (bet builder)
function famSel(m, f) {
  const sel = [];
  const push = (id, fam, emoji, label, p) => {
    const pp = clamp(p, 0.02, 0.985);
    sel.push({ id, fam, emoji, label, p: pp, fair: fairOdds(pp), mid: f.id, home: f.home, away: f.away, date: f.date });
  };
  const favHome = m.pHome >= m.pAway;
  const favName = favHome ? es(f.home) : es(f.away);
  const favP = favHome ? m.pHome : m.pAway;
  const favLam = favHome ? m.lh : m.la;

  // resultado: gana favorito si hay favorito claro, si no doble oportunidad
  if (favP >= 0.5) push("res", "res", "✅", `Gana ${favName}`, favP);
  else push("res", "res", "🛡️", favHome ? `${es(f.home)} o empate` : `Empate o ${es(f.away)}`, favP + m.pDraw);

  // goles totales (línea dinámica)
  const g = bestLine(m.lt, [1.5, 2.5, 3.5], 0.66);
  push("goals", "goals", g.side === "over" ? "🥅" : "🧱", `${g.side === "over" ? "Más" : "Menos"} de ${g.line} goles`, g.p);

  // ambos marcan
  if (m.pBTTS >= 0.5) push("btts", "btts", "⚽", "Ambos marcan", m.pBTTS);
  else push("btts", "btts", "🚫", "No ambos marcan", 1 - m.pBTTS);

  // el favorito marca / anota 2+
  const pScore = 1 - Math.exp(-favLam);
  const p2 = 1 - Math.exp(-favLam) - favLam * Math.exp(-favLam);
  if (p2 >= 0.52) push("tg", "tg", "🔥", `${favName} anota 2+`, p2);
  else push("tg", "tg", "⚽", `${favName} marca`, pScore);

  // córners / tarjetas / remates al arco (líneas dinámicas, distintas según el partido)
  const c = bestLine(m.muCorners, [7.5, 8.5, 9.5, 10.5, 11.5, 12.5], 0.72);
  push("cor", "cor", "🚩", `${c.side === "over" ? "Más" : "Menos"} de ${c.line} córners`, c.p);
  const k = bestLine(m.muCards, [2.5, 3.5, 4.5, 5.5], 0.7);
  push("card", "card", "🟨", `${k.side === "over" ? "Más" : "Menos"} de ${k.line} tarjetas`, k.p);
  const s = bestLine(m.muSot, [4.5, 5.5, 6.5, 7.5, 8.5, 9.5], 0.72);
  push("sot", "sot", "🎯", `${s.side === "over" ? "Más" : "Menos"} de ${s.line} remates al arco`, s.p);

  return sel;
}

// cuota efectiva: usa Betano/Epicbet si la cargaste, si no la cuota justa del modelo
function makeOddOf(odds) {
  return (s) => {
    const b = parseFloat(odds[`${s.mid}:${s.id}:bet`]);
    const e = parseFloat(odds[`${s.mid}:${s.id}:epic`]);
    if (b > 1) return { od: b, src: "B" };
    if (e > 1) return { od: e, src: "E" };
    return { od: s.fair, src: "" };
  };
}
// bet builder de un solo partido hasta el tramo
function sameGameCombo(sels, tier, oddOf) {
  const fams = [...sels].sort((a, b) => b.p - a.p);
  let od = 1, prob = 1; const legs = [];
  for (const s of fams) { const o = oddOf(s); legs.push({ ...s, od: o.od, src: o.src }); od *= o.od; prob *= s.p; if (od >= tier) break; }
  return { legs, od, prob, reached: od >= tier * 0.92 };
}
// combinada del día: mezcla mercados de los partidos de la fecha (máx 3 por partido)
function dayCombo(daySels, tier, oddOf) {
  const all = [...daySels].sort((a, b) => b.p - a.p);
  const per = {}; let od = 1, prob = 1; const legs = [];
  for (const s of all) {
    per[s.mid] = per[s.mid] || 0;
    if (per[s.mid] >= 3) continue;
    const o = oddOf(s); legs.push({ ...s, od: o.od, src: o.src }); per[s.mid]++; od *= o.od; prob *= s.p;
    if (od >= tier) break;
  }
  legs.sort((a, b) => a.mid - b.mid || b.p - a.p);
  return { legs, od, prob, reached: od >= tier * 0.92 };
}

// bola de nieve: por día, el ticket más SEGURO (single o doble del mismo partido) con cuota 1.6-1.9
function snowballPlan(daysSels, oddOf) {
  const plan = [];
  for (const { date, sels } of daysSels) {
    const tickets = [];
    for (const s of sels) tickets.push({ legs: [{ ...s, od: oddOf(s).od }], od: oddOf(s).od, p: s.p });
    const byMatch = {};
    sels.forEach((s) => { (byMatch[s.mid] = byMatch[s.mid] || []).push(s); });
    for (const mid in byMatch) {
      const arr = byMatch[mid];
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].p < 0.6 || arr[j].p < 0.6) continue; // dobles solo con patas seguras
        const od = oddOf(arr[i]).od * oddOf(arr[j]).od;
        tickets.push({ legs: [{ ...arr[i], od: oddOf(arr[i]).od }, { ...arr[j], od: oddOf(arr[j]).od }], od, p: arr[i].p * arr[j].p });
      }
    }
    const band = tickets.filter((t) => t.od >= 1.6 && t.od <= 1.9);
    const pick = band.length
      ? band.sort((a, b) => b.p - a.p)[0]
      : tickets.sort((a, b) => Math.abs(a.od - 1.75) - Math.abs(b.od - 1.75))[0];
    if (pick) plan.push({ date, pick });
  }
  return plan;
}

// ---------- store (localStorage; sirve en Vercel, degrada a memoria) ----------
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memoria */ } },
};

// ============================================================
export default function App() {
  const [tab, setTab] = useState("partidos");
  const [results, setResults] = useState({});
  const [odds, setOdds] = useState({});
  const [snow, setSnow] = useState({ banca: 5000, dias: {} });
  const [open, setOpen] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setResults(store.get("wc_results", {}));
    setOdds(store.get("wc_odds", {}));
    setSnow(store.get("wc_snow", { banca: 5000, dias: {} }));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) store.set("wc_results", results); }, [results, ready]);
  useEffect(() => { if (ready) store.set("wc_odds", odds); }, [odds, ready]);
  useEffect(() => { if (ready) store.set("wc_snow", snow); }, [snow, ready]);

  const state = useMemo(() => computeState(results), [results]);
  const models = useMemo(() => {
    const o = {};
    for (const f of FIXTURES) {
      o[f.id] = evalMatch(effR(state.r, f.home), effR(state.r, f.away), {
        cH: state.fc[f.home], cA: state.fc[f.away],
        yH: state.fy[f.home], yA: state.fy[f.away],
        sH: state.fs[f.home], sA: state.fs[f.away],
      });
    }
    return o;
  }, [state]);

  const isPlayed = (id) => results[id] && results[id].gh != null;
  const upcoming = FIXTURES.filter((f) => !isPlayed(f.id));

  const selections = useMemo(() => {
    const o = {};
    for (const f of FIXTURES) o[f.id] = famSel(models[f.id], f);
    return o;
  }, [models]);
  const oddOf = useMemo(() => makeOddOf(odds), [odds]);

  const saveResult = (id, obj) => setResults((p) => ({ ...p, [id]: obj }));
  const clearResult = (id) => setResults((p) => { const n = { ...p }; delete n[id]; return n; });

  return (
    <div className="wc">
      <style>{CSS}</style>
      <div className="bgglow" />
      <div className="wrap">
        <header className="hd">
          <div className="kick">⚽ USA · MÉXICO · CANADÁ · 11 JUN — 19 JUL</div>
          <h1 className="title">MUNDIAL <span>2026</span></h1>
          <p className="sub">Combinadas inteligentes, valor vs Betano/Epicbet y bola de nieve 🏔️</p>
        </header>

        <nav className="nav">
          {[["partidos", "⚽ Partidos"], ["resultados", "📝 Resultados"], ["combinadas", "🎯 Combinadas"], ["nieve", "🏔️ Bola de nieve"]]
            .map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </nav>

        {tab === "partidos" && <Partidos {...{ models, selections, results, odds, setOdds, open, setOpen, isPlayed }} />}
        {tab === "resultados" && <Resultados {...{ results, saveResult, clearResult }} />}
        {tab === "combinadas" && <Combinadas {...{ upcoming, selections, oddOf }} />}
        {tab === "nieve" && <Nieve {...{ upcoming, selections, oddOf, snow, setSnow }} />}

        <div className="disc">
          ⚠️ Probabilidades de un modelo propio (Poisson + Elo dinámico), <b>no</b> garantías. Las cuotas de
          Betano/Epicbet las cargas tú (sin API pública). La bola de nieve es de altísima varianza: una caída la
          deja en cero. Apuesta solo lo que puedas perder. 🎲
        </div>
      </div>
    </div>
  );
}

// ---------- PARTIDOS ----------
function Partidos({ models, selections, results, odds, setOdds, open, setOpen, isPlayed }) {
  const byDay = useMemo(() => {
    const g = {}; FIXTURES.forEach((f) => { (g[f.date] = g[f.date] || []).push(f); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);
  return (
    <div className="fade">
      {byDay.map(([date, list]) => (
        <section className="daygrp" key={date}>
          <div className="dayhd"><span className="dot" /><b>{DAY_LABEL(date)}</b><span className="ln" /></div>
          {list.map((f) => {
            const m = models[f.id], played = isPlayed(f.id), r = results[f.id];
            const best = [["1", m.pHome], ["X", m.pDraw], ["2", m.pAway]].sort((a, b) => b[1] - a[1])[0][0];
            const hw = played && r.gh > r.ga, aw = played && r.ga > r.gh;
            return (
              <div className="card" key={f.id}>
                <div className="row" onClick={() => setOpen(open === f.id ? null : f.id)}>
                  <div className="teams">
                    <div className={"tm" + (hw ? " win" : "")}><span className="fl">{FLAG[f.home]}</span>{es(f.home)}{hw && " ✓"}</div>
                    <div className={"tm" + (aw ? " win" : "")}><span className="fl">{FLAG[f.away]}</span>{es(f.away)}{aw && " ✓"}</div>
                    <div className="grp">GRUPO {f.group}</div>
                  </div>
                  {played ? (
                    <div className="scorebox">
                      <div className="score mono">{r.gh}<span className="vs">–</span>{r.ga}</div>
                      <div className="ptag">FINAL</div>
                    </div>
                  ) : (
                    <div className="probs">
                      {[["1", m.pHome], ["X", m.pDraw], ["2", m.pAway]].map(([k, p]) => (
                        <div key={k} className={"pill" + (best === k ? " top" : "")}>
                          <div className="pk">{k}</div><div className="pv mono">{Math.round(p * 100)}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {open === f.id && <MatchDetail {...{ f, m, sels: selections[f.id], odds, setOdds }} />}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
function MatchDetail({ f, m, sels, odds, setOdds }) {
  const key = (id, b) => `${f.id}:${id}:${b}`;
  const set = (id, b, v) => setOdds((p) => ({ ...p, [key(id, b)]: v }));
  const edge = (p, raw) => (raw && raw > 1 ? p * raw - 1 : null);
  const rows = [
    { id: "1", label: `Gana ${es(f.home)}`, p: m.pHome },
    { id: "X", label: "Empate", p: m.pDraw },
    { id: "2", label: `Gana ${es(f.away)}`, p: m.pAway },
    ...sels.filter((s) => s.id !== "res"),
    ...sels.filter((s) => s.id === "res"),
  ];
  return (
    <div className="det fade">
      <div className="mkthd"><span>Mercado (línea más probable)</span><span>Justa</span><span>Betano</span><span>Epicbet</span></div>
      {rows.map((s) => {
        const bt = parseFloat(odds[key(s.id, "bet")]), ep = parseFloat(odds[key(s.id, "epic")]);
        const eb = edge(s.p, bt), ee = edge(s.p, ep);
        return (
          <div className="mkt" key={s.id}>
            <span className="mn">{s.emoji ? s.emoji + " " : ""}{s.label} <b className="mp">{Math.round(s.p * 100)}%</b></span>
            <span className="mf mono">{fairOdds(s.p).toFixed(2)}</span>
            <input className={"mono" + (eb > 0 ? " val" : "")} placeholder="–" value={odds[key(s.id, "bet")] || ""} onChange={(e) => set(s.id, "bet", e.target.value)} />
            <input className={"mono" + (ee > 0 ? " val" : "")} placeholder="–" value={odds[key(s.id, "epic")] || ""} onChange={(e) => set(s.id, "epic", e.target.value)} />
          </div>
        );
      })}
      <div className="est">
        <span className="e">🥅 {m.lt.toFixed(2)} goles</span>
        <span className="e">🚩 {m.muCorners.toFixed(1)} córners</span>
        <span className="e">🟨 {m.muCards.toFixed(1)} tarjetas</span>
        <span className="e">🎯 {m.muSot.toFixed(1)} al arco</span>
      </div>
      <div className="note">Verde = la casa paga más que la cuota justa → hay <b>valor</b>. Lo que cargues acá se usa en las Combinadas y la Bola de nieve.</div>
    </div>
  );
}

// ---------- RESULTADOS (con stats) ----------
function Resultados({ results, saveResult, clearResult }) {
  const sorted = [...FIXTURES].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const done = sorted.filter((f) => results[f.id] && results[f.id].gh != null).length;
  return (
    <div className="fade">
      <p className="sub mb">Carga el marcador (obligatorio) y, si quieres, córners / tarjetas / remates al arco por país.
        El modelo reajusta solo las probabilidades de cada selección. {done}/72 cargados.</p>
      {sorted.map((f) => <ResRow key={f.id} {...{ f, r: results[f.id], saveResult, clearResult }} />)}
    </div>
  );
}
function ResRow({ f, r, saveResult, clearResult }) {
  const [s, setS] = useState({ gh: "", ga: "", ch: "", ca: "", yh: "", ya: "", sh: "", sa: "" });
  const [exp, setExp] = useState(false);
  useEffect(() => {
    if (r) setS({ gh: str(r.gh), ga: str(r.ga), ch: str(r.ch), ca: str(r.ca), yh: str(r.yh), ya: str(r.ya), sh: str(r.sh), sa: str(r.sa) });
    else setS({ gh: "", ga: "", ch: "", ca: "", yh: "", ya: "", sh: "", sa: "" });
  }, [r]);
  const num = (v) => (v === "" ? "" : v.replace(/\D/g, ""));
  const upd = (k, v) => setS((p) => ({ ...p, [k]: num(v) }));
  const save = () => {
    const o = { gh: +s.gh, ga: +s.ga };
    [["ch", "ca"], ["yh", "ya"], ["sh", "sa"]].flat().forEach((k) => { if (s[k] !== "") o[k] = +s[k]; });
    saveResult(f.id, o);
  };
  const hasStats = r && (r.ch != null || r.yh != null || r.sh != null);
  return (
    <div className="card">
      <div className="row resrow">
        <div className="teams">
          <div className="tm"><span className="fl">{FLAG[f.home]}</span>{es(f.home)}</div>
          <div className="tm"><span className="fl">{FLAG[f.away]}</span>{es(f.away)}</div>
          <div className="grp">{DAY_LABEL(f.date)} · G{f.group}</div>
        </div>
        <div className="resin">
          <input className="mono big" value={s.gh} inputMode="numeric" placeholder="–" onChange={(e) => upd("gh", e.target.value)} />
          <span className="vs2">:</span>
          <input className="mono big" value={s.ga} inputMode="numeric" placeholder="–" onChange={(e) => upd("ga", e.target.value)} />
          <button className={"chip" + (exp || hasStats ? " chipon" : "")} onClick={() => setExp(!exp)}>＋📊</button>
        </div>
      </div>
      {(exp || (r && hasStats)) && (
        <div className="statsbox fade">
          <StatRow icon="🚩" label="Córners" a={s.ch} b={s.ca} oa={(v) => upd("ch", v)} ob={(v) => upd("ca", v)} />
          <StatRow icon="🟨" label="Tarjetas" a={s.yh} b={s.ya} oa={(v) => upd("yh", v)} ob={(v) => upd("ya", v)} />
          <StatRow icon="🎯" label="Al arco" a={s.sh} b={s.sa} oa={(v) => upd("sh", v)} ob={(v) => upd("sa", v)} />
        </div>
      )}
      <div className="resact">
        {r ? <button className="btn red" onClick={() => clearResult(f.id)}>Borrar</button>
          : <span />}
        <button className="btn" disabled={s.gh === "" || s.ga === ""} onClick={save}>{r ? "Actualizar" : "Guardar"}</button>
      </div>
    </div>
  );
}
function StatRow({ icon, label, a, b, oa, ob }) {
  return (
    <div className="statrow">
      <span className="stl">{icon} {label}</span>
      <input className="mono sm" value={a} inputMode="numeric" placeholder="–" onChange={(e) => oa(e.target.value)} />
      <input className="mono sm" value={b} inputMode="numeric" placeholder="–" onChange={(e) => ob(e.target.value)} />
    </div>
  );
}
const str = (v) => (v == null ? "" : String(v));

// ---------- COMBINADAS ----------
const TIERS = [[1.5, "×1.5"], [2, "×2"], [5, "×5"], [10, "×10"], [100, "×100"]];
function Combinadas({ upcoming, selections, oddOf }) {
  const [tier, setTier] = useState(2);
  const [mode, setMode] = useState("dia");
  const byDay = useMemo(() => {
    const g = {}; upcoming.forEach((f) => { (g[f.date] = g[f.date] || []).push(f); });
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcoming]);
  if (!upcoming.length) return <div className="empty">🏆 No quedan partidos por jugar.</div>;

  const partidoCards = [];
  if (mode === "partido") {
    byDay.forEach(([date, list]) => list.forEach((f) => {
      const c = sameGameCombo(selections[f.id], tier, oddOf);
      if (c.reached) partidoCards.push({ f, c, date });
    }));
  }
  const tag = (l) => (l.src ? <sup className="src">{l.src}</sup> : null);

  return (
    <div className="fade">
      <div className="seg">
        {TIERS.map(([t, l]) => <button key={t} className={tier === t ? "on" : ""} onClick={() => setTier(t)}>{l}</button>)}
      </div>
      <div className="modes">
        <button className={mode === "dia" ? "on" : ""} onClick={() => setMode("dia")}>📅 Del día</button>
        <button className={mode === "partido" ? "on" : ""} onClick={() => setMode("partido")}>🏟️ Por partido</button>
      </div>
      <p className="sub mb">
        {mode === "dia"
          ? "Bet builder del día: mezcla las mejores selecciones (resultado, goles, córners, tarjetas, remates) de los partidos de una misma fecha hasta llegar al tramo."
          : "Bet builder de un partido: combina varios mercados del mismo encuentro, como “Crea tu apuesta” de Betano."}
      </p>

      {mode === "dia" && byDay.map(([date, list]) => {
        const daySels = list.flatMap((f) => selections[f.id]);
        const c = dayCombo(daySels, tier, oddOf);
        return (
          <div className="combo" key={date}>
            <div className="combohd">
              <div className="tt">📅 {DAY_LABEL(date)} · {c.legs.length} picks</div>
              <div className={"od mono" + (c.reached ? "" : " warn")}>×{c.od.toFixed(2)}</div>
            </div>
            {c.legs.map((l, i) => (
              <div className="leg" key={i}>
                <span className="lg-m"><span className="lg-fl">{FLAG[l.home]}{FLAG[l.away]}</span> {es(l.home)}–{es(l.away)}</span>
                <span className="lg-p">{l.emoji} {l.label} <span className="lg-o mono">{l.od.toFixed(2)}{tag(l)}</span></span>
              </div>
            ))}
            <div className="combofo">
              <span>{c.reached
                ? <>Prob. ≈ <b>{(c.prob * 100).toFixed(c.prob < 0.1 ? 1 : 0)}%</b></>
                : <b className="warn">tope del día ×{c.od.toFixed(2)}</b>}</span>
              <span>$10.000 → <b className="gold">${Math.round(10000 * c.od).toLocaleString("es-CL")}</b></span>
            </div>
          </div>
        );
      })}

      {mode === "partido" && !partidoCards.length &&
        <div className="empty">Ningún partido llega a ×{tier} por sí solo. Para tramos altos usa “Del día”.</div>}
      {mode === "partido" && partidoCards.slice(0, 30).map(({ f, c, date }) => (
        <div className="combo" key={f.id}>
          <div className="combohd">
            <div className="tt"><span className="lg-fl">{FLAG[f.home]}{FLAG[f.away]}</span> {es(f.home)}–{es(f.away)} <span className="lg-d">· {DAY_LABEL(date)}</span></div>
            <div className="od mono">×{c.od.toFixed(2)}</div>
          </div>
          {c.legs.map((l, i) => (
            <div className="leg" key={i}>
              <span className="lg-m">{l.emoji} {l.label}</span>
              <span className="lg-o mono">{l.od.toFixed(2)}{tag(l)} · {Math.round(l.p * 100)}%</span>
            </div>
          ))}
          <div className="combofo">
            <span>Prob. ≈ <b>{(c.prob * 100).toFixed(c.prob < 0.1 ? 1 : 0)}%</b></span>
            <span>$10.000 → <b className="gold">${Math.round(10000 * c.od).toLocaleString("es-CL")}</b></span>
          </div>
        </div>
      ))}

      <div className="note">⚠️ <b>B</b>/<b>E</b> = usando tu cuota de Betano/Epicbet; sin etiqueta = cuota justa del modelo. En un mismo partido los mercados están correlacionados: Betano suele pagar algo menos.</div>
    </div>
  );
}

// ---------- BOLA DE NIEVE ----------
function Nieve({ upcoming, selections, oddOf, snow, setSnow }) {
  const plan = useMemo(() => {
    const byDay = {};
    upcoming.forEach((f) => { (byDay[f.date] = byDay[f.date] || []).push(f); });
    const days = Object.keys(byDay).sort().map((date) => ({ date, sels: byDay[date].flatMap((f) => selections[f.id]) }));
    return snowballPlan(days, oddOf);
  }, [upcoming, selections, oddOf]);
  const setDay = (d, v) => setSnow((p) => ({ ...p, dias: { ...p.dias, [d]: p.dias[d] === v ? undefined : v } }));
  const reset = () => setSnow({ banca: 5000, dias: {} });
  let proj = snow.banca;
  return (
    <div className="fade">
      <div className="bank">
        <div className="lab">🏔️ BANCA ACTUAL</div>
        <div className="v mono">${Math.round(snow.banca).toLocaleString("es-CL")}</div>
        <div className="ed">
          <input className="mono" value={snow.banca} onChange={(e) => setSnow((p) => ({ ...p, banca: parseFloat(e.target.value.replace(/[^\d.]/g, "")) || 0 }))} />
          <button className="btn ghost" onClick={reset}>Reiniciar a 5.000</button>
        </div>
      </div>
      <p className="sub mb">Un ticket por día (cuota 1.6–1.9, el más seguro): puede ser una sola apuesta o dos del mismo
        partido. Marca Ganó/Perdió y la banca rueda sola apostándose completa.</p>
      {!plan.length && <div className="empty">🏆 No quedan partidos por jugar.</div>}
      {plan.map(({ date, pick }) => {
        const res = snow.dias[date];
        const stake = proj, ret = stake * pick.od;
        const after = res === "loss" ? 0 : ret;
        const l0 = pick.legs[0];
        const node = (
          <div className="sn" key={date}>
            <div className="d">{DAY_LABEL(date)}</div>
            <div className="snpick">{FLAG[l0.home]}{FLAG[l0.away]} {es(l0.home)}–{es(l0.away)}
              <span className="o mono">@ {pick.od.toFixed(2)}</span></div>
            <div className="snlegs">{pick.legs.map((l, i) => <span key={i} className="snleg">{l.emoji} {l.label}</span>)}</div>
            <div className="snproj mono">Apuesta ${Math.round(stake).toLocaleString("es-CL")} → si gana ${Math.round(ret).toLocaleString("es-CL")} · prob ≈ {Math.round(pick.p * 100)}%</div>
            <div className="snbtns">
              <button className={res === "win" ? "won" : "w"} onClick={() => setDay(date, "win")}>✅ Ganó</button>
              <button className={res === "loss" ? "lost" : "l"} onClick={() => setDay(date, "loss")}>❌ Perdió</button>
            </div>
          </div>
        );
        proj = after; return node;
      })}
      {plan.length > 0 && (
        <div className="combo" style={{ marginTop: 6 }}>
          <div className="combohd"><div className="tt">🟢 Si todo cae</div><div className="od mono">${Math.round(proj).toLocaleString("es-CL")}</div></div>
          <div className="note">Banca al dejarla rodar los {plan.length} días del plan asumiendo que cada ticket gana. Una sola caída = $0; conviene retirar por tramos.</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
.wc{--bg1:#0b0a1f;--bg2:#161334;--panel:#1b1838;--panel2:#15122e;--line:#322d5e;
  --cyan:#2bd9ff;--pink:#ff3d8b;--gold:#ffcb45;--turf:#25e08a;--red:#ff5470;
  --txt:#f3f1ff;--mut:#9d9ad0;--mut2:#6f6ca0;
  font-family:Archivo,system-ui,sans-serif;color:var(--txt);min-height:100vh;position:relative;
  background:linear-gradient(180deg,var(--bg1),var(--bg2) 60%,var(--bg1));overflow-x:hidden}
.bgglow{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(600px 380px at 12% -5%,rgba(255,61,139,.20),transparent 60%),
  radial-gradient(620px 400px at 92% 2%,rgba(43,217,255,.18),transparent 60%),
  radial-gradient(500px 500px at 50% 110%,rgba(255,203,69,.10),transparent 60%)}
.mono{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:880px;margin:0 auto;padding:0 16px 50px;position:relative;z-index:1}
.fade{animation:fade .35s ease}@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.hd{padding:30px 0 16px}
.kick{font-size:11px;letter-spacing:.22em;color:var(--cyan);font-weight:800}
.title{font-family:Anton,sans-serif;font-size:58px;letter-spacing:.01em;line-height:.92;margin:8px 0 6px;
  background:linear-gradient(100deg,var(--cyan),var(--pink) 55%,var(--gold));-webkit-background-clip:text;
  background-clip:text;color:transparent;filter:drop-shadow(0 4px 20px rgba(255,61,139,.25))}
.title span{display:inline-block}
.sub{color:var(--mut);font-size:14px;line-height:1.5}
.mb{margin-bottom:14px}
.nav{position:sticky;top:0;z-index:5;display:flex;gap:6px;padding:12px 0;overflow-x:auto;
  background:linear-gradient(var(--bg1),var(--bg1) 65%,transparent)}
.nav button{flex:0 0 auto;background:var(--panel);border:1px solid var(--line);color:var(--mut);
  padding:10px 15px;border-radius:999px;font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;
  white-space:nowrap;transition:.18s}
.nav button.on{background:linear-gradient(100deg,var(--pink),var(--cyan));color:#0b0a1f;border-color:transparent;
  box-shadow:0 6px 18px rgba(255,61,139,.3)}
.nav button:hover:not(.on){color:var(--txt);border-color:var(--pink)}
.daygrp{margin-bottom:24px}
.dayhd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.dayhd .dot{width:8px;height:8px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold)}
.dayhd b{font-family:Anton,sans-serif;font-size:15px;letter-spacing:.08em;color:var(--gold)}
.dayhd .ln{flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;margin-bottom:9px;overflow:hidden;
  transition:.18s}
.card:hover{border-color:#46407e}
.row{display:grid;grid-template-columns:1fr auto;gap:12px;padding:13px 15px;cursor:pointer;align-items:center}
.teams{min-width:0}
.tm{display:flex;align-items:center;gap:9px;font-weight:700;font-size:15.5px;line-height:1.55}
.tm .fl{font-size:21px;width:28px;text-align:center;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
.tm.win{color:var(--turf);font-weight:800}
.grp{font-size:10px;color:var(--mut2);letter-spacing:.12em;margin-top:3px;font-weight:700}
.probs{display:flex;gap:6px}
.pill{min-width:54px;text-align:center;border-radius:11px;padding:7px 5px;background:var(--panel2);border:1px solid var(--line)}
.pill .pk{font-size:9px;color:var(--mut);letter-spacing:.1em;font-weight:700}
.pill .pv{font-size:15px;font-weight:800}
.pill.top{border-color:var(--cyan);background:rgba(43,217,255,.12)}
.pill.top .pv{color:var(--cyan)}
.scorebox{text-align:right}
.score{font-family:Anton,sans-serif;font-size:24px}.score .vs{color:var(--mut2);margin:0 7px;font-size:16px}
.ptag{font-size:9px;color:var(--gold);letter-spacing:.14em;font-weight:800}
.det{border-top:1px solid var(--line);padding:14px;background:var(--panel2)}
.mkthd{display:grid;grid-template-columns:1.5fr .7fr .8fr .8fr;gap:8px;padding:0 9px 5px;font-size:10px;
  color:var(--mut2);letter-spacing:.08em;font-weight:800}
.mkt{display:grid;grid-template-columns:1.5fr .7fr .8fr .8fr;gap:8px;align-items:center;padding:8px 9px;
  background:var(--panel);border:1px solid var(--line);border-radius:10px;font-size:13px;margin-bottom:6px}
.mkt .mn{color:var(--mut)}.mkt .mp{color:var(--turf);font-weight:800;margin-left:4px}
.mkt .mf{color:var(--gold);font-weight:800}
.mkt input{width:100%;background:var(--bg1);border:1px solid var(--line);color:var(--txt);border-radius:7px;
  padding:6px;font-size:12px;text-align:center}
.mkt input.val{border-color:var(--turf);box-shadow:0 0 0 1px var(--turf);color:var(--turf)}
.est{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}
.est .e{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:6px 11px;font-size:12.5px;font-weight:700}
.note{font-size:11px;color:var(--mut2);margin-top:9px}
.resrow{cursor:default}
.resin{display:flex;gap:7px;align-items:center}
.resin input.big{width:44px;text-align:center;background:var(--bg1);border:1px solid var(--line);color:var(--txt);
  border-radius:9px;padding:9px 0;font-weight:800;font-size:16px}
.vs2{color:var(--mut);font-weight:800}
.chip{background:var(--panel2);border:1px solid var(--line);color:var(--mut);border-radius:9px;padding:9px 8px;
  cursor:pointer;font-family:inherit;font-weight:700;font-size:13px}
.chip.chipon{border-color:var(--cyan);color:var(--cyan)}
.statsbox{border-top:1px solid var(--line);padding:11px 15px;background:var(--panel2);display:flex;flex-direction:column;gap:7px}
.statrow{display:grid;grid-template-columns:1fr 56px 56px;gap:8px;align-items:center;font-size:13px;font-weight:700}
.statrow .stl{color:var(--mut)}
.statrow input.sm{width:100%;text-align:center;background:var(--bg1);border:1px solid var(--line);color:var(--txt);
  border-radius:7px;padding:6px 0;font-size:13px}
.resact{display:flex;justify-content:space-between;gap:8px;padding:0 15px 13px}
.btn{background:linear-gradient(100deg,var(--turf),var(--cyan));color:#06231a;border:none;border-radius:10px;
  padding:9px 16px;font-family:inherit;font-weight:800;cursor:pointer;font-size:13px}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--mut)}
.btn.red{background:transparent;border:1px solid var(--red);color:var(--red)}
.seg{display:flex;gap:6px;margin-bottom:14px;overflow-x:auto}
.seg button{flex:1;min-width:62px;background:var(--panel);border:1px solid var(--line);color:var(--mut);padding:11px 6px;
  border-radius:11px;font-family:Anton,sans-serif;letter-spacing:.05em;font-size:16px;cursor:pointer}
.seg button.on{background:linear-gradient(120deg,var(--gold),var(--pink));color:#1a0d20;border-color:transparent;
  box-shadow:0 6px 16px rgba(255,203,69,.25)}
.modes{display:flex;gap:6px;margin-bottom:13px}
.modes button{flex:1;background:var(--panel);border:1px solid var(--line);color:var(--mut);padding:10px;border-radius:11px;
  font-family:inherit;font-weight:800;cursor:pointer;font-size:13.5px}
.modes button.on{background:rgba(43,217,255,.12);border-color:var(--cyan);color:var(--cyan)}
.warn{color:var(--red)!important}
.combo{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:15px;margin-bottom:11px}
.combohd{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px}
.combohd .tt{font-weight:800;font-size:14.5px}
.combohd .od{font-family:Anton,sans-serif;font-size:26px;color:var(--gold)}
.leg{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px dashed var(--line);font-size:13px;align-items:center}
.leg:first-of-type{border-top:none}
.lg-fl{font-size:15px;margin-right:3px}
.lg-d{color:var(--mut2);font-size:11px}
.lg-p{font-weight:700;text-align:right;flex:0 0 auto}
.lg-o{color:var(--turf);margin-left:6px}
.combofo{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:8px;padding-top:9px;font-size:12.5px;color:var(--mut)}
.gold{color:var(--gold);font-weight:800}
.bank{background:linear-gradient(135deg,rgba(255,203,69,.16),rgba(255,61,139,.10));border:1px solid var(--line);
  border-radius:20px;padding:22px;margin-bottom:16px;text-align:center}
.bank .lab{font-size:11px;letter-spacing:.22em;color:var(--mut);font-weight:800}
.bank .v{font-family:Anton,sans-serif;font-size:46px;color:var(--gold);line-height:1.05;
  filter:drop-shadow(0 3px 14px rgba(255,203,69,.3))}
.bank .ed{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.bank .ed input{width:120px;text-align:center;background:var(--bg1);border:1px solid var(--line);color:var(--txt);
  border-radius:9px;padding:9px;font-weight:700}
.sn{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:9px}
.sn .d{font-family:Anton,sans-serif;font-size:13px;letter-spacing:.06em;color:var(--gold)}
.snpick{font-weight:800;font-size:15px;margin-top:5px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.snpick .o{color:var(--cyan);font-weight:700;font-size:13px}
.snproj{font-size:12px;color:var(--mut);margin-top:6px}
.snlegs{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
.snleg{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:5px 9px;font-size:12.5px;font-weight:700}
.src{font-size:9px;color:var(--gold);font-weight:800;margin-left:1px;vertical-align:super}
.snbtns{display:flex;gap:7px;margin-top:9px}
.snbtns button{flex:1;padding:9px;border-radius:9px;border:1px solid var(--line);background:var(--bg1);color:var(--mut);
  font-family:inherit;font-weight:800;cursor:pointer;font-size:13px}
.snbtns button.w{border-color:var(--turf);color:var(--turf)}
.snbtns button.l{border-color:var(--red);color:var(--red)}
.snbtns button.won{background:var(--turf);color:#06231a;border-color:transparent}
.snbtns button.lost{background:var(--red);color:#fff;border-color:transparent}
.empty{text-align:center;color:var(--mut);padding:44px 20px;font-size:15px}
.disc{font-size:11.5px;color:var(--mut2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;
  margin-top:20px;line-height:1.55;background:var(--panel2)}
@media(max-width:560px){.title{font-size:44px}.probs{gap:4px}.pill{min-width:46px}
  .mkt,.mkthd{grid-template-columns:1.4fr .6fr .7fr .7fr}}
`;