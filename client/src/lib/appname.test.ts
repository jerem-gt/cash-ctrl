import { describe, expect, it } from 'vitest';

import { appName } from './appname';

describe('appName', () => {
  it('retourne "CashCtrl (dev)" en mode dev/test', () => {
    expect(appName()).toBe('CashCtrl (dev)');
  });
});
