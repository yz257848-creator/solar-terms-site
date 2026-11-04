/**
 * home.js —— 首页脚本
 * 职责：渲染「当令节气」卡片、二十四节气刻度尺、四季节气卡片。
 */
(function () {
  'use strict';

  var D = window.SOLAR_DATA;
  var ST = window.ST;

  /** 取资源相对路径 */
  function img(path) {
    return ST.asset('assets/images/terms/' + path);
  }

  /* ---------- 1. 当令节气 ---------- */
  function renderNow() {
    var info = ST.currentTerm();          // 自动识别今日所处节气
    var t = info.term;
    var today = new Date();
    var endDate = new Date(info.end.getTime() - 86400000);   // 本节气最后一天
    var total = ST.dayDiff(info.start, info.end);

    var $ = function (id) { return document.getElementById(id); };

    if ($('now-name')) {
      $('now-name').textContent = t.name;
      document.title = t.name + ' · 二十四节气';
    }
    if ($('now-pinyin')) $('now-pinyin').textContent = t.pinyin;
    if ($('now-slogan')) $('now-slogan').textContent = t.slogan;
    if ($('now-intro')) $('now-intro').textContent = t.intro;
    if ($('now-range')) {
      $('now-range').textContent = ST.formatDate(info.start) + ' — ' + ST.formatDate(endDate);
    }
    if ($('now-day')) {
      $('now-day').textContent = '第 ' + info.dayIndex + ' 天 / 共 ' + total + ' 天';
    }
    if ($('now-next')) {
      $('now-next').textContent = info.nextTerm.name + ' · 还有 ' + info.daysLeft + ' 天';
    }
    if ($('now-link')) {
      $('now-link').href = 'pages/detail.html?id=' + t.id;
    }
    if ($('now-seal')) $('now-seal').textContent = t.name;
    if ($('now-img')) {
      $('now-img').src = img(t.image);
      $('now-img').alt = t.name + '节气插画';
    }

    renderRuler(t.index - 1, t.name);
    document.body.dataset.season = t.season;
    return info;
  }

  /* ---------- 2. 二十四节气刻度尺 ---------- */
  function renderRuler(activeIndex, activeName) {
    var box = document.getElementById('ruler');
    if (!box) return;

    var html = '';
    for (var i = 0; i < 24; i++) {
      var cls = 'ruler__tick';
      if (i % 6 === 0) cls += ' is-major';         // 四立：每季起点
      if (i === activeIndex) cls += ' is-now';
      html += '<i class="' + cls + '"></i>';
    }
    // 当前节气的小标签，按比例定位
    var left = ((activeIndex + 0.5) / 24) * 100;
    html += '<span class="ruler__tag" style="left:' + left + '%">' + activeName + '</span>';
    box.innerHTML = html;
  }

  /* ---------- 3. 四季节气卡片 ---------- */
  function cardHTML(t, currentId) {
    var isNow = t.id === currentId;
    return '' +
      '<a class="term-card" href="pages/detail.html?id=' + t.id + '" data-reveal>' +
        '<div class="term-card__media">' +
          '<img src="' + img(t.image) + '" alt="' + t.name + '节气插画" width="800" height="600" loading="lazy">' +
          '<span class="term-card__no">' + ST.pad(t.index) + '</span>' +
          (isNow ? '<span class="term-card__now">当令</span>' : '') +
        '</div>' +
        '<div class="term-card__body">' +
          '<div class="term-card__row">' +
            '<h4 class="term-card__name">' + t.name + '</h4>' +
            '<span class="term-card__py">' + t.pinyin + '</span>' +
          '</div>' +
          '<p class="term-card__date">' + t.dateText + ' · 黄经 ' + t.sunLongitude + '°</p>' +
          '<p class="term-card__desc">' + t.slogan + '</p>' +
        '</div>' +
        '<span class="term-card__arrow" aria-hidden="true">→</span>' +
      '</a>';
  }

  function renderSeasons(currentId) {
    ['spring', 'summer', 'autumn', 'winter'].forEach(function (key) {
      var grid = document.querySelector('[data-grid="' + key + '"]');
      if (!grid) return;
      grid.innerHTML = D.terms
        .filter(function (t) { return t.season === key; })
        .map(function (t) { return cardHTML(t, currentId); })
        .join('');
    });
    // 新插入的卡片需要重新注册淡入观察
    ST.initReveal();
  }

  /* ---------- 4. 初始化 ---------- */
  function init() {
    var info = renderNow();
    renderSeasons(info.term.id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
