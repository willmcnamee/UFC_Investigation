/* ==============================================================
   SCROLL REVEAL — generic fade/rise-in on scroll, wrapped in its
   own IIFE so its locals (prefersReducedMotion, revealEls,
   revealObserver) can never collide with this file's other
   top-level scroll/observer logic (e.g. prefersReducedMotionHM,
   ratioObserver).
   =============================================================== */
(function () {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealEls = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach(el => el.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    revealEls.forEach(el => revealObserver.observe(el));
  }
})();

/* ==============================================================
   DATA NOTE
   ------------------------------------------------------------
   The controversial-title-reigns heatmap is now built entirely at
   runtime by fetching and parsing Events_with_controversy.csv,
   which must sit in the same folder as this script. Nothing about
   the heatmap is hardcoded any more — edit the CSV and reload the
   page to see it reflected.

   This relies on the browser's fetch() API, which most browsers
   block for file:// pages (CORS). Serve this folder over a local
   web server while developing, e.g. VS Code's "Live Server"
   extension, or `python -m http.server` from this folder, then
   open the http://localhost URL it gives you.

   RATIO_DATA further down (active / interim / vacant share) is
   still PLACEHOLDER — no equivalent daily dataset has been
   supplied for that chart yet.
   =============================================================== */
const CONTROVERSY_CSV_PATH = "Events_with_controversy.csv";
const DIVISION_NAMES = {"WSW":"Women's Strawweight","WFLW":"Women's Flyweight","WBW":"Women's Bantamweight","FLW":"Flyweight","BW":"Bantamweight","FW":"Featherweight","LW":"Lightweight","WW":"Welterweight","MW":"Middleweight","LHW":"Light Heavyweight","HW":"Heavyweight"};

/* ==============================================================
   CSV PARSING + AGGREGATION
   ------------------------------------------------------------
   Each CSV row describes one reign segment for a division, from
   "Date" to "End date". Whenever that row's "Controversy" column
   is 1, every day of that segment counts as controversial — the
   controversial days are ("Date", "End date"], i.e. the start day
   itself is excluded and the end day is included, which matches
   how "Days in state" is computed elsewhere in the sheet.

   Note the "Controversy Start Date" / "Controversy End Date"
   columns are NOT used to compute day counts (verified against
   the sheet's own numbers: several controversial rows have Start/
   End dates that fall outside the row's own Date/End date range,
   e.g. describing when a dispute was first reported vs. when the
   reign itself ran — using them as the day range overcounts).
   They're left in the CSV as narrative reference only.

   Controversial days are collected into a per-division Set of ISO
   day strings before counting, so that two adjacent/duplicated
   rows referencing the same underlying dispute don't get double
   counted.
   =============================================================== */
function splitCSVLine(line){
  // Handles quoted fields (which may themselves contain commas, e.g. the
  // "Exact Controversy" narrative column) and doubled "" escaped quotes.
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++){
    const ch = line[i];
    if (inQuotes){
      if (ch === '"'){
        if (line[i + 1] === '"'){ cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"'){
      inQuotes = true;
    } else if (ch === ","){
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text){
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.length > 0);
  const header = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(splitCSVLine);
  return { header, rows };
}

function parseFlexibleDate(raw){
  if (!raw) return null;
  const parts = raw.split("/").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  let [a, b, year] = parts;
  if (year < 100) year += 2000;
  let day = a, month = b;
  // a handful of rows in the sheet are entered as M/D/Y rather than D/M/Y
  if (month > 12 && day <= 12){ [day, month] = [month, day]; }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function addUTCDays(date, days){
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDay(date){ return date.toISOString().slice(0, 10); }
function monthKey(date){ return date.toISOString().slice(0, 7); }

function monthsBetween(startMonth, endMonth){
  const months = [];
  let [y, m] = startMonth.split("-").map(Number);
  const [endY, endM] = endMonth.split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)){
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12){ m = 1; y++; }
  }
  return months;
}

function longestStreak(values){
  let best = { len: 0, startIndex: -1, endIndex: -1 };
  let curLen = 0, curStart = -1;
  values.forEach((v, i) => {
    if (v > 0){
      if (curLen === 0) curStart = i;
      curLen++;
      if (curLen > best.len) best = { len: curLen, startIndex: curStart, endIndex: i };
    } else {
      curLen = 0;
    }
  });
  return best;
}

function buildControversyModel(csvText){
  const { header, rows } = parseCSV(csvText);
  const col = name => header.indexOf(name);
  const DIVISION = col("Division");
  const DATE = col("Date");
  const END_DATE = col("End date");
  const CONTROVERSY = col("Controversy");
  const CONTROVERSY_START = col("Controversy Start Date");
  const EXACT_CONTROVERSY = col("Exact Controversy");

  const divisions = []; // preserves first-appearance order from the CSV
  const seenDivisions = new Set();
  const controversialDaysByDivision = new Map();
  // Per division: the individual controversial rows ("segments") feeding it,
  // plus a month -> set-of-segment-index map, so a cell can be traced back
  // to exactly which controversy/controversies put days into it.
  const segmentsByDivision = new Map();
  const monthSegmentsByDivision = new Map();
  let minDate = null, maxDate = null;

  rows.forEach(cols => {
    const division = cols[DIVISION];
    if (!division) return;
    if (!seenDivisions.has(division)){ seenDivisions.add(division); divisions.push(division); }

    const rowStart = parseFlexibleDate(cols[DATE]);
    const rowEnd = parseFlexibleDate(cols[END_DATE]);
    if (rowStart && (!minDate || rowStart < minDate)) minDate = rowStart;
    if (rowEnd && (!maxDate || rowEnd > maxDate)) maxDate = rowEnd;

    if (cols[CONTROVERSY] !== "1") return;
    if (!rowStart || !rowEnd || rowEnd <= rowStart) return; // guards against malformed rows (e.g. reversed dates)

    const segments = segmentsByDivision.get(division) || [];
    const segIndex = segments.length;
    segments.push({
      startDate: parseFlexibleDate(cols[CONTROVERSY_START]) || rowStart,
      exact: (cols[EXACT_CONTROVERSY] || "").trim(),
    });
    segmentsByDivision.set(division, segments);

    const daySet = controversialDaysByDivision.get(division) || new Set();
    const monthSegs = monthSegmentsByDivision.get(division) || new Map();
    let cursor = addUTCDays(rowStart, 1); // exclusive start
    while (cursor <= rowEnd){
      const day = isoDay(cursor);
      daySet.add(day);
      const mk = day.slice(0, 7);
      const segSet = monthSegs.get(mk) || new Set();
      segSet.add(segIndex);
      monthSegs.set(mk, segSet);
      cursor = addUTCDays(cursor, 1);
    }
    controversialDaysByDivision.set(division, daySet);
    monthSegmentsByDivision.set(division, monthSegs);
  });

  if (!minDate || !maxDate){
    throw new Error("No valid dates found in CSV — check the Date/End date columns.");
  }

  const months = monthsBetween(monthKey(minDate), monthKey(maxDate));
  const monthIndex = new Map(months.map((m, i) => [m, i]));

  const countsByDivision = new Map(divisions.map(d => [d, new Array(months.length).fill(0)]));
  divisions.forEach(division => {
    const daySet = controversialDaysByDivision.get(division);
    if (!daySet) return;
    const counts = countsByDivision.get(division);
    daySet.forEach(day => {
      const mi = monthIndex.get(day.slice(0, 7));
      if (mi !== undefined) counts[mi]++;
    });
  });

  const monthRows = months.map((m, mi) => ({
    m,
    v: divisions.map(d => countsByDivision.get(d)[mi]),
    details: divisions.map(d => {
      const segs = segmentsByDivision.get(d);
      const idxSet = monthSegmentsByDivision.get(d)?.get(m);
      if (!segs || !idxSet || idxSet.size === 0) return null;
      return Array.from(idxSet).map(i => segs[i]).sort((a, b) => a.startDate - b.startDate);
    }),
  }));
  const maxCell = Math.max(1, ...monthRows.flatMap(row => row.v));

  const totalDaysByDivision = {};
  const monthsWithControversyByDivision = {};
  const longestStreakByDivision = {};
  const streaks = [];

  divisions.forEach(division => {
    const counts = countsByDivision.get(division);
    totalDaysByDivision[division] = controversialDaysByDivision.get(division)?.size || 0;
    monthsWithControversyByDivision[division] = counts.filter(v => v > 0).length;
    const streak = longestStreak(counts);
    longestStreakByDivision[division] = streak.len;
    if (streak.len > 0) streaks.push({ division, ...streak });
  });

  // Auto-generate annotations for the most notable streaks (mirrors the
  // hand-picked call-outs this heatmap used to ship with, but derived live).
  const topStreaks = streaks.slice().sort((a, b) => b.len - a.len).slice(0, 4);
  const annotations = {};
  topStreaks.forEach(s => {
    const name = DIVISION_NAMES[s.division] || s.division;
    const startMonth = months[s.startIndex];
    const isOngoing = s.endIndex === months.length - 1;
    annotations[startMonth] = isOngoing
      ? `${name}'s current run — ${s.len} months and counting as of this dataset's last update.`
      : `${name} logs ${s.len} straight controversial months from here, ${monthLabel(startMonth)} to ${monthLabel(months[s.endIndex])}.`;
  });

  return {
    divisions,
    months: monthRows,
    maxCell,
    totalDaysByDivision,
    monthsWithControversyByDivision,
    longestStreakByDivision,
    dateRange: { start: months[0], end: months[months.length - 1] },
    totalMonths: months.length,
    annotations,
  };
}

/* ==============================================================
   Active / interim / vacant title reign share, per year
   =============================================================== */
const RATIO_DATA = [
  { year: 2017, active: 93.0, interim: 4.7, vacant: 2.3 },
  { year: 2018, active: 90.0, interim: 8.0, vacant: 2.0 },
  { year: 2019, active: 90.1, interim: 4.2, vacant: 5.7 },
  { year: 2020, active: 93.3, interim: 5.2, vacant: 1.4 },
  { year: 2021, active: 88.0, interim: 6.8, vacant: 5.2 },
  { year: 2022, active: 85.0, interim: 5.4, vacant: 9.6 },
  { year: 2023, active: 90.4, interim: 9.1, vacant: 0.5 },
  { year: 2024, active: 91.9, interim: 4.3, vacant: 3.9 },
  { year: 2025, active: 90.0, interim: 8.1, vacant: 1.9 },
  { year: 2026, active: 90.2, interim: 6.1, vacant: 3.7 },
];

/* ==============================================================
   RATIO SCROLLYTELLING CHART
   =============================================================== */
const ratioChartEl = document.getElementById("ratioChart");
const ratioStageLabel = document.getElementById("ratioStageLabel");
const ratioStageTitle = document.getElementById("ratioStageTitle");
const ratioStageSub = document.getElementById("ratioStageSub");

function buildRatioRows(){
  ratioChartEl.innerHTML = RATIO_DATA.map(row => `
    <div class="ratioRow" data-year="${row.year}">
      <span class="ratioRow__label">${row.year}${row.year === 2026 ? "<sup>*</sup>" : ""}</span>
      <div class="ratioRow__track">
        <span class="ratioRow__seg ratioRow__seg--active" data-value="${row.active}" style="width:0%"></span>
        <span class="ratioRow__seg ratioRow__seg--interim" data-value="${row.interim}" style="width:0%"></span>
        <span class="ratioRow__seg ratioRow__seg--vacant" data-value="${row.vacant}" style="width:0%"></span>
      </div>
      <span class="ratioRow__pct">${row.active.toFixed(1)}%</span>
    </div>`).join("");
}
buildRatioRows();

const RATIO_STAGES = [
  { label: "Step 1 of 3", title: "Active title reigns", sub: "Share of days each year a division was held by an active champion", segs: ["active"] },
  { label: "Step 2 of 3", title: "+ Interim reigns", sub: "Interim titles barely move the needle year to year", segs: ["active","interim"] },
  { label: "Step 3 of 3", title: "+ Vacant periods", sub: "The full picture: active, interim and vacant, 2017–2026", segs: ["active","interim","vacant"] },
];

function applyRatioStage(stepIndex){
  const stage = RATIO_STAGES[stepIndex];
  ratioStageLabel.textContent = stage.label;
  ratioStageTitle.textContent = stage.title;
  ratioStageSub.textContent = stage.sub;

  RATIO_DATA.forEach(row => {
    const rowEl = ratioChartEl.querySelector(`.ratioRow[data-year="${row.year}"]`);
    if (!rowEl) return;
    const activeSeg = rowEl.querySelector(".ratioRow__seg--active");
    const interimSeg = rowEl.querySelector(".ratioRow__seg--interim");
    const vacantSeg = rowEl.querySelector(".ratioRow__seg--vacant");
    const pctEl = rowEl.querySelector(".ratioRow__pct");

    activeSeg.style.width = stage.segs.includes("active") ? row.active + "%" : "0%";
    interimSeg.style.width = stage.segs.includes("interim") ? row.interim + "%" : "0%";
    vacantSeg.style.width = stage.segs.includes("vacant") ? row.vacant + "%" : "0%";

    const shownTotal = stage.segs.reduce((sum, key) => sum + row[key], 0);
    pctEl.textContent = shownTotal.toFixed(1) + "%";
  });
}
applyRatioStage(0);

const ratioSteps = document.querySelectorAll("#ratiostory .step");
const ratioObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      ratioSteps.forEach(s => s.classList.remove("is-active"));
      entry.target.classList.add("is-active");
      applyRatioStage(Number(entry.target.dataset.step));
    }
  });
}, { root: null, threshold: 0.6 });
ratioSteps.forEach(s => ratioObserver.observe(s));

