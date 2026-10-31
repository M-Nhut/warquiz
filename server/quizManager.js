const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'quizzes.json');

class QuizManager {
  constructor() {
    this.quizzes = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.quizzes = JSON.parse(raw);
      } else {
        this.quizzes = [];
        this.save();
      }
    } catch (err) {
      console.error('Error loading quizzes:', err);
      this.quizzes = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.quizzes, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error saving quizzes:', err);
      return false;
    }
  }

  getAllQuizzes() {
    return this.quizzes.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      questionCount: q.questions ? q.questions.length : 0,
      timePerQuestion: q.timePerQuestion || 15
    }));
  }

  getQuizById(id) {
    return this.quizzes.find(q => q.id === id);
  }

  createQuiz(data) {
    const id = data.id || `quiz-${Date.now()}`;
    const newQuiz = {
      id,
      title: data.title || 'Bộ câu hỏi mới',
      description: data.description || '',
      timePerQuestion: Number(data.timePerQuestion) || 15,
      questions: data.questions || []
    };
    this.quizzes.push(newQuiz);
    this.save();
    return newQuiz;
  }

  updateQuiz(id, data) {
    const idx = this.quizzes.findIndex(q => q.id === id);
    if (idx === -1) return null;
    this.quizzes[idx] = {
      ...this.quizzes[idx],
      title: data.title || this.quizzes[idx].title,
      description: data.description !== undefined ? data.description : this.quizzes[idx].description,
      timePerQuestion: Number(data.timePerQuestion) || this.quizzes[idx].timePerQuestion || 15,
      questions: data.questions || this.quizzes[idx].questions
    };
    this.save();
    return this.quizzes[idx];
  }

  deleteQuiz(id) {
    const idx = this.quizzes.findIndex(q => q.id === id);
    if (idx === -1) return false;
    this.quizzes.splice(idx, 1);
    this.save();
    return true;
  }

  importQuizzes(quizArray) {
    if (!Array.isArray(quizArray)) return false;
    for (const item of quizArray) {
      if (item && item.title && Array.isArray(item.questions)) {
        item.id = item.id || `quiz-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const existingIdx = this.quizzes.findIndex(q => q.id === item.id);
        if (existingIdx !== -1) {
          this.quizzes[existingIdx] = item;
        } else {
          this.quizzes.push(item);
        }
      }
    }
    this.save();
    return true;
  }
}

module.exports = new QuizManager();
