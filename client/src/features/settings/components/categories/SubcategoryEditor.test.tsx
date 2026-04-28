import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubcategoryEditor } from './SubcategoryEditor';

describe('SubcategoryEditor', () => {
  const defaultProps = {
    name: 'Santé',
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isPending: false,
    submitLabel: 'OK',
    placeholder: 'Sous-cat placeholder',
  };

  it('affiche la valeur initiale et le placeholder correctement', () => {
    render(<SubcategoryEditor {...defaultProps} />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Santé');
    expect(input).toHaveAttribute('placeholder', 'Sous-cat placeholder');
  });

  it('appelle onSave avec le nouveau nom lors du clic sur le bouton de soumission', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SubcategoryEditor {...defaultProps} onSave={onSave} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Pharmacie');

    await user.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSave).toHaveBeenCalledWith('Pharmacie');
  });

  it('appelle onSave lors de l’appui sur la touche Entrée', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<SubcategoryEditor {...defaultProps} onSave={onSave} />);

    const input = screen.getByRole('textbox');
    await user.type(input, '{enter}');

    expect(onSave).toHaveBeenCalled();
  });

  it('désactive le bouton et affiche "..." quand isPending est vrai', () => {
    render(<SubcategoryEditor {...defaultProps} isPending={true} />);

    const submitBtn = screen.getByRole('button', { name: '...' });
    expect(submitBtn).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'OK' })).not.toBeInTheDocument();
  });

  it('appelle onCancel lors du clic sur le bouton Annuler', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<SubcategoryEditor {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('désactive le bouton de soumission si le champ est vide ou ne contient que des espaces', async () => {
    const user = userEvent.setup();
    render(<SubcategoryEditor {...defaultProps} />);

    const input = screen.getByRole('textbox');
    const submitBtn = screen.getByRole('button', { name: 'OK' });

    await user.clear(input);
    expect(submitBtn).toBeDisabled();

    await user.type(input, '   ');
    expect(submitBtn).toBeDisabled();
  });

  it('donne le focus automatiquement au champ de texte au montage', () => {
    render(<SubcategoryEditor {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });
});
