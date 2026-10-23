// Runs in <head> before first paint so the saved theme never flashes. Default is night (the brand's dark look).
(function () {
  var d = document.documentElement, t = 'dark';
  d.classList.add('js');
  try { t = localStorage.getItem('frc_theme') === 'light' ? 'light' : 'dark'; } catch (e) {}
  d.dataset.theme = t;
})();
