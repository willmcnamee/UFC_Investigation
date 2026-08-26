/* Fade/rise-in on scroll for static prose sections. Scoped in an
   IIFE to avoid colliding with the scrollytelling observers below. */
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

/* APEX_USAGE and VEGAS_DATA are both loaded at runtime from "Apex data.csv"
   (the Apex Data / City pivot tables from the source workbook, 2018–2026).
   "Apex" combines UFC Apex 2020–2025 with its 2026 rebrand, Meta Apex. Apex %
   is Apex's share of the *global* UFC calendar, not just US events. 2026
   figures are partial-year (YTD), flagged in the UI.

   The City pivot only stores per-city percentages, not raw counts, so the
   per-year US event total is recovered in inferYearTotal() by finding the
   integer every city's percentage rounds back to cleanly. */

/* Minimal CSV parser: handles quoted fields, embedded commas/quotes. */
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (inQuotes){
      if (c === '"'){
        if (text[i + 1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"'){
      inQuotes = true;
    } else if (c === ","){
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r"){
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

const APEX_2026_NOTES = { 2026: "YTD, as Meta Apex" };

async function loadApexUsage(){
  const res = await fetch(encodeURI("Apex data.csv"));
  const rows = parseCSV(await res.text());
  const findRow = label => rows.find(r => (r[0] || "").trim() === label);

  const yearRow = findRow("Year");
  const apexRow = findRow("Apex");
  const pctRow = findRow("Apex %");
  const years = yearRow.slice(1).map(v => v.trim()).filter(Boolean).map(Number);

  return years.map((year, i) => {
    const entry = {
      year,
      events: Number(apexRow[i + 1]),
      pct: Math.round(Number(pctRow[i + 1]) * 100) / 100,
    };
    if (APEX_2026_NOTES[year]) entry.note = APEX_2026_NOTES[year];
    return entry;
  });
}

/* Given a year's list of city percentages (each = count/total*100,
   rounded to 2dp by the source spreadsheet), find the integer total
   that every value rounds most cleanly back to. */
function inferYearTotal(pctValues){
  let best = null;
  for (let n = 5; n <= 60; n++){
    let maxErr = 0;
    for (const pct of pctValues){
      const raw = pct / 100 * n;
      maxErr = Math.max(maxErr, Math.abs(raw - Math.round(raw)));
    }
    if (!best || maxErr < best.maxErr) best = { n, maxErr };
  }
  return best.n;
}

async function loadLocationData(){
  const res = await fetch(encodeURI("Apex data.csv"));
  const rows = parseCSV(await res.text());
  const findRow = label => rows.find(r => (r[0] || "").trim() === label);

  const cityHeaderIdx = rows.findIndex(r => (r[0] || "").trim() === "City");
  const years = rows[cityHeaderIdx].slice(1, 11).map(v => Number(v.trim()));

  const cityRows = [];
  for (let i = cityHeaderIdx + 1; i < rows.length; i++){
    const label = (rows[i][0] || "").trim();
    if (!label || label === "Grand Total") break;
    cityRows.push(rows[i]);
  }

  const parsePct = v => {
    const n = parseFloat((v || "").replace("%", ""));
    return isNaN(n) ? 0 : n;
  };

  const totalUSEvents = years.map((year, yi) => {
    const pcts = cityRows.map(r => parsePct(r[yi + 1])).filter(p => p > 0);
    return inferYearTotal(pcts);
  });

  const distinctCitiesRow = findRow("COUNTUNIQUE of City");
  const distinctCities = years.map((year, yi) => Number(distinctCitiesRow[yi + 1]));

  const apexUsage = await loadApexUsage();
  const apexByYear = Object.fromEntries(apexUsage.map(d => [d.year, d.events]));
  const apexEvents = years.map(y => apexByYear[y] || 0);
  const nonApexEvents = totalUSEvents.map((t, i) => t - apexEvents[i]);

  return { years, totalUSEvents, apexEvents, nonApexEvents, distinctCities };
}

/* Share of Las Vegas's own cards that were at the Apex/Meta Apex
   specifically — real, from the same sheet. Used as a supporting
   stat, not a full chart. */
const APEX_SHARE_OF_VEGAS = { 2020: 91.30, 2021: 91.18, 2022: 84.00, 2023: 77.27, 2024: 80.95, 2025: 75.00, 2026: 75.00 };


const DEAL_TIMELINE = [
  { year: "2018", text: "ESPN signed a five-year deal to become the UFC's US pay-per-view and broadcast partner for $1.5 billion ($300 million per year). <br><br>This deal required the UFC to provide 30 Fight Nights per year." },
  { year: "2019", text: "ESPN and the UFC extend their deal by two years meaning it will now last until the end of 2025." },
  { year: "2020", text: "The COVID-19 pandemic prompts the UFC to start hosting their events at the Apex." },
  { year: "2020-2025", text: "The UFC continues to host a proportion of their annual events at the Apex." },
  { year: "2026", text: "Paramount+ becomes the new owner of the UFC’s US media rights for $7.7 billion across seven years ($1.1 billion per year)." },
  { year: "2026", text: "Meta and the UFC sign a five-year deal to rename the UFC Apex to the Meta Apex." },
];

// Champion nationality vs. events hosted in that country. eventsHosted is
// taken from the Country grand-total column in Apex_research_-_Summary.csv
// (2016–2026 totals; countries absent from the sheet = 0 events).
const NATIONALITY_DATA = [
  { nationality: "United States", champions: 4, eventsHosted: 315 },
  { nationality: "Brazil", champions: 2, eventsHosted: 17 },
  { nationality: "Russia", champions: 1, eventsHosted: 3 },
  { nationality: "Kyrgyzstan", champions: 1, eventsHosted: 0 },
  { nationality: "New Zealand", champions: 1, eventsHosted: 2 },
  { nationality: "Georgia", champions: 1, eventsHosted: 0 },
  { nationality: "Cameroon", champions: 1, eventsHosted: 0 },
];

/* ==============================================================
   CHART TOOLTIP (shared across every bar chart on the page)
   ------------------------------------------------------------
   Bars are the hit target — each one gets its own pointer + focus
   listeners, no crosshair needed. Values lead, labels follow.
   =============================================================== */
const tooltipEl = document.createElement("div");
tooltipEl.className = "chartTooltip";
tooltipEl.setAttribute("role", "tooltip");
document.body.appendChild(tooltipEl);

function positionTooltip(target){
  const r = target.getBoundingClientRect();
  const tw = tooltipEl.offsetWidth;
  const th = tooltipEl.offsetHeight;
  let left = r.left + r.width / 2 - tw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
  let top = r.top - th - 10;
  if (top < 8) top = r.bottom + 10;
  tooltipEl.style.left = left + "px";
  tooltipEl.style.top = top + "px";
}

/* rows: [{ value, label }], title/note optional strings. All
   inserted via textContent — labels ultimately come from CSV data. */
function showTooltip(target, { title, rows, note }){
  tooltipEl.replaceChildren();
  if (title){
    const t = document.createElement("div");
    t.className = "chartTooltip__title";
    t.textContent = title;
    tooltipEl.appendChild(t);
  }
  rows.forEach(({ value, label }) => {
    const row = document.createElement("div");
    row.className = "chartTooltip__row";
    const v = document.createElement("span");
    v.className = "chartTooltip__value";
    v.textContent = value;
    const l = document.createElement("span");
    l.className = "chartTooltip__label";
    l.textContent = label;
    row.append(v, l);
    tooltipEl.appendChild(row);
  });
  if (note){
    const n = document.createElement("div");
    n.className = "chartTooltip__note";
    n.textContent = note;
    tooltipEl.appendChild(n);
  }
  tooltipEl.classList.add("is-visible");
  positionTooltip(target);
}

function hideTooltip(){
  tooltipEl.classList.remove("is-visible");
}

/* Wires pointer + keyboard-focus tooltip handling onto a bar mark. */
function attachBarTooltip(el, content){
  el.tabIndex = 0;
  const show = () => { showTooltip(el, content); el.classList.add("is-hovered"); };
  const hide = () => { hideTooltip(); el.classList.remove("is-hovered"); };
  el.addEventListener("pointerenter", show);
  el.addEventListener("pointermove", () => positionTooltip(el));
  el.addEventListener("pointerleave", hide);
  el.addEventListener("focus", show);
  el.addEventListener("blur", hide);
}

/* ==============================================================
   APEX USAGE CHART (scrollytelling, single series)
   ------------------------------------------------------------
   Y-axis is Apex's share of that year's global UFC calendar (%),
   not raw event counts — raw counts live in the tooltip only.
   =============================================================== */
const apexChartEl = document.getElementById("apexChart");
const apexStageLabel = document.getElementById("apexStageLabel");
const apexStageTitle = document.getElementById("apexStageTitle");
const apexStageSub = document.getElementById("apexStageSub");

/* Picks a "nice" axis max + tick step for a given data max, so
   small-range charts (e.g. distinct cities, max ~19) get finer
   ticks than large-range ones (e.g. total events, max ~39). */
function computeAxis(max){
  const step = max <= 20 ? 5 : max <= 60 ? 10 : 20;
  const axisMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  return { axisMax, ticks };
}

async function initApexUsageChart(){
  const APEX_USAGE = await loadApexUsage();
  const { axisMax, ticks } = computeAxis(Math.max(...APEX_USAGE.map(d => d.pct)));

  function buildApexChart(){
    apexChartEl.innerHTML = `
      <div class="axisChart__inner">
        <div class="axisChart__ylabel">Share of global calendar</div>
        <div class="axisChart__yaxis">
          ${ticks.map(t => `<span class="axisChart__tick" style="bottom:${(t / axisMax * 100).toFixed(2)}%">${t}%</span>`).join("")}
        </div>
        <div class="axisChart__plot">
          <div class="axisChart__grid">
            ${ticks.filter(t => t > 0).map(t => `<div class="axisChart__gridline" style="bottom:${(t / axisMax * 100).toFixed(2)}%"></div>`).join("")}
          </div>
          <div class="barChart__row">
            ${APEX_USAGE.map(d => `
              <div class="barChart__col" data-year="${d.year}">
                <div class="barChart__bar" style="height:0%" data-target="${(d.pct / axisMax * 100).toFixed(1)}"></div>
              </div>`).join("")}
          </div>
        </div>
        <div class="axisChart__xaxis barChart__row">
          ${APEX_USAGE.map(d => `<div class="axisChart__xaxis-col"><span class="barChart__label">${d.year}${d.year === 2026 ? "<sup>*</sup>" : ""}</span></div>`).join("")}
        </div>
      </div>
      <p class="axisChart__xlabel">Year</p>
    `;
    // trigger to full height on next frame for a nice load-in
    requestAnimationFrame(() => {
      apexChartEl.querySelectorAll(".barChart__bar").forEach(bar => {
        bar.style.height = bar.dataset.target + "%";
      });
    });

    apexChartEl.querySelectorAll(".barChart__col").forEach((col, i) => {
      const d = APEX_USAGE[i];
      const rows = [
        { value: `${d.pct}%`, label: "of that year's global calendar" },
        { value: String(d.events), label: "Apex events" },
      ];
      attachBarTooltip(col.querySelector(".barChart__bar"), {
        title: String(d.year),
        rows,
        note: d.note,
      });
    });
  }
  buildApexChart();

  const APEX_STAGES = [
    {
      label: "Step 1 of 4", title: "Built for an emergency",
      sub: "Apex events as a share of the entire global UFC calendar, 2018–2026",
      highlight: [2020]
    },
    {
      label: "Step 2 of 4", title: "The emergency ends",
      sub: "US arenas return to full crowds through 2021",
      highlight: [2021]
    },
    {
      label: "Step 3 of 4", title: "A new beginning?",
      sub: "2022: World sport opens back up, but the UFC doesn't",
      highlight: [2022]
    },
      {
      label: "Step 4 of 4", title: "It never really ended",
      sub: "2023 onward: usage settles lower, then ticks back up",
      highlight: [2023, 2024, 2025, 2026]
    },
  ];

  function applyApexStage(stepIndex){
    const stage = APEX_STAGES[stepIndex];
    apexStageLabel.textContent = stage.label;
    apexStageTitle.textContent = stage.title;
    apexStageSub.textContent = stage.sub;

    apexChartEl.querySelectorAll(".barChart__col").forEach(col => {
      const year = Number(col.dataset.year);
      const bar = col.querySelector(".barChart__bar");
      bar.classList.remove("barChart__bar--muted");
      if (!stage.highlight.includes(year)) bar.classList.add("barChart__bar--muted");
      bar.style.background = stepIndex === 2 && stage.highlight.includes(year) ? "var(--amber)" : "";
    });
  }
  applyApexStage(0);

  const apexSteps = document.querySelectorAll("#apexstory .step");
  const apexObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        apexSteps.forEach(s => s.classList.remove("is-active"));
        entry.target.classList.add("is-active");
        applyApexStage(Number(entry.target.dataset.step));
      }
    });
  }, { root: null, threshold: 0.6 });
  apexSteps.forEach(s => apexObserver.observe(s));
}
initApexUsageChart();

