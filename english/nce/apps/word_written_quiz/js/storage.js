const Storage = {
    KEYS: {
        SELECTED_LESSONS: 'nce_word_written_quiz_selected_lessons',
        WORD_COUNT: 'nce_word_written_quiz_word_count',
        WRONG_WORDS: 'nce_word_written_quiz_wrong_words',
        RECENT_RESULTS: 'nce_word_written_quiz_recent_results'
    },

    load(key, defaultValue = null) {
        const saved = localStorage.getItem(key);
        if (saved) {
            return JSON.parse(saved);
        }
        return defaultValue;
    },

    save(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    loadFromStorage(key, target, property, defaultValue = null) {
        const saved = localStorage.getItem(key);
        if (saved) {
            target[property] = JSON.parse(saved);
        } else if (defaultValue !== null) {
            target[property] = defaultValue;
        }
    },

    saveToStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    },

    loadSelectedLessons(target) {
        this.loadFromStorage(this.KEYS.SELECTED_LESSONS, target, 'selectedLessons', []);
    },

    saveSelectedLessons(selectedLessons) {
        this.saveToStorage(this.KEYS.SELECTED_LESSONS, selectedLessons);
    },

    loadWrongWords(target) {
        this.loadFromStorage(this.KEYS.WRONG_WORDS, target, 'wrongWords', []);
    },

    saveWrongWords(wrongWords) {
        this.saveToStorage(this.KEYS.WRONG_WORDS, wrongWords);
    },

    loadRecentResults(target) {
        this.loadFromStorage(this.KEYS.RECENT_RESULTS, target, 'recentResults', []);
    },

    saveRecentResults(recentResults) {
        this.saveToStorage(this.KEYS.RECENT_RESULTS, recentResults);
    },

    loadWordCount(target) {
        this.loadFromStorage(this.KEYS.WORD_COUNT, target, 'wordCount', 10);
    },

    saveWordCount(wordCount) {
        this.saveToStorage(this.KEYS.WORD_COUNT, wordCount);
    }
};
