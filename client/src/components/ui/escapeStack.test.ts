import { describe, expect, it, vi } from 'vitest';

import { nextEscapeOrder, pushEscape } from './escapeStack';

describe('escapeStack', () => {
  it("désigne l'entrée au rang le plus élevé même si l'ancienne est re-poussée en dernier", () => {
    const older = vi.fn();
    const newer = vi.fn();
    const orderOlder = nextEscapeOrder();
    const orderNewer = nextEscapeOrder();
    const releaseNewer = pushEscape({ onEscape: newer, order: orderNewer });
    const releaseOlder = pushEscape({ onEscape: older, order: orderOlder });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(newer).toHaveBeenCalledOnce();
    expect(older).not.toHaveBeenCalled();
    releaseNewer();
    releaseOlder();
  });
});
