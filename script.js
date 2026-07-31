const header = document.querySelector(".site-header");
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
const year = document.getElementById("year");
const progressBar = document.querySelector(".scroll-progress__bar");
const heroPhotoParallax = document.querySelector(".hero-photo__parallax");
const hero = document.querySelector(".hero");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (year) {
  year.textContent = String(new Date().getFullYear());
}

const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 16);
};

const setScrollProgress = () => {
  if (!progressBar) return;
  const doc = document.documentElement;
  const max = doc.scrollHeight - doc.clientHeight;
  const value = max > 0 ? (window.scrollY / max) * 100 : 0;
  progressBar.style.width = `${Math.min(100, Math.max(0, value))}%`;
};

const setPhotoParallax = () => {
  if (!heroPhotoParallax || !hero || reduceMotion) return;
  const rect = hero.getBoundingClientRect();
  const viewH = window.innerHeight || 1;
  const progress = (viewH - rect.top) / (viewH + rect.height);
  const clamped = Math.min(1, Math.max(0, progress));
  const shift = (clamped - 0.35) * 48;
  heroPhotoParallax.style.transform = `translate3d(0, calc(-6% + ${shift}px), 0)`;
};

const onScroll = () => {
  setHeaderState();
  setScrollProgress();
  setPhotoParallax();
};

setHeaderState();
setScrollProgress();
setPhotoParallax();
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", onScroll, { passive: true });

if (toggle && header && nav) {
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

const revealTargets = document.querySelectorAll(
  ".section-head, .about-copy, .about-side, .skill, .step, .project, .why-lead, .why-block, .why-formula, .badges, .stack-note, .audience-lead, .audience-card, .fit-lead, .fit-quiz, .reviews-intro, .manifesto, .cta-inner, .contact-link, .socials"
);

const projects = document.querySelectorAll(".project");
projects.forEach((project, index) => {
  project.style.setProperty("--i", String(index));
});

revealTargets.forEach((el, index) => {
  el.classList.add("reveal");
  if (!el.style.getPropertyValue("--i")) {
    el.style.setProperty("--i", String(index % 6));
  }
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
  );

  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add("is-visible"));
}

const brandType = document.querySelector("[data-text-type]");
if (brandType && window.TextType) {
  if (reduceMotion) {
    brandType.textContent = "Vibe Coder";
  } else {
    new window.TextType(brandType, {
      text: ["Vibe Coder", "Web & AI", "Digital Form"],
      typingSpeed: 120,
      deletingSpeed: 70,
      pauseDuration: 2200,
      initialDelay: 600,
      showCursor: true,
      cursorCharacter: "_",
      loop: true,
      startOnVisible: true,
    });
  }
}

document
  .querySelectorAll(
    ".btn, .logo, .nav a, .nav-cta, .nav-toggle, .contact-link, .socials a, .project, .badges li, .site-footer a, .fit-option, .project-preview, .project-link"
  )
  .forEach((el) => el.classList.add("cursor-target"));

if (typeof window.initTargetCursor === "function") {
  window.initTargetCursor({
    spinDuration: 2,
    hideDefaultCursor: true,
    parallaxOn: true,
    hoverDuration: 0.2,
    cursorColor: "#ffffff",
    cursorColorOnTarget: "#ff4d1a",
  });
}

const lightbox = document.getElementById("project-lightbox");
const lightboxTitle = lightbox?.querySelector(".lightbox-title");
const lightboxImage = lightbox?.querySelector(".lightbox-image");
const lightboxTriggers = document.querySelectorAll("[data-project-preview]");
const lightboxClosers = lightbox?.querySelectorAll("[data-lightbox-close]");

const openLightbox = (src, title) => {
  if (!lightbox || !lightboxImage || !lightboxTitle) return;
  lightboxImage.setAttribute("src", src);
  lightboxImage.setAttribute("alt", title);
  lightboxTitle.textContent = title;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const closeLightbox = () => {
  if (!lightbox || !lightboxImage) return;
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.setAttribute("src", "");
  lightboxImage.setAttribute("alt", "");
  document.body.style.overflow = "";
};

lightboxTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    const src = trigger.getAttribute("data-project-preview");
    const title = trigger.getAttribute("data-project-title") || "Проект";
    if (src) openLightbox(src, title);
  });
});

lightboxClosers?.forEach((closer) => {
  closer.addEventListener("click", closeLightbox);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLightbox();
  }
});
