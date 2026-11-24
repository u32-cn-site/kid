const ModalRenderers = {
    renderLessonModalBody(books, allLessons, selectedLessons, wrongSentences) {
        const modalBody = document.getElementById('lesson-modal-body');
        let html = '';

        if (wrongSentences.length > 0) {
            html += `
                <div class="book-section">
                    <div class="book-title">错误句子 (${wrongSentences.length}句)</div>
                    <div class="lesson-item">
                        <input type="checkbox" id="wrong-sentences-checkbox" checked>
                        <label for="wrong-sentences-checkbox">使用错误句子练习</label>
                    </div>
                </div>
            `;
        }

        for (const book of books) {
            const bookLessons = allLessons.filter(l => l.bookName === book.name);
            if (bookLessons.length === 0) continue;

            html += `
                <div class="book-section">
                    <div class="book-title">${book.name}</div>
            `;

            for (const lesson of bookLessons) {
                const isChecked = selectedLessons.some(
                    l => l.bookIndex === lesson.bookIndex && l.lesson === lesson.lesson
                );

                html += `
                    <div class="lesson-item">
                        <input type="checkbox"
                            id="lesson-${lesson.bookIndex}-${lesson.lesson}"
                            data-book-index="${lesson.bookIndex}"
                            data-lesson="${lesson.lesson}"
                            ${isChecked ? 'checked' : ''}>
                        <label for="lesson-${lesson.bookIndex}-${lesson.lesson}">Lesson ${lesson.lesson} ${lesson.title[0]} ${lesson.title[1]}</label>
                    </div>
                `;
            }

            html += '</div>';
        }

        modalBody.innerHTML = html;
    },

    renderWrongSentencesList(wrongSentences) {
        document.getElementById('wrong-sentences-count').textContent = wrongSentences.length;

        const list = document.getElementById('wrong-sentences-list');
        list.innerHTML = '';

        if (wrongSentences.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">暂无错误句子,太棒了！</div>';
            return;
        }

        for (const sentenceData of wrongSentences) {
            const div = document.createElement('div');
            div.className = 'wrong-item';
            div.innerHTML = `
                <div class="wrong-word">${sentenceData.sentence}</div>
                <div class="wrong-meaning">${sentenceData.meaning}</div>
                <div style="font-size:12px;color:#999;margin-top:4px;">${sentenceData.lessonInfo.bookName} - Lesson ${sentenceData.lessonInfo.lesson}</div>
            `;
            list.appendChild(div);
        }
    },

    renderRecentResultsList(recentResults) {
        const list = document.getElementById('recent-results-list');
        list.innerHTML = '';

        if (recentResults.length === 0) {
            list.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">暂无测试记录</div>';
            return;
        }

        for (const test of recentResults.reverse()) {
            const testDiv = document.createElement('div');
            testDiv.className = 'recent-test-result';

            const date = new Date(test.time);
            const dateStr = date.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            testDiv.innerHTML = `
                <div class="test-summary">
                    <span class="test-time">${dateStr}</span>
                    <span class="test-score">${test.score}分</span>
                    <span class="test-stats">(${test.correctCount}正确/${test.wrongCount}错误)</span>
                </div>
                <div class="test-details" style="display:none;">
                    ${test.results.map(result => `
                        <div class="test-word-item ${result.isCorrect ? 'correct' : 'wrong'}">
                            <span class="test-word">${result.sentence}</span>
                            <span class="test-spelling">${result.spelling}</span>
                            <span class="test-status">${result.isCorrect ? '✓' : '✗'}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            testDiv.querySelector('.test-summary').addEventListener('click', function() {
                const details = testDiv.querySelector('.test-details');
                details.style.display = details.style.display === 'none' ? 'block' : 'none';
            });

            list.appendChild(testDiv);
        }
    }
};
