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

  /* Свотчи отделок: показать первое фото выбранной отделки */
  document.querySelectorAll('.swatch-chip[data-photo]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.swatch-chip[data-photo]').forEach(function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });
      show(parseInt(chip.dataset.photo, 10) || 0);
    });
  });

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
