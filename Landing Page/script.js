/* ==============================================================
   Landing page interactions: reveal-on-scroll, sticky nav
   solidifying past the hero, a reading-progress bar, count-up
   stats, and the hero scroll cue. Everything here is additive —
   the page is fully readable with JS disabled.
   ============================================================= */

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ==============================================================
   SCROLL REVEAL
   ============================================================= */
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

/* ==============================================================
   COUNT-UP STATS — animates numbers into view once, then leaves
   the final value in place. Reduced motion / no-JS just shows
   the target value immediately (rendered by the browser without
   this script running at all, since markup already has a value).
   ============================================================= */
const countEls = document.querySelectorAll("[data-countup]");

function formatCount(el, value) {
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  return `${prefix}${value}${suffix}`;
}

function animateCount(el) {
  const target = parseFloat(el.dataset.target);
  const isDecimal = String(el.dataset.target).includes(".");

  if (prefersReducedMotion) {
    el.textContent = formatCount(el, isDecimal ? target.toFixed(1) : target);
    return;
  }

  const duration = 1100;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    el.textContent = formatCount(el, isDecimal ? current.toFixed(1) : Math.round(current));
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

if ("IntersectionObserver" in window) {
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  countEls.forEach(el => countObserver.observe(el));
} else {
  countEls.forEach(animateCount);
}

/* ==============================================================
   NAV — transparent over the hero, solid once scrolled past it
   ============================================================= */
const siteNav = document.getElementById("siteNav");
const heroEl = document.querySelector(".hero");

if (siteNav && heroEl && "IntersectionObserver" in window) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      siteNav.classList.toggle("siteNav--solid", !entry.isIntersecting);
    });
  }, { threshold: 0, rootMargin: "-72px 0px 0px 0px" });
  navObserver.observe(heroEl);
}

/* ==============================================================
   READING PROGRESS BAR
   ============================================================= */
const progressBar = document.getElementById("progressBar");
let progressTicking = false;

function updateProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  if (progressBar) progressBar.style.width = pct + "%";
  progressTicking = false;
}

if (progressBar) {
  window.addEventListener("scroll", () => {
    if (!progressTicking) {
      requestAnimationFrame(updateProgress);
      progressTicking = true;
    }
  }, { passive: true });
  updateProgress();
}

/* ==============================================================
   HERO SCROLL CUE
   ============================================================= */
const scrollCue = document.getElementById("scrollCue");
if (scrollCue) {
  scrollCue.addEventListener("click", () => {
    document.querySelector(".lede").scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
}
