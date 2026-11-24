let data = {
    books: [],
    allLessons: [],
    selectedLessons: [],
    quizSentences: [],
    wrongSentences: [],
    recentResults: []
};

let quizState = {
    sentenceCount: 8,
    currentIndex: 0,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    isTesting: false,
    currentSentence: null,
    submitted: false,
    currentTestResults: []
};

async function loadData() {
    try {
        const indexData = await fetch('../../data/index.json');
        const indexJson = await indexData.json();
        data.books = indexJson.books;

        data.allLessons = await DataLoader.loadAllLessons(data.books);
        Storage.loadSelectedLessons(data);
        Storage.loadWrongSentences(data);
        Storage.loadSentenceCount(quizState);
        Storage.loadRecentResults(data);
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

async function prepareQuizSentences() {
    data.quizSentences = [];
    const seenSentences = new Set();

    if (data.selectedLessons.length > 0) {
        for (const lesson of data.selectedLessons) {
            const sentences = await DataLoader.loadLessonSentences(lesson);

            for (const sentence of sentences) {
                const sentenceKey = sentence[0].toLowerCase();
                if (!seenSentences.has(sentenceKey)) {
                    seenSentences.add(sentenceKey);
                    data.quizSentences.push({
                        sentence: sentence[0],
                        meaning: sentence[1],
                        lessonInfo: lesson
                    });
                }
            }
        }
    } else if (data.wrongSentences.length > 0) {
        for (const sentence of data.wrongSentences) {
            const sentenceKey = sentence.sentence.toLowerCase();
            if (!seenSentences.has(sentenceKey)) {
                seenSentences.add(sentenceKey);
                data.quizSentences.push({
                    sentence: sentence.sentence,
                    meaning: sentence.meaning,
                    lessonInfo: sentence.lessonInfo
                });
            }
        }
    }

    UI.shuffleArray(data.quizSentences);

    if (quizState.sentenceCount !== 'all') {
        const count = Math.min(quizState.sentenceCount, data.quizSentences.length);
        data.quizSentences = data.quizSentences.slice(0, count);
    }
}

function updateUI() {
    const quizStatus = document.getElementById('quiz-status');
    const score = document.getElementById('score');
    const sentenceCountText = document.getElementById('sentence-count-text');
    const wrongSentencesCountBadge = document.getElementById('wrong-sentences-count-badge');

    sentenceCountText.textContent = quizState.sentenceCount === 'all' ? '全部' : quizState.sentenceCount + '句';
    wrongSentencesCountBadge.textContent = data.wrongSentences.length;

    if (!quizState.isTesting) {
        if (data.quizSentences.length === 0) {
            quizStatus.textContent = data.selectedLessons.length === 0 && data.wrongSentences.length === 0 ? '请选择课文' : '请开始测试';
        } else {
            quizStatus.textContent = '请选择课文并点击「开始测试」';
        }
    } else {
        const current = quizState.currentIndex + 1;
        const total = data.quizSentences.length;
        quizStatus.textContent = `${current}/${total}`;
    }

    score.textContent = `得分: ${quizState.score}`;
}

function startQuiz() {
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.correctCount = 0;
    quizState.wrongCount = 0;
    quizState.isTesting = true;
    quizState.submitted = false;
    quizState.currentTestResults = [];

    prepareQuizSentences().then(() => {
        if (data.quizSentences.length === 0) {
            alert('没有可测试的句子！');
            quizState.isTesting = false;
            return;
        }

        const quizInput = document.getElementById('quiz-input');
        quizInput.classList.remove('hidden');
        showCurrentSentence();
        updateUI();
    });
}

function showCurrentSentence() {
    if (quizState.currentIndex >= data.quizSentences.length) {
        finishQuiz();
        return;
    }

    quizState.currentSentence = data.quizSentences[quizState.currentIndex];
    quizState.submitted = false;

    document.getElementById('quiz-chinese').textContent = quizState.currentSentence.meaning;
    const quizEnglish = document.getElementById('quiz-english');
    quizEnglish.textContent = quizState.currentSentence.sentence;
    quizEnglish.classList.remove('hidden', 'reveal');
    void quizEnglish.offsetWidth;
    document.getElementById('quiz-input').value = '';
    document.getElementById('quiz-input').placeholder = '输入英文句子';
    document.getElementById('quiz-input').disabled = false;
    document.getElementById('quiz-input').focus();
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('quiz-feedback').innerHTML = '';

    updateUI();

    setTimeout(() => {
        AudioPlayer.speakSentence(quizState.currentSentence.sentence);
    }, 100);
}

function normalizeForComparison(text) {
    return text.toLowerCase().replace(/[.,?!;:""'""'—-]/g, '').replace(/\s+/g, ' ').trim();
}

function updateRealTimeFeedback() {
    if (!quizState.currentSentence) return;

    const input = document.getElementById('quiz-input');
    const feedback = document.getElementById('quiz-feedback');
    const userInput = input.value;

    if (userInput.trim() === '') {
        feedback.classList.add('hidden');
        return;
    }

    feedback.classList.remove('hidden');

    const correctAnswer = quizState.currentSentence.sentence;
    const correctWords = normalizeForComparison(correctAnswer).split(' ');
    const userTokens = userInput.split(/(\s+)/);

    let usedCorrectWords = new Set();
    let feedbackHTML = '';

    for (let i = 0; i < userTokens.length; i++) {
        const token = userTokens[i];
        const isWhitespace = /^\s+$/.test(token);

        if (isWhitespace) {
            feedbackHTML += token;
        } else if (token.trim() === '') {
            continue;
        } else {
            const normalizedToken = token.replace(/[.,?!;:""'""'—-]/g, '').toLowerCase();
            let foundIndex = -1;

            for (let j = 0; j < correctWords.length; j++) {
                if (!usedCorrectWords.has(j) && correctWords[j] === normalizedToken) {
                    foundIndex = j;
                    break;
                }
            }

            if (foundIndex !== -1) {
                usedCorrectWords.add(foundIndex);
                feedbackHTML += `<span class="word-correct">${token}</span>`;
            } else {
                feedbackHTML += `<span class="word-wrong">${token}</span>`;
            }
        }
    }

    feedback.innerHTML = feedbackHTML;
}

function checkAnswer() {
    if (quizState.submitted) return;

    const input = document.getElementById('quiz-input');
    const userAnswer = input.value.trim();

    if (userAnswer === '') {
        return;
    }

    const correctAnswer = quizState.currentSentence.sentence;
    const normalizedUserAnswer = normalizeForComparison(userAnswer);
    const normalizedCorrectAnswer = normalizeForComparison(correctAnswer);

    quizState.submitted = true;
    input.disabled = true;
    document.getElementById('quiz-feedback').classList.add('hidden');

    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    document.getElementById('quiz-english').classList.add('reveal');

    quizState.currentTestResults.push({
        sentence: quizState.currentSentence.sentence,
        spelling: userAnswer,
        isCorrect: isCorrect,
        time: new Date().toISOString()
    });

    if (isCorrect) {
        quizState.correctCount++;
        const pointsPerSentence = Math.ceil(100 / data.quizSentences.length);
        const totalPoints = Math.min(quizState.score + pointsPerSentence, 100);
        quizState.score = totalPoints;

        removeFromWrongSentences(quizState.currentSentence);
    } else {
        quizState.wrongCount++;
        addToWrongSentences(quizState.currentSentence);
    }

    updateUI();
    setTimeout(() => {
        showCheckModal(isCorrect, userAnswer, correctAnswer);
    }, 50);
}

function showCheckModal(isCorrect, userAnswer, correctAnswer) {
    const modal = document.getElementById('check-modal');
    const title = document.getElementById('check-title');
    const content = document.getElementById('check-content');
    const userInput = document.getElementById('quiz-input').value;

    if (isCorrect) {
        title.textContent = '回答正确!';
        title.style.color = '#4caf50';
        content.innerHTML = `
            <div class="check-content">
                <div class="check-correct">✓ 回答正确！</div>
                <div class="check-correct-answer">你的回答: <span class="correct-answer">${userInput}</span></div>
                <div class="check-correct-answer">正确答案: <span class="correct-answer">${quizState.currentSentence.sentence}</span></div>
            </div>
        `;
    } else {
        title.textContent = '回答错误';
        title.style.color = '#d32f2f';
        content.innerHTML = `
            <div class="check-content">
                <div class="check-wrong">✗ 回答错误</div>
                <div class="check-correct-answer">你的回答: <span class="correct-answer">${userInput}</span></div>
                <div class="check-correct-answer">正确答案: <span class="correct-answer">${quizState.currentSentence.sentence}</span></div>
            </div>
        `;
    }

    modal.classList.add('show');
}

function nextSentence() {
    document.getElementById('check-modal').classList.remove('show');
    quizState.currentIndex++;
    showCurrentSentence();
}

function finishQuiz() {
    quizState.isTesting = false;

    const quizInput = document.getElementById('quiz-input');
    quizInput.classList.add('hidden');

    document.getElementById('quiz-english').classList.add('hidden');

    data.recentResults.push({
        score: quizState.score,
        correctCount: quizState.correctCount,
        wrongCount: quizState.wrongCount,
        results: quizState.currentTestResults,
        time: new Date().toISOString()
    });

    if (data.recentResults.length > 10) {
        data.recentResults = data.recentResults.slice(-10);
    }

    Storage.saveRecentResults(data.recentResults);

    const modal = document.getElementById('result-modal');
    document.getElementById('final-score').textContent = quizState.score;
    document.getElementById('correct-count').textContent = quizState.correctCount;
    document.getElementById('wrong-count').textContent = quizState.wrongCount;

    const wrongList = document.getElementById('result-wrong-list');
    wrongList.innerHTML = '';

    if (quizState.score === 100) {
        AudioPlayer.playPerfectScoreSound();
        wrongList.innerHTML = '<div style="text-align:center;color:#4caf50;font-size:18px;padding:20px;">🎉 完美！满分100分！🎉</div>';
    } else if (quizState.wrongCount === 0) {
        AudioPlayer.playSuccessSound();
        wrongList.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">太棒了！全部回答正确！</div>';
    } else {
        const wrongItems = data.quizSentences.filter((sentence, index) => {
            return index >= quizState.correctCount;
        });

        for (const item of wrongItems) {
            const div = document.createElement('div');
            div.className = 'wrong-item';
            div.innerHTML = `
                <div class="wrong-word">${item.sentence}</div>
                <div class="wrong-meaning">${item.meaning}</div>
            `;
            wrongList.appendChild(div);
        }
    }

    modal.classList.add('show');
    updateUI();
}

function addToWrongSentences(sentenceData) {
    const exists = data.wrongSentences.find(s => s.sentence === sentenceData.sentence);
    if (!exists) {
        data.wrongSentences.push({
            sentence: sentenceData.sentence,
            meaning: sentenceData.meaning,
            lessonInfo: sentenceData.lessonInfo
        });
        Storage.saveWrongSentences(data.wrongSentences);
    }
}

function removeFromWrongSentences(sentenceData) {
    data.wrongSentences = data.wrongSentences.filter(s => s.sentence !== sentenceData.sentence);
    Storage.saveWrongSentences(data.wrongSentences);
}

function openLessonModal() {
    UI.openModal('lesson-modal', () => {
        ModalRenderers.renderLessonModalBody(data.books, data.allLessons, data.selectedLessons, data.wrongSentences);
    });
}

function closeLessonModal() {
    UI.closeModal('lesson-modal');
}

function saveLessonModalSelection() {
    const newSelectedLessons = [];

    const checkboxes = document.querySelectorAll('#lesson-modal-body input[type="checkbox"][id^="lesson-"]');

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const bookIndex = parseInt(checkbox.dataset.bookIndex);
            const lessonNum = parseInt(checkbox.dataset.lesson);

            const lesson = data.allLessons.find(
                l => l.bookIndex === bookIndex && l.lesson === lessonNum
            );

            if (lesson) {
                newSelectedLessons.push({
                    bookIndex: lesson.bookIndex,
                    bookName: lesson.bookName,
                    lesson: lesson.lesson,
                    title: lesson.title,
                    dir: lesson.dir
                });
            }
        }
    });

    data.selectedLessons = newSelectedLessons;
    Storage.saveSelectedLessons(data.selectedLessons);

    const wrongSentencesCheckbox = document.getElementById('wrong-sentences-checkbox');
    if (wrongSentencesCheckbox) {
        data.useWrongSentences = wrongSentencesCheckbox.checked;
    }

    closeLessonModal();
    startQuiz();
}