/* ==============================================================
   VEGAS DOMINANCE CHART
   ------------------------------------------------------------
   One chart area that swaps its content per scrollytelling step
   (total US events -> apex vs non-apex split -> distinct cities),
   all sharing the same x-axis (VEGAS_DATA.years) and footprint so
   the three views are directly comparable.
   =============================================================== */
const vegasChartEl = document.getElementById("vegasChart");
const vegasStageLabel = document.getElementById("vegasStageLabel");
const vegasStageTitle = document.getElementById("vegasStageTitle");
const vegasStageSub = document.getElementById("vegasStageSub");

async function initVegasChart(){
  const VEGAS_DATA = await loadLocationData();

  function buildBigChart(config){
    const years = VEGAS_DATA.years;

    if (config.type === "stacked"){
      const { apex, nonApex, title } = config;
      const totals = apex.map((v,i) => v + nonApex[i]);
      const { axisMax, ticks } = computeAxis(Math.max(...totals));

      vegasChartEl.innerHTML = `
        <p class="miniChart__title">${title}</p>
        <div class="legend">
          <span class="legend__item"><span class="dot dot--amber"></span>Apex</span>
          <span class="legend__item"><span class="dot dot--paleblue"></span>Non-Apex</span>
        </div>
        <div class="axisChart__inner">
          <div class="axisChart__ylabel">US events</div>
          <div class="axisChart__yaxis">
            ${ticks.map(t => `<span class="axisChart__tick" style="bottom:${(t / axisMax * 100).toFixed(2)}%">${t}</span>`).join("")}
          </div>
          <div class="axisChart__plot">
            <div class="axisChart__grid">
              ${ticks.filter(t => t > 0).map(t => `<div class="axisChart__gridline" style="bottom:${(t / axisMax * 100).toFixed(2)}%"></div>`).join("")}
            </div>
            <div class="miniChart__row">
            ${years.map((year,i)=>`
              <div class="miniChart__col">
                <div class="miniChart__stack" style="height:0%" data-target="${(totals[i]/axisMax*100).toFixed(1)}">
                  <div class="miniChart__bar miniChart__bar--apex" data-i="${i}" style="height:${(apex[i]/totals[i]*100 || 0)}%"></div>
                  <div class="miniChart__bar miniChart__bar--nonapex" data-i="${i}" style="height:${(nonApex[i]/totals[i]*100 || 0)}%"></div>
                </div>
              </div>`).join("")}
            </div>
          </div>
          <div class="axisChart__xaxis miniChart__row">
            ${years.map(year => `<div class="axisChart__xaxis-col"><span class="miniChart__label">${year}${year === 2026 ? "<sup>*</sup>" : ""}</span></div>`).join("")}
          </div>
        </div>
        <p class="axisChart__xlabel">Year</p>
      `;

      requestAnimationFrame(() => {
        vegasChartEl.querySelectorAll(".miniChart__bar, .miniChart__stack").forEach(bar => {
          if (bar.dataset.target) bar.style.height = bar.dataset.target + "%";
        });
      });

      vegasChartEl.querySelectorAll(".miniChart__bar--apex").forEach(bar => {
        const i = Number(bar.dataset.i);
        attachBarTooltip(bar, {
          title: String(years[i]),
          rows: [
            { value: String(apex[i]), label: "Apex events" },
            { value: `${(apex[i] / totals[i] * 100).toFixed(1)}%`, label: "of that year's US events" },
          ],
        });
      });
      vegasChartEl.querySelectorAll(".miniChart__bar--nonapex").forEach(bar => {
        const i = Number(bar.dataset.i);
        attachBarTooltip(bar, {
          title: String(years[i]),
          rows: [
            { value: String(nonApex[i]), label: "Non-Apex events" },
            { value: `${(nonApex[i] / totals[i] * 100).toFixed(1)}%`, label: "of that year's US events" },
          ],
        });
      });
    } else {
      const { values, barClass, title, unitLabel, yLabel, markPartialYear } = config;
      const { axisMax, ticks } = computeAxis(Math.max(...values));
      const sum = values.reduce((a, b) => a + b, 0);

      vegasChartEl.innerHTML = `
        <p class="miniChart__title">${title}</p>
        <div class="axisChart__inner">
          <div class="axisChart__ylabel">${yLabel}</div>
          <div class="axisChart__yaxis">
            ${ticks.map(t => `<span class="axisChart__tick" style="bottom:${(t / axisMax * 100).toFixed(2)}%">${t}</span>`).join("")}
          </div>
          <div class="axisChart__plot">
            <div class="axisChart__grid">
              ${ticks.filter(t => t > 0).map(t => `<div class="axisChart__gridline" style="bottom:${(t / axisMax * 100).toFixed(2)}%"></div>`).join("")}
            </div>
            <div class="miniChart__row">
            ${values.map((v,i)=>`
              <div class="miniChart__col">
                <div class="miniChart__bar ${barClass}" data-i="${i}" style="height:0%" data-target="${(v/axisMax*100).toFixed(1)}"></div>
              </div>`).join("")}
            </div>
          </div>
          <div class="axisChart__xaxis miniChart__row">
            ${years.map(year => `<div class="axisChart__xaxis-col"><span class="miniChart__label">${year}${markPartialYear && year === 2026 ? "<sup>*</sup>" : ""}</span></div>`).join("")}
          </div>
        </div>
        <p class="axisChart__xlabel">Year</p>
      `;

      requestAnimationFrame(() => {
        vegasChartEl.querySelectorAll(".miniChart__bar, .miniChart__stack").forEach(bar => {
          if (bar.dataset.target) bar.style.height = bar.dataset.target + "%";
        });
      });

      vegasChartEl.querySelectorAll(".miniChart__bar").forEach(bar => {
        const i = Number(bar.dataset.i);
        attachBarTooltip(bar, {
          title: String(years[i]),
          rows: [
            { value: String(values[i]), label: unitLabel },
            { value: `${(values[i] / sum * 100).toFixed(1)}%`, label: "of the 2017–2026 total shown" },
          ],
        });
      });
    }
  }

  const VEGAS_CHARTS = {
    total: () => buildBigChart({ type: "single", values: VEGAS_DATA.totalUSEvents, barClass: "miniChart__bar--total", title: "Total UFC events held in the US, per year", unitLabel: "US events", yLabel: "US events", markPartialYear: true }),
    stacked: () => buildBigChart({ type: "stacked", apex: VEGAS_DATA.apexEvents, nonApex: VEGAS_DATA.nonApexEvents, title: "Apex vs non-Apex UFC events held in the US" }),
    cities: () => buildBigChart({ type: "single", values: VEGAS_DATA.distinctCities, barClass: "miniChart__bar--cities", title: "Distinct US cities hosting a UFC card", unitLabel: "distinct cities", yLabel: "Distinct cities", markPartialYear: true }),
  };

  let currentVegasChart = null;

  function setVegasChart(type){
    if (type === currentVegasChart) return;
    currentVegasChart = type;

    const alreadyVisible = vegasChartEl.classList.contains("is-visible");
    const render = () => {
      VEGAS_CHARTS[type]();
      vegasChartEl.classList.add("is-visible");
    };

    if (!alreadyVisible){
      render();
    } else {
      vegasChartEl.classList.remove("is-visible");
      setTimeout(render, 250);
    }
  }

  const VEGAS_STAGES = [
    { label: "Step 1 of 3", title: "The influx of US events", chart: "total" },
    { label: "Step 2 of 3", title: "How much is because of the Apex", chart: "stacked" },
    { label: "Step 3 of 3", title: "The spoils aren't being shared", chart: "cities" },
  ];

  function applyVegasStage(stepIndex){
    const stage = VEGAS_STAGES[stepIndex];
    vegasStageLabel.textContent = stage.label;
    vegasStageTitle.textContent = stage.title;
    vegasStageSub.textContent = stage.sub;
    setVegasChart(stage.chart);
  }
  applyVegasStage(0);

  const vegasSteps = document.querySelectorAll("#vegasstory .step");
  const vegasObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        vegasSteps.forEach(s => s.classList.remove("is-active"));
        entry.target.classList.add("is-active");
        applyVegasStage(Number(entry.target.dataset.step));
      }
    });
  }, { root: null, threshold: 0.6 });
  vegasSteps.forEach(s => vegasObserver.observe(s));
}
initVegasChart();

