/* ==============================================================
   DATA NOTE
   ------------------------------------------------------------
   TICKET_PRICE_DATA is REAL, supplied 2026-08-14. "price" is the
   average UFC ticket price per year adjusted for inflation, in 2007
   $ terms (this is what the chart plots, per the "ADJUSTED FOR
   INFLATION" instruction in the article copy). "nominal" is the
   unadjusted average price that year, shown alongside it in the
   chart tooltip for context only — it is not plotted.

   Cluster averages (2007–2015 vs 2016–2026) and the ratio between
   them are computed live from this array in ticketClusterStats(),
   not hardcoded, and match the source figures supplied: $124.80 vs
   $269.72, a 2.16× (116.13%) increase.
   =============================================================== */
const TICKET_PRICE_DATA = [
  { year: 2007, price: 151.95, nominal: 157.78 },
  { year: 2008, price: 72.84, nominal: 190.51 },
  { year: 2009, price: 72.84, nominal: 75.37 },
  { year: 2010, price: 167.4, nominal: 176.05 },
  { year: 2011, price: 166.86, nominal: 181.02 },
  { year: 2012, price: 136.67, nominal: 151.34 },
  { year: 2013, price: 157.82, nominal: 177.32 },
  { year: 2014, price: 117.89, nominal: 134.60 },
  { year: 2015, price: 78.89, nominal: 90.18 },
  { year: 2016, price: 326.14, nominal: 377.52 },
  { year: 2017, price: 171.72, nominal: 203.01 },
  { year: 2018, price: 247.41, nominal: 299.63 },
  { year: 2019, price: 165.89, nominal: 204.54 },
  { year: 2020, price: 306.14, nominal: 382.13 },
  { year: 2021, price: 374.01, nominal: 488.79 },
  { year: 2022, price: 242.93, nominal: 342.88 },
  { year: 2023, price: 277.38, nominal: 407.62 },
  { year: 2024, price: 359.22, nominal: 543.47 },
  { year: 2025, price: 258.17, nominal: 400.86 },
  { year: 2026, price: 237.94, nominal: 384.5723435 },
];

/* ==============================================================
   ALL-VENUES DATA NOTE
   ------------------------------------------------------------
   ALL_VENUES_TICKET_PRICE_DATA is REAL, supplied 2026-08-17. Unlike
   TICKET_PRICE_DATA (which is limited to the eight venues used at
   least four times since 2007, for a fairer year-on-year
   comparison), this covers every UFC event with publicly available
   gate/attendance data, across all venues. "price" is already
   adjusted for inflation to 2007 $ terms, matching the other
   dataset; no unadjusted "nominal" figure was supplied for this set.
   =============================================================== */
const ALL_VENUES_TICKET_PRICE_DATA = [
  { year: 2007, price: 200.72 },
  { year: 2008, price: 191.41 },
  { year: 2009, price: 158.17 },
  { year: 2010, price: 154.18 },
  { year: 2011, price: 149.46 },
  { year: 2012, price: 134.34 },
  { year: 2013, price: 155.15 },
  { year: 2014, price: 105.93 },
  { year: 2015, price: 148.98 },
  { year: 2016, price: 150.73 },
  { year: 2017, price: 97.98 },
  { year: 2018, price: 122.2 },
  { year: 2019, price: 107.36 },
  { year: 2020, price: 165.35 },
  { year: 2021, price: 278.52 },
  { year: 2022, price: 189.52 },
  { year: 2023, price: 205.69 },
  { year: 2024, price: 289.56 },
  { year: 2025, price: 216.58 },
  { year: 2026, price: 208.9 },
];

function ticketClusterStats(){
  const cluster1 = TICKET_PRICE_DATA.filter(d => d.year <= 2015);
  const cluster2 = TICKET_PRICE_DATA.filter(d => d.year >= 2016);
  const avg1 = cluster1.reduce((s, d) => s + d.price, 0) / cluster1.length;
  const avg2 = cluster2.reduce((s, d) => s + d.price, 0) / cluster2.length;
  return {
    avg1: Math.round(avg1),
    avg2: Math.round(avg2),
    ratio: (avg2 / avg1).toFixed(2),
  };
}

