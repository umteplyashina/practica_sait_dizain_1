/**
 * Vanilla TextType — адаптация React Bits TextType для HTML/JS сайта.
 * Без React и npm: чистый JS + CSS-мигание курсора.
 */
class TextType {
  constructor(element, options = {}) {
    this.el = element;
    this.text = Array.isArray(options.text) ? options.text : [options.text || ""];
    this.typingSpeed = options.typingSpeed ?? 75;
    this.deletingSpeed = options.deletingSpeed ?? 50;
    this.pauseDuration = options.pauseDuration ?? 1500;
    this.initialDelay = options.initialDelay ?? 400;
    this.loop = options.loop ?? true;
    this.showCursor = options.showCursor ?? true;
    this.cursorCharacter = options.cursorCharacter ?? "_";
    this.hideCursorWhileTyping = options.hideCursorWhileTyping ?? false;
    this.variableSpeed = options.variableSpeed ?? null;
    this.startOnVisible = options.startOnVisible ?? false;
    this.reverseMode = options.reverseMode ?? false;
    this.onSentenceComplete = options.onSentenceComplete ?? null;

    this.displayedText = "";
    this.currentCharIndex = 0;
    this.isDeleting = false;
    this.currentTextIndex = 0;
    this.isVisible = !this.startOnVisible;
    this.timeoutId = null;
    this.destroyed = false;
    this.hasStarted = false;

    this.contentEl = null;
    this.cursorEl = null;

    this.mount();
  }

  mount() {
    this.el.classList.add("text-type");
    this.el.setAttribute("aria-label", this.text.join(". "));
    this.el.textContent = "";

    this.contentEl = document.createElement("span");
    this.contentEl.className = "text-type__content";
    this.contentEl.setAttribute("aria-hidden", "true");
    this.el.appendChild(this.contentEl);

    if (this.showCursor) {
      this.cursorEl = document.createElement("span");
      this.cursorEl.className = "text-type__cursor";
      this.cursorEl.setAttribute("aria-hidden", "true");
      this.cursorEl.textContent = this.cursorCharacter;
      this.el.appendChild(this.cursorEl);
    }

    if (this.startOnVisible) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.isVisible = true;
              this.tick();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(this.el);
    } else {
      this.tick();
    }
  }

  getSpeed() {
    if (!this.variableSpeed) return this.typingSpeed;
    const { min, max } = this.variableSpeed;
    return Math.random() * (max - min) + min;
  }

  getProcessedText() {
    const current = this.text[this.currentTextIndex] || "";
    return this.reverseMode ? current.split("").reverse().join("") : current;
  }

  updateCursorVisibility() {
    if (!this.cursorEl) return;
    const fullLength = (this.text[this.currentTextIndex] || "").length;
    const typing = this.currentCharIndex < fullLength || this.isDeleting;
    this.cursorEl.classList.toggle(
      "text-type__cursor--hidden",
      this.hideCursorWhileTyping && typing
    );
  }

  schedule(fn, delay) {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(fn, delay);
  }

  tick() {
    if (this.destroyed || !this.isVisible) return;

    const processedText = this.getProcessedText();
    this.updateCursorVisibility();

    const run = () => {
      if (this.destroyed) return;

      if (this.isDeleting) {
        if (this.displayedText === "") {
          this.isDeleting = false;

          if (this.currentTextIndex === this.text.length - 1 && !this.loop) {
            return;
          }

          if (typeof this.onSentenceComplete === "function") {
            this.onSentenceComplete(this.text[this.currentTextIndex], this.currentTextIndex);
          }

          this.currentTextIndex = (this.currentTextIndex + 1) % this.text.length;
          this.currentCharIndex = 0;
          this.schedule(() => this.tick(), this.pauseDuration);
          return;
        }

        this.displayedText = this.displayedText.slice(0, -1);
        this.contentEl.textContent = this.displayedText;
        this.schedule(() => this.tick(), this.deletingSpeed);
        return;
      }

      if (this.currentCharIndex < processedText.length) {
        this.displayedText += processedText[this.currentCharIndex];
        this.currentCharIndex += 1;
        this.contentEl.textContent = this.displayedText;
        this.schedule(() => this.tick(), this.getSpeed());
        return;
      }

      if (!this.loop && this.currentTextIndex === this.text.length - 1) {
        return;
      }

      this.schedule(() => {
        this.isDeleting = true;
        this.tick();
      }, this.pauseDuration);
    };

    if (this.currentCharIndex === 0 && !this.isDeleting && this.displayedText === "" && !this.hasStarted) {
      this.hasStarted = true;
      this.schedule(run, this.initialDelay);
    } else {
      run();
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timeoutId);
  }
}

window.TextType = TextType;
