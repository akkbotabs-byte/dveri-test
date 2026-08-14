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
     «Варианты и цены» (data-variants — индексы строк tbody; заголовки
     групп покрытий tr.facing-group в нумерацию не входят — build.py
     нумерует только варианты прайса). */
  var chipList = Array.prototype.slice.call(
    document.querySelectorAll('.swatch-chip:not(.glass-chip)'));
  var priceLabel = document.querySelector('.model-price .price-label');
  var nophotoNote = document.querySelector('.swatch-nophoto-note');
  var variantRows = Array.prototype.slice.call(
    document.querySelectorAll('#varianty .price-table tbody tr:not(.facing-group)'));

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
  var kitCard = document.querySelector('.need-card--kit');
  var kitColor = null;

  /* Строка комплекта следует и за выбором размера с исполнением
     (selSize/selEdge из блока корзины ниже; var — в общей области
     видимости IIFE): высота 2300 у Альбы — отдельный вариант прайса
     с погонажем своей высоты, кромка Прайма — отдельный gid. */
  function kitVariantOk(k) {
    if (!cartData) { return true; }
    var v = cartData.variants[k.vi];
    if (!v) { return true; }
    if (selEdge && v.gid !== selEdge) { return false; }
    if (selSize && v.sizes.indexOf(selSize) === -1) { return false; }
    return true;
  }

  /* Минимальный комплект выбранной пары отделка×стекло (и размера
     с исполнением). Если комплекта для выбора нет (отделка вне прайса
     погонажа), карточку прячем: оставить её значило бы показать цену
     предыдущей отделки, а не выбранной. */
  function updateKitCard() {
    if (!kitData) { return; }
    var best = null;
    kitData.forEach(function (k) {
      if (kitColor && k.colors.indexOf(kitColor) === -1) { return; }
      if (activeGlass && k.g !== activeGlass) { return; }
      if (!kitVariantOk(k)) { return; }
      if (!best || k.total < best.total) { best = k; }
    });
    if (kitCard) { kitCard.hidden = !best; }
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
    /* И наоборот: свотчи отделок, которых нет с выбранным стеклом, гасим
       (правка владельцев 11.08.2026: Миланский орех не бывает с Сатинато) */
    chipList.forEach(function (c) {
      c.disabled = Boolean(activeGlass) &&
        !comboIdxs(c.dataset.color, activeGlass).length;
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

  /* ---- Корзина: размер полотна и кнопки «В корзину» ----
     #cart-data (build.py): варианты прайса (цвета, стекло, цена, размеры,
     ключ gid), подписи размеров, слаги цветов и срез наличия по размерам.
     Кнопка полотна собирает строку корзины из ТЕКУЩЕГО выбора
     (цвет × стекло × размер), «Комплект в корзину» кладёт полотно,
     коробку × 3 и наличники × 5 отдельными строками с пометкой
     «комплект». Без JS этих контролов нет (.no-js в styles.css). */
  var cartEl = document.getElementById('cart-data');
  var cartData = null;
  if (cartEl && window.DSDCart) {
    try { cartData = JSON.parse(cartEl.textContent); } catch (err3) { cartData = null; }
  }
  /* ---- Скрытая дверь (Инвизибл): три селектора высота × открывание ×
     кромка вместо размера. #cart-data.hoe — варианты прайса в порядке
     таблицы «Варианты и цены»; сторона обратного открывания
     (правое/левое) на цену не влияет и уходит только в подпись
     позиции корзины. ---- */
  if (cartData && cartData.hoe) {
    var hoe = cartData.hoe;
    var hoeChips = Array.prototype.slice.call(
      document.querySelectorAll('.hoe-chip'));
    var hoeBtn = document.querySelector('.cart-add-door');
    var hoeSel = { h: null, o: null, e: null };
    hoeChips.forEach(function (c) {
      if (c.getAttribute('aria-pressed') === 'true') {
        hoeSel[c.dataset.group] = c.dataset.val;
      }
    });

    var hoeVariant = function () {
      var o = hoeSel.o === 'pryamoe' ? 'pryamoe' : 'obratnoe';
      for (var hi = 0; hi < hoe.variants.length; hi += 1) {
        var v = hoe.variants[hi];
        if (v.h === hoeSel.h && v.o === o && v.e === hoeSel.e) {
          return { v: v, i: hi };
        }
      }
      return null;
    };

    /* Комбинация выбрана всегда (в каждой группе есть активная
       таблетка) — показываем точную цену варианта и подсвечиваем
       его строку в таблице «Варианты и цены» */
    var hoeUpdate = function () {
      var f = hoeVariant();
      if (!f) { return; }
      if (priceLabel) { priceLabel.textContent = f.v.pricef; }
      variantRows.forEach(function (tr, i) {
        tr.classList.toggle('is-active', i === f.i);
      });
    };

    hoeChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        hoeSel[chip.dataset.group] = chip.dataset.val;
        hoeChips.forEach(function (c) {
          if (c.dataset.group === chip.dataset.group) {
            c.setAttribute('aria-pressed', String(c === chip));
          }
        });
        hoeUpdate();
      });
    });
    /* Клик по свотчу цвета возвращает цену «от …» (базовый слушатель
       выше) — восстанавливаем точную цену выбранной комбинации */
    chipList.forEach(function (chip) {
      chip.addEventListener('click', hoeUpdate);
    });

    if (hoeBtn) {
      hoeBtn.addEventListener('click', function () {
        var f = hoeVariant();
        if (!f) { return; }
        var side = hoeSel.o === 'obr-r' ? ', правое'
          : hoeSel.o === 'obr-l' ? ', левое' : '';
        window.DSDCart.add([{
          id: 'd:' + cartData.slug + ':' + hoe.cslug + ':' +
            f.v.o + '-' + f.v.e + ':' + f.v.h,
          n: 'Полотно ' + cartData.name,
          v: hoe.color + ', ' + hoe.open[f.v.o] + side + ', ' +
            hoe.edge[f.v.e] + ', высота ' + f.v.h + ' мм, ширина под проём',
          p: f.v.price, q: 1
        }]);
        window.DSDCart.flash(hoeBtn);
      });
    }

    hoeUpdate();
  } else if (cartData) {
    var sizeChips = Array.prototype.slice.call(
      document.querySelectorAll('.size-chip:not(.edge-chip)'));
    var doorBtn = document.querySelector('.cart-add-door');
    var kitBtn = document.querySelector('.cart-add-kit');
    var selSize = null;
    sizeChips.forEach(function (chSel) {
      if (chSel.getAttribute('aria-pressed') === 'true') {
        selSize = chSel.dataset.size;
      }
    });

    /* Переключатель «Исполнение» (Прайм: кромка 4 AL / ПВХ) — варианты,
       неразличимые по цвету×стеклу×размеру; selEdge — выбранный gid.
       Дефолт проставлен при сборке (самый дешёвый вариант группы). */
    var edgeChips = Array.prototype.slice.call(
      document.querySelectorAll('.edge-chip'));
    var selEdge = null;
    edgeChips.forEach(function (chE) {
      if (chE.getAttribute('aria-pressed') === 'true') {
        selEdge = chE.dataset.gid;
      }
    });

    var colorNow = function () {
      var c = null;
      chipList.forEach(function (chip) {
        if (chip.getAttribute('aria-pressed') === 'true') {
          c = chip.dataset.color || null;
        }
      });
      return c;
    };

    var capitalize = function (s) {
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    };

    /* Варианты прайса под выбранные цвет, стекло и исполнение (пусто
       не бывает: несуществующие пары model.js гасит на свотчах) */
    var scopeVariants = function (color, glass) {
      var out = cartData.variants.filter(function (v) {
        return (!color || v.colors.indexOf(color) !== -1) &&
          (!glass || v.g === glass) &&
          (!selEdge || v.gid === selEdge);
      });
      return out.length ? out : cartData.variants;
    };

    var sizeInStock = function (scope, color, k) {
      if (!cartData.stock) { return null; }
      return scope.some(function (v) {
        if (v.sizes.indexOf(k) === -1) { return false; }
        return v.colors.some(function (c) {
          if (color && c !== color) { return false; }
          var have = cartData.stock[c + '|' + v.g];
          return Boolean(have) && have.indexOf(k) !== -1;
        });
      });
    };

    /* Таблетки размеров: гасим размеры, которых нет у выбранной пары
       (укороченные — только ПГ; 2300 — только эмаль Альбы), обновляем
       бейджи «есть»/«под заказ», при выпадении выбранного размера
       выбираем 800 или первый доступный */
    var updateSizes = function () {
      var color = colorNow();
      var glass = activeGlass;
      var scope = scopeVariants(color, glass);
      var enabled = [];
      sizeChips.forEach(function (chip) {
        var k = chip.dataset.size;
        var ok = scope.some(function (v) { return v.sizes.indexOf(k) !== -1; });
        chip.disabled = !ok;
        if (ok) { enabled.push(k); }
        var st = chip.querySelector('.size-stock');
        if (st) {
          var have = ok && sizeInStock(scope, color, k);
          st.textContent = have ? 'есть' : 'под заказ';
          st.classList.toggle('size-stock--in', Boolean(have));
          st.classList.toggle('size-stock--out', !have);
        }
      });
      if (enabled.indexOf(selSize) === -1) {
        selSize = enabled.indexOf('800') !== -1 ? '800' : enabled[0];
      }
      sizeChips.forEach(function (chip) {
        chip.setAttribute('aria-pressed', String(chip.dataset.size === selSize));
      });
      /* Цена «от» — по выбранному исполнению (у моделей без него ценой
         управляют свотчи и updateCombo, здесь не вмешиваемся) */
      if (edgeChips.length && priceLabel) {
        var minV = null;
        scope.forEach(function (v) {
          if (!minV || v.price < minV.price) { minV = v; }
        });
        if (minV && minV.pricef) {
          priceLabel.textContent = 'от ' + minV.pricef;
        }
      }
      /* Карточка комплекта следует за размером и исполнением; вызов
         здесь — с уже пересчитанным selSize (первый слушатель свотча
         зовёт updateKitCard до пересчёта размеров) */
      updateKitCard();
    };

    sizeChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        if (chip.disabled) { return; }
        selSize = chip.dataset.size;
        sizeChips.forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        updateKitCard();
      });
    });
    edgeChips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        selEdge = chip.dataset.gid;
        edgeChips.forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        updateSizes();
      });
    });
    /* Свотчи и «Стекло» уже слушаются выше — здесь только пересчёт
       размеров (сработает после установки состояния первым слушателем) */
    chipList.forEach(function (chip) {
      chip.addEventListener('click', updateSizes);
    });
    glassChips.forEach(function (g) {
      g.addEventListener('click', updateSizes);
    });

    /* Полотно в корзину: цена и ключ — у самого дешёвого варианта,
       подходящего под выбор (без выбора цвета это цена «от», её
       покупатель и видит в блоке) */
    if (doorBtn) {
      doorBtn.addEventListener('click', function () {
        var color = colorNow();
        var scope = scopeVariants(color, activeGlass).filter(function (v) {
          return v.sizes.indexOf(selSize) !== -1;
        });
        if (!scope.length || !selSize) { return; }
        var v = scope.reduce(function (a, b) { return b.price < a.price ? b : a; });
        var c = (color && v.colors.indexOf(color) !== -1) ? color : v.colors[0];
        window.DSDCart.add([{
          id: 'd:' + cartData.slug + ':' + cartData.cslug[c] + ':' +
            v.gid + ':' + selSize,
          n: 'Полотно ' + cartData.name,
          v: capitalize(c) + (v.label ? ', ' + v.label : '') + ', ' +
            cartData.sizes[selSize] + ' мм',
          p: v.price, q: 1
        }]);
        window.DSDCart.flash(doorBtn);
      });
    }

    /* Комплект в корзину: строка комплекта — та же, что показана в
       карточке (минимальная по выбранным отделке × стеклу × размеру ×
       исполнению — тот же фильтр, что в updateKitCard) */
    if (kitBtn && kitData) {
      kitBtn.addEventListener('click', function () {
        var best = null;
        kitData.forEach(function (k) {
          if (kitColor && k.colors.indexOf(kitColor) === -1) { return; }
          if (activeGlass && k.g !== activeGlass) { return; }
          if (!kitVariantOk(k)) { return; }
          if (!best || k.total < best.total) { best = k; }
        });
        if (!best) { return; }
        var v = cartData.variants[best.vi];
        var c = (kitColor && v.colors.indexOf(kitColor) !== -1)
          ? kitColor : v.colors[0];
        var size = v.sizes.indexOf(selSize) !== -1 ? selSize
          : (v.sizes.indexOf('800') !== -1 ? '800' : v.sizes[0]);
        var fin = ' · в цвет полотна: ' + capitalize(c);
        window.DSDCart.add([
          {
            id: 'd:' + cartData.slug + ':' + cartData.cslug[c] + ':' +
              v.gid + ':' + size,
            n: 'Полотно ' + cartData.name,
            v: capitalize(c) + (v.label ? ', ' + v.label : '') + ', ' +
              cartData.sizes[size] + ' мм',
            p: v.price, q: 1, k: true
          },
          { id: best.korItem.id, n: best.korItem.n,
            v: best.korItem.v + fin, p: best.korItem.p, q: 3, k: true },
          { id: best.nalItem.id, n: best.nalItem.n,
            v: best.nalItem.v + fin, p: best.nalItem.p, q: 5, k: true }
        ]);
        window.DSDCart.flash(kitBtn);
      });
    }

    updateSizes();
  }

  /* ---- Предвыбор отделки из ?color=<slug> ----
     Ссылки «Подробнее»/заголовка карточек каталога ведут сюда с выбранным
     на карточке цветом (cards.js). Клик по свотчу тянет за собой все
     следствия: фото, цену, таблицу, комплект, размеры. Слаг сверяем
     с data-cslug реальных свотчей — невалидный игнорируется. Стоит после
     навешивания ВСЕХ слушателей свотчей (базового и корзинных). */
  if (window.URLSearchParams) {
    var wantColor = new URLSearchParams(window.location.search).get('color');
    if (wantColor) {
      chipList.some(function (chip) {
        if (chip.dataset.cslug === wantColor && !chip.disabled) {
          chip.click();
          return true;
        }
        return false;
      });
    }
  }

  updateNav();
})();
