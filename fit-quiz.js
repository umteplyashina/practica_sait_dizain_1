(() => {
  const root = document.querySelector("[data-fit-quiz]");
  if (!root) return;

  const questions = [
    {
      text: "Кто вы и что сейчас нужно упаковать?",
      options: [
        {
          label: "Эксперт / коуч / консультант — нужен личный сайт или лендинг",
          score: 2,
        },
        {
          label: "Креатор или фаундер AI/digital-продукта — нужен запуск или портфолио",
          score: 2,
        },
        {
          label: "Пока просто хочу «сайт побыстрее и подешевле»",
          score: 0,
        },
      ],
    },
    {
      text: "Что для вас важнее в результате?",
      options: [
        {
          label: "Чтобы с первого экрана было понятно, кто я и кому подхожу",
          score: 2,
        },
        {
          label: "Чтобы было красиво и современно, но без потери смысла",
          score: 2,
        },
        {
          label: "Главное — закрыть задачу минимальными затратами",
          score: 0,
        },
      ],
    },
    {
      text: "Как вы хотите работать над проектом?",
      options: [
        {
          label: "Готов/а обсуждать аудиторию, тон и ощущение — не только блоки",
          score: 2,
        },
        {
          label: "Есть понимание задачи, нужен сильный партнёр по сборке и подаче",
          score: 2,
        },
        {
          label: "Просто сделайте красиво, смысл разберёмся потом",
          score: 0,
        },
      ],
    },
    {
      text: "Какой формат вам ближе сейчас?",
      options: [
        {
          label: "Сильная первая версия с характером — без месяцев согласований",
          score: 2,
        },
        {
          label: "Концепт + структура + сборка под конкретный запуск",
          score: 2,
        },
        {
          label: "Шаблон «как у всех», лишь бы было",
          score: 0,
        },
      ],
    },
  ];

  const results = {
    yes: {
      eyebrow: "Нам по пути",
      title: "Похоже, получится сильный проект",
      text: "Вы думаете про человека, смысл и ощущение — а не только про «набор блоков». Напишите коротко, кто вы и что нужно собрать: разберём, как это может выглядеть.",
      primaryHref: "#contact",
      primaryLabel: "Написать мне",
    },
    maybe: {
      eyebrow: "Почти",
      title: "Есть потенциал — давайте уточним задачу",
      text: "Кажется, запрос можно собрать сильно, но пока не хватает ясности. Напишите, для кого страница и что сейчас бесит в текущем варианте — так быстрее поймём, стоит ли идти вместе.",
      primaryHref: "#contact",
      primaryLabel: "Уточнить задачу",
    },
    no: {
      eyebrow: "Честно",
      title: "Сейчас, скорее всего, не мой формат",
      text: "Если нужен самый быстрый шаблон без разговора о смысле и аудитории — я не лучший выбор. Можете посмотреть работы или вернуться, когда захочется страницу с характером.",
      primaryHref: "#projects",
      primaryLabel: "Посмотреть работы",
    },
  };

  const stepLabel = root.querySelector("[data-fit-step]");
  const questionEl = root.querySelector("[data-fit-question]");
  const optionsEl = root.querySelector("[data-fit-options]");
  const progressEl = root.querySelector("[data-fit-progress]");
  const questionsStage = root.querySelector('[data-fit-stage="questions"]');
  const resultStage = root.querySelector('[data-fit-stage="result"]');
  const resultEyebrow = root.querySelector("[data-fit-result-eyebrow]");
  const resultTitle = root.querySelector("[data-fit-result-title]");
  const resultText = root.querySelector("[data-fit-result-text]");
  const primaryBtn = root.querySelector("[data-fit-primary]");
  const restartBtn = root.querySelector("[data-fit-restart]");

  let index = 0;
  let score = 0;

  const setProgress = () => {
    if (!progressEl) return;
    const value = ((index) / questions.length) * 100;
    progressEl.style.width = `${value}%`;
  };

  const renderQuestion = () => {
    const current = questions[index];
    if (!current || !questionEl || !optionsEl || !stepLabel) return;

    questionsStage?.classList.remove("is-hidden");
    resultStage?.classList.add("is-hidden");

    stepLabel.textContent = `Вопрос ${index + 1} из ${questions.length}`;
    questionEl.textContent = current.text;
    optionsEl.innerHTML = "";

    current.options.forEach((option, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fit-option cursor-target";
      button.innerHTML = `<span class="fit-option-index">0${optionIndex + 1}</span><span class="fit-option-text">${option.label}</span>`;
      button.addEventListener("click", () => {
        score += option.score;
        index += 1;
        if (index >= questions.length) {
          showResult();
        } else {
          setProgress();
          renderQuestion();
        }
      });
      optionsEl.appendChild(button);
    });

    setProgress();
  };

  const showResult = () => {
    let key = "maybe";
    if (score >= 7) key = "yes";
    else if (score <= 2) key = "no";

    const result = results[key];
    questionsStage?.classList.add("is-hidden");
    resultStage?.classList.remove("is-hidden");

    if (stepLabel) stepLabel.textContent = "Результат";
    if (progressEl) progressEl.style.width = "100%";
    if (resultEyebrow) resultEyebrow.textContent = result.eyebrow;
    if (resultTitle) resultTitle.textContent = result.title;
    if (resultText) resultText.textContent = result.text;
    if (primaryBtn) {
      primaryBtn.setAttribute("href", result.primaryHref);
      primaryBtn.textContent = result.primaryLabel;
    }

    root.dataset.result = key;
  };

  const restart = () => {
    index = 0;
    score = 0;
    delete root.dataset.result;
    renderQuestion();
  };

  restartBtn?.addEventListener("click", restart);
  renderQuestion();
})();
