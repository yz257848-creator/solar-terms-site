/**
 * detail.js —— 节气详情页脚本
 * 依据 URL 参数 id 渲染对应节气；无参数或参数无效时，自动回退到当前节气。
 */
(function () {
  'use strict';

  var D = window.SOLAR_DATA;
  var ST = window.ST;

  /** 读取地址栏中的节气 id，并做白名单校验 */
  function resolveTerm() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var term = id ? ST.getTerm(id) : null;
    if (term) return term;

    // 参数缺失或不合法时，使用今日所处节气
    return ST.currentTerm().term;
  }

  function render(t) {
    var season = D.seasons[t.season];
    var year = new Date().getFullYear();
    var exact = ST.termDate(year, t.index - 1);          // 今年的交节日期
    var $ = function (id) { return document.getElementById(id); };

    // 文档标题与描述
    document.title = t.name + ' · 二十四节气';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t.name + '：' + t.intro.slice(0, 68) + '……');

    // 面包屑
    if ($('crumb-season')) $('crumb-season').textContent = season.name + '季';
    if ($('crumb-term')) $('crumb-term').textContent = t.name;

    // 题头
    if ($('d-index')) $('d-index').textContent = '第 ' + ST.pad(t.index) + ' 个节气 · ' + season.title;
    if ($('d-name')) $('d-name').textContent = t.name;
    if ($('d-pinyin')) $('d-pinyin').textContent = t.pinyin;
    if ($('d-slogan')) $('d-slogan').textContent = t.slogan;

    if ($('d-date')) $('d-date').textContent = t.dateText;
    if ($('d-exact')) $('d-exact').textContent = year + '年' + ST.formatDate(exact);
    if ($('d-sun')) $('d-sun').textContent = t.sunLongitude + '°';
    if ($('d-season')) {
      $('d-season').textContent = season.name + '季 · 第 ' + ((t.index - 1) % 6 + 1) + ' 个节气';
    }
    if ($('d-saying')) $('d-saying').textContent = t.saying;

    if ($('d-img')) {
      $('d-img').src = ST.asset('assets/images/terms/' + t.image);
      $('d-img').alt = t.name + '节气插画';
    }
    if ($('d-seal')) $('d-seal').textContent = t.name;

    // 释义
    if ($('d-intro')) {
      $('d-intro').innerHTML = '<p>' + t.intro + '</p>' +
        '<p>在七十二候中，' + t.name + '的三候依次是<strong>' +
        t.phenology.map(function (p) { return '「' + p.name + '」'; }).join('') +
        '</strong>。五天为一候，古人便以这些草木鸟兽的细微变化，把一个节气分成三段可感的时光。</p>';
    }

    // 三候
    if ($('d-hou')) {
      var houName = ['初候', '二候', '三候'];
      $('d-hou').innerHTML = t.phenology.map(function (p, i) {
        return '<div class="hou">' +
          '<p class="hou__no">' + houName[i] + ' · 第 ' + (i * 5 + 1) + '—' + (i * 5 + 5) + ' 日</p>' +
          '<h3 class="hou__name">' + p.name + '</h3>' +
          '<p class="hou__desc">' + p.desc + '</p>' +
          '</div>';
      }).join('');
    }

    // 民俗
    if ($('d-customs')) {
      $('d-customs').innerHTML = t.customs.map(function (c, i) {
        return '<div class="custom">' +
          '<span class="custom__mark" aria-hidden="true"><i>' + ST.pad(i + 1) + '</i></span>' +
          '<div><h3 class="custom__title">' + c.title + '</h3>' +
          '<p class="custom__desc">' + c.desc + '</p></div>' +
          '</div>';
      }).join('');
    }

    // 养生
    if ($('d-health')) {
      $('d-health').innerHTML =
        '<p class="health__title">' + t.health.title + '</p>' +
        '<ul class="health__tips">' +
        t.health.tips.map(function (tip) { return '<li>' + tip + '</li>'; }).join('') +
        '</ul>';
    }

    // 诗词
    if ($('d-poem')) {
      $('d-poem').innerHTML =
        '<p class="poem__title">' + t.poem.title + '</p>' +
        '<div class="poem__lines">' +
        t.poem.lines.map(function (line) { return '<span>' + line + '</span>'; }).join('') +
        '</div>' +
        '<p class="poem__author">' + t.poem.dynasty + ' · ' + t.poem.author + '</p>' +
        '<p class="poem__note">' + t.poem.note + '</p>';
    }

    // 前后节气切换（首尾循环）
    if ($('d-switch')) {
      var prev = D.terms[(t.index - 2 + 24) % 24];
      var next = D.terms[t.index % 24];
      $('d-switch').innerHTML =
        '<a href="detail.html?id=' + prev.id + '">' +
          '<span class="term-switch__dir">← 上一个节气</span>' +
          '<span class="term-switch__name">' + prev.name + '</span>' +
          '<span class="term-switch__meta">' + prev.dateText + '</span>' +
        '</a>' +
        '<a href="detail.html?id=' + next.id + '">' +
          '<span class="term-switch__dir">下一个节气 →</span>' +
          '<span class="term-switch__name">' + next.name + '</span>' +
          '<span class="term-switch__meta">' + next.dateText + '</span>' +
        '</a>';
    }

    // 二十四节气索引：当前项高亮
    if ($('d-strip')) {
      $('d-strip').innerHTML = D.terms.map(function (item) {
        return '<li><a href="detail.html?id=' + item.id + '"' +
          (item.id === t.id ? ' class="is-current" aria-current="page"' : '') + '>' +
          item.name + '</a></li>';
      }).join('');
    }
  }

  function init() {
    var t = resolveTerm();
    render(t);
    ST.initReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
