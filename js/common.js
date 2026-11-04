/**
 * common.js —— 全站公共脚本
 * 职责：节气日期推算、当前节气识别、导航交互、滚动淡入、平滑滚动、返回顶部。
 * 仅使用原生 JavaScript，无任何第三方依赖。
 */
(function (global) {
  'use strict';

  /* 各节气相对 1900 年小寒的分钟偏移量，用于天文近似推算交节日期 */
  var TERM_MINUTES = [
    0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693,
    263343, 285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758
  ];

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  /* ---------- 工具函数 ---------- */

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /** 资源路径拼接：兼容根目录与 pages/ 子目录两种相对路径 */
  function asset(path) {
    var base = global.SITE_BASE || '';
    return base + path;
  }

  /**
   * 生成某年第 index 个节气（0 = 立春 … 23 = 大寒）的日期
   * 偏移表以「小寒」为首（公历 1 月的第一个节气），故需做一次顺序换算
   */
  function termDate(year, index) {
    var minutes = TERM_MINUTES[(index + 2) % 24];
    var ms = 31556925974.7 * (year - 1900) + minutes * 60000 + Date.UTC(1900, 0, 6, 2, 5);
    var d = new Date(ms);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /** 日期展示：11月4日 */
  function formatDate(d) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /** 日期展示：2026年11月4日 星期三 */
  function formatFullDate(d) {
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + WEEK[d.getDay()];
  }

  /** 两个日期间相差的整日数 */
  function dayDiff(a, b) {
    var ms = new Date(b.getFullYear(), b.getMonth(), b.getDate()) -
             new Date(a.getFullYear(), a.getMonth(), a.getDate());
    return Math.round(ms / 86400000);
  }

  /**
   * 计算指定日期所处的节气区间
   * @param {Date} date 目标日期，默认今天
   * @returns {Object} 当前节气、起止日期、下一个节气、进度等
   */
  function currentTerm(date) {
    var today = date || new Date();
    var terms = global.SOLAR_DATA.terms;
    var y = today.getFullYear();
    var list = [];

    // 取上一年、本年、下一年共 72 个节气按时间排序，稳健处理跨年情况
    [y - 1, y, y + 1].forEach(function (year) {
      terms.forEach(function (t, i) {
        list.push({ term: t, index: i, date: termDate(year, i) });
      });
    });
    list.sort(function (a, b) { return a.date - b.date; });

    var now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var current = list[0];
    var next = list[1];
    for (var i = 0; i < list.length - 1; i++) {
      if (now >= list[i].date && now < list[i + 1].date) {
        current = list[i];
        next = list[i + 1];
        break;
      }
    }

    var span = dayDiff(current.date, next.date) || 15;
    var passed = dayDiff(current.date, now);
    var progress = Math.max(0, Math.min(1, passed / span));

    return {
      term: current.term,
      start: current.date,
      end: next.date,
      nextTerm: next.term,
      nextDate: next.date,
      dayIndex: passed + 1,          // 处于该节气的第几天
      daysLeft: span - passed,       // 距下一个节气还有几天
      progress: progress             // 该节气已走过的比例 0—1
    };
  }

  /** 按 id 查节气 */
  function getTerm(id) {
    return global.SOLAR_DATA.map[id] || null;
  }

  /** 二十四节气歌，首页与关于页共用 */
  var SONG = [
    '春雨惊春清谷天，夏满芒夏暑相连。',
    '秋处露秋寒霜降，冬雪雪冬小大寒。',
    '每月两节不变更，最多相差一两天。',
    '上半年来六廿一，下半年是八廿三。'
  ];

  /* ---------- 页面交互 ---------- */

  /** 滚动淡入：元素进入视口后添加 is-visible 类 */
  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in global)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add('is-visible'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(items, function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 70 + 'ms';
      io.observe(el);
    });
  }

  /** 顶部导航：滚动吸顶阴影、移动端菜单、当前页高亮 */
  function initHeader() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.site-nav');

    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-scrolled', global.pageYOffset > 12);
      };
      onScroll();
      global.addEventListener('scroll', onScroll, { passive: true });
    }

    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    // 移动端点击页面空白处收起菜单
    document.addEventListener('click', function (e) {
      if (!nav || !nav.classList.contains('is-open')) return;
      if (nav.contains(e.target) || (toggle && toggle.contains(e.target))) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  /** 平滑滚动：处理页内锚点，补偿吸顶高度 */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!link) return;
      var id = link.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + global.pageYOffset - 76;
      if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        global.scrollTo(0, top);
      } else {
        global.scrollTo({ top: top, behavior: 'smooth' });
      }
      history.replaceState(null, '', id);
    });
  }

  /** 返回顶部按钮 */
  function initBackTop() {
    var btn = document.querySelector('.back-top');
    if (!btn) return;
    global.addEventListener('scroll', function () {
      btn.classList.toggle('is-show', global.pageYOffset > 600);
    }, { passive: true });
    btn.addEventListener('click', function () {
      global.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /** 页脚年份 */
  function initYear() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /** 统一初始化 */
  function init() {
    initHeader();
    initSmoothScroll();
    initReveal();
    initBackTop();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.ST = {
    termDate: termDate,
    currentTerm: currentTerm,
    getTerm: getTerm,
    asset: asset,
    formatDate: formatDate,
    formatFullDate: formatFullDate,
    dayDiff: dayDiff,
    pad: pad,
    SONG: SONG,
    initReveal: initReveal
  };
})(window);
