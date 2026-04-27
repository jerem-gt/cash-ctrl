import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmojiClickData } from 'emoji-picker-react';
import { describe, expect, it, vi } from 'vitest';

import { CategoryEditor } from './CategoryEditor';

vi.mock('emoji-picker-react', () => ({
  default: ({
    onEmojiClick,
  }: {
    onEmojiClick: (emojiData: EmojiClickData, event: MouseEvent) => void;
  }) => (
    <button onClick={() => onEmojiClick({ emoji: '🚀' } as EmojiClickData, {} as MouseEvent)}>
      Mock Picker Click
    </button>
  ),
  Categories: {},
}));

describe('CategoryEditor', () => {
  const defaultProps = {
    initialValues: { name: 'Courses', color: '#ff0000', icon: '🛒' },
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isPending: false,
    submitLabel: 'OK',
  };

  it('affiche les valeurs initiales correctement', () => {
    render(<CategoryEditor {...defaultProps} />);

    expect(screen.getByPlaceholderText(/nom de la catégorie/i)).toHaveValue('Courses');
    expect(screen.getByRole('button', { name: '🛒' })).toBeInTheDocument();
  });

  it('appelle onSave avec les données modifiées lors du clic sur OK', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CategoryEditor {...defaultProps} onSave={onSave} />);

    const input = screen.getByPlaceholderText(/nom de la catégorie/i);
    await user.clear(input);
    await user.type(input, 'Supermarché');

    await user.click(screen.getByRole('button', { name: 'OK' }));

    expect(onSave).toHaveBeenCalledWith({
      name: 'Supermarché',
      color: '#ff0000',
      icon: '🛒',
    });
  });

  it("ouvre le sélecteur d'emoji au clic sur l'icône", async () => {
    const user = userEvent.setup();
    render(<CategoryEditor {...defaultProps} />);

    const emojiBtn = screen.getByRole('button', { name: '🛒' });
    await user.click(emojiBtn);

    // Vérifie le fallback du Suspense ou le picker
    expect(screen.getByText(/chargement.../i) || screen.getByRole('textbox')).toBeInTheDocument();
  });

  it("ferme le picker d'emoji avec la touche Échap", async () => {
    const user = userEvent.setup();
    render(<CategoryEditor {...defaultProps} />);

    // Ouvrir
    await user.click(screen.getByRole('button', { name: '🛒' }));

    // Simuler Échap
    fireEvent.keyDown(window, { key: 'Escape' });

    // Le picker ne devrait plus être visible (il faut attendre la fin de l'effet)
    await waitFor(() => {
      expect(screen.queryByText(/chargement.../i)).not.toBeInTheDocument();
    });
  });

  it('affiche un état de chargement sur le bouton lors de isPending', () => {
    render(<CategoryEditor {...defaultProps} isPending={true} />);

    const submitBtn = screen.getByRole('button', { name: '...' });
    expect(submitBtn).toBeDisabled();
  });

  it('appelle onCancel lors du clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CategoryEditor {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("soumet le formulaire lors de l'appui sur Enter dans le champ texte", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CategoryEditor {...defaultProps} onSave={onSave} />);

    const input = screen.getByPlaceholderText(/nom de la catégorie/i);
    await user.type(input, '{enter}');

    expect(onSave).toHaveBeenCalled();
  });

  it('met à jour l icon quand on clique sur un emoji', async () => {
    const user = userEvent.setup();
    render(<CategoryEditor {...defaultProps} />);

    // Ouvre le picker
    await user.click(screen.getByRole('button', { name: '🛒' }));

    // Clique sur l'emoji dans notre mock
    await user.click(screen.getByText('Mock Picker Click'));

    // Vérifie que le bouton de prévisualisation a changé
    expect(screen.getByRole('button', { name: '🚀' })).toBeInTheDocument();
  });
});
