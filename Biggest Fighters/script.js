/* ==============================================================
   SCROLL REVEAL
   ------------------------------------------------------------
   Generic fade/rise-in utility for static prose sections (see
   .reveal / .reveal-group in styles.css). Wrapped in its own IIFE
   so it doesn't collide with the top-level `prefersReducedMotion`
   declared further down (in the HORIZONTAL SCROLLYTELLING block),
   and placed here at the very top of the file — rather than after
   that block — because the HORIZONTAL SCROLLYTELLING code currently
   throws (its #horiz target is commented out in index.html, see the
   NB note near that block), which halts every subsequent top-level
   statement in this file for the rest of the load.
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
   PLACEHOLDER DATA
   ------------------------------------------------------------
   Every value below is illustrative only. Replace with verified
   figures before publishing:
     - followers: Instagram follower count, source TBC
       (https://www.sacnilk.com/news/List_Of_Most_Followed_UFC_on_Instagram)
     - retired:     true if 100% retired from competition
     - fought2026:  true if fighter has fought OR has a fight
                    officially scheduled in 2026
     - dispute:     true if fighter has publicly disputed UFC
                    business practices / matchmaking / pay
   =============================================================== */
const FIGHTERS = [
  { rank: 1,  name: "Conor McGregor",      followers: "46.39M", retired: false, fought2026: true,  dispute: true  },
  { rank: 2,  name: "Khabib Nurmagomedov", followers: "43.28M", retired: true,  fought2026: false, dispute: false },
  { rank: 3,  name: "Ronda Rousey",        followers: "16.64M", retired: false, fought2026: false, dispute: true  },
  { rank: 4,  name: "Islam Makhachev",     followers: "13.38M", retired: false, fought2026: true,  dispute: false },
  { rank: 5,  name: "Khamzat Chimaev",     followers: "13.02M", retired: false, fought2026: true,  dispute: false },
  { rank: 6,  name: "Charles Oliveira",    followers: "10.14M", retired: false, fought2026: true,  dispute: false },
  { rank: 7,  name: "Alex Pereira",        followers: "10.00M", retired: false, fought2026: true,  dispute: false },
  { rank: 8,  name: "Jon Jones",           followers: "9.51M",  retired: false, fought2026: false, dispute: true  },
  { rank: 9,  name: "Israel Adesanya",     followers: "8.29M",  retired: false, fought2026: true,  dispute: false },
  { rank: 10, name: "Nate Diaz",           followers: "7.27M",  retired: false, fought2026: false, dispute: true  },
  { rank: 11, name: "Francis Ngannou",     followers: "7.21M",  retired: false, fought2026: false, dispute: true  },
  { rank: 12, name: "Dustin Poirier",      followers: "5.95M",  retired: true,  fought2026: false, dispute: false },
  { rank: 13, name: "Georges St-Pierre",   followers: "5.73M",  retired: true,  fought2026: false, dispute: false },
  { rank: 14, name: "Arman Tsarukyan",     followers: "5.51M",  retired: false, fought2026: false, dispute: true  },
  { rank: 15, name: "Anderson Silva",      followers: "5.44M",  retired: true,  fought2026: false, dispute: false },
];

/* ==============================================================
   TABLE RENDER
   =============================================================== */
const tableBody = document.getElementById("fightTableBody");
const readout = document.getElementById("readout");
const stageLabel = document.getElementById("stageLabel");
const stageTitle = document.getElementById("stageTitle");
const stageSub = document.getElementById("stageSub");

function statusTag(f){
  if (f.retired) return `<span class="status-tag"><i class="dot dot--muted"></i>Retired</span>`;
  if (f.dispute) return `<span class="status-tag"><i class="dot dot--amber"></i>Disputed</span>`;
  return `<span class="status-tag"><i class="dot dot--neutral"></i>No dispute</span>`;
}

function buildRows(){
  tableBody.innerHTML = FIGHTERS.map(f => {
    const rowClasses = [];
    if (f.retired) rowClasses.push("status-retired");
    if (f.dispute) rowClasses.push("has-dispute");
    return `
      <tr data-name="${f.name}" data-retired="${f.retired}" data-fought="${f.fought2026}" data-dispute="${f.dispute}" class="${rowClasses.join(' ')}">
        <td class="col-rank">${String(f.rank).padStart(2,"0")}</td>
        <td class="col-name"><strong>${f.name}</strong></td>
        <td class="col-followers">${f.followers}</td>
        <td class="col-status">${statusTag(f)}</td>
      </tr>`;
  }).join("");
}
buildRows();

/* ----------------------------------------------------------------
   Fit the table exactly to whatever vertical space is available in
   the sticky stage, so all 15 rows (16 incl. header) are visible on
   screen at once with no internal scrolling — on any screen size.
   Re-measures on resize since "available space" changes with it.
   ------------------------------------------------------------- */
