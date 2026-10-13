import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let App: typeof import('./App').default;

const Boom = () => {
  throw new Error('boom');
};
const Fine = () => <p>page ok</p>;

beforeAll(async () => {
  vi.doMock('@/lib/routeChunks', () => {
    const ok = () => Promise.resolve({ default: Fine });
    return {
      routeChunk: {
        '/': () => Promise.resolve({ default: Boom }),
        '/transactions': ok,
        '/accounts': ok,
        '/accounts/:id': ok,
        '/scheduled': ok,
        '/settings': ok,
        '/reports': ok,
      },
      prefetchRouteChunk: () => undefined,
    };
  });
  vi.resetModules();
  ({ default: App } = await import('./App'));
});

afterAll(() => {
  vi.doUnmock('@/lib/routeChunks');
  vi.resetModules();
});

describe('ErrorBoundary', () => {
  it('affiche le message traduit après une erreur de rendu puis se réinitialise à la navigation', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    globalThis.history.pushState({}, '', '/');
    render(<App />);
    expect(
      await screen.findByText(/Une erreur est survenue — cliquez pour recharger/),
    ).toBeVisible();

    fireEvent.click(screen.getAllByRole('link', { name: /^comptes$/i })[0]);
    expect(await screen.findByText('page ok')).toBeVisible();
    expect(screen.queryByText(/cliquez pour recharger/)).toBeNull();
    spy.mockRestore();
  });
});
