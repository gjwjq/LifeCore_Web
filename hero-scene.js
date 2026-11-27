const drawDuration = 1150;
const travelDuration = 10500;
const maxFrameTime = 64;
const routeColor = '#286d99';
const signalColor = '#17645b';

function buildRoute(width, height) {
  const anchors = [
    [.07, .81], [.07, .89], [.25, .89], [.25, .945], [.63, .945], [.63, .89],
    [.97, .89], [.97, .57], [.92, .57], [.92, .38], [.97, .38], [.97, .132], [.944, .132],
  ].map(([x, y]) => ({ x: x * width, y: y * height }));
  const corner = Math.min(width, height) * .045;
  const points = [{ ...anchors[0], distance: 0 }];

  function addPoint(x, y) {
    const previous = points.at(-1);
    points.push({ x, y, distance: previous.distance + Math.hypot(x - previous.x, y - previous.y) });
  }

  for (let index = 1; index < anchors.length - 1; index += 1) {
    const turn = anchors[index];
    const before = anchors[index - 1];
    const after = anchors[index + 1];
    const incoming = Math.hypot(before.x - turn.x, before.y - turn.y);
    const outgoing = Math.hypot(after.x - turn.x, after.y - turn.y);
    const radius = Math.min(corner, incoming * .46, outgoing * .46);
    const enterX = turn.x + (before.x - turn.x) * radius / incoming;
    const enterY = turn.y + (before.y - turn.y) * radius / incoming;
    const exitX = turn.x + (after.x - turn.x) * radius / outgoing;
    const exitY = turn.y + (after.y - turn.y) * radius / outgoing;
    addPoint(enterX, enterY);

    for (let step = 1; step <= 8; step += 1) {
      const t = step / 8;
      const enter = (1 - t) ** 2;
      const exit = t ** 2;
      const control = 2 * t * (1 - t);
      addPoint(enter * enterX + control * turn.x + exit * exitX, enter * enterY + control * turn.y + exit * exitY);
    }
  }

  addPoint(anchors.at(-1).x, anchors.at(-1).y);
  return points;
}

