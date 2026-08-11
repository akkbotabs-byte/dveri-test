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

  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.gallery-thumb'));
  /* Стартовый кадр — обложка (её миниатюра помечена aria-current="true"):
     именно она стоит в главном фото, и листать надо от неё */
  var current = 0;
  thumbs.forEach(function (t, k) {
    if (t.getAttribute('aria-current') === 'true') { current = k; }
  });
  var zoomBtn = document.querySelector('.gallery-zoom');
  var galleryEl = document.querySelector('.model-gallery');
  var mainFig = document.querySelector('.gallery-main');
  var prevBtn = document.querySelector('.gallery-prev');
  var nextBtn = document.querySelector('.gallery-next');
  var counter = document.querySelector('.gallery-counter');
  var boxPrev = document.querySelector('#lightbox .lightbox-prev');
  var boxNext = document.querySelector('#lightbox .lightbox-next');
  var boxClose = document.querySelector('#lightbox .lightbox-close');
  /* Свайп по главному фото гасит следующий за ним клик по ссылке-зуму */
  var swiped = false;

  /* Галерея по цвету: выбранный свотч оставляет только кадры своей
     отделки (у кадров — c из models.json); до выбора цвета и у отделок
     без кадров показывается полный (дефолтный) набор. */
  var filterColor = null;

  function visibleIdxs() {
    var out = [];
    photos.forEach(function (p, i) {
      if (!filterColor || p.c === filterColor) { out.push(i); }
    });
    return out.length ? out : photos.map(function (p, i) { return i; });
  }

  /* Скрываем кнопку листания. Если она сейчас в фокусе, фокус уводим на
     соседний контрол (иначе он падает на <body>): в галерее — на зум,
     в лайтбоксе — на «закрыть», чтобы не разорвать ловушку фокуса. */
  function hideNav(btn, hide, fallback) {
    if (!btn) { return; }
    if (hide && fallback && document.activeElement === btn) { fallback.focus(); }
    btn.hidden = hide;
  }

  /* Стрелки и счётчик показываем, только когда есть что листать —
     видимых кадров больше одного (после фильтра по отделке их может
     остаться и один). Стрелки лайтбокса листают те же видимые кадры,
     поэтому прячутся по тому же условию — мёртвых контролов нет.
     Разметка приходит скрытой, так что без JS их нет. */
  function updateNav() {
    var vis = visibleIdxs();
    var pos = vis.indexOf(current);
    var many = vis.length > 1;
    hideNav(prevBtn, !many, zoomBtn);
    hideNav(nextBtn, !many, zoomBtn);
    hideNav(boxPrev, !many, boxClose);
    hideNav(boxNext, !many, boxClose);
    if (counter) {
      counter.hidden = !many;
      counter.textContent = (pos === -1 ? 1 : pos + 1) + ' / ' + vis.length;
    }
  }

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
    updateNav();
  }

  function applyFilter(color) {
    filterColor = (color && photos.some(function (p) { return p.c === color; }))
      ? color : null;
    thumbs.forEach(function (t, k) {
      t.hidden = Boolean(filterColor) && photos[k].c !== filterColor;
    });
    /* Текущий кадр выпал из фильтра — переключаемся на первый доступный */
    var vis = visibleIdxs();
    if (vis.indexOf(current) === -1) { show(vis[0]); }
    updateNav();
  }

  /* Листание (стрелки галереи и лайтбокса) — только по видимым кадрам */
  function step(d) {
    var vis = visibleIdxs();
    var pos = vis.indexOf(current);
    if (pos === -1) { pos = 0; }
    show(vis[(pos + d + vis.length) % vis.length]);
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
  var glassNote = document.querySelector('.glass-nophoto-note');
  var comboEl = document.getElementById('variants-data');
  var combo = null;
  if (comboEl && glassChips.length) {
    try { combo = JSON.parse(comboEl.textContent); } catch (err) { combo = null; }
  }
  var kitStrongs = Array.prototype.slice.call(
    document.querySelectorAll('.model-price .price-kit strong'));
  var activeColor = null;
  var activeGlass = null;

  /* Карточка «Комплект с погонажем» (#furnitura): цифры пересчитываются
     под выбранную отделку и остекление. #kit-data — строки комплекта
     (цвета, остекление и уже готовые строки), те же, что в таблице
     «Стоимость комплекта». */
  var kitEl = document.getElementById('kit-data');
  var kitData = null;
  if (kitEl) {
    try { kitData = JSON.parse(kitEl.textContent); } catch (err2) { kitData = null; }
  }
  var KIT_FIELDS = {
    delta: '.need-kit-delta', totalf: '.need-kit-total', fins: '.need-kit-fins',
    pol: '.need-kit-pol', kor: '.need-kit-kor', nal: '.need-kit-nal'
  };
  var kitNodes = {};
  Object.keys(KIT_FIELDS).forEach(function (k) {
    kitNodes[k] = document.querySelector(KIT_FIELDS[k]);
  });
  var kitColor = null;

  /* Минимальный комплект выбранной пары отделка×стекло. Пары без своего
     комплекта (например, отделка вне прайса погонажа) цифры не трогают. */
  function updateKitCard() {
    if (!kitData) { return; }
    var best = null;
    kitData.forEach(function (k) {
      if (kitColor && k.colors.indexOf(kitColor) === -1) { return; }
      if (activeGlass && k.g !== activeGlass) { return; }
      if (!best || k.total < best.total) { best = k; }
    });
    if (!best) { return; }
    Object.keys(kitNodes).forEach(function (n) {
      if (kitNodes[n]) { kitNodes[n].textContent = best[n]; }
    });
  }

  /* Исходные цены — для сброса при повторном клике по активному свотчу */
  var initialPrice = priceLabel ? priceLabel.textContent : '';
  var initialKits = kitStrongs.map(function (s) { return s.textContent; });

  function resetPrice() {
    if (priceLabel) { priceLabel.textContent = initialPrice; }
    kitStrongs.forEach(function (s, i) { s.textContent = initialKits[i]; });
    variantRows.forEach(function (tr) { tr.classList.remove('is-active'); });
  }

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
    if (!activeColor && !activeGlass) {
      resetPrice();      /* ни цвет, ни стекло не выбраны — полный сброс */
    } else {
      applyIdxs(comboIdxs(activeColor, activeGlass));
    }
    updateKitCard();     /* стекло могло сброситься — считаем после него */
    /* Фото: сперва пара цвет×стекло, затем первое фото цвета;
       нет фото выбранного остекления — пометка «фото уточняется» */
    var pi = photoFor(activeColor, activeGlass);
    if (glassNote) { glassNote.hidden = !(activeGlass && pi === -1); }
    if (pi === -1 && colorChip && colorChip.dataset.photo) {
      pi = parseInt(colorChip.dataset.photo, 10) || 0;
    }
    if (pi !== -1) { show(pi); }
  }

  chipList.forEach(function (chip) {
    chip.addEventListener('click', function () {
      /* Повторный клик по активному свотчу — сброс: дефолтная галерея,
         исходные цены, подсветка строк снята */
      var wasActive = chip.getAttribute('aria-pressed') === 'true';
      chipList.forEach(function (c) {
        c.setAttribute('aria-pressed', String(!wasActive && c === chip));
      });
      if (nophotoNote) {
        nophotoNote.hidden = wasActive || !chip.hasAttribute('data-nophoto');
      }
      /* Галерея по цвету: у отделки с фото — только её кадры;
         data-nophoto — дефолтный набор (пометка «фото уточняется») */
      applyFilter((wasActive || chip.hasAttribute('data-nophoto'))
        ? null : chip.dataset.color);
      kitColor = wasActive ? null : (chip.dataset.color || null);
      if (combo) {
        /* Карточку комплекта обновит updateCombo — там уже согласованы
           выбранные отделка и остекление */
        activeColor = kitColor;
        updateCombo(wasActive ? null : chip);
        return;
      }
      updateKitCard();
      if (wasActive) {
        resetPrice();
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
    boxClose.focus();
  }
  function closeBox() {
    if (!box) { return; }
    box.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) { lastFocus.focus(); }
  }
  function boxStep(d) {
    step(d);
    renderBox();
  }

  if (box && boxImg && zoomBtn) {
    /* Зум — ссылка на полноразмерный файл; с JS открываем лайтбокс */
    zoomBtn.addEventListener('click', function (e) {
      e.preventDefault();
      /* Клик-«хвост» состоявшегося свайпа — лайтбокс не открываем */
      if (swiped) { swiped = false; return; }
      openBox();
    });
    boxClose.addEventListener('click', closeBox);
    boxPrev.addEventListener('click', function () { boxStep(-1); });
    boxNext.addEventListener('click', function () { boxStep(1); });
    box.addEventListener('click', function (e) { if (e.target === box) { closeBox(); } });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) { return; }
      if (e.key === 'Escape') { closeBox(); }
      if (e.key === 'ArrowLeft') { boxStep(-1); }
      if (e.key === 'ArrowRight') { boxStep(1); }
      /* Ловушка фокуса: Tab циклится по кнопкам диалога, фон не получает фокус.
         Скрытые стрелки (единственный видимый кадр) в цикл не берём */
      if (e.key === 'Tab') {
        var focusables = Array.prototype.filter.call(
          box.querySelectorAll('button'), function (b) { return !b.hidden; });
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

  /* ---- Листание основной галереи: стрелки, клавиатура, свайп ---- */
  if (prevBtn) {
    prevBtn.addEventListener('click', function () { step(-1); });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', function () { step(1); });
  }

  /* Клавиатура: ← / → работают, пока фокус внутри блока галереи
     (миниатюры, стрелки, ссылка-зум). У лайтбокса своя обработка стрелок
     на document — при открытом лайтбоксе здесь не вмешиваемся. */
  if (galleryEl) {
    galleryEl.addEventListener('keydown', function (e) {
      if (box && !box.hidden) { return; }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        step(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        step(1);
      }
    });
  }

  /* Свайп по главному фото: порог 40px по X; вертикальный жест отдаём
     скроллу страницы (|dy| > |dx|). Слушатели passive — preventDefault
     здесь не нужен, страница скроллится как обычно. */
  if (mainFig) {
    var tx = 0;
    var ty = 0;
    var tracking = false;
    mainFig.addEventListener('touchstart', function (e) {
      swiped = false;
      tracking = e.touches.length === 1;
      if (tracking) {
        tx = e.touches[0].clientX;
        ty = e.touches[0].clientY;
      }
    }, { passive: true });
    mainFig.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1) { tracking = false; }
    }, { passive: true });
    mainFig.addEventListener('touchend', function (e) {
      if (!tracking) { return; }
      tracking = false;
      var dx = e.changedTouches[0].clientX - tx;
      var dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) { return; }
      swiped = true;
      /* Совместимый click приходит сразу за touchend. Если браузер его не
         пришлёт, флаг не должен пережить жест: на гибридном устройстве он
         съел бы следующий клик мышью по зуму. */
      window.setTimeout(function () { swiped = false; }, 400);
      step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  updateNav();
})();
