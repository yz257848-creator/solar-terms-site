/**
 * quiz.js —— 节气小问答
 * 简易答题逻辑：单选、即时判分、逐题解析、结果汇总。
 */
(function () {
  'use strict';

  var KEY = ['A', 'B', 'C', 'D'];
  var list = (window.SOLAR_DATA && window.SOLAR_DATA.quiz) || [];
  var index = 0;
  var score = 0;
  var answered = false;

  var el = {};

  function cache() {
    el.count = document.getElementById('quiz-count');
    el.score = document.getElementById('quiz-score');
    el.progress = document.getElementById('quiz-progress');
    el.question = document.getElementById('quiz-question');
    el.options = document.getElementById('quiz-options');
    el.feedback = document.getElementById('quiz-feedback');
    el.next = document.getElementById('quiz-next');
    el.tip = document.getElementById('quiz-tip');
    el.footer = document.getElementById('quiz-footer');
    el.result = document.getElementById('quiz-result');
    el.resultTitle = document.getElementById('quiz-result-title');
    el.resultText = document.getElementById('quiz-result-text');
    el.restart = document.getElementById('quiz-restart');
  }

  /* 渲染当前题目 */
  function render() {
    var item = list[index];
    answered = false;

    el.count.textContent = '第 ' + (index + 1) + ' / ' + list.length + ' 题';
    el.question.textContent = item.q;
    el.feedback.textContent = '';
    el.feedback.classList.remove('is-show');
    el.tip.textContent = '选择你认为正确的选项';
    el.next.disabled = true;
    el.next.textContent = index === list.length - 1 ? '查看结果' : '下一题';
    el.progress.style.width = (index / list.length) * 100 + '%';

    el.options.innerHTML = item.options.map(function (text, i) {
      return '<button class="quiz-option" type="button" data-i="' + i + '">' +
        '<span class="quiz-option__key">' + KEY[i] + '</span>' +
        '<span>' + text + '</span>' +
        '</button>';
    }).join('');
  }

  /* 作答 */
  function choose(i) {
    if (answered) return;
    answered = true;

    var item = list[index];
    var opts = el.options.querySelectorAll('.quiz-option');

    Array.prototype.forEach.call(opts, function (btn, k) {
      btn.disabled = true;
      if (k === item.answer) btn.classList.add('is-correct');
      if (k === i && k !== item.answer) btn.classList.add('is-wrong');
    });

    if (i === item.answer) {
      score++;
      el.tip.textContent = '答对了';
    } else {
      el.tip.textContent = '正确答案是 ' + KEY[item.answer];
    }

    el.score.textContent = '答对 ' + score + ' 题';
    el.feedback.textContent = item.explain;
    el.feedback.classList.add('is-show');
    el.next.disabled = false;
    el.progress.style.width = ((index + 1) / list.length) * 100 + '%';
  }

  /* 下一题 / 查看结果 */
  function next() {
    if (!answered) return;
    if (index < list.length - 1) {
      index++;
      render();
    } else {
      showResult();
    }
  }

  function showResult() {
    el.footer.style.display = 'none';
    el.question.style.display = 'none';
    el.options.style.display = 'none';
    el.feedback.style.display = 'none';
    el.result.classList.add('is-show');

    var total = list.length;
    var title = '答对 ' + score + ' / ' + total + ' 题';
    var text;

    if (score === total) {
      text = '全对。节气的时间、物候与诗句，你都已经记在心里了。';
    } else if (score >= total * 0.75) {
      text = '掌握得不错，再回到四季卡片里看看那些还没记牢的节气吧。';
    } else if (score >= total * 0.4) {
      text = '已经有了一半的印象，读一读每个节气的三候，会更容易记住。';
    } else {
      text = '不妨从「当令节气」开始，顺着一年的顺序再走一遍四季。';
    }

    el.resultTitle.textContent = title;
    el.resultText.textContent = text;
  }

  /* 重新开始 */
  function restart() {
    index = 0;
    score = 0;
    el.footer.style.display = '';
    el.question.style.display = '';
    el.options.style.display = '';
    el.feedback.style.display = '';
    el.feedback.classList.remove('is-show');
    el.result.classList.remove('is-show');
    el.score.textContent = '答对 0 题';
    render();
  }

  /* 事件绑定 */
  function bind() {
    el.options.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.quiz-option') : null;
      if (!btn || btn.disabled) return;
      choose(parseInt(btn.dataset.i, 10));
    });

    el.next.addEventListener('click', next);
    el.restart.addEventListener('click', restart);
  }

  function init() {
    cache();
    if (!el.question || !list.length) return;
    bind();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
