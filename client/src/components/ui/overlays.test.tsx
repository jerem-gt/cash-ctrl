import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmModal, ModalFrame } from './overlays';

describe('ConfirmModal', () => {
  const base = {
    title: 'Supprimer ?',
    body: 'Action irréversible.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('affiche le titre et le corps', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Action irréversible.')).toBeInTheDocument();
  });

  it('appelle onConfirm au clic sur Confirmer', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmModal {...base} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('appelle onCancel au clic sur Annuler', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmModal {...base} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('désactive les boutons si isPending', () => {
    render(<ConfirmModal {...base} isPending />);
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });
});

describe('ModalFrame', () => {
  it('place le focus sur le premier élément focusable', () => {
    render(
      <ModalFrame title="T">
        <input aria-label="champ" />
      </ModalFrame>,
    );
    expect(screen.getByLabelText('champ')).toHaveFocus();
  });

  it('restaure le focus à la fermeture', () => {
    const { rerender } = render(<button>déclencheur</button>);
    screen.getByRole('button', { name: 'déclencheur' }).focus();
    rerender(
      <>
        <button>déclencheur</button>
        <ModalFrame title="T">
          <input aria-label="champ" />
        </ModalFrame>
      </>,
    );
    expect(screen.getByLabelText('champ')).toHaveFocus();
    rerender(<button>déclencheur</button>);
    expect(screen.getByRole('button', { name: 'déclencheur' })).toHaveFocus();
  });

  it('Échap ne ferme que la modale la plus haute', () => {
    const low = vi.fn();
    const high = vi.fn();
    render(
      <>
        <ModalFrame title="Bas" onClose={low}>
          <p>a</p>
        </ModalFrame>
        <ModalFrame title="Haut" onClose={high}>
          <p>b</p>
        </ModalFrame>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(high).toHaveBeenCalledOnce();
    expect(low).not.toHaveBeenCalled();
  });

  it('sans onClose, la plus haute bloque Échap vers celles du dessous', () => {
    const low = vi.fn();
    render(
      <>
        <ModalFrame title="Bas" onClose={low}>
          <p>a</p>
        </ModalFrame>
        <ModalFrame title="Haut">
          <p>b</p>
        </ModalFrame>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(low).not.toHaveBeenCalled();
  });

  it('verrouille puis rétablit le scroll du body', () => {
    document.body.style.overflow = 'auto';
    const a = render(<ModalFrame title="A">x</ModalFrame>);
    const b = render(<ModalFrame title="B">y</ModalFrame>);
    expect(document.body.style.overflow).toBe('hidden');
    a.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    b.unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it("intercepte l'événement cancel natif", () => {
    render(<ModalFrame title="T">x</ModalFrame>);
    const ev = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('restaure le focus sur le déclencheur même si un enfant prend le focus dans son effet', () => {
    function SelfFocus() {
      const ref = useRef<HTMLInputElement>(null);
      useEffect(() => {
        ref.current?.focus();
      }, []);
      return <input ref={ref} aria-label="auto" />;
    }
    const Harness = ({ open }: Readonly<{ open: boolean }>) => (
      <div>
        <button>déclencheur</button>
        {open && (
          <ModalFrame title="T">
            <button>premier</button>
            <SelfFocus />
          </ModalFrame>
        )}
      </div>
    );
    const { rerender } = render(<Harness open={false} />);
    screen.getByRole('button', { name: 'déclencheur' }).focus();
    rerender(<Harness open />);
    expect(screen.getByRole('button', { name: 'premier' })).toHaveFocus();
    rerender(<Harness open={false} />);
    expect(screen.getByRole('button', { name: 'déclencheur' })).toHaveFocus();
  });

  it('restaure le focus sur le déclencheur qui perd le focus au clic (blur avant ouverture)', () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <button
            onClick={(e) => {
              e.currentTarget.blur();
              setOpen(true);
            }}
          >
            déclencheur
          </button>
          {open && (
            <ModalFrame title="T" onClose={() => setOpen(false)}>
              <input aria-label="champ" />
            </ModalFrame>
          )}
        </div>
      );
    };
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'déclencheur' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByLabelText('champ')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'déclencheur' })).toHaveFocus();
  });

  it('rend le focus au bouton de la première modale en fermant la seconde', () => {
    const Harness = () => {
      const [second, setSecond] = useState(false);
      return (
        <ModalFrame title="Première">
          <button onClick={() => setSecond(true)}>ouvrir seconde</button>
          {second && (
            <ModalFrame title="Seconde" onClose={() => setSecond(false)}>
              <input aria-label="champ2" />
            </ModalFrame>
          )}
        </ModalFrame>
      );
    };
    render(<Harness />);
    const btn = screen.getByRole('button', { name: 'ouvrir seconde' });
    btn.focus();
    fireEvent.click(btn);
    expect(screen.getByLabelText('champ2')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'ouvrir seconde' })).toHaveFocus();
  });

  it('sous StrictMode, Échap ne ferme que la modale la plus haute', () => {
    const low = vi.fn();
    const high = vi.fn();
    render(
      <StrictMode>
        <ModalFrame title="Bas" onClose={low}>
          <p>a</p>
        </ModalFrame>
        <ModalFrame title="Haut" onClose={high}>
          <p>b</p>
        </ModalFrame>
      </StrictMode>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(high).toHaveBeenCalledOnce();
    expect(low).not.toHaveBeenCalled();
  });
});