/* ==============================================================
   CHART TOOLTIP (shared, same pattern as the Apex Effect piece)
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

/* Picks a "nice" axis max + tick step for a given data max. */
function computeAxis(max){
  const step = max <= 20 ? 5 : max <= 60 ? 10 : max <= 120 ? 20 : 50;
  const axisMax = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= axisMax; t += step) ticks.push(t);
  return { axisMax, ticks };
}

/* ==============================================================
   ALL-VENUES TICKET PRICE CHART
   ------------------------------------------------------------
   Standalone chart, structurally a carbon copy of step 1 of the
   scrollytelling chart below (plain bars, no clustering, no mean
   lines) but plotting ALL_VENUES_TICKET_PRICE_DATA instead of the
   fairer 8-venue TICKET_PRICE_DATA.
   =============================================================== */
const allVenuesChartEl = document.getElementById("allVenuesChart");
const { axisMax: allVenuesAxisMax, ticks: allVenuesTicks } = computeAxis(Math.max(...ALL_VENUES_TICKET_PRICE_DATA.map(d => d.price)));

function buildAllVenuesChart(){
  allVenuesChartEl.innerHTML = `
    <div class="axisChart__wrap">
      <div class="axisChart__ylabel">Average ticket price ($)</div>
      <div class="axisChart__body">
        <div class="axisChart__inner">
          <div class="axisChart__yaxis">
            ${allVenuesTicks.map(t => `<span class="axisChart__tick" style="bottom:${(t / allVenuesAxisMax * 100).toFixed(2)}%">${t}</span>`).join("")}
          </div>
          <div class="axisChart__plot">
            <div class="axisChart__grid">
              ${allVenuesTicks.map(t => `<div class="axisChart__gridline${t === 0 ? " axisChart__gridline--zero" : ""}" style="bottom:${(t / allVenuesAxisMax * 100).toFixed(2)}%"></div>`).join("")}
            </div>
            <div class="barChart__row">
              ${ALL_VENUES_TICKET_PRICE_DATA.map(d => `
                <div class="barChart__col" data-year="${d.year}">
                  <div class="barChart__bar" style="height:0%" data-target="${(d.price / allVenuesAxisMax * 100).toFixed(1)}"></div>
                </div>`).join("")}
            </div>
          </div>
        </div>
        <div class="axisChart__xaxis">
          <div class="axisChart__yaxis-gap"></div>
          <div class="axisChart__xlabels">
            ${ALL_VENUES_TICKET_PRICE_DATA.map(d => `<span class="barChart__label">${d.year}</span>`).join("")}
          </div>
        </div>
        <div class="axisChart__xlabel">Year</div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => {
    allVenuesChartEl.querySelectorAll(".barChart__bar").forEach(bar => {
      bar.style.height = bar.dataset.target + "%";
    });
  });

  allVenuesChartEl.querySelectorAll(".barChart__col").forEach(col => {
    const d = ALL_VENUES_TICKET_PRICE_DATA.find(row => String(row.year) === col.dataset.year);
    attachBarTooltip(col.querySelector(".barChart__bar"), {
      title: String(d.year),
      rows: [
        { value: `$${d.price.toFixed(0)}`, label: "avg price, 2007 $ (inflation-adjusted)" },
      ],
    });
  });
}
buildAllVenuesChart();

/* ==============================================================
   TICKET PRICE SCROLLYTELLING
   ------------------------------------------------------------
   The chart itself never swaps out — it stays on screen for all
   three steps, so the reader keeps their bearings:
   Step 1: plain bar chart, one bar per year.
   Step 2: same bars, recoloured into the two eras (2007–2015 /
           2016–2026), legend explains the split.
   Step 3: same coloured bars, plus a dashed mean line drawn across
           each era's bars at that era's average price, with the
           stage copy stating the multiple live from the data.
   =============================================================== */
const ticketChartEl = document.getElementById("ticketChart");
const ticketLegendEl = document.getElementById("ticketLegend");
const ticketStageLabel = document.getElementById("ticketStageLabel");
const ticketStageTitle = document.getElementById("ticketStageTitle");

const { axisMax: ticketAxisMax, ticks: ticketTicks } = computeAxis(Math.max(...TICKET_PRICE_DATA.map(d => d.price)));

function buildTicketBars(){
  ticketChartEl.innerHTML = `
    <div class="axisChart__wrap">
      <div class="axisChart__ylabel">Average ticket price ($)</div>
      <div class="axisChart__body">
        <div class="axisChart__inner">
          <div class="axisChart__yaxis">
            ${ticketTicks.map(t => `<span class="axisChart__tick" style="bottom:${(t / ticketAxisMax * 100).toFixed(2)}%">${t}</span>`).join("")}
          </div>
          <div class="axisChart__plot">
            <div class="axisChart__grid">
              ${ticketTicks.map(t => `<div class="axisChart__gridline${t === 0 ? " axisChart__gridline--zero" : ""}" style="bottom:${(t / ticketAxisMax * 100).toFixed(2)}%"></div>`).join("")}
            </div>
            <div class="barChart__row">
              ${TICKET_PRICE_DATA.map(d => `
                <div class="barChart__col" data-year="${d.year}">
                  <div class="barChart__bar" style="height:0%" data-target="${(d.price / ticketAxisMax * 100).toFixed(1)}"></div>
                </div>`).join("")}
            </div>
          </div>
        </div>
        <div class="axisChart__xaxis">
          <div class="axisChart__yaxis-gap"></div>
          <div class="axisChart__xlabels">
            ${TICKET_PRICE_DATA.map(d => `<span class="barChart__label">${d.year}</span>`).join("")}
          </div>
        </div>
        <div class="axisChart__xlabel">Year</div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => {
    ticketChartEl.querySelectorAll(".barChart__bar").forEach(bar => {
      bar.style.height = bar.dataset.target + "%";
    });
  });

  ticketChartEl.querySelectorAll(".barChart__col").forEach(col => {
    const d = TICKET_PRICE_DATA.find(row => String(row.year) === col.dataset.year);
    attachBarTooltip(col.querySelector(".barChart__bar"), {
      title: String(d.year),
      rows: [
        { value: `$${d.price.toFixed(0)}`, label: "avg price, 2007 $ (inflation-adjusted)" },
        { value: `$${d.nominal.toFixed(0)}`, label: "nominal avg price" },
      ],
    });
  });
}

