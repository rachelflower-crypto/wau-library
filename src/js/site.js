// We Are Unbecoming · The Library · small interactions (no frameworks)
(function () {
  // Browse by principle
  var chips = document.querySelectorAll('[data-principle]');
  var books = document.querySelectorAll('[data-principles]');
  var status = document.getElementById('shelf-status');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var p = chip.getAttribute('data-principle');
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var shown = 0;
      books.forEach(function (b) {
        var match = p === 'All' || b.getAttribute('data-principles').split('|').indexOf(p) !== -1;
        if (b.classList.contains('book')) b.classList.toggle('is-dim', !match);
        if (b.tagName === 'LI') b.hidden = !match;
        if (match && b.tagName === 'LI') shown++;
      });
      if (status) {
        status.textContent = p === 'All'
          ? 'Showing all ' + shown + ' books in this Dispatch.'
          : 'Showing ' + shown + (shown === 1 ? ' book' : ' books') + ' filed under ' + p + '.';
      }
    });
  });

  // Secret shelf
  var secret = document.getElementById('secret-book');
  var found = document.getElementById('secret-found');
  if (secret && found) {
    secret.addEventListener('click', function () {
      found.hidden = !found.hidden;
      secret.setAttribute('aria-expanded', found.hidden ? 'false' : 'true');
    });
  }

  // Curiosity cabinet
  var cab = document.getElementById('cabinet');
  var file = document.getElementById('casefile');
  document.querySelectorAll('[data-cabinet]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('data-cabinet') === 'open';
      if (cab) cab.classList.toggle('is-open', open);
      if (file) file.hidden = !open;
      document.querySelectorAll('[data-cabinet="open"]').forEach(function (b) { b.hidden = open; });
      document.querySelectorAll('[data-cabinet="close"]').forEach(function (b) { b.hidden = !open; });
      if (open && file) file.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Copy link
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-copy');
      var note = btn.parentNode.parentNode.querySelector('.copied');
      function done() { if (note) note.hidden = false; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
    });
  });
})();

// Bound edition: print / save as PDF
document.querySelectorAll('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });
