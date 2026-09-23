/* Примерочная: фото клиента + PNG-накладка двери.
   Всё считается в браузере — фото никуда не загружается.
   Холст хранит фото как фон, дверь — как слой с позицией, масштабом,
   наклоном (имитация перспективы) и отражением. */
(function () {
  'use strict';

  var root = document.getElementById('tryon');
  if (!root || !root.getContext && !document.getElementById('tryon-canvas')) return;

  var doors = [];
  try { doors = JSON.parse(root.getAttribute('data-doors') || '[]'); } catch (e) { doors = []; }
  if (!doors.length) return;

  var startBox = document.getElementById('tryon-start');
  var workBox = document.getElementById('tryon-work');
  var fileInput = document.getElementById('tryon-file');
  var canvas = document.getElementById('tryon-canvas');
  var ctx = canvas.getContext('2d');
  var scaleInput = document.getElementById('tryon-scale');
  var skewInput = document.getElementById('tryon-skew');
  var hint = document.getElementById('tryon-hint');
  var tabsBox = document.getElementById('tryon-tabs');
  var doorsBox = document.getElementById('tryon-doors');
  var modelLink = document.getElementById('tryon-model');

  var photo = null;        // Image фона
  var door = null;         // Image накладки
  var current = null;      // выбранная модель
  var view = { x: 0.5, y: 0.55, scale: 0.6, skew: 0, flip: false };
  var facing = 'all';

  /* ---------- холст ---------- */

  function fitCanvas() {
    if (!photo) return;
    var maxW = Math.min(root.clientWidth || 900, 900);
    var maxH = Math.round(window.innerHeight * 0.62);
    var k = Math.min(maxW / photo.width, maxH / photo.height, 1);
    canvas.width = Math.round(photo.width * k);
    canvas.height = Math.round(photo.height * k);
    draw();
  }

  function draw() {
    if (!photo) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
    if (!door || !door.complete || !door.naturalWidth) return;

    var h = canvas.height * view.scale;
    var w = h * (door.naturalWidth / door.naturalHeight);
    var cx = canvas.width * view.x;
    var cy = canvas.height * view.y;

    ctx.save();
    ctx.translate(cx, cy);
    // Наклон по горизонтали — грубая, но понятная имитация перспективы,
    // когда проём снят не строго в лоб.
    ctx.transform(1, 0, Math.tan(view.skew * Math.PI / 180) * -0.5, 1, 0, 0);
    if (view.flip) ctx.scale(-1, 1);
    ctx.drawImage(door, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /* ---------- загрузка фото ---------- */

  function loadPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      photo = img;
      startBox.hidden = true;
      workBox.hidden = false;
      view = { x: 0.5, y: 0.55, scale: 0.6, skew: 0, flip: false };
      scaleInput.value = 60;
      skewInput.value = 0;
      if (!current) selectDoor(doors[0]);
      fitCanvas();
      workBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    img.onerror = function () {
      hint.textContent = 'Не удалось открыть это фото — попробуйте другое.';
    };
    img.src = url;
  }

  fileInput.addEventListener('change', function () {
    loadPhoto(this.files && this.files[0]);
  });

  ['dragover', 'drop'].forEach(function (ev) {
    startBox.addEventListener(ev, function (e) {
      e.preventDefault();
      if (ev === 'drop' && e.dataTransfer) loadPhoto(e.dataTransfer.files[0]);
    });
  });

  /* ---------- выбор двери ---------- */

  function selectDoor(m) {
    current = m;
    var img = new Image();
    img.onload = function () { door = img; draw(); };
    img.src = m.png;
    modelLink.href = m.url;
    modelLink.textContent = 'Открыть «' + m.name + '»';
    Array.prototype.forEach.call(doorsBox.children, function (el) {
      var on = el.getAttribute('data-slug') === m.slug;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderDoors() {
    doorsBox.innerHTML = '';
    doors.filter(function (m) {
      return facing === 'all' || (m.facing || []).indexOf(facing) !== -1;
    }).forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tryon-door';
      b.setAttribute('data-slug', m.slug);
      b.setAttribute('aria-pressed', 'false');
      var im = new Image(90, 120);
      im.src = m.png;
      im.alt = '';
      im.loading = 'lazy';
      var nm = document.createElement('span');
      nm.className = 'tryon-door-name';
      nm.textContent = m.name;
      var pr = document.createElement('span');
      pr.className = 'tryon-door-price';
      pr.textContent = m.price;
      b.appendChild(im);
      b.appendChild(nm);
      b.appendChild(pr);
      b.addEventListener('click', function () { selectDoor(m); });
      doorsBox.appendChild(b);
    });
    if (current) {
      var act = doorsBox.querySelector('[data-slug="' + current.slug + '"]');
      if (act) { act.classList.add('is-active'); act.setAttribute('aria-pressed', 'true'); }
    }
  }

  function renderTabs() {
    var names = { emal: 'Эмаль', laminat: 'Ламинированные', pvh: 'ПВХ', pet: 'ПЭТ', pokraska: 'Под покраску' };
    var have = {};
    doors.forEach(function (m) { (m.facing || []).forEach(function (f) { have[f] = 1; }); });
    var list = [['all', 'Все']].concat(Object.keys(have).map(function (f) { return [f, names[f] || f]; }));
    list.forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'facing-tab' + (pair[0] === facing ? ' is-active' : '');
      b.textContent = pair[1];
      b.addEventListener('click', function () {
        facing = pair[0];
        Array.prototype.forEach.call(tabsBox.children, function (el) {
          el.classList.toggle('is-active', el === b);
        });
        renderDoors();
      });
      tabsBox.appendChild(b);
    });
  }

  /* ---------- перетаскивание и щипок ---------- */

  var drag = null;
  var pinch = null;

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    var p = pos(e);
    drag = { id: e.pointerId, dx: view.x - p.x, dy: view.y - p.y };
    hint.textContent = 'Отпустите, когда дверь встанет на место.';
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!drag || drag.id !== e.pointerId) return;
    var p = pos(e);
    view.x = Math.min(1.2, Math.max(-0.2, p.x + drag.dx));
    view.y = Math.min(1.2, Math.max(-0.2, p.y + drag.dy));
    draw();
  });

  ['pointerup', 'pointercancel'].forEach(function (ev) {
    canvas.addEventListener(ev, function () { drag = null; });
  });

  canvas.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinch = { d: dist(e.touches), scale: view.scale };
      drag = null;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      var k = dist(e.touches) / pinch.d;
      view.scale = Math.min(1.6, Math.max(0.1, pinch.scale * k));
      scaleInput.value = Math.round(view.scale * 100);
      draw();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) pinch = null;
  });

  function dist(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener('wheel', function (e) {
    if (!photo) return;
    e.preventDefault();
    view.scale = Math.min(1.6, Math.max(0.1, view.scale * (e.deltaY < 0 ? 1.06 : 0.94)));
    scaleInput.value = Math.round(view.scale * 100);
    draw();
  }, { passive: false });

  /* ---------- кнопки ---------- */

  scaleInput.addEventListener('input', function () {
    view.scale = this.value / 100;
    draw();
  });

  skewInput.addEventListener('input', function () {
    view.skew = +this.value;
    draw();
  });

  document.getElementById('tryon-flip').addEventListener('click', function () {
    view.flip = !view.flip;
    draw();
  });

  document.getElementById('tryon-reset').addEventListener('click', function () {
    view = { x: 0.5, y: 0.55, scale: 0.6, skew: 0, flip: false };
    scaleInput.value = 60;
    skewInput.value = 0;
    draw();
  });

  document.getElementById('tryon-newphoto').addEventListener('click', function () {
    fileInput.value = '';
    fileInput.click();
  });

  document.getElementById('tryon-save').addEventListener('click', function () {
    if (!photo) return;
    // Сохраняем в полном разрешении фото, а не в размере холста.
    var out = document.createElement('canvas');
    out.width = photo.naturalWidth;
    out.height = photo.naturalHeight;
    var octx = out.getContext('2d');
    octx.drawImage(photo, 0, 0);
    if (door && door.complete) {
      var h = out.height * view.scale;
      var w = h * (door.naturalWidth / door.naturalHeight);
      octx.save();
      octx.translate(out.width * view.x, out.height * view.y);
      octx.transform(1, 0, Math.tan(view.skew * Math.PI / 180) * -0.5, 1, 0, 0);
      if (view.flip) octx.scale(-1, 1);
      octx.drawImage(door, -w / 2, -h / 2, w, h);
      octx.restore();
    }
    var name = 'primerka-' + (current ? current.slug : 'dver') + '.jpg';

    function save(href, revoke) {
      var a = document.createElement('a');
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (revoke) URL.revokeObjectURL(href);
        a.remove();
      }, 1000);
      hint.textContent = 'Картинка сохранена — можно прислать её нам в Telegram.';
    }

    // toBlob экономнее по памяти, но кое-где (встроенные браузеры
    // приложений) молча не вызывает колбэк — подстраховываемся toDataURL.
    var done = false;
    var fallback = setTimeout(function () {
      if (done) return;
      done = true;
      try { save(out.toDataURL('image/jpeg', 0.92), false); }
      catch (e) { hint.textContent = 'Браузер не дал сохранить файл — сделайте скриншот экрана.'; }
    }, 1500);

    try {
      out.toBlob(function (blob) {
        if (done) return;
        done = true;
        clearTimeout(fallback);
        if (blob) save(URL.createObjectURL(blob), true);
        else save(out.toDataURL('image/jpeg', 0.92), false);
      }, 'image/jpeg', 0.92);
    } catch (e) {
      clearTimeout(fallback);
      done = true;
      save(out.toDataURL('image/jpeg', 0.92), false);
    }
  });

  window.addEventListener('resize', fitCanvas);

  renderTabs();
  renderDoors();
})();