function setTicketBarColours(clustered){
  ticketChartEl.querySelectorAll(".barChart__col").forEach(col => {
    const bar = col.querySelector(".barChart__bar");
    if (!bar) return;
    const year = Number(col.dataset.year);
    bar.classList.remove("barChart__bar--cluster1", "barChart__bar--cluster2");
    if (clustered) bar.classList.add(year <= 2015 ? "barChart__bar--cluster1" : "barChart__bar--cluster2");
  });
}

/* Draws a dashed mean-price line across each era's own bars (not
   the full chart width), labelled with that era's average. Span
   edges are measured from the actual rendered bar columns (via
   getBoundingClientRect) rather than derived from column count,
   because the flex gaps between columns mean N/total columns isn't
   the same fraction of width as N columns' worth of actual pixels —
   using column count alone drifts the boundary left of where the
   bars really are, increasingly so further into the row. */
function buildTicketMeanLines(){
  const plot = ticketChartEl.querySelector(".axisChart__plot");
  if (!plot) return;
  const { avg1, avg2 } = ticketClusterStats();

  const cols = Array.from(plot.querySelectorAll(".barChart__col"));
  const cluster1Cols = cols.filter(c => Number(c.dataset.year) <= 2015);
  const cluster2Cols = cols.filter(c => Number(c.dataset.year) >= 2016);
  const plotRect = plot.getBoundingClientRect();
  const pctLeft = el => (el.getBoundingClientRect().left - plotRect.left) / plotRect.width * 100;
  const pctRight = el => (el.getBoundingClientRect().right - plotRect.left) / plotRect.width * 100;

  const c1Left = pctLeft(cluster1Cols[0]);
  const c1Right = pctRight(cluster1Cols[cluster1Cols.length - 1]);
  const c2Left = pctLeft(cluster2Cols[0]);
  const c2Right = pctRight(cluster2Cols[cluster2Cols.length - 1]);

  const spans = [
    { left: c1Left, width: c1Right - c1Left, value: avg1 },
    { left: c2Left, width: c2Right - c2Left, value: avg2 },
  ];

  spans.forEach(s => {
    const bottom = (s.value / ticketAxisMax * 100).toFixed(2);

    const line = document.createElement("div");
    line.className = "axisChart__meanLine";
    line.style.left = s.left + "%";
    line.style.width = s.width + "%";
    line.style.bottom = bottom + "%";
    plot.appendChild(line);

    const label = document.createElement("span");
    label.className = "axisChart__meanLabel";
    label.style.left = (s.left + s.width / 2) + "%";
    label.style.bottom = bottom + "%";
    label.textContent = `avg $${s.value}`;
    plot.appendChild(label);
  });

  requestAnimationFrame(() => {
    plot.querySelectorAll(".axisChart__meanLine, .axisChart__meanLabel").forEach(el => el.classList.add("is-visible"));
  });
}

