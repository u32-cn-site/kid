let data = {
    books: [],
    allLessons: [],
    selectedLessons: [],
    quizWords: [],
    wrongWords: [],
    recentResults: []
};

let quizState = {
    wordCount: 8,
    currentIndex: 0,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    isTesting: false,
    currentWord: null,
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
        Storage.loadWrongWords(data);
        Storage.loadWordCount(quizState);
        Storage.loadRecentResults(data);
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

async function prepareQuizWords() {
    data.quizWords = [];
    const seenWords = new Set();

    if (data.selectedLessons.length > 0) {
        for (const lesson of data.selectedLessons) {
            const words = await DataLoader.loadLessonWords(lesson);

            for (const word of words) {
                const wordKey = word[0].toLowerCase();
                if (!seenWords.has(wordKey)) {
                    seenWords.add(wordKey);
                    data.quizWords.push({
                        word: word[0],
                        pos: word[1],
                        meaning: word[2],
                        lessonInfo: lesson
                    });
                }
            }
        }
    } else if (data.wrongWords.length > 0) {
        for (const word of data.wrongWords) {
            const wordKey = word.word.toLowerCase();
            if (!seenWords.has(wordKey)) {
                seenWords.add(wordKey);
                data.quizWords.push({
                    word: word.word,
                    pos: word.pos,
                    meaning: word.meaning,
                    lessonInfo: word.lessonInfo
                });
            }
        }
    }

    UI.shuffleArray(data.quizWords);

    if (quizState.wordCount !== 'all') {
        const count = Math.min(quizState.wordCount, data.quizWords.length);
        data.quizWords = data.quizWords.slice(0, count);
    }
}

function updateUI() {
    const quizStatus = document.getElementById('quiz-status');
    const score = document.getElementById('score');
    const wordCountText = document.getElementById('word-count-text');
    const wrongWordsCountBadge = document.getElementById('wrong-words-count-badge');

    wordCountText.textContent = quizState.wordCount === 'all' ? '全部' : quizState.wordCount + '个';
    wrongWordsCountBadge.textContent = data.wrongWords.length;

    if (!quizState.isTesting) {
        if (data.quizWords.length === 0) {
            quizStatus.textContent = data.selectedLessons.length === 0 && data.wrongWords.length === 0 ? '请选择课文' : '请开始测试';
        } else {
            quizStatus.textContent = '请选择课文并点击「开始测试」';
        }
    } else {
        const current = quizState.currentIndex + 1;
        const total = data.quizWords.length;
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

    prepareQuizWords().then(() => {
        if (data.quizWords.length === 0) {
            alert('没有可测试的单词！');
            quizState.isTesting = false;
            return;
        }

        const quizInput = document.getElementById('quiz-input');
        quizInput.classList.remove('hidden');
        showCurrentWord();
        updateUI();
    });
}

function showCurrentWord() {
    if (quizState.currentIndex >= data.quizWords.length) {
        finishQuiz();
        return;
    }

    quizState.currentWord = data.quizWords[quizState.currentIndex];
    quizState.submitted = false;

    document.getElementById('quiz-chinese').textContent = quizState.currentWord.meaning;
    const quizEnglish = document.getElementById('quiz-english');
    quizEnglish.textContent = quizState.currentWord.word;
    quizEnglish.classList.remove('hidden', 'reveal');
    void quizEnglish.offsetWidth;
    document.getElementById('quiz-input').value = '';
    document.getElementById('quiz-input').placeholder = quizState.currentWord.word[0];
    document.getElementById('quiz-input').disabled = false;
    document.getElementById('quiz-input').focus();

    updateUI();

    setTimeout(() => {
        AudioPlayer.speakWord(quizState.currentWord.word);
    }, 100);
}

function checkAnswer() {
    if (quizState.submitted) return;

    const input = document.getElementById('quiz-input');
    const userAnswer = input.value.trim().toLowerCase();

    if (userAnswer === '') {
        return;
    }

    const correctAnswer = quizState.currentWord.word.toLowerCase();

    quizState.submitted = true;
    input.disabled = true;

    const isCorrect = userAnswer === correctAnswer;

    document.getElementById('quiz-english').classList.add('reveal');

    quizState.currentTestResults.push({
        word: quizState.currentWord.word,
        spelling: userAnswer,
        isCorrect: isCorrect,
        time: new Date().toISOString()
    });

    if (isCorrect) {
        quizState.correctCount++;
        const pointsPerWord = Math.ceil(100 / data.quizWords.length);
        const totalPoints = Math.min(quizState.score + pointsPerWord, 100);
        quizState.score = totalPoints;

        removeFromWrongWords(quizState.currentWord);
    } else {
        quizState.wrongCount++;
        addToWrongWords(quizState.currentWord);
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

    if (isCorrect) {
        title.textContent = '回答正确!';
        title.style.color = '#4caf50';
        content.innerHTML = `
            <div class="check-content">
                <div class="check-correct">✓ 回答正确！</div>
            </div>
        `;
    } else {
        title.textContent = '回答错误';
        title.style.color = '#d32f2f';
        content.innerHTML = `
            <div class="check-content">
                <div class="check-wrong">✗ 回答错误</div>
                <div class="check-correct-answer">正确答案: <span class="correct-answer">${quizState.currentWord.word}</span></div>
            </div>
        `;
    }

    modal.classList.add('show');
}

function nextWord() {
    document.getElementById('check-modal').classList.remove('show');
    quizState.currentIndex++;
    showCurrentWord();
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
        wrongList.innerHTML = '<div style="text-align:center;color:#4caf50;font-size:18px;padding:20px;">🎉 完美！满分100数！🎉</div>';
    } else if (quizState.wrongCount === 0) {
        AudioPlayer.playSuccessSound();
        wrongList.innerHTML = '<div style="text-align:center;color:#999;padding:20px;">太棒了！全部回答正确！</div>';
    } else {
        const wrongItems = data.quizWords.filter((word, index) => {
            return index >= quizState.correctCount;
        });

        for (const item of wrongItems) {
            const div = document.createElement('div');
            div.className = 'wrong-item';
            div.innerHTML = `
                <div class="wrong-word">${item.word}</div>
                <div class="wrong-meaning">${item.meaning}</div>
            `;
            wrongList.appendChild(div);
        }
    }

    modal.classList.add('show');
    updateUI();
}

function addToWrongWords(wordData) {
    const exists = data.wrongWords.find(w => w.word === wordData.word);
    if (!exists) {
        data.wrongWords.push({
            word: wordData.word,
            pos: wordData.pos,
            meaning: wordData.meaning,
            lessonInfo: wordData.lessonInfo
        });
        Storage.saveWrongWords(data.wrongWords);
    }
}

function removeFromWrongWords(wordData) {
    data.wrongWords = data.wrongWords.filter(w => w.word !== wordData.word);
    Storage.saveWrongWords(data.wrongWords);
}

function openLessonModal() {
    UI.openModal('lesson-modal', () => {
        ModalRenderers.renderLessonModalBody(data.books, data.allLessons, data.selectedLessons, data.wrongWords);
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

    const wrongWordsCheckbox = document.getElementById('wrong-words-checkbox');
    if (wrongWordsCheckbox) {
        data.useWrongWords = wrongWordsCheckbox.checked;
    }

    closeLessonModal();
    startQuiz();
}

function openWordCountModal() {
    const buttons = document.querySelectorAll('.word-count-btn');
    buttons.forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.count === String(quizState.wordCount)) {
            btn.classList.add('selected');
        }
    });
    UI.openModal('word-count-modal');
}

function closeWordCountModal() {
    UI.closeModal('word-count-modal');
}

function openWrongWordsModal() {
    UI.openModal('wrong-words-modal', () => {
        ModalRenderers.renderWrongWordsList(data.wrongWords);
    });
}

function closeWrongWordsModal() {
    UI.closeModal('wrong-words-modal');
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
            nextWord();
        } else if (document.getElementById('result-modal').classList.contains('show')) {
            closeResultModal();
        }
    }
}