/* ==============================================================
   ANIMATED CONTROVERSY HEATMAP (loaded live from CSV)
   =============================================================== */
const heatmapSection = document.getElementById("heatmap");
const heatmapChartEl = document.getElementById("heatmapChart");
const heatmapMonthLabel = document.getElementById("heatmapMonthLabel");
const heatmapReadout = document.getElementById("heatmapReadout");
const heatmapAnnotation = document.getElementById("heatmapAnnotation");

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(m){
  const [y, mo] = m.split("-");
  return `${MONTH_NAMES[Number(mo) - 1]} ${y}`;
}

function dayLabel(date){
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function cellColor(value, max){
  // 0 -> paper tone, mid -> amber, max -> crimson
  const t = Math.max(0, Math.min(1, value / max));
  const paper = [236, 230, 216];
  const amber = [232, 162, 61];
  const crimson = [193, 57, 43];
  let c1, c2, localT;
  if (t <= 0.5){ c1 = paper; c2 = amber; localT = t / 0.5; }
  else { c1 = amber; c2 = crimson; localT = (t - 0.5) / 0.5; }
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * localT);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * localT);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * localT);
  return `rgb(${r},${g},${b})`;
}

function initHeatmap(model){
  const DIVS = model.divisions;
  const MONTHS = model.months;
  const MAXCELL = model.maxCell;
  const TOTAL_MONTHS = MONTHS.length;
  const ANNOTATIONS = model.annotations;
  const CELL_DETAILS = MONTHS.map(month => month.details); // [monthIndex][divIndex] -> segments | null

  const ROW_H = 24;
  const ROW_GAP = 3;
  const LABEL_W = 40;
  const CHART_H = DIVS.length * (ROW_H + ROW_GAP);
  let cellW = 6;

  function buildHeatmapSVG(){
    const rows = DIVS.map((d, i) => {
      const y = i * (ROW_H + ROW_GAP);
      return `<text x="${LABEL_W - 8}" y="${y + ROW_H / 2 + 4}" text-anchor="end" class="hm-label">${d}</text>`;
    }).join("");

    const cells = [];
    MONTHS.forEach((month, mi) => {
      const x = LABEL_W + mi * cellW;
      DIVS.forEach((d, di) => {
        const y = di * (ROW_H + ROW_GAP);
        const value = month.v[di];
        const hasDetails = value > 0;
        cells.push(`<rect class="hm-cell${hasDetails ? " hm-cell--data" : ""}" data-month-index="${mi}" data-div-index="${di}" data-value="${value}" x="${x}" y="${y}" width="${Math.max(cellW - 1, 1)}" height="${ROW_H}" rx="1.5" fill="var(--line)" />`);
      });
    });

    // year tick marks (January of each year)
    const yearTicks = [];
    MONTHS.forEach((month, mi) => {
      if (month.m.endsWith("-01")){
        const x = LABEL_W + mi * cellW;
        const year = month.m.split("-")[0];
        const yearLabel = year === "2026" ? `${year}<tspan class="hm-year-ast" baseline-shift="super">*</tspan>` : year;
        yearTicks.push(`<text x="${x}" y="${CHART_H + 16}" class="hm-year">${yearLabel}</text>`);
      }
    });

    const totalW = LABEL_W + TOTAL_MONTHS * cellW;
    heatmapChartEl.innerHTML = `
      <svg viewBox="0 0 ${totalW} ${CHART_H + 28}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .hm-label{ font-family:'IBM Plex Mono',monospace; font-size:10.5px; fill: var(--muted); }
          .hm-year{ font-family:'IBM Plex Mono',monospace; font-size:10px; fill: var(--muted); }
          .hm-year-ast{ font-size:7px; }
        </style>
        ${rows}
        ${cells.join("")}
        ${yearTicks.join("")}
        <line id="hmPlayhead" x1="${LABEL_W}" y1="0" x2="${LABEL_W}" y2="${CHART_H}" stroke="var(--amber)" stroke-width="1.5" opacity="0" />
      </svg>`;
  }

  function measureHeatmap(){
    const wrapWidth = heatmapChartEl.parentElement.clientWidth - 40;
    const minTotalW = 720; // allow horizontal scroll on very small screens rather than crushing cells
    const chartW = Math.max(wrapWidth, minTotalW) - LABEL_W;
    cellW = Math.max(chartW / TOTAL_MONTHS, 4);
    buildHeatmapSVG();
  }

  function renderHeatmapProgress(revealIndex){
    const cellsNodeList = heatmapChartEl.querySelectorAll(".hm-cell");
    let revealedControversialMonths = 0;
    let currentMonthTotal = 0;
    cellsNodeList.forEach(cell => {
      const mi = Number(cell.dataset.monthIndex);
      const value = Number(cell.dataset.value);
      if (mi <= revealIndex){
        cell.setAttribute("fill", cellColor(value, MAXCELL));
        if (value > 0) revealedControversialMonths++;
        if (mi === revealIndex) currentMonthTotal += value;
      } else {
        cell.setAttribute("fill", "var(--line)");
      }
    });

    const currentMonth = MONTHS[Math.min(revealIndex, TOTAL_MONTHS - 1)];
    heatmapMonthLabel.textContent = monthLabel(currentMonth.m);

    heatmapReadout.innerHTML = `
      <span><b>${Math.min(revealIndex + 1, TOTAL_MONTHS)}</b> / ${TOTAL_MONTHS} months shown</span>
      <span><b>${revealedControversialMonths}</b> division-months with controversy so far</span>
      <span><b>${currentMonthTotal}</b> controversial division-days this month</span>
    `;

    const playhead = heatmapChartEl.querySelector("#hmPlayhead");
    if (playhead){
      const x = LABEL_W + (revealIndex + 0.5) * cellW;
      playhead.setAttribute("x1", x);
      playhead.setAttribute("x2", x);
      playhead.setAttribute("opacity", "0.7");
    }

    const annotation = ANNOTATIONS[currentMonth.m];
    heatmapAnnotation.textContent = annotation || "";
  }

  const prefersReducedMotionHM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let heatmapScrollLength = 0;

  function measureHeatmapSection(){
    measureHeatmap();
    const pxPerMonth = prefersReducedMotionHM ? 4 : 16;
    heatmapScrollLength = TOTAL_MONTHS * pxPerMonth;
    heatmapSection.style.height = `${window.innerHeight + heatmapScrollLength}px`;
  }

  function onHeatmapScroll(){
    const rect = heatmapSection.getBoundingClientRect();
    const start = rect.top;
    const progress = Math.min(Math.max(-start / heatmapScrollLength, 0), 1);
    const revealIndex = Math.floor(progress * (TOTAL_MONTHS - 1));
    renderHeatmapProgress(revealIndex);
  }

  let hmTicking = false;
  function requestHeatmapTick(){
    if (!hmTicking){
      window.requestAnimationFrame(() => { onHeatmapScroll(); hmTicking = false; });
      hmTicking = true;
    }
  }

  // Jump the scrollytelling playhead so a clicked cell's month becomes the
  // "most recent" one revealed, by scrolling to the matching point inside
  // the pinned section's scroll-driven range.
  function scrollHeatmapToMonth(monthIndex){
    if (!heatmapScrollLength || TOTAL_MONTHS < 2) return;
    const clamped = Math.max(0, Math.min(monthIndex, TOTAL_MONTHS - 1));
    const progress = clamped / (TOTAL_MONTHS - 1);
    const sectionTop = heatmapSection.getBoundingClientRect().top + window.scrollY;
    const targetY = sectionTop + progress * heatmapScrollLength;
    window.scrollTo({ top: targetY, behavior: prefersReducedMotionHM ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------
     HOVER TOOLTIP — start date + exact controversy for any cell
     that has one, plus click-to-scroll navigation. Both are wired
     once via delegation on heatmapChartEl so they survive the
     rebuilds triggered by measureHeatmap() on resize.
     ------------------------------------------------------------ */
  let hmTooltipEl = null;
  function ensureHeatmapTooltip(){
    if (hmTooltipEl) return hmTooltipEl;
    hmTooltipEl = document.createElement("div");
    hmTooltipEl.className = "hm-tooltip";
    hmTooltipEl.setAttribute("role", "tooltip");
    document.body.appendChild(hmTooltipEl);
    return hmTooltipEl;
  }

  function positionHeatmapTooltip(clientX, clientY){
    const el = hmTooltipEl;
    const pad = 14;
    const rect = el.getBoundingClientRect();
    let x = clientX + pad;
    let y = clientY + pad;
    if (x + rect.width > window.innerWidth - 8) x = clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = clientY - rect.height - pad;
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  }

  function showHeatmapTooltip(cell, clientX, clientY){
    const mi = Number(cell.dataset.monthIndex);
    const di = Number(cell.dataset.divIndex);
    const segs = CELL_DETAILS[mi] && CELL_DETAILS[mi][di];
    if (!segs || !segs.length){ hideHeatmapTooltip(); return; }

    const name = DIVISION_NAMES[DIVS[di]] || DIVS[di];
    const title = `${name} · ${monthLabel(MONTHS[mi].m)}`;
    const lines = segs.map(seg => {
      const dateStr = `Controversy start: ${dayLabel(seg.startDate)}`;
      return seg.exact ? `${dateStr}<br>${escapeHtml(seg.exact)}` : dateStr;
    });

    const el = ensureHeatmapTooltip();
    el.innerHTML = `<div class="hm-tooltip__title">${escapeHtml(title)}</div>` +
      lines.map(line => `<div class="hm-tooltip__line">${line}</div>`).join("");
    el.style.display = "block";
    positionHeatmapTooltip(clientX, clientY);
  }

  function hideHeatmapTooltip(){
    if (hmTooltipEl) hmTooltipEl.style.display = "none";
  }

  heatmapChartEl.addEventListener("mouseover", (e) => {
    const cell = e.target.closest(".hm-cell--data");
    if (!cell) return;
    showHeatmapTooltip(cell, e.clientX, e.clientY);
  });
  heatmapChartEl.addEventListener("mousemove", (e) => {
    if (!hmTooltipEl || hmTooltipEl.style.display === "none") return;
    const cell = e.target.closest(".hm-cell--data");
    if (!cell) return;
    positionHeatmapTooltip(e.clientX, e.clientY);
  });
  heatmapChartEl.addEventListener("mouseout", (e) => {
    const cell = e.target.closest(".hm-cell--data");
    if (!cell) return;
    if (e.relatedTarget && cell.contains(e.relatedTarget)) return;
    hideHeatmapTooltip();
  });
  heatmapChartEl.addEventListener("click", (e) => {
    const cell = e.target.closest(".hm-cell");
    if (!cell) return;
    scrollHeatmapToMonth(Number(cell.dataset.monthIndex));
  });

  window.addEventListener("scroll", requestHeatmapTick, { passive: true });
  window.addEventListener("resize", () => { measureHeatmapSection(); requestHeatmapTick(); });
  measureHeatmapSection();
  requestHeatmapTick();
}

function showHeatmapMessage(text){
  heatmapChartEl.innerHTML = `<p style="font-family:var(--font-mono); font-size:13px; color:var(--muted); margin:0;">${text}</p>`;
}

showHeatmapMessage("Loading Events_with_controversy.csv…");

fetch(CONTROVERSY_CSV_PATH)
  .then(res => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.text();
  })
  .then(csvText => {
    const model = buildControversyModel(csvText);
    initHeatmap(model);
  })
  .catch(err => {
    console.error("Failed to load controversy CSV:", err);
    showHeatmapMessage(
      `Couldn't load ${CONTROVERSY_CSV_PATH}. If you're opening this page directly as a file:// URL, ` +
      `browsers block local file fetches for security — serve this folder with a local web server instead ` +
      `(e.g. the VS Code "Live Server" extension, or running <code>python -m http.server</code> here) and open the ` +
      `http://localhost link it gives you.`
    );
  });

/* ==============================================================
   HERO SCROLL CUE
   =============================================================== */
document.getElementById("scrollCue").addEventListener("click", () => {
  document.querySelector(".lede").scrollIntoView({ behavior: "smooth" });
});
