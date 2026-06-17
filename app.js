const dataFileEl = document.getElementById('dataFile');
const modeEl = document.getElementById('mode');
const courseFilterEl = document.getElementById('courseFilter');
const startBtn = document.getElementById('startBtn');
const resetExamBtn = document.getElementById('resetExamBtn');
const summaryEl = document.getElementById('summary');
const questionListEl = document.getElementById('questionList');
const questionTemplate = document.getElementById('questionTemplate');
const navigationEl = document.getElementById('navigation');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

const COURSE_LABELS = {
  mixed: 'Μεικτό (Mixed)',
  dental_surgery: 'Οδοντική Χειρουργική',
  periodontology: 'Περιοδοντολογία',
  endodontics: 'Ενδοδοντολογία'
};

let allQuestions = [];
let visibleQuestions = [];
let currentQuestionIndex = 0;
const selectedAnswers = new Map();

initializeApp();

function initializeApp() {
  summaryEl.textContent = 'Επιλέξτε ένα αρχείο δεδομένων.';
  
  dataFileEl.addEventListener('change', async (e) => {
    if (!e.target.value) {
      summaryEl.textContent = 'Επιλέξτε ένα αρχείο δεδομένων.';
      questionListEl.replaceChildren();
      return;
    }
    
    summaryEl.textContent = 'Φόρτωση ερωτήσεων...';
    try {
      allQuestions = await loadQuestions(e.target.value);
      selectedAnswers.clear();
      modeEl.disabled = false;
      courseFilterEl.disabled = false;
      updateCourseFilterOptions(e.target.value);
      courseFilterEl.value = 'all';
      applyMode();
    } catch (error) {
      summaryEl.textContent = 'Σφάλμα φόρτωσης. Ελέγξτε το επιλεγμένο αρχείο.';
      console.error(error);
      modeEl.disabled = true;
      courseFilterEl.disabled = true;
    }
  });

  startBtn.addEventListener('click', applyMode);
  resetExamBtn.addEventListener('click', () => {
    if (modeEl.value === 'exam') {
      applyMode(true);
    }
  });
  
  prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      renderSingleQuestion();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (currentQuestionIndex < visibleQuestions.length - 1) {
      currentQuestionIndex++;
      renderSingleQuestion();
    }
  });
}

function updateCourseFilterOptions(filePath) {
  const isMixed = filePath.includes('questions-data-mixed.js');
  
  if (isMixed) {
    // Show only mixed option
    courseFilterEl.innerHTML = `
      <option value="all">Όλα τα μαθήματα</option>
      <option value="mixed">Μεικτό (Mixed)</option>
    `;
  } else {
    // Show all course options
    courseFilterEl.innerHTML = `
      <option value="all">Όλα τα μαθήματα</option>
      <option value="dental_surgery">Οδοντική Χειρουργική</option>
      <option value="periodontology">Περιοδοντολογία</option>
      <option value="endodontics">Ενδοδοντολογία</option>
    `;
  }
}

async function loadQuestions(filePath) {
  if (filePath.endsWith('.json')) {
    // Load JSON file
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to load ${filePath}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.questions)) {
      throw new Error('Invalid JSON format: expected questions[]');
    }
    return data.questions;
  } else if (filePath.endsWith('.js')) {
    // Load JavaScript file that sets window.QUESTIONS_DATA
    // First, clear any previous data
    delete window.QUESTIONS_DATA;
    
    // Load the script
    const script = document.createElement('script');
    script.src = filePath;
    script.async = false;
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        const data = window.QUESTIONS_DATA;
        if (!data || !Array.isArray(data.questions)) {
          reject(new Error('Invalid .js format: expected window.QUESTIONS_DATA with questions[]'));
        } else {
          resolve(data.questions);
        }
        document.body.removeChild(script);
      };
      script.onerror = () => {
        reject(new Error(`Failed to load ${filePath}`));
        document.body.removeChild(script);
      };
      document.body.appendChild(script);
    });
  } else {
    throw new Error('Unsupported file format. Use .json or .js files.');
  }
}

function applyMode(forceNewExam = false) {
  const mode = modeEl.value;
  const course = courseFilterEl.value;

  selectedAnswers.clear();
  currentQuestionIndex = 0;

  if (mode === 'exam') {
    visibleQuestions = createExamSet(course, forceNewExam);
  } else {
    visibleQuestions = allQuestions.filter((q) => course === 'all' || q.courseId === course);
  }

  navigationEl.style.display = visibleQuestions.length > 0 ? 'flex' : 'none';
  renderSummary();
  renderSingleQuestion();
}

