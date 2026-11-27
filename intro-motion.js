const clamp = (value) => Math.min(1, Math.max(0, value));
const tolerance = .002;
const holdDelay = 100;

function easeToward(value, target, elapsed, timeConstant) {
  if (Math.abs(target - value) <= tolerance) return target;
  return target + (value - target) * Math.exp(-elapsed / timeConstant);
}

export function createIntroMotion(opening, requestUpdate) {
  const viewport = opening?.querySelector('[data-opening-window]');
  const introAnchor = opening?.querySelector('[data-opening-snap-intro]');
  const intro = viewport?.querySelector('.intro');
  const content = intro?.querySelector('.intro-inner');
  const view = opening?.ownerDocument?.defaultView;
  const css = view?.CSS;

  const supportsTextGradient = css?.supports('background-clip', 'text') || css?.supports('-webkit-background-clip', 'text');
  if (!introAnchor || !content || !supportsTextGradient) return () => {};

  let enabled = false;
  let horizontal;
  let lastTime;
  let lastScroll;
  let holdDistance;
  let holdSince;
  let completedAtHold = false;
  let fill;
  let glow;

  function publish(nextGlow, nextFill) {
    if (glow !== nextGlow) {
      glow = nextGlow;
      opening.style.setProperty('--glow-progress', glow.toFixed(4));
    }
    if (fill !== nextFill) {
      fill = nextFill;
      intro.style.setProperty('--intro-fill-progress', fill.toFixed(4));
    }
  }

  return function update(allowed, time = view.performance.now()) {
    if (!allowed) {
      if (!enabled) return;
      enabled = false;
      opening.classList.remove('has-intro-motion');
      opening.style.removeProperty('--glow-progress');
      intro.style.removeProperty('--intro-fill-progress');
      horizontal = lastTime = lastScroll = holdDistance = holdSince = fill = glow = undefined;
      completedAtHold = false;
      return;
    }

    const nextHorizontal = opening.classList.contains('is-horizontal');
    const bounds = (nextHorizontal ? viewport : intro).getBoundingClientRect();
    const height = view.innerHeight;
    const scroll = view.scrollY;
    const modeChanged = nextHorizontal !== horizontal;
    const jumped = lastScroll !== undefined && Math.abs(scroll - lastScroll) > height * .82;
    const elapsed = Math.min(48, Math.max(1, time - (lastTime ?? time - 16)));
    horizontal = nextHorizontal;
    lastTime = time;
    lastScroll = scroll;

    const offscreen = bounds.bottom <= 0 || bounds.top >= height;
    let targetGlow = Number(bounds.bottom <= 0);
    let targetFill = targetGlow;
    let waitingForHold = false;

    if (modeChanged || offscreen) {
      holdDistance = holdSince = undefined;
      completedAtHold = false;
    }

    if (!offscreen && horizontal) {
      const openingTop = opening.getBoundingClientRect().top;
      const stop = introAnchor.getBoundingClientRect().top - openingTop;
      const distance = Math.max(0, -openingTop);
      if (stop > 0) {
        const fillStart = stop * .61;
        const fillEnd = stop + Math.min(100, Math.max(65, stop * .12));
        targetGlow = clamp((distance - stop * .03) / (stop * .93));
        targetFill = clamp((distance - fillStart) / (fillEnd - fillStart));

        if (distance < stop - 2) completedAtHold = false;
        if (distance >= stop - 2 && distance < fillEnd && !completedAtHold) {
          if (distance !== holdDistance) {
            holdDistance = distance;
            holdSince = time;
          }
          // A native proximity snap can rest here before the scroll range ends.
          completedAtHold = time - holdSince >= holdDelay;
          waitingForHold = !completedAtHold;
        } else {
          holdDistance = holdSince = undefined;
        }
        if (completedAtHold) targetFill = 1;
      }
    } else if (!offscreen) {
      const { top } = content.getBoundingClientRect();
      targetGlow = clamp((height - top) / (height * .56));
      targetFill = clamp((height * .92 - top) / (height * .44));
    }

    if (!enabled || modeChanged || offscreen || jumped) publish(targetGlow, targetFill);
    else publish(easeToward(glow, targetGlow, elapsed, 80), easeToward(fill, targetFill, elapsed, 175));

    if (!enabled) {
      enabled = true;
      opening.classList.add('has-intro-motion');
    }
    if (waitingForHold || glow !== targetGlow || fill !== targetFill) requestUpdate?.();
  };
}