const STICKY_TOP = 64; // must match .tablestory__stage { top: 64px } in CSS
const TOTAL_TABLE_ROWS = FIGHTERS.length + 1; // +1 for header row

function fitTableToViewport(){
  const stage = document.querySelector(".tablestory__stage");
  const header = document.querySelector(".stage__header");
  const readoutEl = document.getElementById("readout");
  const legendEl = document.getElementById("legend");
  if (!stage || !header || !readoutEl || !legendEl) return;

  const root = document.documentElement.style;

  // Below the 880px breakpoint the stage is laid out statically (see
  // .tablestory__stage in styles.css), so the page scrolls normally and
  // none of the viewport-fitting below is needed — reset to defaults.
  if (getComputedStyle(stage).position !== "sticky"){
    root.removeProperty("--row-pad-v");
    root.removeProperty("--row-font");
    root.removeProperty("--row-font-head");
    root.removeProperty("--tag-pad-v");
    root.removeProperty("--tag-pad-h");
    return;
  }

  const stageStyles = getComputedStyle(stage);
  const readoutStyles = getComputedStyle(readoutEl);
  const legendStyles = getComputedStyle(legendEl);

  const chrome =
    STICKY_TOP +
    parseFloat(stageStyles.paddingTop) +
    header.getBoundingClientRect().height +
    readoutEl.getBoundingClientRect().height +
    parseFloat(readoutStyles.marginBottom) +
    parseFloat(legendStyles.marginTop) +
    legendEl.getBoundingClientRect().height +
    parseFloat(stageStyles.paddingBottom) +
    2; // border allowance on tableWrap

  // Only a tiny epsilon here — a real floor (e.g. 240) would force the
  // table to claim more height than is actually left on a short
  // viewport, which is exactly what was pushing the legend off screen.
  const available = Math.max(window.innerHeight - chrome, 20);

  // No lower bound on row height here (only an upper cap, for large
  // screens) — every size below is a plain fraction of it, so the 16
  // rows always add up to exactly `available` and all 15 fighters stay
  // on screen with no internal scrolling, however short the viewport.
  const rowHeight = Math.min(available / TOTAL_TABLE_ROWS, 42);

  // Everything below is derived from the SAME per-row content budget,
  // so the tallest element in a row (the status-tag pill, which has
  // its own padding stacked on top of its own text) is guaranteed to
  // fit within rowHeight rather than being sized independently and
  // silently overflowing it.
  const padV = Math.min(rowHeight * 0.22, 10);
  const contentAvail = Math.max(rowHeight - padV * 2 - 1, 1); // -1 for row border
  const lineHeightRatio = 1.15;

  const fontMain = Math.min(contentAvail / lineHeightRatio, 14);
  const tagPadV = Math.min(contentAvail * 0.12, 3);
  const fontHead = Math.min((contentAvail - tagPadV * 2) / lineHeightRatio, 10.5);
  const tagPadH = Math.min(fontHead * 0.7, 9);

  root.setProperty("--row-pad-v", padV.toFixed(1) + "px");
  root.setProperty("--row-font", fontMain.toFixed(1) + "px");
  root.setProperty("--row-font-head", fontHead.toFixed(1) + "px");
  root.setProperty("--tag-pad-v", tagPadV.toFixed(1) + "px");
  root.setProperty("--tag-pad-h", tagPadH.toFixed(1) + "px");
}

fitTableToViewport();
window.addEventListener("resize", fitTableToViewport);
if (document.fonts && document.fonts.ready){
  document.fonts.ready.then(fitTableToViewport);
}

const STAGES = [
  {
    label: "Step 1 of 3",
    title: "MMA's 15 biggest stars",
    sub: "Ranked by Instagram followers, May 2026",
    readout: null,
  },
  {
    label: "Step 2 of 3",
    title: "11 are still active",
    sub: "Four of the 15 are 100% retired from competition",
    readout: [
      { big: "4", small: "Retired" },
      { big: "11", small: "Still active" },
    ],
  },
  {
    label: "Step 3 of 3",
    title: "6 have disputed the UFC",
    sub: "Of the 11 active fighters, six have publicly clashed with the promotion",
    readout: [
      { big: "6", small: "Public disputes w/ UFC" },
      { big: "5", small: "No public dispute" },
    ],
  },
];

/* ----------------------------------------------------------------
   FLIP animation: capture row positions before a DOM/class change,
   apply the change, then animate the delta so remaining rows glide
   into the space left by any row that just got hidden (rather than
   the list just snapping/jumping upward).
   ------------------------------------------------------------- */
