/* Страница модели: галерея с миниатюрами, переключение отделок, лайтбокс.
   Без JS видно главное фото и все миниатюры (ссылки на полноразмерные файлы). */
(function () {
  'use strict';
  var dataEl = document.getElementById('gallery-data');
  var mainImg = document.querySelector('.gallery-main img');
  if (!dataEl || !mainImg) { return; }

  var photos;
  try { photos = JSON.parse(dataEl.textContent); } catch (err) { return; }
  if (!photos || !photos.length) { return; }

  var current = 0;
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.gallery-thumb'));
  var zoomBtn = document.querySelector('.gallery-zoom');

  function show(i) {
    current = (i + photos.length) % photos.length;
    var p = photos[current];
    mainImg.src = p.src;
    mainImg.alt = p.alt;
    mainImg.width = p.w;
    mainImg.height = p.h;
    /* Ссылка-зум ведёт на текущий полноразмерный файл (актуально без лайтбокса) */
    if (zoomBtn) { zoomBtn.setAttribute('href', p.src); }
    thumbs.forEach(function (t, k) {
      t.setAttribute('aria-current', String(k === current));
    });
  }

  /* Миниатюры — ссылки на полноразмерные файлы (fallback без JS);
     с JS переход отменяем и листаем галерею на месте */
  thumbs.forEach(function (t, k) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      show(k);
    });
  });

  /* Свотчи отделок: у отделок с фото — показать первое фото цвета;
     у прайсовых отделок без фото (data-nophoto) фото не меняется,
     появляется пометка «фото уточняется». Любой свотч обновляет цену
     «от N ₽» (data-pricef) и подсвечивает свои строки в таблице
     «Варианты и цены» (data-variants — индексы строк tbody). */
  var chipList = Array.prototype.slice.call(
    document.querySelectorAll('.swatch-chip:not(.glass-chip)'));
  var priceLabel = document.querySelector('.model-price .price-label');
  var nophotoNote = document.querySelector('.swatch-nophoto-note');
  var variantRows = Array.prototype.slice.call(
    document.querySelectorAll('#varianty .price-table tbody tr'));

  /* Переключатель «Стекло» (модели, где прайс различает остекление):
     пара цвет×стекло обновляет цену «от», строки таблицы, строки
     «комплект…» / «под ключ…» и фото (#variants-data: варианты с
     цветами/стеклом/ценой + комплекты; у фото галереи — c/g). */
  var glassChips = Array.prototype.slice.call(document.querySelectorAll('.glass-chip'));
  var comboEl = document.getElementById('variants-data');
  var combo = null;
  if (comboEl && glassChips.length) {
    try { combo = JSON.parse(comboEl.textContent); } catch (err) { combo = null; }
  }
  var kitStrongs = Array.prototype.slice.call(
    document.querySelectorAll('.model-price .price-kit strong'));
  var activeColor = null;
  var activeGlass = null;

  function comboIdxs(color, glass) {
    var out = [];
    combo.variants.forEach(function (v, i) {
      if (color && v.colors.indexOf(color) === -1) { return; }
      if (glass && v.g !== glass) { return; }
      out.push(i);
    });
    return out;
  }

  function photoFor(color, glass) {
    var i;
    if (glass) {
      for (i = 0; i < photos.length; i++) {
        if (photos[i].g === glass && (!color || photos[i].c === color)) { return i; }
      }
    }
    return -1;
  }

  function applyIdxs(idxs) {
    /* Цена «от» — минимум по выбранной паре цвет×стекло */
    var best = null;
    idxs.forEach(function (i) {
      var v = combo.variants[i];
      if (!best || v.price < best.price) { best = v; }
    });
    if (priceLabel && best) { priceLabel.textContent = 'от ' + best.pricef; }
    variantRows.forEach(function (tr, i) {
      tr.classList.toggle('is-active', idxs.indexOf(i) !== -1);
    });
    /* Строки «Комплект…» и «под ключ…» — минимум по комплектам пары */
    var kit = null;
    combo.kits.forEach(function (k) {
      if (idxs.indexOf(k.v) === -1) { return; }
      if (activeColor && k.colors.indexOf(activeColor) === -1) { return; }
      if (!kit || k.total < kit.total) { kit = k; }
    });
    if (kit && kitStrongs[0]) { kitStrongs[0].textContent = kit.totalf; }
    if (kit && kit.podf && kitStrongs[1]) { kitStrongs[1].textContent = kit.podf; }
  }

  function updateCombo(colorChip) {
    /* Стекло, недоступное в выбранном цвете, гасим; выбранное — сбрасываем */
    if (activeGlass && !comboIdxs(activeColor, activeGlass).length) {
      activeGlass = null;
    }
    glassChips.forEach(function (g) {
      var k = g.dataset.glass;
      g.disabled = !comboIdxs(activeColor, k).length;
      g.setAttribute('aria-pressed', String(k === activeGlass));
    });
    applyIdxs(comboIdxs(activeColor, activeGlass));
    /* Фото: сперва пара цвет×стекло, затем первое фото цвета */
    var pi = photoFor(activeColor, activeGlass);
    if (pi === -1 && colorChip && colorChip.dataset.photo) {
      pi = parseInt(colorChip.dataset.photo, 10) || 0;
    }
    if (pi !== -1) { show(pi); }
  }

  chipList.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chipList.forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });
      if (nophotoNote) {
        nophotoNote.hidden = !chip.hasAttribute('data-nophoto');
      }
      if (combo) {
        activeColor = chip.dataset.color || null;
        updateCombo(chip);
        return;
      }
      if (chip.dataset.photo) {
        show(parseInt(chip.dataset.photo, 10) || 0);
      }
      if (priceLabel && chip.dataset.pricef) {
        priceLabel.textContent = 'от ' + chip.dataset.pricef;
      }
      var idxs = (chip.dataset.variants || '').split(' ');
      variantRows.forEach(function (tr, i) {
        tr.classList.toggle('is-active', idxs.indexOf(String(i)) !== -1);
      });
    });
  });

  if (combo) {
    glassChips.forEach(function (g) {
      g.addEventListener('click', function () {
        if (g.disabled) { return; }
        activeGlass = (activeGlass === g.dataset.glass) ? null : g.dataset.glass;
        var colorChip = null;
        chipList.forEach(function (c) {
          if (c.getAttribute('aria-pressed') === 'true') { colorChip = c; }
        });
        updateCombo(colorChip);
      });
    });
  }

  /* ---- Лайтбокс ---- */
  var box = document.getElementById('lightbox');
  var boxImg = box ? box.querySelector('.lightbox-img') : null;
  var lastFocus = null;

  function renderBox() {
    var p = photos[current];
    boxImg.src = p.src;
    boxImg.alt = p.alt;
  }
  function openBox() {
    if (!box) { return; }
    lastFocus = document.activeElement;
    renderBox();
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    box.querySelector('.lightbox-close').focus();
  }
  function closeBox() {
    if (!box) { return; }
    box.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) { lastFocus.focus(); }
  }
  function step(d) {
    show(current + d);
    renderBox();
  }

  if (box && boxImg && zoomBtn) {
    /* Зум — ссылка на полноразмерный файл; с JS открываем лайтбокс */
    zoomBtn.addEventListener('click', function (e) {
      e.preventDefault();
      openBox();
    });
    box.querySelector('.lightbox-close').addEventListener('click', closeBox);
    box.querySelector('.lightbox-prev').addEventListener('click', function () { step(-1); });
    box.querySelector('.lightbox-next').addEventListener('click', function () { step(1); });
    box.addEventListener('click', function (e) { if (e.target === box) { closeBox(); } });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) { return; }
      if (e.key === 'Escape') { closeBox(); }
      if (e.key === 'ArrowLeft') { step(-1); }
      if (e.key === 'ArrowRight') { step(1); }
      /* Ловушка фокуса: Tab циклится по кнопкам диалога, фон не получает фокус */
      if (e.key === 'Tab') {
        var focusables = box.querySelectorAll('button');
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        } else if (!box.contains(document.activeElement)) {
          e.preventDefault(); first.focus();
        }
      }
    });
  }
})();
