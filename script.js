function initializeGallery(gallery) {
  const tablist = gallery.querySelector('[data-gallery-tabs]');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[data-gallery-tab]'));
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
  if (!tabs.length || panels.some((panel) => !panel?.matches('[data-gallery-panel]') || !gallery.contains(panel))) return;

  tablist.setAttribute('role', 'tablist');

  function activateTab(index) {
    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      panels[tabIndex].hidden = !isSelected;
    });
  }

  tabs.forEach((tab, index) => {
    const panel = panels[index];
    tab.id ||= `${panel.id}-tab`;
    tab.setAttribute('role', 'tab');
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => {
      activateTab(index);
      tab.focus();
    });
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      switch (event.key) {
        case 'ArrowLeft':
          nextIndex = (index + tabs.length - 1) % tabs.length;
          break;
        case 'ArrowRight':
          nextIndex = (index + 1) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      activateTab(nextIndex);
      tabs[nextIndex].focus();
    });
  });

  activateTab(0);
  gallery.classList.add('js');
}

document.querySelectorAll('[data-gallery]').forEach(initializeGallery);

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
const hasWalkthrough = walkthroughSteps.length > 0 && walkthroughSteps.length === walkthroughImages.length;
const storyMedia = window.matchMedia('(min-width: 850px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)');
const mobileStoryMedia = window.matchMedia('(width < 850px) and (min-height: 540px) and (prefers-reduced-motion: no-preference)');

let storyEnabled = false;
let mobileStoryEnabled = false;
let activeStep = -1;
let frame = null;

function activateWalkthroughStep(index) {
  if (!hasWalkthrough || index === activeStep) return;

  activeStep = index;
  walkthroughStage.dataset.activeStep = String(index);
  walkthroughSteps.forEach((step, stepIndex) => {
    const isCurrent = stepIndex === index;
    step.classList.toggle('is-current', isCurrent);
    walkthroughImages[stepIndex].classList.toggle('is-current', isCurrent);
  });
}

function nearestWalkthroughStep() {
  const viewportHeight = window.innerHeight;
  const stageBottom = mobileStoryEnabled ? walkthroughStage.getBoundingClientRect().bottom : 0;
  const readingCenter = (viewportHeight + Math.min(viewportHeight, Math.max(0, stageBottom))) / 2;
  let nearestIndex = 0;
  let nearestDistance = Infinity;

  walkthroughSteps.forEach((step, index) => {
    const { top, height } = step.getBoundingClientRect();
    const distance = Math.abs(top + height / 2 - readingCenter);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });

  return nearestIndex;
}

function updateScrollStory() {
  frame = null;

  let heroProgress;
  if ((storyEnabled || mobileStoryEnabled) && heroStage) {
    const track = hero.getBoundingClientRect();
    const travel = mobileStoryEnabled ? track.height * .68 : track.height - heroStage.getBoundingClientRect().height;
    const headerBottom = Math.max(0, header?.getBoundingClientRect().bottom ?? 0);
    heroProgress = travel > 0 ? Math.min(1, Math.max(0, (headerBottom - track.top) / travel)) : 0;
  }
  const nextStep = (storyEnabled || mobileStoryEnabled) && hasWalkthrough ? nearestWalkthroughStep() : 0;

  header?.classList.toggle('is-scrolled', window.scrollY > 12);
  if (heroProgress !== undefined) hero.style.setProperty('--hero-progress', String(heroProgress));
  activateWalkthroughStep(nextStep);
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
  if (frame !== null) window.cancelAnimationFrame(frame);
  updateScrollStory();
}

activateWalkthroughStep(0);
syncScrollStory();
storyMedia.addEventListener('change', syncScrollStory);
mobileStoryMedia.addEventListener('change', syncScrollStory);
window.addEventListener('scroll', requestScrollUpdate, { passive: true });
window.addEventListener('resize', requestScrollUpdate, { passive: true });
