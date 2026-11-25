import {createWalkthroughRoute} from './route.js';
import {initializeHeroScene} from './hero-scene.js';
import {createOpeningTransition} from './opening.js';
import {createGalleryScroll} from './gallery-scroll.js';

const setHeroMotionPaused = initializeHeroScene(document.querySelector('[data-hero-route]'));
const heroMotionToggle = document.querySelector('[data-hero-motion-toggle]');
if (heroMotionToggle && 'IntersectionObserver' in window) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const syncMotionToggle = () => { heroMotionToggle.hidden = reducedMotion.matches; };
  syncMotionToggle();
  reducedMotion.addEventListener?.('change', syncMotionToggle);
  heroMotionToggle.addEventListener('click', () => {
    const paused = heroMotionToggle.getAttribute('aria-pressed') !== 'true';
    heroMotionToggle.setAttribute('aria-pressed', String(paused));
    heroMotionToggle.title = paused ? '지도 움직임 재생' : '지도 움직임 일시정지';
    setHeroMotionPaused(paused);
  });
}

const revealTargets = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && revealTargets.length) {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });

  revealTargets.forEach((target) => observer.observe(target));
  document.body.classList.add('can-reveal');
}

const header = document.querySelector('[data-site-header]');
const hero = document.querySelector('[data-hero-scroll]');
const heroStage = hero?.querySelector('[data-hero-stage]');
const walkthrough = document.querySelector('[data-walkthrough]');
const walkthroughStage = walkthrough?.querySelector('[data-walkthrough-stage]');
const walkthroughSteps = Array.from(walkthrough?.querySelectorAll('.walkthrough-steps [data-walkthrough-step]') ?? []);
const walkthroughImages = Array.from(walkthroughStage?.querySelectorAll('[data-walkthrough-image]') ?? []);
const routeStops = Array.from(walkthroughStage?.querySelectorAll('[data-route-stop]') ?? []);
const updateRoute = createWalkthroughRoute(walkthroughStage?.querySelector('[data-walkthrough-route]'));
const hasWalkthrough = walkthroughSteps.length > 0 && walkthroughSteps.length === walkthroughImages.length;
const storyMedia = window.matchMedia('(min-width: 850px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
const mobileStoryMedia = window.matchMedia('(width < 850px) and (min-height: 540px) and (prefers-reduced-motion: no-preference)');

let storyEnabled = false;
let mobileStoryEnabled = false;
let activeStep = -1;
let frame = null;

const openingTransition = createOpeningTransition(document.querySelector('[data-opening]'), header, requestScrollUpdate);
const galleryScroll = createGalleryScroll(document.querySelector('[data-gallery]'), header, requestScrollUpdate);

function activateWalkthroughStep(index) {
  if (!hasWalkthrough || index === activeStep) return;

  activeStep = index;
  walkthroughStage.dataset.activeStep = String(index);
  walkthroughSteps.forEach((step, stepIndex) => {
    const isCurrent = stepIndex === index;
    step.classList.toggle('is-current', isCurrent);
    walkthroughImages[stepIndex].classList.toggle('is-current', isCurrent);
  });
  routeStops.forEach((stop, stopIndex) => {
    if (stopIndex === index) stop.setAttribute('aria-current', 'step');
    else stop.removeAttribute('aria-current');
  });
}

function readWalkthroughPosition() {
  const viewportHeight = window.innerHeight;
  const stageBottom = mobileStoryEnabled ? walkthroughStage.getBoundingClientRect().bottom : 0;
  const readingCenter = (viewportHeight + Math.min(viewportHeight, Math.max(0, stageBottom))) / 2;
  const centers = walkthroughSteps.map((step) => {
    const { top, height } = step.getBoundingClientRect();
    return top + height / 2;
  });
  const next = centers.findIndex((center) => center >= readingCenter);
  if (next === -1) return centers.length - 1;
  if (next === 0) return 0;
  const previousCenter = centers[next - 1];
  return next - 1 + (readingCenter - previousCenter) / (centers[next] - previousCenter);
}

function updateScrollStory() {
  frame = null;

  let heroProgress = openingTransition.update();
  galleryScroll.update();
  if (heroProgress === undefined && (storyEnabled || mobileStoryEnabled) && heroStage) {
    const track = hero.getBoundingClientRect();
    const travel = mobileStoryEnabled ? track.height * .68 : track.height - heroStage.getBoundingClientRect().height;
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    heroProgress = travel > 0 ? Math.min(1, Math.max(0, (headerBottom - track.top) / travel)) : 0;
  }
  const position = (storyEnabled || mobileStoryEnabled) && hasWalkthrough ? readWalkthroughPosition() : 0;

  header?.classList.toggle('is-scrolled', window.scrollY > 12);
  if (heroProgress !== undefined) hero.style.setProperty('--hero-progress', String(heroProgress));
  activateWalkthroughStep(Math.round(position));
  updateRoute(position / Math.max(1, walkthroughSteps.length - 1));
}

function requestScrollUpdate() {
  if (frame === null) frame = window.requestAnimationFrame(updateScrollStory);
}

function syncScrollStory() {
  storyEnabled = storyMedia.matches && Boolean(heroStage || hasWalkthrough);
  mobileStoryEnabled = mobileStoryMedia.matches && Boolean(heroStage || hasWalkthrough);
  document.body.classList.toggle('has-scroll-story', storyEnabled);
  document.body.classList.toggle('has-mobile-story', mobileStoryEnabled);
  if (!storyEnabled && !mobileStoryEnabled) hero?.style.removeProperty('--hero-progress');
  openingTransition.sync();
  galleryScroll.sync();
  if (frame !== null) window.cancelAnimationFrame(frame);
  updateScrollStory();
}

activateWalkthroughStep(0);
syncScrollStory();
storyMedia.addEventListener('change', syncScrollStory);
mobileStoryMedia.addEventListener('change', syncScrollStory);
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate, { passive: true });
