import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useClickOutside } from './useClickOutside';

function TestComponent({ onClose }: Readonly<{ onClose: () => void }>) {
  const ref = useClickOutside<HTMLDivElement>(onClose);
  return (
    <div ref={ref} data-testid="container">
      <button>Dedans</button>
    </div>
  );
}

describe('useClickOutside', () => {
  it("appelle onClose quand on clique à l'extérieur", () => {
    const onClose = vi.fn();
    render(<TestComponent onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("n'appelle pas onClose quand on clique à l'intérieur", () => {
    const onClose = vi.fn();
    const { getByText } = render(<TestComponent onClose={onClose} />);
    fireEvent.pointerDown(getByText('Dedans'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("n'appelle pas onClose quand on clique sur le conteneur lui-même", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<TestComponent onClose={onClose} />);
    fireEvent.pointerDown(getByTestId('container'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useClickOutside (stabilité)', () => {
  it('ne se ré-abonne pas à chaque rendu et utilise le dernier onClose', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<TestComponent onClose={first} />);
    const subscriptions = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length;
    rerender(<TestComponent onClose={second} />);
    expect(addSpy.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(
      subscriptions,
    );
    fireEvent.pointerDown(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    addSpy.mockRestore();
  });
});