function closeResultModal() {
    document.getElementById('result-modal').classList.remove('show');
    data.quizWords = [];
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

    document.getElementById('lesson-select-btn').addEventListener('click', openLessonModal);
    document.getElementById('word-count-btn').addEventListener('click', openWordCountModal);
    document.getElementById('wrong-words-btn').addEventListener('click', openWrongWordsModal);
    document.getElementById('recent-results-btn').addEventListener('click', openRecentResultsModal);
    document.getElementById('quiz-english').addEventListener('click', () => {
        if (quizState.isTesting && quizState.currentWord) {
            AudioPlayer.speakWord(quizState.currentWord.word);
        }
    });

    document.getElementById('lesson-modal-save').addEventListener('click', saveLessonModalSelection);
    UI.setupModalWithCancel('lesson-modal', closeLessonModal);
    UI.setupModalWithCancel('word-count-modal', closeWordCountModal);
    UI.setupModalEventListeners('wrong-words-modal', closeWrongWordsModal);
    UI.setupModalEventListeners('recent-results-modal', closeRecentResultsModal);

    document.querySelectorAll('.word-count-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const count = e.target.dataset.count;
            quizState.wordCount = count === 'all' ? 'all' : parseInt(count);
            Storage.saveWordCount(quizState.wordCount);
            updateUI();
            closeWordCountModal();
        });
    });
}

init();
