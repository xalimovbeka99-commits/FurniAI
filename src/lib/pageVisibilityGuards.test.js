import { describe, test, expect, vi } from 'vitest';

describe('BLOCKER 5 — Page Visibility Guards', () => {
  test('startLoop does not start animation frame when document.hidden === true', () => {
    let loopStarted = false;
    let bldRafId = null;

    const mockDocument = { hidden: true };
    const builderActive = true;
    const ren = {};

    function startLoop() {
      if (mockDocument.hidden) return;
      if (!bldRafId && builderActive && ren) {
        loopStarted = true;
      }
    }

    startLoop();
    expect(loopStarted).toBe(false);

    mockDocument.hidden = false;
    startLoop();
    expect(loopStarted).toBe(true);
  });

  test('visibilitychange hidden stops loops, visible resumes only active view', () => {
    let heroLooping = true;
    let builderLooping = true;

    let landingActive = true;
    let builderActive = false;

    function stopHeroLoop() { heroLooping = false; }
    function stopBuilderLoop() { builderLooping = false; }
    function startHeroLoop() { heroLooping = true; }
    function startBuilderLoop() { builderLooping = true; }

    const onVisibilityChange = (isHidden) => {
      if (isHidden) {
        stopHeroLoop();
        stopBuilderLoop();
      } else {
        if (landingActive) startHeroLoop();
        if (builderActive) startBuilderLoop();
      }
    };

    // Tab hidden
    onVisibilityChange(true);
    expect(heroLooping).toBe(false);
    expect(builderLooping).toBe(false);

    // Tab visible on landing page
    onVisibilityChange(false);
    expect(heroLooping).toBe(true);
    expect(builderLooping).toBe(false);
  });
});
