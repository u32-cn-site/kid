const AudioPlayer = {
    audioContext: null,

    getContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    },

    playTone(freq, start, duration, gain, startTime) {
        const audioCtx = this.getContext();
        if (audioCtx.state === 'closed') {
            this.audioContext = null;
            return;
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(gain, startTime + start);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + start + duration);

        oscillator.start(startTime + start);
        oscillator.stop(startTime + start + duration);
    },

    playMelody(notes, gain = 0.15) {
        const audioCtx = this.getContext();
        if (audioCtx.state === 'closed') {
            this.audioContext = null;
            return;
        }

        const now = audioCtx.currentTime;
        notes.forEach(note => {
            this.playTone(note.freq, note.start, note.duration, gain, now);
        });
    },

    playKeypressSound() {
        try {
            this.playTone(800, 0, 0.1, 0.1, this.getContext().currentTime);
        } catch (error) {
            console.warn('播放按键音效失败:', error);
        }
    },

    playSuccessSound() {
        try {
            const notes = [
                { freq: 523.25, start: 0, duration: 0.15 },
                { freq: 659.25, start: 0.15, duration: 0.15 },
                { freq: 783.99, start: 0.3, duration: 0.15 },
                { freq: 1046.50, start: 0.45, duration: 0.2 },
                { freq: 783.99, start: 0.65, duration: 0.15 },
                { freq: 1046.50, start: 0.8, duration: 0.3 }
            ];
            this.playMelody(notes);
        } catch (error) {
            console.warn('播放成功音效失败:', error);
        }
    },

    playPerfectScoreSound() {
        try {
            const melody = [
                { freq: 523.25, start: 0, duration: 0.12 },
                { freq: 659.25, start: 0.12, duration: 0.12 },
                { freq: 783.99, start: 0.24, duration: 0.12 },
                { freq: 1046.50, start: 0.36, duration: 0.12 },
                { freq: 783.99, start: 0.48, duration: 0.12 },
                { freq: 1046.50, start: 0.6, duration: 0.15 },
                { freq: 1318.51, start: 0.75, duration: 0.12 },
                { freq: 1046.50, start: 0.87, duration: 0.12 },
                { freq: 1567.98, start: 0.99, duration: 0.25 },
                { freq: 1318.51, start: 1.24, duration: 0.12 },
                { freq: 1567.98, start: 1.36, duration: 0.4 }
            ];
            this.playMelody(melody, 0.18);
        } catch (error) {
            console.warn('播放满分音效失败:', error);
        }
    },

    speakWord(word) {
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.volume = 1;
            speechSynthesis.speak(utterance);
        }
    }
};
