/**
 * orbit.js —— 「地球在哪儿」交互
 * 职责：按节气对应的太阳黄经，在黄道俯视图上标出地球的位置，并给出距离、直射点、昼夜等读数。
 * 全部图形用原生 SVG 字符串拼成，不依赖任何图表库，也没有任何外部资源。
 *
 * 三条约定：
 *   1. 这是俯视图，视线从黄道北极往下看。黄经逆时针增大，而屏幕纵轴向下，所以 y 要取反。
 *   2. 节气给定的是「太阳黄经 λ」，地球与太阳永远分处两端，故地球黄经 = λ + 180°。
 *   3. 地轴方向在空间中基本固定，投影到这张俯视图上恒为竖直、北端朝上，
 *      这也正好解释了为什么夏至时北极朝着太阳、冬至时背着太阳。
 */
(function (global) {
  'use strict';

  var D = global.SOLAR_DATA;
  if (!D || !D.terms) return;

  /* ---------- 1. 几何常量（画布 720 × 720） ---------- */
  var CX = 360, CY = 360;
  var R = 224;          // 轨道半径
  var R_EARTH = 23;     // 地球半径
  var R_SEASON = 268;   // 季节色环半径
  var R_LABEL = 306;    // 四正位文字半径
  var R_BADGE = R - 56; // 节气名写在环内侧，避开地球本身
  var R_SUN = 24;       // 太阳圆心半径
  var AU = 1.496;       // 1 天文单位 ≈ 1.496 亿公里
  var PERI_LON = 282.5; // 近日点对应的太阳黄经（每年 1 月初）
  var TILT = 23.44;     // 黄赤交角，用于算太阳直射点纬度

  /* 四个正位：环上位置用「地球所在黄经」表示，括号里是当时的太阳黄经 */
  var CARDINAL = [
    { lon: 0, name: '秋分', sun: 180 },
    { lon: 90, name: '冬至', sun: 270 },
    { lon: 180, name: '春分', sun: 0 },
    { lon: 270, name: '夏至', sun: 90 }
  ];

  /* 季节色环：以四立为界，同样按地球黄经分段 */
  var SEASON_ARC = [
    ['spring', 135, 225],
    ['summer', 225, 315],
    ['autumn', 315, 405],
    ['winter', 45, 135]
  ];

  /* 每个节气一句小注，长短不齐，像随手记的 */
  var NOTES = {
    lichun: '刚过近日点不久，地球还走在离太阳比较近的一段路上。',
    yushui: '地球仍然偏在近日点这一侧，太阳的直射点正慢慢往北挪。',
    jingzhe: '快走到春分那个位置了，再过半个月，昼夜就要拉平。',
    chunfen: '地球在环的最左边，太阳直射赤道，南北半球分到的光差不多。',
    qingming: '过了春分，北半球的白天开始比黑夜长，一天长一点。',
    guyu: '地球朝远日点那头走，太阳一天比一天升得高。',
    lixia: '直射点已经进了北半球，北半球从此昼长夜短。',
    xiaoman: '太阳直射点接近最北的位置，白天还在继续变长。',
    mangzhong: '快到夏至那个点了，北半球的白昼正在逼近一年里最长的一天。',
    xiazhi: '地球在环的正下方，北极整个探向太阳，北半球白昼最长。',
    xiaoshu: '这几天正好经过远日点，是一年里地球离太阳最远的时候。',
    dashu: '刚过远日点，日地距离又开始一点点缩短，但热还在后头。',
    liqiu: '过了远日点，地球开始往回走，日地距离一点点缩短。',
    chushu: '太阳直射点往南退，白天一天比一天短一点。',
    bailu: '快到秋分了，昼夜又要拉平，早上草叶上开始有露水。',
    qiufen: '地球在环的最右边，太阳直射赤道，这一天昼夜几乎一样长。',
    hanlu: '直射点已经进了南半球，北半球昼短夜长。',
    shuangjiang: '太阳越走越低，正午的影子一天比一天长。',
    lidong: '地球朝近日点那头转，白天继续变短。',
    xiaoxue: '北半球接到的阳光越来越斜，地面攒不住热了。',
    daxue: '快到冬至，正午的太阳高度接近一年里最低。',
    dongzhi: '地球在环的正上方，北极背对太阳，北半球白昼最短。',
    xiaohan: '这两天正是近日点，一年里地球离太阳最近。',
    dahan: '离开近日点不久，日地距离正在一点点拉大。'
  };

  /* ---------- 2. 小工具 ---------- */

  /** 黄经 + 半径 → 画布坐标（黄经逆时针增大，故纵轴取反） */
  function api(lon, r) {
    var a = lon * Math.PI / 180;
    return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
  }

  function n(v, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(v * p) / p;
  }

  /** 地球所在黄经 */
  function earthLon(t) {
    return (t.sunLongitude + 180) % 360;
  }

  /** 圆弧路径（黄经增大方向，即屏幕上逆时针） */
  function arcPath(r, lon1, lon2) {
    var a = api(lon1, r);
    var b = api(lon2, r);
    return 'M' + n(a.x) + ',' + n(a.y) + ' A' + r + ',' + r + ' 0 0 0 ' + n(b.x) + ',' + n(b.y);
  }

  /**
   * 地球「昼半球」的路径：以晨昏线为直径，取朝向太阳的那半圆。
   * theta 是地球指向太阳的屏幕角度，从 theta+90° 逆时针画到 theta-90°，
   * 恰好经过 theta，也就是正对太阳的那一侧。
   */
  function dayPath(ex, ey, r, theta) {
    var a1 = theta + Math.PI / 2;
    var a2 = theta - Math.PI / 2;
    var p1 = { x: ex + r * Math.cos(a1), y: ey + r * Math.sin(a1) };
    var p2 = { x: ex + r * Math.cos(a2), y: ey + r * Math.sin(a2) };
    return 'M' + n(p1.x) + ',' + n(p1.y) +
           ' A' + r + ',' + r + ' 0 0 0 ' + n(p2.x) + ',' + n(p2.y) + ' Z';
  }

  /* ---------- 3. 天文读数 ---------- */

  /** 日地距离（天文单位）：近日点在太阳黄经 282.5° 附近，e ≈ 0.0167 */
  function distAU(lonSun) {
    return 1 - 0.0167 * Math.cos((lonSun - PERI_LON) * Math.PI / 180);
  }

  /** 太阳直射点纬度（赤纬），sinδ = sin23.44° · sinλ */
  function decl(lonSun) {
    var s = Math.sin(TILT * Math.PI / 180) * Math.sin(lonSun * Math.PI / 180);
    return Math.asin(Math.max(-1, Math.min(1, s))) * 180 / Math.PI;
  }

  /* ---------- 4. 静态图层 ---------- */

  function buildStatic() {
    var o = [];

    o.push('<defs>');
    o.push('<radialGradient id="ogSun" cx="38%" cy="34%" r="72%">' +
           '<stop offset="0%" stop-color="#f6e2b0"/>' +
           '<stop offset="58%" stop-color="#dcb46c"/>' +
           '<stop offset="100%" stop-color="#b08c4f"/>' +
           '</radialGradient>');
    o.push('<marker id="ogArrow" viewBox="0 0 10 10" refX="8" refY="5" ' +
           'markerWidth="7" markerHeight="7" orient="auto">' +
           '<path d="M0,1 L9,5 L0,9 Z" fill="#8fb9ab"/></marker>');
    o.push('</defs>');

    o.push('<title id="ogTitle">地球与太阳的相对位置</title>');
    o.push('<desc>俯视黄道面的示意图：中心是太阳，圆环上标出二十四节气时地球所在的位置。</desc>');

    // 季节色环
    o.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_SEASON +
           '" fill="none" stroke="rgba(47,107,91,0.10)" stroke-width="1"/>');
    SEASON_ARC.forEach(function (s) {
      var col = D.seasons[s[0]].color;
      o.push('<path d="' + arcPath(R_SEASON, s[1], s[2]) + '" fill="none" stroke="' + col +
             '" stroke-opacity="0.5" stroke-width="6"/>');
    });

    // 轨道虚线
    o.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R +
           '" fill="none" stroke="rgba(47,107,91,0.28)" stroke-width="1" stroke-dasharray="2 6"/>');

    // 二十四节气对应的地球位置：小圆点，二分二至稍微大一点
    D.terms.forEach(function (t) {
      var p = api(earthLon(t), R);
      var col = D.seasons[t.season].color;
      var major = t.sunLongitude % 90 === 0;
      o.push('<circle cx="' + n(p.x) + '" cy="' + n(p.y) + '" r="' + (major ? 4.4 : 2.8) +
             '" fill="' + col + '" fill-opacity="' + (major ? 0.95 : 0.5) +
             '" stroke="#fcfaf3" stroke-width="1"/>');
    });

    // 公转方向箭头
    var a1 = api(26, R + 20);
    var a2 = api(52, R + 20);
    o.push('<path d="' + arcPath(R + 20, 26, 52) + '" fill="none" stroke="#8fb9ab" ' +
           'stroke-width="1.8" marker-end="url(#ogArrow)" stroke-opacity="1"/>');
    void a1; void a2;

    // 四正位文字
    CARDINAL.forEach(function (c) {
      var p = api(c.lon, R_LABEL);
      o.push('<text x="' + n(p.x) + '" y="' + n(p.y - 2) + '" text-anchor="middle" ' +
             'font-size="14" letter-spacing="1.5" fill="#46524d">' + c.name + '</text>');
      o.push('<text class="og-sub" x="' + n(p.x) + '" y="' + n(p.y + 15) + '" text-anchor="middle" ' +
             'font-size="9.5" letter-spacing="0.5" fill="#7b8781">太阳黄经 ' + c.sun + '°</text>');
    });

    // 太阳：光晕 + 光芒 + 本体
    o.push('<circle cx="' + CX + '" cy="' + CY + '" r="56" fill="rgba(216,180,108,0.12)"/>');
    o.push('<circle cx="' + CX + '" cy="' + CY + '" r="37" fill="rgba(216,180,108,0.18)"/>');
    for (var i = 0; i < 8; i++) {
      var a = i * 45 * Math.PI / 180;
      o.push('<line x1="' + n(CX + Math.cos(a) * 27) + '" y1="' + n(CY - Math.sin(a) * 27) +
             '" x2="' + n(CX + Math.cos(a) * 32) + '" y2="' + n(CY - Math.sin(a) * 32) +
             '" stroke="#c8a05c" stroke-opacity="0.32" stroke-width="1.3" stroke-linecap="round"/>');
    }
    o.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R_SUN + '" fill="url(#ogSun)"/>');

    // 动态层
    o.push('<g id="ogDyn"></g>');

    return '<svg viewBox="0 0 720 720" role="img" aria-labelledby="ogTitle" ' +
           'xmlns="http://www.w3.org/2000/svg">' + o.join('') + '</svg>';
  }

  /* ---------- 5. 动态图层（每次换节气重画） ---------- */

  function buildDynamic(lon, term) {
    var e = api(lon, R);
    var theta = Math.atan2(CY - e.y, CX - e.x); // 地球指向太阳的屏幕角度
    var inner = api(lon, R - R_EARTH);          // 视线起点：地球朝内的边缘
    var rim = api(lon, R_SUN + 1);              // 视线终点：太阳边缘
    var badge = api(lon, R_BADGE);
    var o = [];

    // 地球望向太阳的视线
    o.push('<line x1="' + n(inner.x) + '" y1="' + n(inner.y) + '" x2="' + n(rim.x) + '" y2="' + n(rim.y) +
           '" stroke="#2f6b5b" stroke-opacity="0.42" stroke-width="1.2" stroke-dasharray="5 5"/>');

    // 选中位置的淡影，让地球「落」在环上
    o.push('<circle cx="' + n(e.x) + '" cy="' + n(e.y) + '" r="' + (R_EARTH + 13) +
           '" fill="#2f6b5b" fill-opacity="0.08"/>');

    // 地球：夜半球打底，再盖一层昼半球
    o.push('<circle cx="' + n(e.x) + '" cy="' + n(e.y) + '" r="' + R_EARTH + '" fill="#5e6b66"/>');
    o.push('<path d="' + dayPath(e.x, e.y, R_EARTH, theta) + '" fill="#f4f1e3"/>');
    o.push('<circle cx="' + n(e.x) + '" cy="' + n(e.y) + '" r="' + R_EARTH +
           '" fill="none" stroke="#2f6b5b" stroke-opacity="0.55" stroke-width="1.1"/>');

    // 地轴：投影后恒为竖直，北端朝上
    o.push('<line x1="' + n(e.x) + '" y1="' + n(e.y - R_EARTH * 1.16) + '" x2="' + n(e.x) +
           '" y2="' + n(e.y + R_EARTH * 1.16) + '" stroke="#2f6b5b" stroke-opacity="0.5" ' +
           'stroke-width="1" stroke-dasharray="2.5 3"/>');
    o.push('<text x="' + n(e.x + 5) + '" y="' + n(e.y - R_EARTH * 1.16 - 3) +
           '" font-size="9" fill="#2f6b5b" fill-opacity="0.75">N</text>');

    // 节气名。二分二至在圆环外已经写着，这里就不重复了
    if (term.sunLongitude % 90 !== 0) {
      o.push('<text x="' + n(badge.x) + '" y="' + n(badge.y + 5) + '" text-anchor="middle" ' +
             'font-size="14" letter-spacing="2.5" fill="#2f6b5b" stroke="#f8f4ea" ' +
             'stroke-width="4" stroke-linejoin="round" style="paint-order:stroke">' +
             term.name + '</text>');
    }

    return o.join('');
  }

  /* ---------- 6. 读数面板 ---------- */

  function panelHTML(t) {
    var lon = earthLon(t);
    var lam = t.sunLongitude;
    var d = decl(lam);
    var au = distAU(lam);
    var season = D.seasons[t.season];

    var dirLat = Math.abs(d) < 0.15 ? '赤道'
      : (d > 0 ? '北纬 ' + Math.abs(d).toFixed(1) + '°' : '南纬 ' + Math.abs(d).toFixed(1) + '°');
    var light = Math.abs(d) < 0.15 ? '昼夜平分' : (d > 0 ? '昼长夜短' : '昼短夜长');

    var trend, trendShort;
    if (lam === 90) {
      trend = '这是全年白昼最长的一天，往后就一点点变短了。';
      trendShort = '转折';
    } else if (lam === 270) {
      trend = '这是全年白昼最短的一天，往后就一点点变长了。';
      trendShort = '转折';
    } else if (lam > 270 || lam < 90) {
      trend = '白天正在一天天变长。';
      trendShort = '渐长';
    } else {
      trend = '白天正在一天天变短。';
      trendShort = '渐短';
    }

    var note = NOTES[t.id] || '';

    return '' +
      '<p class="orb-panel__kicker">第 ' + t.index + ' 个节气 · ' + season.name + '季</p>' +
      '<div class="orb-panel__title">' +
        '<h2>' + t.name + '</h2>' +
        '<span class="orb-panel__pinyin">' + t.pinyin + '</span>' +
      '</div>' +
      '<p class="orb-panel__slogan">' + t.slogan + '</p>' +
      '<p class="orb-panel__text">太阳走到黄经 <strong>' + lam + '°</strong>时，' + t.name +
        '就开始了，通常落在 ' + t.dateText + '。这一刻地球在轨道上的 <strong>' + lon +
        '°</strong>处，与太阳分处两端。</p>' +
      '<p class="orb-panel__text">太阳直射点在<strong>' + dirLat + '</strong>，北半球' +
        light + '，' + trend + '</p>' +
      '<dl class="orb-facts">' +
        '<div><dt>太阳黄经</dt><dd>' + lam + '°</dd></div>' +
        '<div><dt>地球所在黄经</dt><dd>' + lon + '°</dd></div>' +
        '<div><dt>日地距离</dt><dd>' + (au * AU).toFixed(3) +
          ' 亿公里<small>平均 1.496 亿公里</small></dd></div>' +
        '<div><dt>北半球昼长</dt><dd>' + light + ' · ' + trendShort + '</dd></div>' +
      '</dl>' +
      (note ? '<p class="orb-panel__note">' + note + '</p>' : '') +
      '<div class="orb-panel__actions">' +
        '<a class="btn btn--primary" href="detail.html?id=' + t.id + '">看这个节气的详情</a>' +
        '<span class="orb-panel__hint">也可用 Tab 键切到下方节气按钮</span>' +
      '</div>';
  }

  /* ---------- 7. 页面装配 ---------- */

  var el = {
    stage: document.getElementById('orb-stage'),
    panel: document.getElementById('orb-panel'),
    chips: document.getElementById('orb-chips'),
    prev: document.getElementById('orb-prev'),
    next: document.getElementById('orb-next')
  };
  if (!el.stage) return;

  var dyn = null;       // 动态图层 <g>
  var current = 0;      // 当前选中的节气下标
  var lonNow = 0;       // 地球当前黄经（动画中间值）
  var raf = null;

  function paint(lon, term) {
    if (dyn) dyn.innerHTML = buildDynamic(lon, term);
  }

  function markChips() {
    var btns = el.chips ? el.chips.children : [];
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-pressed', i === current ? 'true' : 'false');
    }
  }

  function animateTo(target, term) {
    if (raf) {
      global.cancelAnimationFrame(raf);
      raf = null;
    }
    var reduce = global.matchMedia &&
                 global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      lonNow = target;
      paint(target, term);
      return;
    }

    var from = lonNow;
    var delta = ((target - from + 540) % 360) - 180; // 取最短的一边转过去
    var dur = 520;
    var t0 = null;

    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      lonNow = (from + delta * e + 360) % 360;
      paint(lonNow, term);
      if (p < 1) {
        raf = global.requestAnimationFrame(step);
      } else {
        lonNow = target;
        paint(target, term);
        raf = null;
      }
    }
    raf = global.requestAnimationFrame(step);
  }

  function select(i, animate) {
    var n = D.terms.length;
    current = ((i % n) + n) % n;
    var t = D.terms[current];
    var lon = earthLon(t);

    if (el.panel) el.panel.innerHTML = panelHTML(t);
    markChips();

    if (animate) {
      animateTo(lon, t);
    } else {
      lonNow = lon;
      paint(lon, t);
    }
  }

  function renderChips() {
    if (!el.chips) return;
    var html = '';
    D.terms.forEach(function (t, i) {
      html += '<button type="button" class="chip" data-i="' + i + '" aria-pressed="false">' +
              t.name + '<em>' + t.sunLongitude + '°</em></button>';
    });
    el.chips.innerHTML = html;

    el.chips.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.chip') : null;
      if (!btn) return;
      select(parseInt(btn.getAttribute('data-i'), 10), true);
    });
  }

  function init() {
    el.stage.innerHTML = buildStatic();
    dyn = el.stage.querySelector('#ogDyn');

    renderChips();

    if (el.prev) {
      el.prev.addEventListener('click', function () { select(current - 1, true); });
    }
    if (el.next) {
      el.next.addEventListener('click', function () { select(current + 1, true); });
    }

    // 打开页面时先对准当令节气
    var idx = 0;
    if (global.ST && global.ST.currentTerm) {
      var c = global.ST.currentTerm();
      if (c && c.term) idx = c.term.index - 1;
    }
    select(idx, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
