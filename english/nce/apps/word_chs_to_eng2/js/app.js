const STORAGE_KEY = 'nce_word_chs_to_eng2_state';
const SELECTED_LESSONS_KEY = 'nce_word_chs_to_eng2_selected_lessons';

let state = {
    currentIndex: 0,
    showEnglish: false
};

let data = {
    books: [],
    allLessons: [],
    selectedLessons: [],
    words: []
};

async function loadData() {
    try {
        const response = await fetch('../../data/index.json');
        data.books = await response.json();
        data.books = data.books.books;
        
        await loadAllLessons();
        loadSelectedLessons();
        await loadSelectedWords();
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

async function loadAllLessons() {
    data.allLessons = [];
    for (const book of data.books) {
        const bookDir = book.dir;
        const fullPath = '../../data/' + bookDir + '/index.json';
        const response = await fetch(fullPath);
        const bookData = await response.json();
        
        for (const lesson of bookData.lessons) {
            data.allLessons.push({
                bookIndex: data.books.indexOf(book),
                bookName: book.name,
                lesson: lesson.lesson,
                title: lesson.title,
                dir: bookDir
            });
        }
    }
}

function loadSelectedLessons() {
    const saved = localStorage.getItem(SELECTED_LESSONS_KEY);
    if (saved) {
        data.selectedLessons = JSON.parse(saved);
    }
}

function saveSelectedLessons() {
    localStorage.setItem(SELECTED_LESSONS_KEY, JSON.stringify(data.selectedLessons));
}

async function loadSelectedWords() {
    data.words = [];

    for (const selectedLesson of data.selectedLessons) {
        const lessonPath = `../../data/${selectedLesson.dir}/lesson_${selectedLesson.lesson}.json`;

        try {
            const response = await fetch(lessonPath);
            const lessonData = await response.json();
            const rawWords = lessonData.words || [];

            for (const word of rawWords) {
                data.words.push({
                    bookName: selectedLesson.bookName,
                    lesson: selectedLesson.lesson,
                    title: selectedLesson.title,
                    english: word[0],
                    chinese: word[2]
                });
            }
        } catch (error) {
            console.error(`加载课文失败: ${selectedLesson.dir}/lesson_${selectedLesson.lesson}.json`, error);
        }
    }

    shuffleWords();
}

function shuffleWords() {
    for (let i = data.words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [data.words[i], data.words[j]] = [data.words[j], data.words[i]];
    }
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
    const totalWords = data.words.length;
    const currentWord = state.currentIndex + 1;
    
    let headerContent = document.getElementById('header-content');
    if (!headerContent) {
        headerContent = document.createElement('div');
        headerContent.id = 'header-content';
        document.getElementById('header').appendChild(headerContent);
    }
    
    if (totalWords === 0) {
        headerContent.innerHTML = `<span class="progress">请选择课文</span>`;
    } else {
        headerContent.innerHTML = `<span class="progress">${currentWord}/${totalWords}</span>`;
    }
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
    if (data.words.length === 0) {
        document.getElementById('chinese-text').textContent = '请点击「选择课文」按钮选择要练习的课文';
        document.getElementById('english-text').style.display = 'none';
        updateHeader();
        return;
    }
    
    const word = data.words[state.currentIndex];
    document.getElementById('chinese-text').textContent = word.chinese;
    
    const englishText = document.getElementById('english-text');
    if (state.showEnglish) {
        englishText.textContent = word.english;
        englishText.style.display = 'block';
        speakEnglish(word.english);
    } else {
        englishText.style.display = 'none';
    }
    
    updateHeader();
    saveState();
}

function nextWord() {
    if (data.words.length === 0) return;
    if (state.currentIndex < data.words.length - 1) {
        state.currentIndex++;
        updateContent();
    }
}

function prevWord() {
    if (data.words.length === 0) return;
    if (state.currentIndex > 0) {
        state.currentIndex--;
        updateContent();
    }
}

function toggleEnglish() {
    state.showEnglish = !state.showEnglish;
    updateContent();
}

function openModal() {
    renderModalBody();
    document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('show');
}

function renderModalBody() {
    const modalBody = document.getElementById('modal-body');
    let html = '';
    
    for (let i = 0; i < data.allLessons.length; i++) {
        const lesson = data.allLessons[i];
        const isChecked = data.selectedLessons.some(
            l => l.bookIndex === lesson.bookIndex && l.lesson === lesson.lesson
        );
        
        html += `
            <div class="lesson-item">
                <input type="checkbox" 
                    id="lesson-${i}" 
                    data-book-index="${lesson.bookIndex}" 
                    data-lesson="${lesson.lesson}"
                    ${isChecked ? 'checked' : ''}>
                <label for="lesson-${i}">${lesson.bookName} - Lesson ${lesson.lesson} ${lesson.title[0]} ${lesson.title[1]}</label>
            </div>
        `;
    }
    
    modalBody.innerHTML = html;
}

function saveModalSelection() {
    const checkboxes = document.querySelectorAll('#modal-body input[type="checkbox"]');
    const newSelectedLessons = [];
    
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
    saveSelectedLessons();
    
    state.currentIndex = 0;
    state.showEnglish = false;
    
    closeModal();
    loadSelectedWords().then(() => {
        updateContent();
    });
}

function handleKeydown(e) {
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            nextWord();
            break;
        case 'ArrowUp':
            e.preventDefault();
            prevWord();
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
    const modal = document.getElementById('modal-overlay');
    if (modal.classList.contains('show') && modal.contains(e.target)) {
        return;
    }
    
    e.preventDefault();
    if (e.deltaY < 0) {
        prevWord();
    } else {
        nextWord();
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
    
    document.getElementById('settings-btn').addEventListener('click', openModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveModalSelection);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            closeModal();
        }
    });
}

init();
