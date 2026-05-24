import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SettingsCard } from './SettingsCard';

const baseProps = {
  title: 'Ma carte',
  icon: '🧪',
  editContent: (close: () => void) => (
    <>
      <input aria-label="Nom édition" defaultValue="test" />
      <button onClick={close}>Fermer</button>
    </>
  ),
};

describe('SettingsCard', () => {
  describe('mode lecture', () => {
    it('affiche le titre avec role article', () => {
      render(<SettingsCard {...baseProps} />);
      expect(screen.getByRole('article', { name: 'Ma carte' })).toBeInTheDocument();
      expect(screen.getByText('Ma carte')).toBeInTheDocument();
    });

    it("affiche l'icône", () => {
      render(<SettingsCard {...baseProps} />);
      expect(screen.getByText('🧪')).toBeInTheDocument();
    });

    it('affiche le subtitle quand fourni', () => {
      render(<SettingsCard {...baseProps} subtitle={<span>Mon sous-titre</span>} />);
      expect(screen.getByText('Mon sous-titre')).toBeInTheDocument();
    });

    it('affiche le badge quand fourni', () => {
      render(<SettingsCard {...baseProps} badge={<span>42</span>} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('affiche le leading quand fourni', () => {
      render(<SettingsCard {...baseProps} leading={<span>Poignée</span>} />);
      expect(screen.getByText('Poignée')).toBeInTheDocument();
    });

    it('affiche les boutons Modifier et Supprimer par défaut', () => {
      const onDelete = vi.fn();
      render(<SettingsCard {...baseProps} onDelete={onDelete} />);
      expect(screen.getByRole('button', { name: /Modifier/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Supprimer/i })).toBeInTheDocument();
    });

    it("n'affiche pas Supprimer si canDelete=false", () => {
      render(<SettingsCard {...baseProps} canDelete={false} onDelete={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /Supprimer/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Modifier/i })).toBeInTheDocument();
    });

    it("n'affiche pas Supprimer si onDelete absent", () => {
      render(<SettingsCard {...baseProps} />);
      expect(screen.queryByRole('button', { name: /Supprimer/i })).not.toBeInTheDocument();
    });

    it('appelle onDelete au clic sur Supprimer', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<SettingsCard {...baseProps} onDelete={onDelete} />);
      await user.click(screen.getByRole('button', { name: /Supprimer/i }));
      expect(onDelete).toHaveBeenCalledOnce();
    });
  });

  describe('mode édition', () => {
    it('bascule en mode édition au clic sur Modifier', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /Modifier/i }));
      expect(screen.getByLabelText('Nom édition')).toBeInTheDocument();
    });

    it('masque les boutons Modifier et Supprimer en mode édition', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...baseProps} onDelete={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: /Modifier/i }));
      expect(screen.queryByRole('button', { name: /Modifier/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Supprimer/i })).not.toBeInTheDocument();
    });

    it('close() retourne en mode lecture', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...baseProps} />);
      await user.click(screen.getByRole('button', { name: /Modifier/i }));
      await user.click(screen.getByRole('button', { name: /Fermer/i }));
      expect(screen.getByRole('button', { name: /Modifier/i })).toBeInTheDocument();
      expect(screen.queryByLabelText('Nom édition')).not.toBeInTheDocument();
    });
  });

  describe('contenu collapsible', () => {
    const collapsibleProps = {
      ...baseProps,
      collapsibleContent: <button>Contenu caché</button>,
    };

    it('masque le contenu collapsible par défaut', () => {
      render(<SettingsCard {...collapsibleProps} />);
      expect(screen.queryByRole('button', { name: /Contenu caché/i })).not.toBeInTheDocument();
    });

    it('affiche un bouton expand avec aria-expanded=false par défaut', () => {
      render(<SettingsCard {...collapsibleProps} />);
      expect(screen.getByRole('button', { name: 'Ma carte' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('affiche le contenu au clic sur le trigger', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...collapsibleProps} />);
      await user.click(screen.getByRole('button', { name: 'Ma carte' }));
      expect(screen.getByRole('button', { name: /Contenu caché/i })).toBeInTheDocument();
    });

    it('passe aria-expanded à true après le clic', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...collapsibleProps} />);
      const trigger = screen.getByRole('button', { name: 'Ma carte' });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('masque de nouveau le contenu au second clic', async () => {
      const user = userEvent.setup();
      render(<SettingsCard {...collapsibleProps} />);
      const trigger = screen.getByRole('button', { name: 'Ma carte' });
      await user.click(trigger);
      await user.click(trigger);
      expect(screen.queryByRole('button', { name: /Contenu caché/i })).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it("n'affiche pas de trigger expand sans collapsibleContent", () => {
      render(<SettingsCard {...baseProps} />);
      expect(screen.queryByRole('button', { name: 'Ma carte' })).not.toBeInTheDocument();
    });
  });
});
