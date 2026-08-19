/* Карточки моделей (каталог и «Похожие модели»): кликабельные свотчи.
   Клик по свотчу перекрашивает карточку в его цвет: фото (data-img-<slug>,
   короткий fade — тот же, что у цветового фильтра), alt, цена «от»
   (data-pricef-<slug>); ссылки «Подробнее» и заголовка получают
   ?color=<slug> — страница модели предвыбирает эту отделку (model.js).
   Повторный клик по активному свотчу — сброс. Локальный выбор
   переопределяет глобальный цветовой фильтр только для своей карточки;
   при смене фильтра catalog.js зовёт setFilterColors — локальный выбор
   сбрасывается к состоянию фильтра. Активный фильтр «Тип полотна»
   (setFilterGlazing из catalog.js) выбирает кадр нужного glazing:
   цвет+glazing -> glazing -> цвет -> дефолт. Без JS кнопки-свотчи стоят
   с disabled и остаются индикаторами; здесь disabled снимается. */
window.DSDCards = (function () {
  'use strict';
  var cards = Array.prototype.slice.call(
    document.querySelectorAll('.card[data-colors]'));

  /* Приоритет цветов глобального фильтра (порядок выбора пользователем,
     передаёт catalog.js); на страницах без фильтра всегда пуст */
  var filterColors = [];
  /* Активный тип полотна фильтра: 'pg' | 'po', когда в фильтре
     «Тип полотна» выбран ровно один вариант (передаёт catalog.js);
     иначе null. На страницах без фильтра всегда null. */
  var filterGlazing = null;

  function firstPresent(card, slugs) {
    var have = (card.dataset.colors || '').split(' ');
    for (var i = 0; i < slugs.length; i += 1) {
      if (have.indexOf(slugs[i]) !== -1) { return slugs[i]; }
    }
    return null;
  }

  /* Вариант показа — лучший доступный кадр под пару цвет × тип полотна:
     цвет+glazing (data-img-<цвет>--<pg|po>) -> glazing (data-img-pg/po)
     -> цвет (data-img-<цвет>) -> дефолт. Атрибуты есть только у моделей
     с кадрами обоих типов (нет кадра — ступень пропускается). */
  function variantFor(card, slug) {
    var keys = [];
    if (filterGlazing && slug) { keys.push(slug + '--' + filterGlazing); }
    if (filterGlazing) { keys.push(filterGlazing); }
    if (slug) { keys.push(slug); }
    for (var i = 0; i < keys.length; i += 1) {
      var src = card.getAttribute('data-img-' + keys[i]);
      if (src) {
        return { src: src, alt: card.getAttribute('data-alt-' + keys[i]) };
      }
    }
    return { src: card.getAttribute('data-img-default'),
             alt: card.getAttribute('data-alt-default') };
  }

  function swapImage(card, v) {
    var img = card.querySelector('.card-media img');
    if (!img) { return; }
    /* Сравниваем с целью незавершённого свапа, а не только с src:
       два apply() подряд (быстрое щёлканье по фильтрам) иначе давали
       ранний выход у второго, и первый — уже неактуальный — кадр
       вставал по своему таймеру */
    if (!v.src || (img._swapTarget || img.getAttribute('src')) === v.src) { return; }
    img._swapTarget = v.src;
    /* Отменяем незавершённый предыдущий свап: при быстром щёлканье
       таймеры и reveal разных свапов не перекрываются */
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

  /* Цена «от N ₽» по вариантам показанного цвета (data-pricef-<slug>);
     без цвета или без своей цены — данные по модели целиком */
  function updatePrice(card, slug) {
    var priceEl = card.querySelector('.card-price');
    var def = card.getAttribute('data-pricef-default');
    if (!priceEl || !def) { return; }
    var value = (slug && card.getAttribute('data-pricef-' + slug)) || def;
    var text = 'от ' + value;
    if (priceEl.textContent !== text) { priceEl.textContent = text; }
  }

  /* «Подробнее» и заголовок ведут на страницу модели в выбранном
     (локально) цвете; без выбора query снимается */
  function updateLinks(card, slug) {
    Array.prototype.forEach.call(
      card.querySelectorAll('.card-title a, .card-actions .btn--secondary'),
      function (a) {
        var raw = (a.getAttribute('href') || '').split('#');
        var path = raw[0].split('?')[0];
        var hash = raw[1] ? '#' + raw[1] : '';
        a.setAttribute('href', path + (slug ? '?color=' + slug : '') + hash);
      });
  }

  function paint(card) {
    var local = card._localColor || null;
    var slug = local || firstPresent(card, filterColors);
    swapImage(card, variantFor(card, slug));
    updatePrice(card, slug);
    updateLinks(card, local);
    /* Кольцо — только у локально выбранного свотча (перекраска фильтром
       кольца не даёт: карточные свотчи фильтр не «нажимал») */
    Array.prototype.forEach.call(
      card.querySelectorAll('.card-swatch'),
      function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.color === local));
      });
  }

  cards.forEach(function (card) {
    card._localColor = null;
    Array.prototype.forEach.call(
      card.querySelectorAll('.card-swatch'),
      function (btn) {
        btn.disabled = false;
        btn.addEventListener('click', function (e) {
          /* Свотч лежит поверх растянутой ссылки заголовка карточки —
             клик по нему не должен срабатывать как переход */
          e.preventDefault();
          e.stopPropagation();
          var slug = btn.dataset.color;
          card._localColor = (card._localColor === slug) ? null : slug;
          paint(card);
        });
      });
  });

  return {
    /* catalog.js: смена набора выбранных цветов фильтра сбрасывает
       локальный выбор карточек и задаёт приоритет перекраски.
       Перекраску видимых карточек делает сам catalog.js через paint. */
    setFilterColors: function (list) {
      filterColors = list.slice();
      cards.forEach(function (card) { card._localColor = null; });
    },
    /* catalog.js: активный тип полотна ('pg'/'po' при ровно одном
       выбранном, иначе null). Локальный выбор цвета не сбрасывает —
       клик по свотчу уважает активный glazing, и наоборот. */
    setFilterGlazing: function (g) {
      filterGlazing = g === 'pg' || g === 'po' ? g : null;
    },
    paint: paint
  };
})();
