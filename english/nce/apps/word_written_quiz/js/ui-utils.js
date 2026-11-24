const UI = {
    openModal(modalId, renderCallback = null) {
        if (renderCallback) {
            renderCallback();
        }
        document.getElementById(modalId).classList.add('show');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    },

    setupModalEventListeners(modalId, closeCallback) {
        document.getElementById(`${modalId}-close`).addEventListener('click', closeCallback);
        document.getElementById(modalId).addEventListener('click', (e) => {
            if (e.target.id === modalId) {
                closeCallback();
            }
        });
    },

    setupModalWithCancel(modalId, closeCallback) {
        this.setupModalEventListeners(modalId, closeCallback);
        document.getElementById(`${modalId}-cancel`).addEventListener('click', closeCallback);
    },

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
};
