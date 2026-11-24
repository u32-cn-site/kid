const Storage = {
    KEYS: {
        SELECTED_LESSONS: 'nce_sentence_written_quiz_selected_lessons',
        SENTENCE_COUNT: 'nce_sentence_written_quiz_sentence_count',
        WRONG_SENTENCES: 'nce_sentence_written_quiz_wrong_sentences',
        RECENT_RESULTS: 'nce_sentence_written_quiz_recent_results'
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

    loadWrongSentences(target) {
        this.loadFromStorage(this.KEYS.WRONG_SENTENCES, target, 'wrongSentences', []);
    },

    saveWrongSentences(wrongSentences) {
        this.saveToStorage(this.KEYS.WRONG_SENTENCES, wrongSentences);
    },

    loadRecentResults(target) {
        this.loadFromStorage(this.KEYS.RECENT_RESULTS, target, 'recentResults', []);
    },

    saveRecentResults(recentResults) {
        this.saveToStorage(this.KEYS.RECENT_RESULTS, recentResults);
    },

    loadSentenceCount(target) {
        this.loadFromStorage(this.KEYS.SENTENCE_COUNT, target, 'sentenceCount', 10);
    },

    saveSentenceCount(sentenceCount) {
        this.saveToStorage(this.KEYS.SENTENCE_COUNT, sentenceCount);
    }
};
