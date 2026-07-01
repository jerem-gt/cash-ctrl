import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OfflineBanner } from '@/components/OfflineBanner';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

describe('OfflineBanner', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it("ne s'affiche pas quand le navigateur est en ligne", () => {
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByText('Hors ligne — données en cache')).not.toBeInTheDocument();
  });

  it("s'affiche si navigator.onLine est false au montage", () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    renderWithProviders(<OfflineBanner />);
    expect(screen.getByText('Hors ligne — données en cache')).toBeInTheDocument();
  });

  it("apparaît quand l'événement offline est déclenché", () => {
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByText('Hors ligne — données en cache')).not.toBeInTheDocument();
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Hors ligne — données en cache')).toBeInTheDocument();
  });

  it("disparaît quand l'événement online est déclenché après offline", () => {
    renderWithProviders(<OfflineBanner />);
    act(() => {
      globalThis.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText('Hors ligne — données en cache')).toBeInTheDocument();
    act(() => {
      globalThis.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText('Hors ligne — données en cache')).not.toBeInTheDocument();
  });
});
