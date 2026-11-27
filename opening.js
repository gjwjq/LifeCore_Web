const forwardThreshold = .42;
const reverseThreshold = .28;

export function createOpeningTransition(opening, header, desktopMotion, mobileMotion, requestUpdate) {
  const viewport = opening?.querySelector('[data-opening-window]');
  const track = viewport?.querySelector('[data-opening-track]');
  const hero = track?.querySelector('[data-hero-scroll]');
  const copy = hero?.querySelector('.hero-copy');
  const visual = hero?.querySelector('.hero-visual');
  const intro = track?.querySelector('.intro .intro-inner');
  const introAnchor = opening?.querySelector('[data-opening-snap-intro]');
  const document = opening?.ownerDocument;
  const how = document?.getElementById('how');
  const view = document?.defaultView;

  if (!copy || !visual || !intro || !introAnchor || !view ||
      !view.CSS?.supports('position', 'sticky') || !view.CSS.supports('overflow', 'clip')) {
    return { sync() {}, update() {} };
  }

  const nativeSnap = view.CSS.supports('scroll-snap-type', 'y proximity');
  let enabled = false;
  let progress;
  let headerHeight;
  let headerExit;
  let snapActive = false;
  let howSnapActive = false;
  let previousDistance;
  let direction = 0;
  let anchorDirection = 0;

  function outerHeight(element) {
    const { marginTop, marginBottom } = view.getComputedStyle(element);
    return element.offsetHeight + (parseFloat(marginTop) || 0) + (parseFloat(marginBottom) || 0);
  }

  function requiredHeight(stacked) {
    const copyHeight = outerHeight(copy);
    const visualHeight = outerHeight(visual);
    const heroHeight = stacked ? copyHeight + visualHeight : Math.max(copyHeight, visualHeight);
    return Math.max(heroHeight, outerHeight(intro) + 64);
  }

  function setSnap(active, howActive = false) {
    if (active !== snapActive) {
      snapActive = active;
      document.documentElement.classList.toggle('opening-snap-active', active);
    }
    if (howActive !== howSnapActive) {
      howSnapActive = howActive;
      document.documentElement.classList.toggle('opening-how-snap-active', howActive);
    }
  }

  function protectAnchor(hash) {
    if (!hash?.startsWith('#')) return;
    const target = document.getElementById(hash.slice(1));
    if (!target || (opening.contains(target) && target !== opening)) return;
    anchorDirection = target.contains(opening) ? -1 : 1;
    setSnap(false);
  }

  function sync() {
    const allowed = desktopMotion.matches || mobileMotion.matches;
    if (!allowed && !enabled) return;

    const currentHeaderHeight = header?.offsetHeight ?? 0;
    if (allowed) {
      if (headerHeight !== currentHeaderHeight) {
        headerHeight = currentHeaderHeight;
        opening.style.setProperty('--opening-header-height', `${headerHeight}px`);
      }
      opening.classList.add('is-horizontal');
    }

    const stacked = view.matchMedia('(max-width: 780px)').matches;
    enabled = allowed && requiredHeight(stacked) <= viewport.clientHeight - currentHeaderHeight;
    opening.classList.toggle('is-horizontal', enabled);
    if (!enabled) {
      if (headerHeight !== undefined) opening.style.removeProperty('--opening-header-height');
      if (progress !== undefined) {
        opening.style.removeProperty('--opening-progress');
        delete opening.dataset.openingScene;
      }
      if (headerExit !== undefined) header?.style.removeProperty('--opening-header-exit');
      setSnap(false);
      headerHeight = undefined;
      progress = undefined;
      headerExit = undefined;
      previousDistance = undefined;
      direction = 0;
    }
    requestUpdate?.();
  }

  function update() {
    if (!enabled) return;

    const { top, height } = opening.getBoundingClientRect();
    const viewportHeight = viewport.getBoundingClientRect().height;
    const travel = height - viewportHeight;
    const introDistance = introAnchor.getBoundingClientRect().top - top;
    const remainingToHow = how ? how.getBoundingClientRect().top - headerHeight : 0;
    const distance = Math.max(0, -top);
    const moved = Math.sign(distance - (previousDistance ?? distance));
    if (moved) direction = moved;
    previousDistance = distance;

    const threshold = progress === 1 ? reverseThreshold : forwardThreshold;
    const next = Number(introDistance > 0 && distance > introDistance * threshold);
    if (next !== progress) {
      progress = next;
      opening.dataset.openingScene = progress === 1 ? 'intro' : 'hero';
      opening.style.setProperty('--opening-progress', String(progress));
    }

    const nextHeaderExit = distance <= travel + 8 ? progress : 0;
    if (nextHeaderExit !== headerExit) {
      headerExit = nextHeaderExit;
      header?.style.setProperty('--opening-header-exit', String(headerExit));
    }

    const passedForwardStops = how ? remainingToHow <= .5 : distance >= introDistance - .5;
    if ((anchorDirection > 0 && passedForwardStops) ||
        (anchorDirection < 0 && distance <= .5) || (moved && moved === -anchorDirection)) {
      anchorDirection = 0;
    }
    // Arm only the stop ahead so the scene being left cannot pull the scroll back.
    const canSnap = nativeSnap && desktopMotion.matches && !anchorDirection;
    const movesTowardScene = progress === 1 ? direction > 0 : direction < 0;
    const pastIntro = distance > travel + .2 * viewportHeight;
    setSnap(
      canSnap && movesTowardScene && distance > .5 && distance < introDistance - .5,
      canSnap && progress === 1 && direction > 0 && pastIntro && remainingToHow > .5,
    );
    return progress;
  }

  hero.addEventListener('focusin', ({ target }) => {
    if (!target.matches(':focus-visible') || !(update() > 0)) return;
    const { left, right } = target.getBoundingClientRect();
    const clip = viewport.getBoundingClientRect();
    if (left >= clip.left && right <= clip.right) return;
    const top = Math.max(0, view.scrollY + opening.getBoundingClientRect().top);
    anchorDirection = -1;
    setSnap(false);
    view.scrollTo({ top, behavior: 'instant' });
    requestUpdate?.();
  });

  protectAnchor(view.location?.hash);
  view.addEventListener('hashchange', () => protectAnchor(view.location.hash));
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (link && (!link.target || link.target === '_self')) protectAnchor(link.hash);
  });

  view.addEventListener('resize', sync, { passive: true });
  if (typeof view.ResizeObserver === 'function') {
    const observer = new view.ResizeObserver(sync);
    [copy, visual, intro, header].filter(Boolean).forEach((element) => observer.observe(element));
  }

  return { sync, update };
}
