const DataLoader = {
    async loadData() {
        try {
            const response = await fetch('../../data/index.json');
            const data = await response.json();
            return data.books;
        } catch (error) {
            console.error('加载数据失败:', error);
            return [];
        }
    },

    async loadAllLessons(books) {
        const allLessons = [];
        for (const book of books) {
            const bookDir = book.dir;
            const fullPath = '../../data/' + bookDir + '/index.json';
            const response = await fetch(fullPath);
            const bookData = await response.json();

            for (const lesson of bookData.lessons) {
                allLessons.push({
                    bookIndex: books.indexOf(book),
                    bookName: book.name,
                    lesson: lesson.lesson,
                    title: lesson.title,
                    dir: bookDir
                });
            }
        }
        return allLessons;
    },

    async loadLessonSentences(lesson) {
        const lessonPath = `../../data/${lesson.dir}/lesson_${lesson.lesson}.json`;

        try {
            const response = await fetch(lessonPath);
            const lessonData = await response.json();
            return lessonData.content.sentences || [];
        } catch (error) {
            console.error(`加载课文句子失败: ${lessonPath}`, error);
            return [];
        }
    }
};
