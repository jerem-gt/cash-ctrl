import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ModalFrame } from './overlays';
import { Popover } from './popover';

function Harness({ onClose }: Readonly<{ onClose?: () => void }>) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>ouvrir</button>
      <Popover
        open={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      >
        <p>menu</p>
      </Popover>
    </div>
  );
}

describe('Popover', () => {
  it('ne rend rien quand fermé', () => {
    render(
      <Popover open={false} onClose={vi.fn()}>
        menu
      </Popover>,
    );
    expect(screen.queryByText('menu')).not.toBeInTheDocument();
  });

  it('se ferme avec Échap et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'ouvrir' }));
    expect(screen.getByText('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ouvrir' })).toHaveFocus();
  });

  it('se ferme au clic sur le fond (non focusable, masqué)', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'ouvrir' }));
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop.tagName).toBe('DIV');
    await user.click(backdrop);
    expect(screen.queryByText('menu')).not.toBeInTheDocument();
  });

  it('ne réagit pas à Échap quand une modale est au-dessus', () => {
    const onClose = vi.fn();
    render(
      <>
        <Popover open onClose={onClose}>
          menu
        </Popover>
        <ModalFrame title="M" onClose={vi.fn()}>
          x
        </ModalFrame>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