/* ==============================================================
   STREAMING DEAL TIMELINE — horizontal scrollytelling
   The section is made tall in JS (100vh + however far the card
   track needs to travel), its viewport stays pinned via CSS
   `position: sticky`, and scroll position drives a translateX on
   the track — so vertical scroll reads as horizontal movement
   through the cards. Below 881px it degrades to a plain
   swipeable row (see the max-width: 880px rule in styles.css).
   =============================================================== */
function initDealTimeline(){
  const section = document.getElementById("dealstory");
  const viewport = document.querySelector(".dealTrack__viewport");
  const track = document.getElementById("dealTrack");
  const labelEl = document.getElementById("dealStageLabel");
  const fillEl = document.getElementById("dealProgressFill");
  if (!section || !viewport || !track) return;

  track.innerHTML = DEAL_TIMELINE.map(d => `
    <article class="dealCard">
      <span class="dealCard__year">${d.year}</span>
      <p class="dealCard__text">${d.text}</p>
    </article>`).join("");

  const cards = Array.from(track.children);
  const isPinned = () => window.matchMedia("(min-width: 881px)").matches;
  // How much extra vertical scroll the section demands per pixel the
  // track actually travels horizontally. 1 = 1:1; higher = more
  // scrolling needed to move between cards.
  const SCROLL_SENSITIVITY = 1.8;
  let maxShift = 0;

  function layout(){
    if (!isPinned()){
      section.style.height = "";
      track.style.transform = "";
      cards.forEach((c, i) => c.classList.toggle("is-active", i === 0));
      if (labelEl) labelEl.textContent = `Deal 1 of ${cards.length}`;
      if (fillEl) fillEl.style.width = "0%";
      return;
    }
    maxShift = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const scrollDistance = maxShift * SCROLL_SENSITIVITY;
    section.style.height = `calc(100vh + ${scrollDistance}px)`;
    update();
  }

  function update(){
    if (!isPinned()) return;
    const scrollable = section.offsetHeight - window.innerHeight;
    const progress = scrollable > 0
      ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / scrollable))
      : 0;

    track.style.transform = `translateX(-${progress * maxShift}px)`;

    const activeIndex = Math.min(cards.length - 1, Math.round(progress * (cards.length - 1)));
    cards.forEach((c, i) => c.classList.toggle("is-active", i === activeIndex));
    if (labelEl) labelEl.textContent = `Deal ${activeIndex + 1} of ${cards.length}`;
    if (fillEl) fillEl.style.width = `${progress * 100}%`;
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", layout);
  layout();
}
initDealTimeline();

/* ==============================================================
   HERO SCROLL CUE
   =============================================================== */
document.getElementById("scrollCue").addEventListener("click", () => {
  document.querySelector(".lede").scrollIntoView({ behavior: "smooth" });
});