function withRowFlip(mutate){
  const rows = Array.from(tableBody.querySelectorAll("tr"));
  const firstRects = new Map();
  rows.forEach(row => {
    if (!row.classList.contains("is-hidden")){
      firstRects.set(row, row.getBoundingClientRect());
    }
  });

  mutate();

  rows.forEach(row => {
    if (row.classList.contains("is-hidden")) return;
    const first = firstRects.get(row);
    const last = row.getBoundingClientRect();

    if (!first){
      // row just became visible again (e.g. scrolling back up) — fade/slide in
      row.style.transition = "none";
      row.style.opacity = "0";
      row.style.transform = "translateY(-6px)";
      requestAnimationFrame(() => {
        row.style.transition = "opacity 0.4s ease, transform 0.45s cubic-bezier(.22,.9,.32,1)";
        row.style.opacity = "1";
        row.style.transform = "translateY(0)";
      });
      return;
    }

    const deltaY = first.top - last.top;
    if (Math.abs(deltaY) > 0.5){
      row.style.transition = "none";
      row.style.transform = `translateY(${deltaY}px)`;
      requestAnimationFrame(() => {
        row.style.transition = "transform 0.45s cubic-bezier(.22,.9,.32,1)";
        row.style.transform = "translateY(0)";
      });
    }
  });
}

function applyStage(stepIndex){
  const stage = STAGES[stepIndex];
  stageLabel.textContent = stage.label;
  stageTitle.textContent = stage.title;
  stageSub.textContent = stage.sub;

  readout.innerHTML = stage.readout
    ? stage.readout.map(r => `<div class="readout__stat"><b>${r.big}</b><span>${r.small}</span></div>`).join("")
    : "";

  withRowFlip(() => {
    const rows = tableBody.querySelectorAll("tr");
    rows.forEach(row => {
      const retired = row.dataset.retired === "true";
      const dispute = row.dataset.dispute === "true";
      row.classList.remove("is-hidden", "status-dispute");

      if (stepIndex === 0){
        // show everyone, no colour coding yet
        return;
      }
      if (stepIndex === 1){
        if (retired) row.classList.add("is-hidden");
        return;
      }
      if (stepIndex === 2){
        if (retired) { row.classList.add("is-hidden"); return; }
        if (dispute) row.classList.add("status-dispute");
      }
    });
  });

  fitTableToViewport();
}
applyStage(0);

/* Drive stage changes from the step column via IntersectionObserver */
const steps = document.querySelectorAll(".step");
const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      steps.forEach(s => s.classList.remove("is-active"));
      entry.target.classList.add("is-active");
      applyStage(Number(entry.target.dataset.step));
    }
  });
}, { root: null, threshold: 0.6 });
steps.forEach(s => stepObserver.observe(s));

/* ==============================================================
   FIGHTER CHAPTER TIMELINE RAIL
   ------------------------------------------------------------
   Drives the sticky side rail / mobile progress strip added to
   each .fighterChapter in index.html (see the matching CSS note
   in styles.css for how node dates were derived from the prose).

   Each chapter's rail nodes (li.chapterRail__node[data-node]) are
   paired by index with <span class="timelineAnchor" data-node>
   markers wrapped around the corresponding phrase in that
   fighter's paragraph. A thin IntersectionObserver band near the
   top of the viewport — the same technique as the .step observer
   above — detects which marker the reader is currently passing,
   marks the matching node active, and sets --rail-progress so the
   rail's fill line (and the mobile strip's fill) advances to it.

   NB: placed ahead of the HORIZONTAL SCROLLYTELLING block below
   because that block's #horiz target is currently commented out
   in index.html — document.getElementById("horiz") returns null
   there and the subsequent .querySelector() throws, which would
   otherwise stop this script before it reached this point.
   =============================================================== */
document.querySelectorAll(".fighterChapter").forEach(chapter => {
  const nodes = Array.from(chapter.querySelectorAll(".chapterRail__node"));
  const anchors = Array.from(chapter.querySelectorAll(".timelineAnchor"));
  const fillTargets = chapter.querySelectorAll(".chapterRail, .chapterRail__mobileBar");
  if (!nodes.length || !anchors.length) return;

  function setActiveNode(index){
    nodes.forEach((n, i) => n.classList.toggle("is-active", i === index));
    const pct = nodes.length > 1 ? (index / (nodes.length - 1)) * 100 : 100;
    fillTargets.forEach(el => el.style.setProperty("--rail-progress", pct + "%"));
  }
  setActiveNode(0);

  const railObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        setActiveNode(Number(entry.target.dataset.node));
      }
    });
  }, { root: null, rootMargin: "-40% 0px -55% 0px", threshold: 0 });

  anchors.forEach(a => railObserver.observe(a));
});

/* ==============================================================
   HERO SCROLL CUE
   =============================================================== */
document.getElementById("scrollCue").addEventListener("click", () => {
  document.querySelector(".lede").scrollIntoView({ behavior: "smooth" });
});