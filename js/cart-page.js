/* Страница /cart.html: таблица позиций из localStorage (cart.js),
   количество с +/−, удаление, итог и оформление заказа без бэкенда —
   deep-link в Telegram, письмо (mailto) или копирование текста заказа.

   Честность цен: цена каждой позиции берётся из реестра #cart-registry
   (генерируется build.py из актуального прайса), а не из localStorage;
   при расхождении показывается актуальная с пометкой «цена обновлена».
   Позиция, выпавшая из прайса, остаётся со снимком цены и пометкой.

   XSS: все строки из localStorage попадают в DOM только через
   textContent; innerHTML с пользовательскими данными не используется. */
(function () {
  'use strict';
  var Cart = window.DSDCart;
  var rowsEl = document.getElementById('cart-rows');
  if (!Cart || !rowsEl) { return; }

  var TG_LINK = 'https://t.me/doors_fabrika';
  var MAIL = 'fabrika.shopdoors@yandex.ru';

  var registry = {};
  var regEl = document.getElementById('cart-registry');
  if (regEl) {
    try { registry = JSON.parse(regEl.textContent) || {}; }
    catch (err) { registry = {}; }
  }

  var emptyEl = document.getElementById('cart-empty');
  var contentEl = document.getElementById('cart-content');
  var totalEl = document.getElementById('cart-total');
  var clearBtn = document.getElementById('cart-clear');
  var form = document.getElementById('cart-form');
  var mailBtn = document.getElementById('cart-mail');
  var copyBtn = document.getElementById('cart-copy');
  var sentEl = document.getElementById('cart-sent');

  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  /* Актуальная цена и наличие позиции: [цена] или [цена, наличие]
     у полотен; null — позиции нет в актуальном прайсе */
  function actual(it) {
    var ent = registry[it.id];
    if (!Array.isArray(ent) || typeof ent[0] !== 'number') { return null; }
    return { p: ent[0], stock: ent.length > 1 ? Boolean(ent[1]) : null };
  }

  function linePrice(it) {
    var a = actual(it);
    return a ? a.p : it.p;
  }

  /* ---- Таблица ---- */

  function renderRow(it, idx, items) {
    var tr = document.createElement('tr');
    var a = actual(it);

    var tdName = el('td', 'cart-item');
    var nameLine = el('p', 'cart-item-name');
    nameLine.appendChild(el('span', null, it.n));
    if (it.k) {
      var kitBadge = el('span', 'badge cart-badge-kit', 'комплект');
      kitBadge.title = 'Позиция из комплекта «полотно + коробка + наличники»';
      nameLine.appendChild(kitBadge);
    }
    tdName.appendChild(nameLine);
    if (it.v) { tdName.appendChild(el('p', 'muted cart-item-var', it.v)); }
    if (a && a.stock !== null) {
      tdName.appendChild(el('p',
        a.stock ? 'stock-line stock-line--in' : 'stock-line stock-line--out',
        a.stock ? 'В наличии' : 'Под заказ'));
    }
    if (!a) {
      tdName.appendChild(el('p', 'muted cart-item-var',
        'позиции нет в актуальном прайсе — цену уточнит менеджер'));
    }
    tr.appendChild(tdName);

    var tdPrice = el('td', 'nowrap');
    tdPrice.appendChild(el('span', null, fmt(linePrice(it))));
    if (a && a.p !== it.p) {
      tdPrice.appendChild(document.createElement('br'));
      tdPrice.appendChild(el('span', 'muted', 'цена обновлена'));
      it.p = a.p;
      Cart.write(items); /* снимок догоняет прайс — пометка разовая */
    }
    tr.appendChild(tdPrice);

    var tdQty = document.createElement('td');
    var qty = el('span', 'cart-qty');
    var minus = el('button', 'cart-qty-btn', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', 'Меньше: ' + it.n);
    var num = el('span', 'cart-qty-num', String(it.q));
    var plus = el('button', 'cart-qty-btn', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', 'Больше: ' + it.n);
    minus.disabled = it.q <= 1;
    plus.disabled = it.q >= Cart.MAX_QTY;
    minus.addEventListener('click', function () { step(idx, -1); });
    plus.addEventListener('click', function () { step(idx, 1); });
    qty.appendChild(minus);
    qty.appendChild(num);
    qty.appendChild(plus);
    tdQty.appendChild(qty);
    tr.appendChild(tdQty);

    tr.appendChild(el('td', 'price-cell', fmt(linePrice(it) * it.q)));

    var tdDel = document.createElement('td');
    var del = el('button', 'cart-remove', '✕');
    del.type = 'button';
    del.setAttribute('aria-label', 'Убрать из корзины: ' + it.n);
    del.addEventListener('click', function () {
      var list = Cart.read();
      list.splice(idx, 1);
      Cart.write(list);
      render();
    });
    tdDel.appendChild(del);
    tr.appendChild(tdDel);
    return tr;
  }

  function step(idx, d) {
    var items = Cart.read();
    var it = items[idx];
    if (!it) { return; }
    it.q = Math.min(Cart.MAX_QTY, Math.max(1, it.q + d));
    Cart.write(items);
    render();
  }

  function render() {
    var items = Cart.read();
    var empty = items.length === 0;
    if (emptyEl) { emptyEl.hidden = !empty; }
    if (contentEl) { contentEl.hidden = empty; }
    if (empty) { return; }
    rowsEl.textContent = '';
    var total = 0;
    items.forEach(function (it, idx) {
      total += linePrice(it) * it.q;
      rowsEl.appendChild(renderRow(it, idx, items));
    });
    if (totalEl) { totalEl.textContent = fmt(total); }
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!window.confirm('Очистить корзину? Все позиции будут убраны.')) {
        return;
      }
      Cart.write([]);
      render();
    });
  }

  /* Корзину поменяли в другой вкладке — перерисовываем */
  window.addEventListener('storage', function (e) {
    if (e.key === Cart.KEY || e.key === null) { render(); }
  });

  /* ---- Текст заказа ---- */

  function orderText(name, phone, comment) {
    var items = Cart.read();
    var lines = ['Заказ с сайта «Магазин дверей»', ''];
    var total = 0;
    items.forEach(function (it, i) {
      var p = linePrice(it);
      total += p * it.q;
      lines.push((i + 1) + '. ' + it.n + (it.k ? ' [комплект]' : '') +
        (it.v ? ' — ' + it.v : '') +
        ' — ' + it.q + ' шт × ' + fmt(p) + ' = ' + fmt(p * it.q));
    });
    lines.push('');
    lines.push('Итого: ' + fmt(total));
    lines.push('');
    lines.push('Имя: ' + name);
    lines.push('Телефон: ' + phone);
    if (comment) { lines.push('Комментарий: ' + comment); }
    return lines.join('\n');
  }

  /* ---- Валидация (та же, что у форм заявки в main.js) ---- */

  function setError(field, msg) {
    var wrap = field.closest('.field') || field.closest('.consent');
    if (!wrap) { return; }
    wrap.classList.toggle('has-error', Boolean(msg));
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    var errEl = wrap.querySelector('.field-error');
    if (errEl) { errEl.textContent = msg || ''; }
  }

  function validate() {
    if (!form) { return null; }
    var name = form.querySelector('[name="name"]');
    var phone = form.querySelector('[name="phone"]');
    var consent = form.querySelector('[name="consent"]');
    var comment = form.querySelector('[name="comment"]');
    var ok = true;
    var firstInvalid = null;

    if (!name.value.trim()) {
      setError(name, 'Укажите имя — так мы будем знать, как к вам обращаться.');
      ok = false;
      firstInvalid = firstInvalid || name;
    } else { setError(name, ''); }

    var digits = phone.value.replace(/\D/g, '');
    if (digits.length < 10) {
      setError(phone, 'Укажите телефон — мы перезвоним по нему.');
      ok = false;
      firstInvalid = firstInvalid || phone;
    } else { setError(phone, ''); }

    if (!consent.checked) {
      setError(consent, 'Для отправки заказа нужно согласие на обработку данных.');
      ok = false;
      firstInvalid = firstInvalid || consent;
    } else { setError(consent, ''); }

    if (!ok) {
      if (firstInvalid) { firstInvalid.focus(); }
      return null;
    }
    if (!Cart.read().length) { return null; }
    return orderText(name.value.trim(), phone.value.trim(),
      comment ? comment.value.trim() : '');
  }

  /* Корзина НЕ очищается после отправки: заказ подтверждает менеджер,
     а состав может ещё пригодиться. Отдельная кнопка «Очистить корзину». */
  function sent(msg) {
    if (!sentEl) { return; }
    sentEl.textContent = msg;
    sentEl.hidden = false;
  }

  if (form) {
    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = validate();
      if (!text) { return; }
      window.open(TG_LINK + '?text=' + encodeURIComponent(text),
        '_blank', 'noopener');
      sent('Открыли Telegram с текстом заказа — проверьте его и нажмите ' +
        '«Отправить» в чате. Если чат не открылся, нажмите «Скопировать ' +
        'заказ» и пришлите текст нам: ' + TG_LINK.replace('https://', '') +
        ' или ' + MAIL + '. Корзина сохранена.');
    });
  }

  if (mailBtn) {
    mailBtn.addEventListener('click', function () {
      var text = validate();
      if (!text) { return; }
      window.location.href = 'mailto:' + MAIL +
        '?subject=' + encodeURIComponent('Заказ с сайта') +
        '&body=' + encodeURIComponent(text);
      sent('Открыли почтовую программу с письмом-заказом — проверьте и ' +
        'отправьте. Если письмо не открылось, нажмите «Скопировать заказ» ' +
        'и вставьте текст в письмо на ' + MAIL + '. Корзина сохранена.');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var text = validate();
      if (!text) { return; }
      var done = function () {
        sent('Заказ скопирован — вставьте его в сообщение ' +
          TG_LINK.replace('https://', '') + ' или в письмо на ' + MAIL + '.');
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    });
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* не вышло */ }
    document.body.removeChild(ta);
    done();
  }

  render();
})();
