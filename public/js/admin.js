let currentQuizzes = [];
let activeQuiz = null;

const quizListEl = document.getElementById('quiz-list');
const quizCountBadge = document.getElementById('quiz-count-badge');
const editorEmpty = document.getElementById('editor-empty');
const editorContainer = document.getElementById('editor-container');

const quizTitleInput = document.getElementById('quiz-title');
const quizTimeInput = document.getElementById('quiz-time');
const quizDescInput = document.getElementById('quiz-desc');
const questionsCountEl = document.getElementById('questions-count');
const questionsAccordion = document.getElementById('questions-accordion');

const btnNewQuiz = document.getElementById('btn-new-quiz');
const btnSaveQuiz = document.getElementById('btn-save-quiz');
const btnDeleteQuiz = document.getElementById('btn-delete-quiz');
const btnAddQuestion = document.getElementById('btn-add-question');
const btnExportAll = document.getElementById('btn-export-all');
const fileImport = document.getElementById('file-import');

// Fetch Quizzes List
async function fetchQuizzes() {
  try {
    const res = await fetch('/api/quizzes');
    currentQuizzes = await res.json();
    renderQuizList();
  } catch (err) {
    console.error('Lỗi tải câu hỏi:', err);
  }
}

function renderQuizList() {
  quizCountBadge.textContent = `${currentQuizzes.length} bộ`;
  quizListEl.innerHTML = '';

  if (currentQuizzes.length === 0) {
    quizListEl.innerHTML = '<div class="text-slate-500 text-sm">Chưa có bộ câu hỏi nào.</div>';
    return;
  }

  currentQuizzes.forEach(q => {
    const isSelected = activeQuiz && activeQuiz.id === q.id;
    const item = document.createElement('div');
    item.className = `p-3 rounded-lg border cursor-pointer transition-all ${
      isSelected
        ? 'bg-slate-800 border-amber-400 shadow-md'
        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
    }`;
    item.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <h4 class="font-bold text-sm text-slate-200 truncate">${q.title}</h4>
        <span class="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">${q.questionCount || 0} câu</span>
      </div>
      <p class="text-xs text-slate-400 truncate">${q.description || 'Không có mô tả'}</p>
    `;
    item.onclick = () => selectQuiz(q.id);
    quizListEl.appendChild(item);
  });
}

async function selectQuiz(id) {
  try {
    const res = await fetch(`/api/quizzes/${id}`);
    activeQuiz = await res.json();
    renderQuizEditor();
    renderQuizList();
  } catch (err) {
    console.error('Lỗi khi tải chi tiết quiz:', err);
  }
}

function renderQuizEditor() {
  if (!activeQuiz) {
    editorEmpty.classList.remove('hidden');
    editorContainer.classList.add('hidden');
    return;
  }

  editorEmpty.classList.add('hidden');
  editorContainer.classList.remove('hidden');

  quizTitleInput.value = activeQuiz.title || '';
  quizTimeInput.value = activeQuiz.timePerQuestion || 15;
  quizDescInput.value = activeQuiz.description || '';

  renderQuestions();
}

function renderQuestions() {
  const questions = activeQuiz.questions || [];
  questionsCountEl.textContent = questions.length;
  questionsAccordion.innerHTML = '';

  if (questions.length === 0) {
    questionsAccordion.innerHTML = `
      <div class="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded">
        Chưa có câu hỏi nào trong bộ này. Bấm nút "+ Thêm Câu Hỏi Mới" ở trên.
      </div>
    `;
    return;
  }

  questions.forEach((q, idx) => {
    const qCard = document.createElement('div');
    qCard.className = 'bg-slate-900 border border-slate-800 rounded-lg p-4 relative';

    const optsHtml = [0, 1, 2, 3].map(optIdx => {
      const val = (q.options && q.options[optIdx]) || '';
      const isChecked = q.correctIndex === optIdx ? 'checked' : '';
      const colors = ['border-red-500/50', 'border-blue-500/50', 'border-amber-500/50', 'border-emerald-500/50'];
      const labels = ['A', 'B', 'C', 'D'];
      return `
        <div class="flex items-center gap-2">
          <input type="radio" name="correct_${idx}" value="${optIdx}" ${isChecked} onchange="updateCorrectIndex(${idx}, ${optIdx})" class="w-4 h-4 text-emerald-500 cursor-pointer">
          <span class="text-xs font-bold w-4 text-slate-400">${labels[optIdx]}:</span>
          <input type="text" value="${escapeHtml(val)}" onchange="updateOptionText(${idx}, ${optIdx}, this.value)" 
                 class="w-full bg-slate-950 border ${colors[optIdx]} rounded px-2.5 py-1.5 text-xs text-white focus:outline-none">
        </div>
      `;
    }).join('');

    qCard.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-3">
        <span class="text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
          Câu ${idx + 1}
        </span>
        <button onclick="deleteQuestion(${idx})" class="text-xs text-rose-400 hover:text-rose-300">
          ✕ Xóa câu này
        </button>
      </div>

      <div class="mb-3">
        <label class="block text-xs font-semibold text-slate-400 mb-1">Nội dung câu hỏi:</label>
        <textarea rows="2" onchange="updateQuestionText(${idx}, this.value)" 
                  class="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-400 focus:outline-none">${escapeHtml(q.question || '')}</textarea>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${optsHtml}
      </div>
    `;
    questionsAccordion.appendChild(qCard);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.updateQuestionText = (idx, text) => {
  if (activeQuiz && activeQuiz.questions[idx]) {
    activeQuiz.questions[idx].question = text;
  }
};

window.updateOptionText = (qIdx, optIdx, text) => {
  if (activeQuiz && activeQuiz.questions[qIdx]) {
    if (!activeQuiz.questions[qIdx].options) activeQuiz.questions[qIdx].options = ['', '', '', ''];
    activeQuiz.questions[qIdx].options[optIdx] = text;
  }
};

window.updateCorrectIndex = (qIdx, correctIdx) => {
  if (activeQuiz && activeQuiz.questions[qIdx]) {
    activeQuiz.questions[qIdx].correctIndex = Number(correctIdx);
  }
};

window.deleteQuestion = (idx) => {
  if (!confirm('Bạn có chắc muốn xóa câu hỏi này?')) return;
  if (activeQuiz && activeQuiz.questions) {
    activeQuiz.questions.splice(idx, 1);
    renderQuestions();
  }
};

btnAddQuestion.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  if (!activeQuiz) return;
  if (!activeQuiz.questions) activeQuiz.questions = [];
  activeQuiz.questions.push({
    id: `q-${Date.now()}`,
    question: 'Nội dung câu hỏi mới...',
    options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
    correctIndex: 0,
    difficulty: 1
  });
  renderQuestions();
  // Scroll to bottom
  questionsAccordion.scrollTop = questionsAccordion.scrollHeight;
};

btnNewQuiz.onclick = () => {
  if (window.soundFX) window.soundFX.playClick();
  activeQuiz = {
    id: `quiz-${Date.now()}`,
    title: 'Bộ Câu Hỏi Mới',
    description: 'Mô tả chi tiết...',
    timePerQuestion: 15,
    questions: [
      {
        id: `q1`,
        question: 'Câu hỏi mẫu 1?',
        options: ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C', 'Lựa chọn D'],
        correctIndex: 0,
        difficulty: 1
      }
    ]
  };
  renderQuizEditor();
};

btnSaveQuiz.onclick = async () => {
  if (!activeQuiz) return;

  activeQuiz.title = quizTitleInput.value.trim() || 'Bộ câu hỏi chưa đặt tên';
  activeQuiz.timePerQuestion = Number(quizTimeInput.value) || 15;
  activeQuiz.description = quizDescInput.value.trim();

  try {
    const isExisting = currentQuizzes.some(q => q.id === activeQuiz.id);
    let res;
    if (isExisting) {
      res = await fetch(`/api/quizzes/${activeQuiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeQuiz)
      });
    } else {
      res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeQuiz)
      });
    }

    if (res.ok) {
      if (window.soundFX) window.soundFX.playCorrect();
      alert('Đã lưu bộ câu hỏi thành công!');
      fetchQuizzes();
    } else {
      alert('Lỗi khi lưu bộ câu hỏi!');
    }
  } catch (err) {
    console.error('Save error:', err);
    alert('Không thể kết nối đến máy chủ.');
  }
};

btnDeleteQuiz.onclick = async () => {
  if (!activeQuiz) return;
  if (!confirm(`Bạn có chắc chắn muốn xóa bộ câu hỏi "${activeQuiz.title}"?`)) return;

  try {
    const res = await fetch(`/api/quizzes/${activeQuiz.id}`, { method: 'DELETE' });
    if (res.ok) {
      activeQuiz = null;
      renderQuizEditor();
      fetchQuizzes();
    }
  } catch (err) {
    console.error(err);
  }
};

btnExportAll.onclick = async () => {
  try {
    const res = await fetch('/api/quizzes');
    const all = await res.json();
    const fullQuizzes = [];
    for (const q of all) {
      const detailRes = await fetch(`/api/quizzes/${q.id}`);
      fullQuizzes.push(await detailRes.json());
    }
    const blob = new Blob([JSON.stringify(fullQuizzes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robotwar-quizzes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('Lỗi xuất dữ liệu: ' + err.message);
  }
};

fileImport.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const res = await fetch('/api/quizzes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Array.isArray(data) ? data : [data])
      });
      if (res.ok) {
        alert('Nhập bộ câu hỏi thành công!');
        fetchQuizzes();
      } else {
        alert('Lỗi định dạng khi nhập dữ liệu.');
      }
    } catch (err) {
      alert('File JSON không hợp lệ: ' + err.message);
    }
  };
  reader.readAsText(file);
};

// Initial Load
fetchQuizzes();