function removeTicketMeanLines(){
  ticketChartEl.querySelectorAll(".axisChart__meanLine, .axisChart__meanLabel").forEach(el => el.remove());
}

const TICKET_STAGES = [
  {
    label: "Step 1 of 3", title: "Ticket prices 2007–2026",
    mode: "plain",
  },
  {
    label: "Step 2 of 3", title: "Two eras",
    mode: "clustered",
  },
  {
    label: "Step 3 of 3", title: "More than double",
    mode: "compare",
  },
];

function applyTicketStage(stepIndex){
  const stage = TICKET_STAGES[stepIndex];
  ticketStageLabel.textContent = stage.label;
  ticketStageTitle.textContent = stage.title;

  setTicketBarColours(stage.mode !== "plain");
  ticketLegendEl.style.display = stage.mode !== "plain" ? "flex" : "none";

  if (stage.mode === "compare") buildTicketMeanLines();
  else removeTicketMeanLines();
}
buildTicketBars();
applyTicketStage(0);

const ticketSteps = document.querySelectorAll("#ticketstory .step");
const ticketObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      ticketSteps.forEach(s => s.classList.remove("is-active"));
      entry.target.classList.add("is-active");
      applyTicketStage(Number(entry.target.dataset.step));
    }
  });
}, { root: null, threshold: 0.6 });
ticketSteps.forEach(s => ticketObserver.observe(s));

/* ==============================================================
   HERO SCROLL CUE
   =============================================================== */
document.getElementById("scrollCue").addEventListener("click", () => {
  document.querySelector(".lede").scrollIntoView({ behavior: "smooth" });
});

/* ==============================================================
   METHODOLOGY MODAL — opened from the ticket-prices "here" link
   =============================================================== */
(() => {
  const trigger = document.getElementById("methodologyTrigger");
  const overlay = document.getElementById("methodologyModal");
  const closeBtn = document.getElementById("methodologyModalClose");
  let lastFocused = null;

  function openModal(){
    lastFocused = document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-visible"));
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal(){
    overlay.classList.remove("is-visible");
    document.removeEventListener("keydown", onKeydown);
    setTimeout(() => { overlay.hidden = true; }, 200);
    if (lastFocused) lastFocused.focus();
  }

  function onKeydown(e){
    if (e.key === "Escape") closeModal();
  }

  trigger.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
})();