function openSentenceCountModal() {
    const buttons = document.querySelectorAll('.sentence-count-btn');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.count === String(quizState.sentenceCount)) {
            btn.classList.add('selected');
        }
    });
    UI.openModal('sentence-count-modal');
}

function closeSentenceCountModal() {
    UI.closeModal('sentence-count-modal');
}

function openWrongSentencesModal() {
    UI.openModal('wrong-sentences-modal', () => {
        ModalRenderers.renderWrongSentencesList(data.wrongSentences);
    });
}

function closeWrongSentencesModal() {
    UI.closeModal('wrong-sentences-modal');
}

function openRecentResultsModal() {
    UI.openModal('recent-results-modal', () => {
        ModalRenderers.renderRecentResultsList(data.recentResults);
    });
}

function closeRecentResultsModal() {
    UI.closeModal('recent-results-modal');
}

function handleModalKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (document.getElementById('check-modal').classList.contains('show')) {
            nextSentence();
        } else if (document.getElementById('result-modal').classList.contains('show')) {
            closeResultModal();
        }
    }
}

function closeResultModal() {
    document.getElementById('result-modal').classList.remove('show');
    data.quizSentences = [];
    quizState.currentIndex = 0;
    quizState.score = 0;
    quizState.correctCount = 0;
    quizState.wrongCount = 0;
    document.getElementById('quiz-chinese').textContent = '请选择课文并点击「开始测试」';
    document.getElementById('quiz-input').value = '';
    document.getElementById('quiz-input').disabled = true;
    document.getElementById('quiz-input').classList.add('hidden');
    document.getElementById('quiz-english').classList.add('hidden');
    updateUI();
}

function handleNonModalKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (!quizState.isTesting) {
            startQuiz();
        } else {
            checkAnswer();
        }
    }
}

function handleKeydown(e) {
    if (document.querySelector('.modal-overlay.show')) {
        handleModalKeydown(e);
    } else {
        handleNonModalKeydown(e);
    }
}

function handleInputKeydown(e) {
    AudioPlayer.playKeypressSound();
    if (e.key === 'Enter') {
        e.preventDefault();
        checkAnswer();
    }
}

async function init() {
    await loadData();
    updateUI();

    document.addEventListener('keydown', handleKeydown);
    document.getElementById('quiz-input').addEventListener('keydown', handleInputKeydown);
    document.getElementById('quiz-input').addEventListener('input', updateRealTimeFeedback);

    document.getElementById('lesson-select-btn').addEventListener('click', openLessonModal);
    document.getElementById('sentence-count-btn').addEventListener('click', openSentenceCountModal);
    document.getElementById('wrong-sentences-btn').addEventListener('click', openWrongSentencesModal);
    document.getElementById('recent-results-btn').addEventListener('click', openRecentResultsModal);
    document.getElementById('quiz-english').addEventListener('click', () => {
        if (quizState.isTesting && quizState.currentSentence) {
            AudioPlayer.speakSentence(quizState.currentSentence.sentence);
        }
    });

    document.getElementById('lesson-modal-save').addEventListener('click', saveLessonModalSelection);
    UI.setupModalWithCancel('lesson-modal', closeLessonModal);
    UI.setupModalWithCancel('sentence-count-modal', closeSentenceCountModal);
    UI.setupModalEventListeners('wrong-sentences-modal', closeWrongSentencesModal);
    UI.setupModalEventListeners('recent-results-modal', closeRecentResultsModal);

    document.querySelectorAll('.sentence-count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const count = e.target.dataset.count;
            quizState.sentenceCount = count === 'all' ? 'all' : parseInt(count);
            Storage.saveSentenceCount(quizState.sentenceCount);
            updateUI();
            closeSentenceCountModal();
        });
    });
}

init();
