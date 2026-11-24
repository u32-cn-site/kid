const STORAGE_KEY = 'nce_chs_to_eng_state';

let state = {
    bookIndex: 0,
    lessonIndex: 0,
    sentenceIndex: 0,
    showEnglish: false
};

let data = {
    books: [],
    lessons: [],
    sentences: []
};

async function loadData() {
    try {
        const response = await fetch('../../data/index.json');
        data.books = await response.json();
        data.books = data.books.books;
        
        await loadBook();
        await loadLesson();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

async function loadBook() {
    const bookDir = data.books[state.bookIndex].dir;
    const fullPath = '../../data/' + bookDir + '/index.json';
    const response = await fetch(fullPath);
    const bookData = await response.json();
    data.lessons = bookData.lessons;
}

async function loadLesson() {
    const lessonNum = data.lessons[state.lessonIndex].lesson;
    const bookDir = data.books[state.bookIndex].dir;
    const lessonPath = `../../data/${bookDir}/lesson_${lessonNum}.json`;
    const response = await fetch(lessonPath);
    const lessonData = await response.json();
    data.sentences = lessonData.content.sentences;

    // Add title as the first sentence [英文标题, 中文标题]
    const title = data.lessons[state.lessonIndex].title;
    data.sentences.unshift([title[0], title[1]]);
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
    }
}

function updateHeader() {
    const lesson = data.lessons[state.lessonIndex];
    const totalSentences = data.sentences.length;
    const currentSentence = state.sentenceIndex + 1;
    
    let headerContent = document.getElementById('header-content');
    if (!headerContent) {
        headerContent = document.createElement('div');
        headerContent.id = 'header-content';
        document.getElementById('header').appendChild(headerContent);
    }
    
    const bookOptions = data.books.map((book, index) => 
        `<option value="${index}" ${index === state.bookIndex ? 'selected' : ''}>${book.name}</option>`
    ).join('');
    
    const lessonOptions = data.lessons.map((l, index) => 
        `<option value="${index}" ${index === state.lessonIndex ? 'selected' : ''}>Lesson ${l.lesson} ${l.title[0]} ${l.title[1]}</option>`
    ).join('');
    
    headerContent.innerHTML = `
        <select class="book-select" id="book-select">${bookOptions}</select>
        <span class="separator">|</span>
        <select class="lesson-select" id="lesson-select">${lessonOptions}</select>
        <span class="separator">|</span>
        <span class="progress">${currentSentence}/${totalSentences}</span>
    `;
    
    const bookSelect = document.getElementById('book-select');
    const lessonSelect = document.getElementById('lesson-select');
    
    bookSelect.addEventListener('change', async (e) => {
        state.bookIndex = parseInt(e.target.value);
        state.lessonIndex = 0;
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadBook();
        await loadLesson();
        updateContent();
    });
    
    lessonSelect.addEventListener('change', async (e) => {
        state.lessonIndex = parseInt(e.target.value);
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadLesson();
        updateContent();
    });
}

function speakEnglish(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }
}

function updateContent() {
    const sentence = data.sentences[state.sentenceIndex];
    document.getElementById('chinese-text').textContent = sentence[1];
    
    const englishText = document.getElementById('english-text');
    if (state.showEnglish) {
        englishText.textContent = sentence[0];
        englishText.style.display = 'block';
        speakEnglish(sentence[0]);
    } else {
        englishText.style.display = 'none';
    }
    
    updateHeader();
    saveState();
}

function nextSentence() {
    if (state.sentenceIndex < data.sentences.length - 1) {
        state.sentenceIndex++;
        updateContent();
    }
}

function prevSentence() {
    if (state.sentenceIndex > 0) {
        state.sentenceIndex--;
        updateContent();
    }
}

async function nextLesson() {
    if (state.lessonIndex < data.lessons.length - 1) {
        state.lessonIndex++;
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadLesson();
        updateContent();
    }
}

async function prevLesson() {
    if (state.lessonIndex > 0) {
        state.lessonIndex--;
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadLesson();
        updateContent();
    }
}

async function nextBook() {
    if (state.bookIndex < data.books.length - 1) {
        state.bookIndex++;
        state.lessonIndex = 0;
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadBook();
        await loadLesson();
        updateContent();
    }
}

async function prevBook() {
    if (state.bookIndex > 0) {
        state.bookIndex--;
        state.lessonIndex = 0;
        state.sentenceIndex = 0;
        state.showEnglish = false;
        await loadBook();
        await loadLesson();
        updateContent();
    }
}

function toggleEnglish() {
    state.showEnglish = !state.showEnglish;
    updateContent();
}

function handleKeydown(e) {
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            nextSentence();
            break;
        case 'ArrowUp':
            e.preventDefault();
            prevSentence();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (e.ctrlKey) {
                prevBook();
            } else {
                prevLesson();
            }
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (e.ctrlKey) {
                nextBook();
            } else {
                nextLesson();
            }
            break;
        case ' ':
            e.preventDefault();
            toggleEnglish();
            break;
    }
}

function handleMousedown(e) {
    if (e.button === 0) {
        state.showEnglish = true;
        updateContent();
    }
}

function handleMouseup(e) {
    if (e.button === 0) {
        state.showEnglish = false;
        updateContent();
    }
}

function handleWheel(e) {
    e.preventDefault();
    if (e.deltaY < 0) {
        prevSentence();
    } else {
        nextSentence();
    }
}

async function init() {
    loadState();
    await loadData();
    updateContent();
    document.addEventListener('keydown', handleKeydown);
    document.querySelector('main').addEventListener('mousedown', handleMousedown);
    document.querySelector('main').addEventListener('mouseup', handleMouseup);
    document.addEventListener('wheel', handleWheel, { passive: false });
}

init();
