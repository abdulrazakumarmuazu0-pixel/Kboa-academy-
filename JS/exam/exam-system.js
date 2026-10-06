// ============================================
// KBOA — Examination System (Production)
// Exam + questions loaded from Firestore.
// Results saved to exam_results. Certificate on pass.
// ============================================

var examState = {
    exam: null,          // exam doc from Firestore
    questions: [],       // from exam.questions array
    currentQuestion: 0,
    answers: {},
    timeRemaining: 0,
    timerInterval: null,
    examStarted: false,
    examSubmitted: false,
    startTime: null,
    endTime: null,
    passMark: 70
};

document.addEventListener('DOMContentLoaded', function() {
    auth.onAuthStateChanged(function(user) {
        if (!user) { window.location.href = 'login.html'; return; }
        initializeExam();
    });
});

async function initializeExam() {
    try {
        var params = new URLSearchParams(window.location.search);
        var courseId = params.get('courseId');
        var examId = params.get('examId');

        var exam = examId ? await KBOA.getExam(examId) : await KBOA.getActiveExam(courseId);

        if (!exam || !exam.questions || exam.questions.length === 0) {
            document.querySelector('.exam-container').innerHTML = KBOA.emptyState(
                '📝', 'No Exam Available',
                'Your instructor has not published an exam for this course yet.',
                '<a href="dashboard.html" class="btn btn-primary">Back to Dashboard</a>');
            return;
        }

        examState.exam = exam;
        examState.questions = exam.questions;
        examState.passMark = exam.passMark || 70;
        examState.timeRemaining = (exam.durationMinutes || 60) * 60;

        // UI setup
        setText('exam-course-title', exam.courseName || exam.title || 'Examination');
        setText('exam-title', exam.title || 'Final Examination');
        setText('total-q', exam.questions.length);
        document.querySelector('.exam-instructions li').innerHTML =
            'This exam contains <strong>' + exam.questions.length + ' questions</strong>';
        var mins = exam.durationMinutes || 60;
        document.querySelectorAll('.exam-instructions li')[1].innerHTML =
            'Time limit: <strong>' + mins + ' minutes</strong>';
        document.querySelectorAll('.exam-instructions li')[5].innerHTML =
            'Pass mark: <strong>' + examState.passMark + '%</strong>';
        document.querySelector('.start-exam-screen .dashboard-section > div > div:first-child div').textContent = exam.questions.length;
        document.querySelectorAll('.start-exam-screen .dashboard-section > div > div')[1].querySelector('div').textContent = mins;

        generateQuestionNav();
        updateTimerDisplay();
    } catch (error) {
        console.error('Exam load error:', error);
        document.querySelector('.exam-container').innerHTML =
            KBOA.errorState('Could not load the exam. Please try again.');
    }
}

// ---------- Flow ----------
function startExam() {
    examState.examStarted = true;
    examState.startTime = new Date();

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('exam-screen').style.display = 'block';

    startTimer();
    loadQuestion(0);
    updateProgress();
}

function startTimer() {
    examState.timerInterval = setInterval(function() {
        examState.timeRemaining--;
        updateTimerDisplay();
        var timerEl = document.getElementById('timer');
        if (examState.timeRemaining <= 300) { timerEl.classList.add('danger'); timerEl.classList.remove('warning'); }
        else if (examState.timeRemaining <= 600) { timerEl.classList.add('warning'); }
        if (examState.timeRemaining <= 0) { clearInterval(examState.timerInterval); autoSubmitExam(); }
    }, 1000);
}

