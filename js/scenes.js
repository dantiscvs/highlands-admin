// Animated marketing scenes.
//
// Each .scene holds four absolutely-positioned steps that cross-fade on a loop.
// A scene only animates while it is on screen, so a page full of them is not
// burning CPU out of view.
//
// Visibility is measured with getBoundingClientRect rather than
// IntersectionObserver: IO does not fire in some embedded and non-compositing
// webviews, and a scene that never starts would otherwise sit there animating
// nothing. The CSS shows the finished end-state whenever .play is absent, so
// the worst case is a static diagram rather than an empty box.
(function () {
  var scenes = [].slice.call(document.querySelectorAll('.scene'));
  if (!scenes.length) return;

  scenes.forEach(function (s) { s.classList.add('js'); });

  // Steps are absolutely positioned, so the stage needs an explicit height or
  // the tallest step gets clipped. Measure rather than guess: content length
  // differs per scene and grows if the copy is ever edited.
  function sizeStages() {
    scenes.forEach(function (scene) {
      var stage = scene.querySelector('.scene-stage');
      if (!stage) return;
      var tallest = 0;
      [].forEach.call(scene.querySelectorAll('.scene-step'), function (step) {
        // Measure while visible but not painted, so a hidden step still reports.
        var prevOpacity = step.style.opacity, prevVis = step.style.visibility;
        step.style.visibility = 'hidden';
        step.style.opacity = '1';
        tallest = Math.max(tallest, step.offsetHeight);
        step.style.opacity = prevOpacity;
        step.style.visibility = prevVis;
      });
      if (tallest) stage.style.minHeight = (tallest + 32) + 'px';
    });
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function update() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    scenes.forEach(function (scene) {
      var r = scene.getBoundingClientRect();
      // Play once any meaningful part of the scene is within the viewport.
      var visible = r.bottom > vh * 0.12 && r.top < vh * 0.88;
      scene.classList.toggle('play', visible);
    });
  }

  // Throttled by timestamp rather than requestAnimationFrame: rAF is paused in
  // background tabs and in some embedded webviews, which would leave scenes
  // stuck in whatever state they were last in. Four getBoundingClientRect
  // calls are cheap enough to run directly.
  var last = 0;
  function onScroll() {
    var now = Date.now();
    if (now - last < 120) return;
    last = now;
    update();
  }

  function init() {
    sizeStages();
    if (reduced) return; // CSS pins the end state; nothing to drive
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { sizeStages(); onScroll(); }, { passive: true });
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  document.querySelectorAll('.scene-replay').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var scene = btn.closest('.scene');
      scene.classList.remove('play');
      void scene.offsetWidth; // force reflow so the animation restarts
      scene.classList.add('play');
    });
  });
})();
