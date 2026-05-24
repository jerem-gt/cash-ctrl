import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useClickOutside } from './useClickOutside';

function TestComponent({ onClose }: { onClose: () => void }) {
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
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("n'appelle pas onClose quand on clique à l'intérieur", () => {
    const onClose = vi.fn();
    const { getByText } = render(<TestComponent onClose={onClose} />);
    fireEvent.mouseDown(getByText('Dedans'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("n'appelle pas onClose quand on clique sur le conteneur lui-même", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<TestComponent onClose={onClose} />);
    fireEvent.mouseDown(getByTestId('container'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
