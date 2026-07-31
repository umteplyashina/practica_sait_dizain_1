/* TargetCursor — vanilla-адаптация React Bits + GSAP под HTML-сайт */

const getContainingBlock = (element) => {
  let node = element?.parentElement;
  while (node && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (
      style.transform !== "none" ||
      style.perspective !== "none" ||
      style.filter !== "none" ||
      style.willChange.includes("transform") ||
      style.willChange.includes("perspective") ||
      style.willChange.includes("filter") ||
      /paint|layout|strict|content/.test(style.contain)
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
};

const getContainingBlockOffset = (block) => {
  if (!block) return { x: 0, y: 0 };
  const rect = block.getBoundingClientRect();
  return { x: rect.left + block.clientLeft, y: rect.top + block.clientTop };
};

const isMobileDevice = () => {
  const hasTouchScreen = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isSmallScreen = window.innerWidth <= 768;
  const userAgent = navigator.userAgent || navigator.vendor || window.opera || "";
  const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );
  return (hasTouchScreen && isSmallScreen) || isMobileUserAgent;
};

function initTargetCursor(options = {}) {
  const gsap = window.gsap;
  if (!gsap) return null;

  const {
    targetSelector = ".cursor-target",
    spinDuration = 2,
    hideDefaultCursor = true,
    hoverDuration = 0.2,
    parallaxOn = true,
    cursorColor = "#ffffff",
    cursorColorOnTarget = "#ff4d1a",
  } = options;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || isMobileDevice()) return null;

  const cursor = document.querySelector(".target-cursor-wrapper");
  const dot = document.querySelector(".target-cursor-dot");
  if (!cursor || !dot) return null;

  const corners = cursor.querySelectorAll(".target-cursor-corner");
  const constants = { borderWidth: 3, cornerSize: 12 };

  const activeStrength = { current: 0 };
  let containingBlock = getContainingBlock(cursor);
  let spinTl = null;
  let isActive = false;
  let targetCornerPositions = null;
  let activeTarget = null;
  let currentLeaveHandler = null;
  let resumeTimeout = null;
  const originalCursor = document.body.style.cursor;

  document.body.classList.add("has-target-cursor");
  if (hideDefaultCursor) {
    document.body.style.cursor = "none";
  }

  corners.forEach((corner) => {
    corner.style.borderColor = cursorColor;
  });
  dot.style.backgroundColor = cursorColor;

  const getOffset = () => getContainingBlockOffset(containingBlock);

  const moveCursor = (x, y) => {
    const { x: offsetX, y: offsetY } = getOffset();
    gsap.to(cursor, {
      x: x - offsetX,
      y: y - offsetY,
      duration: 0.1,
      ease: "power3.out",
    });
  };

  const cleanupTarget = (target) => {
    if (currentLeaveHandler && target) {
      target.removeEventListener("mouseleave", currentLeaveHandler);
    }
    currentLeaveHandler = null;
  };

  const createSpinTimeline = () => {
    if (spinTl) spinTl.kill();
    spinTl = gsap
      .timeline({ repeat: -1 })
      .to(cursor, { rotation: "+=360", duration: spinDuration, ease: "none" });
  };

  const initialOffset = getOffset();
  gsap.set(cursor, {
    xPercent: -50,
    yPercent: -50,
    x: window.innerWidth / 2 - initialOffset.x,
    y: window.innerHeight / 2 - initialOffset.y,
  });
  createSpinTimeline();

  const tickerFn = () => {
    if (!targetCornerPositions || !cursor || !corners.length) return;
    const strength = activeStrength.current;
    if (strength === 0) return;

    const cursorX = gsap.getProperty(cursor, "x");
    const cursorY = gsap.getProperty(cursor, "y");

    Array.from(corners).forEach((corner, i) => {
      const currentX = gsap.getProperty(corner, "x");
      const currentY = gsap.getProperty(corner, "y");
      const targetX = targetCornerPositions[i].x - cursorX;
      const targetY = targetCornerPositions[i].y - cursorY;
      const finalX = currentX + (targetX - currentX) * strength;
      const finalY = currentY + (targetY - currentY) * strength;
      const duration = strength >= 0.99 ? (parallaxOn ? 0.2 : 0) : 0.05;

      gsap.to(corner, {
        x: finalX,
        y: finalY,
        duration,
        ease: duration === 0 ? "none" : "power1.out",
        overwrite: "auto",
      });
    });
  };

  const moveHandler = (e) => moveCursor(e.clientX, e.clientY);

  const scrollHandler = () => {
    if (!activeTarget || !cursor) return;
    const { x: offsetX, y: offsetY } = getOffset();
    const mouseX = gsap.getProperty(cursor, "x") + offsetX;
    const mouseY = gsap.getProperty(cursor, "y") + offsetY;
    const elementUnderMouse = document.elementFromPoint(mouseX, mouseY);
    const isStillOverTarget =
      elementUnderMouse &&
      (elementUnderMouse === activeTarget ||
        elementUnderMouse.closest(targetSelector) === activeTarget);
    if (!isStillOverTarget && currentLeaveHandler) {
      currentLeaveHandler();
    }
  };

  const mouseDownHandler = () => {
    gsap.to(dot, { scale: 0.7, duration: 0.3 });
    gsap.to(cursor, { scale: 0.9, duration: 0.2 });
  };

  const mouseUpHandler = () => {
    gsap.to(dot, { scale: 1, duration: 0.3 });
    gsap.to(cursor, { scale: 1, duration: 0.2 });
  };

  const enterHandler = (e) => {
    const allTargets = [];
    let current = e.target;
    while (current && current !== document.body) {
      if (current.matches?.(targetSelector)) {
        allTargets.push(current);
      }
      current = current.parentElement;
    }

    const target = allTargets[0] || null;
    if (!target || !cursor || !corners.length) return;
    if (activeTarget === target) return;

    if (activeTarget) cleanupTarget(activeTarget);
    if (resumeTimeout) {
      clearTimeout(resumeTimeout);
      resumeTimeout = null;
    }

    activeTarget = target;
    Array.from(corners).forEach((corner) => gsap.killTweensOf(corner, "x,y"));
    gsap.killTweensOf(cursor, "rotation");
    spinTl?.pause();
    gsap.set(cursor, { rotation: 0 });

    if (cursorColorOnTarget) {
      gsap.to(Array.from(corners), {
        borderColor: cursorColorOnTarget,
        duration: 0.15,
        ease: "power2.out",
      });
      gsap.to(dot, {
        backgroundColor: cursorColorOnTarget,
        duration: 0.15,
        ease: "power2.out",
      });
    }

    const rect = target.getBoundingClientRect();
    const { borderWidth, cornerSize } = constants;
    const { x: offsetX, y: offsetY } = getOffset();
    const cursorX = gsap.getProperty(cursor, "x");
    const cursorY = gsap.getProperty(cursor, "y");

    targetCornerPositions = [
      { x: rect.left - borderWidth - offsetX, y: rect.top - borderWidth - offsetY },
      {
        x: rect.right + borderWidth - cornerSize - offsetX,
        y: rect.top - borderWidth - offsetY,
      },
      {
        x: rect.right + borderWidth - cornerSize - offsetX,
        y: rect.bottom + borderWidth - cornerSize - offsetY,
      },
      {
        x: rect.left - borderWidth - offsetX,
        y: rect.bottom + borderWidth - cornerSize - offsetY,
      },
    ];

    isActive = true;
    gsap.ticker.add(tickerFn);

    gsap.to(activeStrength, {
      current: 1,
      duration: hoverDuration,
      ease: "power2.out",
    });

    Array.from(corners).forEach((corner, i) => {
      gsap.to(corner, {
        x: targetCornerPositions[i].x - cursorX,
        y: targetCornerPositions[i].y - cursorY,
        duration: 0.2,
        ease: "power2.out",
      });
    });

    const leaveHandler = () => {
      gsap.ticker.remove(tickerFn);
      isActive = false;
      targetCornerPositions = null;
      gsap.set(activeStrength, { current: 0, overwrite: true });
      activeTarget = null;

      if (cursorColorOnTarget) {
        gsap.to(Array.from(corners), {
          borderColor: cursorColor,
          duration: 0.15,
          ease: "power2.out",
        });
        gsap.to(dot, {
          backgroundColor: cursorColor,
          duration: 0.15,
          ease: "power2.out",
        });
      }

      gsap.killTweensOf(Array.from(corners), "x,y");
      const positions = [
        { x: -constants.cornerSize * 1.5, y: -constants.cornerSize * 1.5 },
        { x: constants.cornerSize * 0.5, y: -constants.cornerSize * 1.5 },
        { x: constants.cornerSize * 0.5, y: constants.cornerSize * 0.5 },
        { x: -constants.cornerSize * 1.5, y: constants.cornerSize * 0.5 },
      ];
      const tl = gsap.timeline();
      Array.from(corners).forEach((corner, index) => {
        tl.to(
          corner,
          {
            x: positions[index].x,
            y: positions[index].y,
            duration: 0.3,
            ease: "power3.out",
          },
          0
        );
      });

      resumeTimeout = setTimeout(() => {
        if (!activeTarget && cursor && spinTl) {
          const currentRotation = gsap.getProperty(cursor, "rotation");
          const normalizedRotation = currentRotation % 360;
          spinTl.kill();
          spinTl = gsap
            .timeline({ repeat: -1 })
            .to(cursor, { rotation: "+=360", duration: spinDuration, ease: "none" });
          gsap.to(cursor, {
            rotation: normalizedRotation + 360,
            duration: spinDuration * (1 - normalizedRotation / 360),
            ease: "none",
            onComplete: () => spinTl?.restart(),
          });
        }
        resumeTimeout = null;
      }, 50);

      cleanupTarget(target);
    };

    currentLeaveHandler = leaveHandler;
    target.addEventListener("mouseleave", leaveHandler);
  };

  const resizeHandler = () => {
    containingBlock = getContainingBlock(cursor);
  };

  window.addEventListener("mousemove", moveHandler);
  window.addEventListener("mouseover", enterHandler, { passive: true });
  window.addEventListener("scroll", scrollHandler, { passive: true });
  window.addEventListener("resize", resizeHandler);
  window.addEventListener("mousedown", mouseDownHandler);
  window.addEventListener("mouseup", mouseUpHandler);

  return () => {
    gsap.ticker.remove(tickerFn);
    window.removeEventListener("mousemove", moveHandler);
    window.removeEventListener("mouseover", enterHandler);
    window.removeEventListener("scroll", scrollHandler);
    window.removeEventListener("resize", resizeHandler);
    window.removeEventListener("mousedown", mouseDownHandler);
    window.removeEventListener("mouseup", mouseUpHandler);
    if (activeTarget) cleanupTarget(activeTarget);
    spinTl?.kill();
    document.body.style.cursor = originalCursor;
    document.body.classList.remove("has-target-cursor");
    isActive = false;
    targetCornerPositions = null;
    activeStrength.current = 0;
  };
}

window.initTargetCursor = initTargetCursor;
