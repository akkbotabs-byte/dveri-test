/* «Магазин дверей» — общий JS: бургер-меню, формы заявки.
   Прогрессивное улучшение: без JS сайт остаётся рабочим. */
(function () {
  'use strict';

  /* ---- Бургер-меню ---- */
  var burger = document.querySelector('.burger');
  var nav = document.getElementById('site-nav');
  function setMenu(open, restoreFocus) {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = nav.querySelector('a');
      if (first) { first.focus(); }
    } else if (restoreFocus) {
      burger.focus();
    }
  }
  if (burger && nav) {
    burger.addEventListener('click', function () {
      setMenu(!nav.classList.contains('is-open'), true);
    });
    nav.addEventListener('click', function (e) {
      /* Закрытие по клику на ссылку: фокус не возвращаем — идёт переход */
      if (e.target.closest('a')) { setMenu(false, false); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false, true); }
    });
  }

  /* ---- Формы заявки: валидация + отправка через Telegram ----
     Бэкенда нет: после валидации собираем текст заявки и открываем
     t.me/doors_fabrika с готовым сообщением — пользователь жмёт
     «Отправить» уже в своём Telegram. Позже можно заменить на бота
     (см. README, раздел «Приём заявок»). */
  var TG_LINK = 'https://t.me/doors_fabrika';
  function setError(field, msg) {
    var wrap = field.closest('.field') || field.closest('.consent');
    if (!wrap) { return; }
    wrap.classList.toggle('has-error', Boolean(msg));
    /* aria-invalid + текст в связанном через aria-describedby контейнере
       с role=alert — скринридер узнаёт и о факте, и о причине ошибки */
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    var err = wrap.querySelector('.field-error');
    if (err) { err.textContent = msg || ''; }
  }

  document.querySelectorAll('form.lead-form').forEach(function (form) {
    /* Форма корзины (#cart-form) выглядит как lead-form (общие стили),
       но заказ отправляет cart-page.js. Второй обработчик здесь открывал
       бы лишнее окно (без состава корзины) и прятал форму. */
    if (form.id === 'cart-form') { return; }
    form.setAttribute('novalidate', 'novalidate');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('[name="name"]');
      var phone = form.querySelector('[name="phone"]');
      var consent = form.querySelector('[name="consent"]');
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
        setError(consent, 'Для отправки заявки нужно согласие на обработку данных.');
        ok = false;
        firstInvalid = firstInvalid || consent;
      } else { setError(consent, ''); }

      if (!ok) {
        if (firstInvalid) { firstInvalid.focus(); }
        return;
      }

      /* Собираем сообщение и открываем Telegram с готовым текстом */
      var comment = form.querySelector('[name="comment"]');
      var model = form.getAttribute('data-model');
      var lines = [
        'Заявка с сайта',
        'Имя: ' + name.value.trim(),
        'Телефон: ' + phone.value.trim()
      ];
      if (model) { lines.push('Модель: ' + model); }
      if (comment && comment.value.trim()) {
        lines.push('Комментарий: ' + comment.value.trim());
      }
      window.open(TG_LINK + '?text=' + encodeURIComponent(lines.join('\n')),
        '_blank', 'noopener');

      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; }
      var success = form.parentElement.querySelector('.form-success');
      form.hidden = true;
      if (success) { success.hidden = false; success.setAttribute('tabindex', '-1'); success.focus(); }
    });
  });
})();
