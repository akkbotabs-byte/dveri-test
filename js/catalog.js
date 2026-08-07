/* Каталог: клиентские фильтры (ПГ/ПО, отделка, цвет), сортировка,
   счётчик, bottom sheet. Внутри группы — ИЛИ, между группами — И.
   При активном фильтре цвета карточка перекрашивается: картинка
   меняется на вариант первого выбранного пользователем цвета,
   который есть у модели (data-img-<slug цвета>), с коротким fade.
   Состояние фильтров и сортировки зеркалится в query-параметры URL
   (replaceState) — выборку можно пошарить и восстановить по ссылке.
   Без JS виден весь каталог (сортировка скрыта через .no-js). */
(function () {
  'use strict';
  var form = document.getElementById('filters-form');
  var grid = document.getElementById('catalog-grid');
  if (!form || !grid) { return; }

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
  var countEl = document.getElementById('count-num');
  var emptyEl = document.getElementById('catalog-empty');
  var chipsEl = document.getElementById('active-chips');

  /* Порядок выбора цветов пользователем: первый выбранный — приоритет
     перекраски карточек. Снятые цвета выбывают, новые встают в конец. */
  var colorOrder = [];

  function checked(nameAttr) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + nameAttr + '"]:checked'));
  }

  function syncColorOrder() {
    var vals = checked('color').map(function (i) { return i.value; });
    colorOrder = colorOrder.filter(function (v) { return vals.indexOf(v) !== -1; });
    vals.forEach(function (v) {
      if (colorOrder.indexOf(v) === -1) { colorOrder.push(v); }
    });
  }

  /* ---- Перекраска карточки: вариант цвета или дефолт, короткий fade.
     Вместе с src подменяется и alt (data-alt-<slug> / data-alt-default) —
     подпись соответствует показанному цвету. ---- */
  function cardVariant(card) {
    var have = (card.dataset.colors || '').split(' ');
    for (var i = 0; i < colorOrder.length; i += 1) {
      if (have.indexOf(colorOrder[i]) !== -1) {
        var src = card.getAttribute('data-img-' + colorOrder[i]);
        if (src) {
          return { src: src, alt: card.getAttribute('data-alt-' + colorOrder[i]) };
        }
        break; /* цвет есть, но отдельного варианта нет — дефолт */
      }
    }
    return { src: card.getAttribute('data-img-default'),
             alt: card.getAttribute('data-alt-default') };
  }

  /* ---- Цена карточки: при активном фильтре цвета показываем «от N ₽»
     по вариантам первого выбранного цвета, который есть у модели
     (data-pricef-<slug>), без фильтра — данные по модели целиком. ---- */
  function updateCardPrice(card) {
    var priceEl = card.querySelector('.card-price');
    var def = card.getAttribute('data-pricef-default');
    if (!priceEl || !def) { return; }
    var value = def;
    var have = (card.dataset.colors || '').split(' ');
    for (var i = 0; i < colorOrder.length; i += 1) {
      if (have.indexOf(colorOrder[i]) !== -1) {
        value = card.getAttribute('data-pricef-' + colorOrder[i]) || def;
        break;
      }
    }
    var text = 'от ' + value;
    if (priceEl.textContent !== text) { priceEl.textContent = text; }
  }

  function swapImage(card) {
    var img = card.querySelector('.card-media img');
    if (!img) { return; }
    var v = cardVariant(card);
    if (!v.src || img.getAttribute('src') === v.src) { return; }
    /* Отменяем незавершённый предыдущий свап: при быстром щёлканье
       фильтрами таймеры и reveal разных свапов не перекрываются */
    (img._swapTimers || []).forEach(window.clearTimeout);
    if (img._swapReveal) { img.removeEventListener('load', img._swapReveal); }
    var timers = img._swapTimers = [];
    var reveal = function () {
      img.classList.remove('is-swapping');
      img._swapReveal = null;
    };
    img._swapReveal = reveal;
    img.classList.add('is-swapping');
    timers.push(window.setTimeout(function () {
      img.setAttribute('src', v.src);
      if (v.alt) { img.setAttribute('alt', v.alt); }
      if (img.complete) {
        reveal();
      } else {
        img.addEventListener('load', reveal, { once: true });
        timers.push(window.setTimeout(reveal, 400)); /* страховка от зависшей загрузки */
      }
    }, 150));
  }

  function apply() {
    syncColorOrder();
    var glazing = checked('glazing').map(function (i) { return i.value; });
    var facing = checked('facing').map(function (i) { return i.value; });
    var colors = checked('color').map(function (i) { return i.value; });
    var stockOnly = checked('stock').length > 0;
    var shown = 0;

    cards.forEach(function (card) {
      var g = (card.dataset.glazing || '').split(' ');
      var f = (card.dataset.facing || '').split(' ');
      var c = (card.dataset.colors || '').split(' ');
      var match =
        (!stockOnly || card.dataset.stock === '1') &&
        (!glazing.length || glazing.some(function (v) { return g.indexOf(v) !== -1; })) &&
        (!facing.length || facing.some(function (v) { return f.indexOf(v) !== -1; })) &&
        (!colors.length || colors.some(function (v) { return c.indexOf(v) !== -1; }));
      card.hidden = !match;
      if (match) {
        shown += 1;
        swapImage(card);
        updateCardPrice(card);
      }
    });

    if (countEl) { countEl.textContent = String(shown); }
    if (emptyEl) { emptyEl.hidden = shown !== 0; }
    renderChips();
    updateUrl();
  }

  /* ---- Состояние в URL: ?stock=…&glazing=…&facing=…&color=…&sort=… ---- */
  var FILTER_NAMES = ['stock', 'glazing', 'facing', 'color'];

  function updateUrl() {
    if (!window.URLSearchParams || !window.history || !history.replaceState) { return; }
    var params = new URLSearchParams(window.location.search);
    FILTER_NAMES.forEach(function (name) {
      /* Для цвета сохраняем порядок выбора пользователем, а не порядок в DOM */
      var vals = name === 'color' ? colorOrder.slice()
        : checked(name).map(function (i) { return i.value; });
      if (vals.length) { params.set(name, vals.join(',')); } else { params.delete(name); }
    });
    if (sortSel && sortSel.value !== 'default') {
      params.set('sort', sortSel.value);
    } else {
      params.delete('sort');
    }
    var qs = params.toString();
    history.replaceState(null, '',
      window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
  }

  function restoreFromUrl() {
    if (!window.URLSearchParams) { return; }
    var params = new URLSearchParams(window.location.search);
    FILTER_NAMES.forEach(function (name) {
      var raw = params.get(name);
      if (!raw) { return; }
      var vals = raw.split(',');
      Array.prototype.forEach.call(
        form.querySelectorAll('input[name="' + name + '"]'),
        function (input) { input.checked = vals.indexOf(input.value) !== -1; });
      if (name === 'color') {
        /* Восстанавливаем и порядок выбора цветов (важен для перекраски).
           Значения сверяем со списком реальных инпутов, а не подставляем
           в селектор: кривой ?color=… не роняет инициализацию */
        var known = Array.prototype.map.call(
          form.querySelectorAll('input[name="color"]'),
          function (input) { return input.value; });
        colorOrder = vals.filter(function (v) {
          return known.indexOf(v) !== -1;
        });
      }
    });
    var sort = params.get('sort');
    if (sortSel && sort) {
      for (var i = 0; i < sortSel.options.length; i += 1) {
        if (sortSel.options[i].value === sort) { sortSel.value = sort; break; }
      }
    }
  }

  function renderChips() {
    if (!chipsEl) { return; }
    chipsEl.textContent = '';
    var active = checked('stock').concat(checked('glazing'), checked('facing'), checked('color'));
    chipsEl.hidden = active.length === 0;
    active.forEach(function (input) {
      var label = input.closest('label');
      var text = label ? label.textContent.trim() : input.value;
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.appendChild(document.createTextNode(text));
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '✕';
      x.setAttribute('aria-label', 'Убрать фильтр: ' + text);
      x.addEventListener('click', function () {
        input.checked = false;
        apply();
      });
      chip.appendChild(x);
      chipsEl.appendChild(chip);
    });
  }

  form.addEventListener('change', apply);
  form.addEventListener('reset', function () {
    window.setTimeout(apply, 0);
  });

  /* ---- Сортировка: по цене (вверх/вниз) и по названию ----
     «Цена по запросу» (нет data-price) всегда уходит в конец списка. */
  var sortSel = document.getElementById('sort');
  var origOrder = cards.slice();
  function sortCards() {
    var mode = sortSel.value;
    var arr = origOrder.slice();
    if (mode === 'price-asc' || mode === 'price-desc') {
      var dir = mode === 'price-asc' ? 1 : -1;
      arr.sort(function (a, b) {
        var pa = parseInt(a.dataset.price, 10);
        var pb = parseInt(b.dataset.price, 10);
        var na = isNaN(pa);
        var nb = isNaN(pb);
        if (na && nb) { return 0; }
        if (na) { return 1; }
        if (nb) { return -1; }
        return (pa - pb) * dir;
      });
    } else if (mode === 'name') {
      arr.sort(function (a, b) {
        return (a.dataset.name || '').localeCompare(b.dataset.name || '', 'ru');
      });
    }
    arr.forEach(function (card) { grid.appendChild(card); });
  }
  if (sortSel) {
    sortSel.addEventListener('change', function () {
      sortCards();
      updateUrl();
    });
  }

  /* ---- Bottom sheet на мобильном ---- */
  var panel = document.getElementById('filters');
  var openBtn = document.querySelector('.filters-open');
  var closeBtn = document.querySelector('.filters-close');
  var applyBtn = document.querySelector('.filters-apply');
  var backdrop = document.querySelector('.filters-backdrop');

  function setOpen(open) {
    if (!panel) { return; }
    panel.classList.toggle('is-open', open);
    if (openBtn) { openBtn.setAttribute('aria-expanded', String(open)); }
    if (backdrop) { backdrop.hidden = !open; }
    document.body.style.overflow = open ? 'hidden' : '';
    /* Фокус: при открытии — внутрь шторки, при закрытии — на кнопку-триггер */
    if (open) {
      if (closeBtn) { closeBtn.focus(); }
    } else if (openBtn) {
      openBtn.focus();
    }
  }
  if (openBtn) { openBtn.addEventListener('click', function () { setOpen(true); }); }
  if (closeBtn) { closeBtn.addEventListener('click', function () { setOpen(false); }); }
  if (applyBtn) { applyBtn.addEventListener('click', function () { setOpen(false); }); }
  if (backdrop) { backdrop.addEventListener('click', function () { setOpen(false); }); }
  document.addEventListener('keydown', function (e) {
    /* Только при открытой шторке — иначе сбросили бы чужой скролл-лок (бургер-меню) */
    if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) { setOpen(false); }
  });

  /* Старт: восстановить состояние из URL, затем применить */
  restoreFromUrl();
  apply();
  if (sortSel && sortSel.value !== 'default') { sortCards(); }
})();