export function initializeHeroScene(canvas) {
  const initialRect = canvas?.getBoundingClientRect?.();
  const context = canvas?.getContext?.('2d');
  if (!initialRect || !context) return () => {};

  const page = canvas.ownerDocument;
  const view = page?.defaultView ?? globalThis;
  const motionPreference = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const supportsAnimation = ['IntersectionObserver', 'requestAnimationFrame', 'cancelAnimationFrame']
    .every((feature) => typeof view[feature] === 'function');
  let drawElapsed = motionPreference?.matches || !supportsAnimation ? drawDuration : 0;
  let travelElapsed = 0;
  let visibleElapsed = 0;
  let frame = null;
  let previousTime;
  let inView = false;
  let paused = false;
  let width = 0;
  let height = 0;
  let ratio = 0;
  let route;

  function canAnimate() {
    return supportsAnimation && inView && !page?.hidden && !motionPreference?.matches && !paused && width > 0 && height > 0;
  }

  function trace(distance) {
    context.beginPath();
    context.moveTo(route[0].x, route[0].y);

    for (let index = 1; index < route.length; index += 1) {
      const point = route[index];
      if (point.distance <= distance) {
        context.lineTo(point.x, point.y);
        continue;
      }

      const previous = route[index - 1];
      const fraction = (distance - previous.distance) / (point.distance - previous.distance);
      const x = previous.x + (point.x - previous.x) * fraction;
      const y = previous.y + (point.y - previous.y) * fraction;
      context.lineTo(x, y);
      return { x, y };
    }

    return route.at(-1);
  }

  function drawSignal(position, opacity) {
    if (opacity <= 0) return;

    const distance = route.at(-1).distance * position;
    const index = route.findIndex((point) => point.distance > distance);
    const before = route[index - 1];
    const after = route[index];
    if (!before || !after) return;

    const fraction = (distance - before.distance) / (after.distance - before.distance);
    const x = before.x + (after.x - before.x) * fraction;
    const y = before.y + (after.y - before.y) * fraction;
    const pulse = (travelElapsed % 1900) / 1900;

    context.save();
    context.globalAlpha = opacity * (1 - pulse) * .38;
    context.beginPath();
    context.arc(x, y, 5 + pulse * 4, 0, Math.PI * 2);
    context.lineWidth = 1.2;
    context.strokeStyle = signalColor;
    context.stroke();

    context.globalAlpha = opacity;
    context.beginPath();
    context.arc(x, y, 3.25, 0, Math.PI * 2);
    context.fillStyle = signalColor;
    context.fill();
    context.lineWidth = 1.25;
    context.strokeStyle = '#f5fff9';
    context.stroke();
    context.restore();
  }

  function paint() {
    if (!width || !height) return;
    const drawRatio = drawElapsed / drawDuration;
    const progress = drawRatio * (1.55 - .55 * drawRatio);
    const end = route.at(-1);
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.25;
    context.strokeStyle = 'rgba(248, 255, 251, .85)';
    trace(end.distance);
    context.stroke();

    context.lineWidth = 1.7;
    context.strokeStyle = routeColor;
    const tip = trace(end.distance * progress);
    if (progress > 0) context.stroke();

    if (progress < 1 && canAnimate()) {
      context.beginPath();
      context.arc(tip.x, tip.y, 3, 0, Math.PI * 2);
      context.fillStyle = routeColor;
      context.fill();
      context.lineWidth = 1.25;
      context.strokeStyle = '#f5fff9';
      context.stroke();
    }

    context.beginPath();
    context.arc(end.x, end.y, 3.2, 0, Math.PI * 2);
    context.fillStyle = '#f5fff9';
    context.fill();
    context.lineWidth = 1.25;
    context.strokeStyle = routeColor;
    context.stroke();

    if (drawElapsed === drawDuration && canAnimate()) {
      const fade = Math.min(1, travelElapsed / 800, (travelDuration - travelElapsed) / 950, visibleElapsed / 240);
      drawSignal(travelElapsed / travelDuration, fade * fade * (3 - 2 * fade));
    }
  }

  function animate(now) {
    frame = null;
    if (!canAnimate()) return;

    const elapsed = Math.min(maxFrameTime, now - (previousTime ?? now));
    previousTime = now;
    visibleElapsed += elapsed;
    const drawingTime = Math.min(elapsed, drawDuration - drawElapsed);
    drawElapsed += drawingTime;
    travelElapsed = (travelElapsed + elapsed - drawingTime) % travelDuration;
    paint();
    frame = view.requestAnimationFrame(animate);
  }

  function syncAnimation() {
    if (canAnimate()) {
      if (frame === null) frame = view.requestAnimationFrame(animate);
    } else {
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      previousTime = undefined;
      visibleElapsed = 0;
    }
    paint();
  }

  function resize({ width: nextWidth, height: nextHeight }) {
    const nextRatio = Math.min(view.devicePixelRatio || 1, 2);
    if (width === nextWidth && height === nextHeight && ratio === nextRatio) return;
    width = nextWidth;
    height = nextHeight;
    ratio = nextRatio;
    if (width && height) {
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      route = buildRoute(width, height);
    }
    syncAnimation();
  }

  resize(initialRect);
  if (typeof view.ResizeObserver === 'function') {
    const observer = new view.ResizeObserver(([entry]) => resize(entry.contentRect));
    observer.observe(canvas);
  }

  if (supportsAnimation) {
    const observer = new view.IntersectionObserver((entries) => {
      const entry = entries.at(-1);
      inView = entry.isIntersecting && entry.intersectionRatio >= .02;
      syncAnimation();
    }, { threshold: .02 });
    observer.observe(canvas);
    page?.addEventListener('visibilitychange', syncAnimation);
    motionPreference?.addEventListener?.('change', ({ matches }) => {
      if (matches) drawElapsed = drawDuration;
      syncAnimation();
    });
  }

  return function setPaused(nextPaused) {
    paused = Boolean(nextPaused);
    if (paused) drawElapsed = drawDuration;
    syncAnimation();
  };
}
