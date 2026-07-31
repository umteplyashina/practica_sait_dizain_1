(() => {
  const track = document.querySelector("[data-reviews-track]");
  const cards = Array.from(document.querySelectorAll("[data-reviews-card]"));
  if (!track || !cards.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileQuery = window.matchMedia("(max-width: 720px)");

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;

  const setCardTransform = (card, index, progress, total) => {
    // Equal scroll slices: card 0 leaves first, then 1, etc.
    // Last card stays visible at the end.
    const leaveCount = Math.max(total - 1, 1);
    const slice = 1 / leaveCount;
    const start = index * slice;
    const end = start + slice;

    let exit = 0;
    if (index < total - 1) {
      exit = easeOutCubic(clamp((progress - start) / (end - start), 0, 1));
    } else {
      // Last card only gently settles into place
      exit = 0;
    }

    // Deck resting pose: slight cascade so cards aren't a flat pile
    const restY = index * 18;
    const restScale = 1 - index * 0.035;
    const restRotate = index * -2.5;

    // Exit motion: fly up + slight twist
    const flyY = exit * -130;
    const flyX = exit * (index % 2 === 0 ? -18 : 22);
    const flyRotate = exit * (index % 2 === 0 ? -14 : 16);
    const opacity = exit > 0.82 ? clamp(1 - (exit - 0.82) / 0.18, 0, 1) : 1;

    card.style.zIndex = String((total - index) * 10);
    card.style.opacity = String(opacity);
    card.style.pointerEvents = exit > 0.9 ? "none" : "auto";
    card.style.transform = [
      `translate(${flyX}%, calc(${restY}px + ${flyY}%))`,
      `rotate(${restRotate + flyRotate}deg)`,
      `scale(${restScale})`,
    ].join(" ");
  };

  const resetCards = () => {
    cards.forEach((card) => {
      card.style.top = "";
      card.style.zIndex = "";
      card.style.transform = "";
      card.style.filter = "";
      card.style.opacity = "";
      card.style.pointerEvents = "";
    });
  };

  let ticker = null;
  let scrollTriggerInstance = null;
  let scrollHandler = null;
  let resizeHandler = null;

  const destroyAnimation = () => {
    if (scrollTriggerInstance) {
      scrollTriggerInstance.kill();
      scrollTriggerInstance = null;
    }
    if (ticker) {
      cancelAnimationFrame(ticker);
      ticker = null;
    }
    if (scrollHandler) {
      window.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
      resizeHandler = null;
    }
    resetCards();
  };

  const updateFromScroll = () => {
    const rect = track.getBoundingClientRect();
    const viewH = window.innerHeight || 1;
    const totalScroll = Math.max(rect.height - viewH, 1);
    const scrolled = clamp(-rect.top, 0, totalScroll);
    const progress = scrolled / totalScroll;
    cards.forEach((card, index) => setCardTransform(card, index, progress, cards.length));
  };

  const initWithGsap = () => {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    if (!gsap || !ScrollTrigger) return false;

    gsap.registerPlugin(ScrollTrigger);
    scrollTriggerInstance = ScrollTrigger.create({
      trigger: track,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.35,
      onUpdate: (self) => {
        cards.forEach((card, index) =>
          setCardTransform(card, index, self.progress, cards.length)
        );
      },
    });

    cards.forEach((card, index) => setCardTransform(card, index, 0, cards.length));
    return true;
  };

  const initFallback = () => {
    scrollHandler = () => {
      cancelAnimationFrame(ticker);
      ticker = requestAnimationFrame(updateFromScroll);
    };
    resizeHandler = scrollHandler;
    updateFromScroll();
    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler, { passive: true });
  };

  const setup = () => {
    destroyAnimation();
    if (reduceMotion || mobileQuery.matches) {
      resetCards();
      return;
    }
    if (!initWithGsap()) initFallback();
  };

  setup();
  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", setup);
  } else if (typeof mobileQuery.addListener === "function") {
    mobileQuery.addListener(setup);
  }
})();
