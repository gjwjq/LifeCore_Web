const forwardThreshold = .45;
const reverseThreshold = .35;
const snapTolerance = 1;

export function createGalleryScroll(gallery, header, requestUpdate) {
  const viewport = gallery?.querySelector('[data-gallery-window]');
  const track = viewport?.querySelector('[data-gallery-track]');
  const panels = Array.from(track?.querySelectorAll('[data-gallery-panel]') ?? []);
  const markers = Array.from(gallery?.querySelectorAll('[data-gallery-snap]') ?? []);
  const page = gallery?.ownerDocument;
  const view = page?.defaultView;
  const root = page?.documentElement;

  if (panels.length !== 3 || markers.length !== panels.length || !root || !view?.matchMedia ||
      !view.CSS?.supports('position', 'sticky') || !view.CSS.supports('overflow', 'clip')) {
    return { sync() {}, update() {} };
  }

  const motion = view.matchMedia('(prefers-reduced-motion: no-preference)');
  const nativeSnap = view.CSS.supports('scroll-snap-type', 'y proximity');
  let enabled = false;
  let stageTop;
  let stageHeight = 0;
  let headerExiting = false;
  let activeIndex;
  let previousDistance;
  let direction = 0;
  let snapActive = false;
  let protectedAnchor;
  let previousAnchorGap;

  function setSnap(active) {
    if (active === snapActive) return;
    snapActive = active;
    root.classList.toggle('gallery-snap-active', active);
  }

  function setIndex(index) {
    if (index === activeIndex) return;
    activeIndex = index;
    gallery.dataset.galleryIndex = String(index);
    gallery.style.setProperty('--gallery-index', String(index));
  }

  function setHeaderExit(exiting) {
    if (exiting === headerExiting) return;
    headerExiting = exiting;
    if (exiting) header?.style.setProperty('--gallery-header-exit', '1');
    else header?.style.removeProperty('--gallery-header-exit');
  }

  function protectAnchor(hash) {
    if (!hash?.startsWith('#')) return;

    let id;
    try {
      id = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }
    const target = page.getElementById(id);
    if (!target) return;

    protectedAnchor = target;
    previousAnchorGap = undefined;
    setSnap(false);
    requestUpdate?.();
  }

  function anchorIsNavigating() {
    if (!protectedAnchor) return false;

    const margin = parseFloat(view.getComputedStyle(protectedAnchor).scrollMarginTop) || 0;
    const padding = parseFloat(view.getComputedStyle(root).scrollPaddingTop) || 0;
    const destination = view.scrollY + protectedAnchor.getBoundingClientRect().top - margin - padding;
    const maxScroll = Math.max(0, root.scrollHeight - view.innerHeight);
    const gap = Math.min(maxScroll, Math.max(0, destination)) - view.scrollY;
    if (Math.abs(gap) <= 2 || (previousAnchorGap !== undefined && (
      Math.sign(gap) !== Math.sign(previousAnchorGap) || Math.abs(gap) > Math.abs(previousAnchorGap) + 4
    ))) {
      protectedAnchor = undefined;
      previousAnchorGap = undefined;
      direction = 0;
    } else {
      previousAnchorGap = gap;
    }
    return true;
  }

  function sync() {
    if (motion.matches) {
      gallery.classList.add('is-scroll-gallery');

      stageHeight = viewport.getBoundingClientRect().height;
      const cssLimit = parseFloat(view.getComputedStyle(viewport).maxHeight);
      const available = Math.min(view.innerHeight, Number.isFinite(cssLimit) ? cssLimit : Infinity);
      const contentHeight = Math.max(viewport.scrollHeight, ...panels.map((panel) => panel.scrollHeight));
      enabled = stageHeight > 0 && Math.max(stageHeight, contentHeight) <= available + snapTolerance;

      const centeredTop = Math.max(0, (available - stageHeight) / 2);
      if (enabled && centeredTop !== stageTop) {
        stageTop = centeredTop;
        gallery.style.setProperty('--gallery-stage-top', `${stageTop}px`);
        previousDistance = undefined;
        direction = 0;
        setSnap(false);
      }
    } else {
      enabled = false;
    }

    if (!enabled) {
      gallery.classList.remove('is-scroll-gallery');
      if (stageTop !== undefined) gallery.style.removeProperty('--gallery-stage-top');
      if (activeIndex !== undefined) {
        gallery.style.removeProperty('--gallery-index');
        delete gallery.dataset.galleryIndex;
      }
      stageTop = undefined;
      activeIndex = undefined;
      previousDistance = undefined;
      direction = 0;
      setSnap(false);
      setHeaderExit(false);
    }
    requestUpdate?.();
  }

  function update() {
    const isNavigating = anchorIsNavigating();
    if (!enabled) return;

    const { top, height } = gallery.getBoundingClientRect();
    const distance = stageTop - top;
    const preRoll = Math.max(0, (header?.offsetHeight ?? 0) - stageTop) + 48;
    setHeaderExit(distance >= -preRoll && distance < height - stageHeight);
    const stops = markers.map((marker) => marker.getBoundingClientRect().top - top);
    const lastIndex = stops.length - 1;
    if (stops.some((stop, index) => index > 0 && stop <= stops[index - 1])) {
      setIndex(0);
      setSnap(false);
      return;
    }

    const moved = Math.sign(distance - (previousDistance ?? distance));
    if (moved && !isNavigating) direction = moved;
    previousDistance = distance;

    let index = activeIndex ?? 0;
    while (index < lastIndex && distance >= stops[index] + (stops[index + 1] - stops[index]) * forwardThreshold) index++;
    while (index > 0 && distance < stops[index - 1] + (stops[index] - stops[index - 1]) * reverseThreshold) index--;
    setIndex(index);

    const targetGap = stops[index] - distance;
    setSnap(nativeSnap && !isNavigating && distance > stops[0] + snapTolerance &&
      distance < stops[lastIndex] - snapTolerance && Math.abs(targetGap) > snapTolerance && Math.sign(targetGap) === direction);
  }

  protectAnchor(view.location?.hash);
  view.addEventListener('hashchange', () => protectAnchor(view.location.hash));
  page.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (link && (!link.target || link.target === '_self')) protectAnchor(link.hash);
  });

  if (motion.addEventListener) motion.addEventListener('change', sync);
  else motion.addListener?.(sync);
  view.addEventListener('resize', sync, { passive: true });
  if (typeof view.ResizeObserver === 'function') {
    const observer = new view.ResizeObserver(sync);
    [viewport, header, ...panels].filter(Boolean).forEach((element) => observer.observe(element));
  }

  return { sync, update };
}
