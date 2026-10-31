/**
 * Universal Safe KaTeX LaTeX Math Formatter for RobotWar Quiz Arena
 * Supports:
 *   - Inline math: $formula$ or \(formula\)
 *   - Display math: $$formula$$ or \[formula\]
 */
(function() {
  const katexConfig = {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false,
    errorColor: '#E11D48'
  };

  function hasMath(text) {
    if (!text || typeof text !== 'string') return false;
    return text.includes('$') || text.includes('\\(') || text.includes('\\[') || text.includes('\\frac') || text.includes('\\sqrt');
  }

  window.renderLatex = function(element, rawText) {
    if (!element) return;
    const str = (rawText !== undefined && rawText !== null) ? String(rawText) : '';
    element.textContent = str;

    if (hasMath(str) && window.renderMathInElement) {
      try {
        window.renderMathInElement(element, katexConfig);
      } catch (err) {
        console.warn('KaTeX render error:', err);
      }
    }
  };

  window.renderLatexToString = function(rawText) {
    const container = document.createElement('span');
    window.renderLatex(container, rawText);
    return container.innerHTML;
  };

  window.setupLatexPreview = function(inputEl, previewContainerEl) {
    if (!inputEl || !previewContainerEl) return;
    const update = () => {
      const val = inputEl.value || '';
      if (hasMath(val)) {
        previewContainerEl.classList.remove('hidden');
        window.renderLatex(previewContainerEl, val);
      } else {
        previewContainerEl.classList.add('hidden');
      }
    };
    inputEl.addEventListener('input', update);
    inputEl.addEventListener('change', update);
    update();
  };
})();
