const stationX = .22;
const stationY = [.18, .50, .82];

export function createWalkthroughRoute(canvas) {
  const context = canvas?.getContext?.('2d');
  if (!context) return () => {};

  let width = 0;
  let height = 0;
  let pixelRatio = 0;
  let progress = 0;

  function traceRoute(position) {
    const x = width * stationX;
    let endX = x;
    let endY = height * stationY[0];
    context.beginPath();
    context.moveTo(endX, endY);

    for (let segment = 0; segment < 2; segment += 1) {
      const fraction = Math.min(1, position * 2 - segment);
      if (fraction <= 0) break;

      const startY = height * stationY[segment];
      const stopY = height * stationY[segment + 1];
      const distanceY = stopY - startY;
      const bend = width * (segment === 0 ? -.23 : .23);
      endX = x + 2 * bend * fraction * (1 - fraction);
      endY = fraction === 1 ? stopY : startY + distanceY * fraction;
      context.quadraticCurveTo(x + bend * fraction, startY + distanceY * fraction / 2, endX, endY);
    }

    return { x: endX, y: endY };
  }

  function paint() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round';
    context.lineWidth = 2;
    context.strokeStyle = 'rgba(106, 133, 120, .37)';
    traceRoute(1);
    context.stroke();

    context.lineWidth = 1;
    context.strokeStyle = 'rgba(111, 133, 122, .28)';
    context.beginPath();
    for (const station of stationY) {
      const y = height * station;
      context.moveTo(width * .25, y);
      context.lineTo(width * .39, y);
    }
    context.stroke();

    context.lineWidth = 2.5;
    context.strokeStyle = '#147a59';
    const point = traceRoute(progress);
    context.stroke();

    const x = width * stationX;
    for (const station of stationY) {
      context.beginPath();
      context.arc(x, height * station, 4.5, 0, Math.PI * 2);
      context.fillStyle = '#e9f1eb';
      context.fill();
      context.lineWidth = 1.5;
      context.strokeStyle = '#8eab9e';
      context.stroke();
    }

    context.beginPath();
    context.arc(point.x, point.y, 7, 0, Math.PI * 2);
    context.fillStyle = '#f2faf5';
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = '#147a59';
    context.stroke();

    context.beginPath();
    context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    context.fillStyle = '#147a59';
    context.fill();
  }

  function resize(nextWidth, nextHeight) {
    const nextRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;

    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    if (!width || !height) return;

    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    paint();
  }

  resize(canvas.clientWidth, canvas.clientHeight);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(([entry]) => {
      resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(canvas);
  }

  return function updateRoute(position) {
    if (!Number.isFinite(position)) return;
    const nextProgress = Math.max(0, Math.min(1, position));
    if (nextProgress === progress) return;
    progress = nextProgress;
    paint();
  };
}
