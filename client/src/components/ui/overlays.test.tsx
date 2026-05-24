import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmModal } from './overlays';

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