function createExamSet(courseFilter) {
  const required = 50;

  if (courseFilter !== 'all') {
    const pool = allQuestions.filter((q) => q.courseId === courseFilter);
    return shuffle(pool).slice(0, Math.min(150, pool.length));
  }

  // Check if this is a mixed-only dataset
  const mixedQuestions = allQuestions.filter((q) => q.courseId === 'mixed');
  if (mixedQuestions.length > 0 && allQuestions.every((q) => q.courseId === 'mixed')) {
    return shuffle(mixedQuestions).slice(0, Math.min(150, mixedQuestions.length));
  }

  const ds = allQuestions.filter((q) => q.courseId === 'dental_surgery');
  const pe = allQuestions.filter((q) => q.courseId === 'periodontology');
  const en = allQuestions.filter((q) => q.courseId === 'endodontics');

  const exam = [
    ...shuffle(ds).slice(0, Math.min(required, ds.length)),
    ...shuffle(pe).slice(0, Math.min(required, pe.length)),
    ...shuffle(en).slice(0, Math.min(required, en.length))
  ];

  return shuffle(exam);
}

function renderSummary() {
  const mode = modeEl.value;
  const total = visibleQuestions.length;
  const current = currentQuestionIndex + 1;

  if (mode !== 'exam') {
    summaryEl.textContent = `Ερώτηση ${current} από ${total}`;
    return;
  }

  const answered = visibleQuestions.filter((q) => selectedAnswers.has(q.id)).length;
  const knownCorrect = visibleQuestions.filter((q) => Number.isInteger(q.correctIndex)).length;
  const correct = visibleQuestions.filter((q) => {
    if (!Number.isInteger(q.correctIndex)) return false;
    return selectedAnswers.get(q.id) === q.correctIndex;
  }).length;

  summaryEl.textContent = `Ερώτηση ${current} από ${total} | Απαντημένες: ${answered} | Σωστές: ${correct}/${knownCorrect}`;
}

function renderSingleQuestion() {
  questionListEl.replaceChildren();
  updateNavigationButtons();
  renderSummary();

  if (visibleQuestions.length === 0) return;

  const q = visibleQuestions[currentQuestionIndex];
  const card = questionTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector('.badge').textContent = `${COURSE_LABELS[q.courseId] || q.courseTitle} • #${q.courseQuestionNumber || q.id}`;
  card.querySelector('h2').textContent = `${currentQuestionIndex + 1}. ${q.question}`;

  const choicesEl = card.querySelector('.choices');
  const feedbackEl = card.querySelector('.feedback');

  q.options.forEach((optionText, optionIndex) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn';
    btn.textContent = `${String.fromCharCode(65 + optionIndex)}) ${optionText}`;

    btn.addEventListener('click', () => {
      selectedAnswers.set(q.id, optionIndex);
      updateCardFeedback(q, card, feedbackEl);
      renderSummary();
    });

    choicesEl.appendChild(btn);
  });

  updateCardFeedback(q, card, feedbackEl);
  questionListEl.appendChild(card);
}

function updateNavigationButtons() {
  prevBtn.disabled = currentQuestionIndex === 0;
  nextBtn.disabled = currentQuestionIndex === visibleQuestions.length - 1;
}

function renderQuestions() {
  renderSingleQuestion();
}

function updateCardFeedback(question, card, feedbackEl) {
  const selected = selectedAnswers.get(question.id);
  const buttons = [...card.querySelectorAll('.choice-btn')];

  buttons.forEach((btn) => {
    btn.classList.remove('correct', 'wrong');
  });

  if (selected === undefined) {
    feedbackEl.textContent = 'Επίλεξε μία απάντηση.';
    feedbackEl.className = 'feedback';
    return;
  }

  if (!Number.isInteger(question.correctIndex)) {
    buttons[selected]?.classList.add('wrong');
    feedbackEl.textContent = 'Δεν έχει καταχωρηθεί ακόμα τεκμηριωμένη σωστή απάντηση για αυτή την ερώτηση.';
    feedbackEl.className = 'feedback err';
    return;
  }

  const correct = question.correctIndex;
  buttons[correct]?.classList.add('correct');

  if (selected === correct) {
    feedbackEl.textContent = 'Σωστή απάντηση.';
    feedbackEl.className = 'feedback ok';
  } else {
    buttons[selected]?.classList.add('wrong');
    feedbackEl.textContent = `Λάθος. Σωστή απάντηση: ${String.fromCharCode(65 + correct)}.`;
    feedbackEl.className = 'feedback err';
  }
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
