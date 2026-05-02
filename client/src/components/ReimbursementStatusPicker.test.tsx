import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReimbursementStatusPicker } from './ReimbursementStatusPicker';

describe('ReimbursementStatusPicker', () => {
  const mockOnChange = vi.fn();

  it('affiche uniquement le bouton "Activer" quand le statut est null', () => {
    render(<ReimbursementStatusPicker status={null} onChange={mockOnChange} />);

    expect(screen.getByText('Suivi remboursement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activer' })).toBeInTheDocument();

    // Les boutons de statut ne doivent pas être rendus
    expect(screen.queryByText('En attente')).not.toBeInTheDocument();
    expect(screen.queryByText('Remboursement terminé')).not.toBeInTheDocument();
  });

  it('affiche le bouton "⚕ Actif" et les sélecteurs de statut quand le suivi est activé', () => {
    render(<ReimbursementStatusPicker status="en_attente" onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: /actif/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'En attente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remboursement terminé' })).toBeInTheDocument();
  });

  it('appelle onChange avec "en_attente" lors du clic sur "Activer"', async () => {
    const user = userEvent.setup();
    render(<ReimbursementStatusPicker status={null} onChange={mockOnChange} />);

    await user.click(screen.getByRole('button', { name: 'Activer' }));
    expect(mockOnChange).toHaveBeenCalledWith('en_attente');
  });

  it('appelle onChange avec null lors du clic sur "⚕ Actif" (désactivation)', async () => {
    const user = userEvent.setup();
    render(<ReimbursementStatusPicker status="rembourse" onChange={mockOnChange} />);

    await user.click(screen.getByRole('button', { name: /actif/i }));
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it('appelle onChange avec "rembourse" lors du clic sur le bouton correspondant', async () => {
    const user = userEvent.setup();
    render(<ReimbursementStatusPicker status="en_attente" onChange={mockOnChange} />);

    await user.click(screen.getByRole('button', { name: 'Remboursement terminé' }));
    expect(mockOnChange).toHaveBeenCalledWith('rembourse');
  });

  it('applique les classes de style actives selon le statut (ex: en_attente)', () => {
    render(<ReimbursementStatusPicker status="en_attente" onChange={mockOnChange} />);

    const btnEnAttente = screen.getByRole('button', { name: 'En attente' });
    const btnTermine = screen.getByRole('button', { name: 'Remboursement terminé' });

    // Vérification des classes Tailwind spécifiques au statut actif
    expect(btnEnAttente).toHaveClass('bg-amber-50');
    expect(btnTermine).toHaveClass('bg-stone-50'); // Style inactif
  });

  it('couvre la branche "false" de la ligne 31 (status est null)', () => {
    // Quand status est null, le bloc après && ne doit pas être exécuté
    render(<ReimbursementStatusPicker status={null} onChange={mockOnChange} />);

    // On vérifie qu'un élément à l'intérieur de ce bloc n'existe pas
    expect(screen.queryByRole('button', { name: 'En attente' })).not.toBeInTheDocument();
  });

  it('Affichage des boutons de changement de status (status !== null)', () => {
    // Quand status n'est pas null, le bloc après && est exécuté
    render(<ReimbursementStatusPicker status="en_attente" onChange={mockOnChange} />);

    // On vérifie que le bloc est bien rendu
    expect(screen.getByRole('button', { name: 'En attente' })).toBeInTheDocument();
  });

  it('couvre les fonctions de rappel à l intérieur du bloc conditionnel', async () => {
    const user = userEvent.setup();
    // On doit être dans l'état "actif" pour accéder aux boutons de changement de status
    render(<ReimbursementStatusPicker status="en_attente" onChange={mockOnChange} />);

    // Clic sur "En attente"
    await user.click(screen.getByRole('button', { name: 'En attente' }));
    expect(mockOnChange).toHaveBeenCalledWith('en_attente');

    // Clic sur "Remboursement terminé"
    await user.click(screen.getByRole('button', { name: 'Remboursement terminé' }));
    expect(mockOnChange).toHaveBeenCalledWith('rembourse');
  });
});