function updateTimerDisplay() {
    var m = Math.floor(examState.timeRemaining / 60);
    var s = examState.timeRemaining % 60;
    setText('timer', (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s);
}

function generateQuestionNav() {
    var nav = document.getElementById('question-nav');
    nav.innerHTML = '';
    examState.questions.forEach(function(q, i) {
        var dot = document.createElement('div');
        dot.className = 'question-dot';
        dot.textContent = i + 1;
        dot.id = 'q-dot-' + i;
        dot.onclick = function() { goToQuestion(i); };
        nav.appendChild(dot);
    });
}

function loadQuestion(index) {
    examState.currentQuestion = index;
    var q = examState.questions[index];

    setText('q-number', index + 1);
    setText('current-q', index + 1);
    setText('q-text', q.question);

    var list = document.getElementById('options-list');
    list.innerHTML = '';
    var letters = ['A', 'B', 'C', 'D'];
    q.options.forEach(function(opt, oi) {
        var item = document.createElement('div');
        item.className = 'option-item' + (examState.answers[index] === oi ? ' selected' : '');
        item.innerHTML = '<div class="option-letter">' + letters[oi] + '</div><div class="option-text">' + opt + '</div>';
        item.onclick = function() { selectAnswer(oi); };
        list.appendChild(item);
    });

    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').textContent =
        index === examState.questions.length - 1 ? 'Finish Review' : 'Next →';

    updateQuestionNav();
    updateAnsweredCount();
}

function selectAnswer(oi) {
    examState.answers[examState.currentQuestion] = oi;
    document.querySelectorAll('.option-item').forEach(function(el, idx) {
        el.classList.toggle('selected', idx === oi);
    });
    updateQuestionNav();
    updateAnsweredCount();
    updateProgress();
}

function updateQuestionNav() {
    examState.questions.forEach(function(q, i) {
        var dot = document.getElementById('q-dot-' + i);
        dot.classList.toggle('current', i === examState.currentQuestion);
        dot.classList.toggle('answered', examState.answers[i] !== undefined);
    });
}

function updateAnsweredCount() {
    setText('answered-count', Object.keys(examState.answers).length);
}

function updateProgress() {
    var pct = (Object.keys(examState.answers).length / examState.questions.length) * 100;
    document.getElementById('exam-progress').style.width = pct + '%';
}

function previousQuestion() { if (examState.currentQuestion > 0) loadQuestion(examState.currentQuestion - 1); }
function nextQuestion() {
    if (examState.currentQuestion < examState.questions.length - 1) loadQuestion(examState.currentQuestion + 1);
    else if (confirm('You reached the last question. Submit the exam?')) submitExam();
}
function goToQuestion(i) { loadQuestion(i); }

// ---------- Submission ----------
function submitExam() {
    var unanswered = examState.questions.length - Object.keys(examState.answers).length;
    if (!confirm(unanswered > 0
        ? 'You have ' + unanswered + ' unanswered questions. Submit anyway?'
        : 'Submit your exam now?')) return;
    finalizeExam();
}

function autoSubmitExam() { alert('Time is up! Submitting automatically.'); finalizeExam(); }

async function finalizeExam() {
    examState.examSubmitted = true;
    examState.endTime = new Date();
    clearInterval(examState.timerInterval);

    var results = calculateResults();
    displayResults(results);

    // Save to Firestore
    try {
        const serverResult = await KBOA.saveExamResult({
            examId: examState.exam.id,
            answers: examState.answers
        });

        if (serverResult && serverResult.passed) {
            await issueCertificate(serverResult.resultId);
        }
    } catch (e) {
        console.error('Result save failed:', e);
    }
}

function calculateResults() {
    var correct = 0, wrong = 0, unanswered = 0;
    examState.questions.forEach(function(q, i) {
        var a = examState.answers[i];
        if (a === undefined) unanswered++;
        else if (a === q.correctAnswer) correct++;
        else wrong++;
    });
    var total = examState.questions.length;
    var pct = Math.round((correct / total) * 100);
    var secs = examState.startTime ? Math.floor((examState.endTime - examState.startTime) / 1000) : 0;
    return {
        total: total, correct: correct, wrong: wrong, unanswered: unanswered,
        percentage: pct, passed: pct >= examState.passMark,
        timeUsed: Math.floor(secs / 60) + ':' + ((secs % 60) < 10 ? '0' : '') + (secs % 60),
        answers: examState.answers
    };
}

async function issueCertificate(resultId) {
    try {
        return await kboaCallFunction('issueCertificate', { resultId: resultId });
    } catch (e) {
        console.error('Certificate issue failed:', e);
        throw e;
    }
}

// ---------- Results UI ----------
function displayResults(r) {
    document.getElementById('exam-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'block';

    setText('score-percentage', r.percentage + '%');
    var circle = document.getElementById('score-circle');
    var status = document.getElementById('result-status');
    var msg = document.getElementById('result-message');

    if (r.passed) {
        circle.className = 'score-circle passed';
        status.className = 'result-status passed';
        status.textContent = 'PASSED 🎉';
        msg.textContent = 'Congratulations! Certificate has been issued to your account.';
    } else {
        circle.className = 'score-circle failed';
        status.className = 'result-status failed';
        status.textContent = 'FAILED';
        msg.textContent = 'You did not meet the pass mark (' + examState.passMark + '%). You can retake the exam.';
    }

    setText('result-total', r.total);
    setText('result-correct', r.correct);
    setText('result-wrong', r.wrong);
    setText('result-unanswered', r.unanswered);
    setText('result-time', r.timeUsed);
    setText('result-score', r.percentage + '%');
}

function viewReview() {
    var section = document.getElementById('review-section');
    var container = document.getElementById('review-questions');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        container.innerHTML = '';
        var letters = ['A', 'B', 'C', 'D'];
        examState.questions.forEach(function(q, i) {
            var a = examState.answers[i];
            var isCorrect = a === q.correctAnswer;
            var card = document.createElement('div');
            card.className = 'review-question ' + (isCorrect ? 'correct' : 'incorrect');
            card.innerHTML =
                '<div class="review-header"><strong>Question ' + (i + 1) + '</strong>'
                + '<span class="review-status ' + (isCorrect ? 'correct' : 'incorrect') + '">'
                + (isCorrect ? '✓ Correct' : (a === undefined ? '○ Unanswered' : '✗ Wrong')) + '</span></div>'
                + '<p style="margin-bottom:10px;">' + q.question + '</p>'
                + (a !== undefined
                    ? '<div class="your-answer ' + (isCorrect ? 'correct' : 'incorrect') + '">Your answer: ' + letters[a] + '. ' + q.options[a] + '</div>'
                    : '<div class="your-answer">You did not answer this question.</div>')
                + (!isCorrect ? '<div class="correct-answer">Correct answer: ' + letters[q.correctAnswer] + '. ' + q.options[q.correctAnswer] + '</div>' : '')
                + (q.explanation ? '<p style="margin-top:10px;font-size:0.85rem;color:var(--gray-500);"><strong>Explanation:</strong> ' + q.explanation + '</p>' : '');
            container.appendChild(card);
        });
        section.scrollIntoView({ behavior: 'smooth' });
    } else section.style.display = 'none';
}

function retakeExam() {
    if (!confirm('Retake this exam? Current attempt is already saved.')) return;
    window.location.reload();
}

function backToDashboard() { window.location.href = 'dashboard.html'; }
function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }

window.startExam = startExam;
window.previousQuestion = previousQuestion;
window.nextQuestion = nextQuestion;
window.goToQuestion = goToQuestion;
window.submitExam = submitExam;
window.viewReview = viewReview;
window.retakeExam = retakeExam;
window.backToDashboard = backToDashboard;
