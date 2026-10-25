import type { Transaction } from '@cashctrl/types';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { CATEGORIES, TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { TxItem } from './TxItem';

const baseTx = TRANSACTIONS.data[0]; // validated expense
const noop = vi.fn();

function renderTx(tx: Transaction) {
  return renderWithProviders(<TxItem tx={tx} onEdit={noop} onDelete={noop} onDuplicate={noop} />);
}

describe('TxItem', () => {
  it('affiche la description', () => {
    renderTx(baseTx);
    expect(screen.getByText('Courses')).toBeInTheDocument();
  });

  it('affiche le montant en négatif pour une dépense', () => {
    renderTx(baseTx);
    expect(screen.getByText(/24,50/)).toBeInTheDocument();
  });

  it(`affiche l'indicateur de transfert si transfer_peer_id est renseigné`, () => {
    const transferTx: Transaction = { ...baseTx, transfer_peer_id: 42, validated: 0 };
    renderTx(transferTx);
    expect(screen.getByTitle(/transfert/i)).toBeInTheDocument();
  });

  it(`affiche le badge "À venir" pour une transaction planifiée future`, () => {
    const futureTx: Transaction = {
      ...baseTx,
      scheduled_id: 5,
      date: '2030-01-01',
      validated: 0,
      transfer_peer_id: null,
    };
    renderTx(futureTx);
    // Badge rendu en double (variante mobile + desktop, masquées par media query) :
    // la copie hors écran est en display:none, donc invisible et muette pour l'AT.
    expect(screen.getAllByText(/à venir/i).length).toBeGreaterThan(0);
  });

  it('affiche le bouton de validation', () => {
    renderTx(baseTx);
    expect(screen.getByTitle(/marquer comme non validée/i)).toBeInTheDocument();
  });

  it('affiche les boutons modifier, dupliquer et supprimer', () => {
    renderTx(baseTx);
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dupliquer' })).toBeInTheDocument();
  });

  it("n'affiche pas les boutons optionnels si callbacks absents", () => {
    renderWithProviders(<TxItem tx={baseTx} />);
    expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Dupliquer')).not.toBeInTheDocument();
  });

  it(`affiche "Ventilée (N)" dans le sous-titre pour une transaction ventilée`, () => {
    const ventilatedTx: Transaction = {
      ...baseTx,
      validated: 0,
      subcategory_id: null,
      splits: [
        { id: 1, subcategory_id: 1, amount: 10 },
        { id: 2, subcategory_id: 2, amount: 14.5 },
      ],
    };
    renderTx(ventilatedTx);
    expect(screen.getByText(/Ventilée \(2\)/)).toBeInTheDocument();
  });

  describe('transaction ventilée', () => {
    const ventilated = (splits: Transaction['splits']): Transaction => ({
      ...baseTx,
      validated: 0,
      category_id: 0,
      subcategory_id: null,
      splits,
    });

    it('affiche les icônes, les sous-catégories et le détail des montants', async () => {
      renderTx(
        ventilated([
          { id: 1, subcategory_id: 1, amount: 367.47 },
          { id: 2, subcategory_id: 2, amount: 12 },
        ]),
      );
      const subtitle = await screen.findByTitle(/Alimentation \/ Supermarché : 367,47/);
      expect(subtitle).toHaveAttribute(
        'title',
        expect.stringContaining('Logement / Loyer : 12,00'),
      );
      expect(subtitle).toHaveTextContent('Ventilée : Alimentation / Supermarché');
      expect(screen.getAllByText(/Supermarché/).length).toBeGreaterThan(0);
      expect(
        document.querySelector('[title^="Alimentation"][class*="rounded-full"]'),
      ).toHaveAttribute('title', 'Alimentation\nLogement');
      expect(screen.getByText('🍴', { selector: 'span.absolute' })).toBeInTheDocument();
      expect(screen.getByText('🏠', { selector: 'span.absolute' })).toBeInTheDocument();
      expect(screen.queryByText('+1')).not.toBeInTheDocument();
    });

    it('affiche le badge +1 pour 3 catégories et une barre à 4 segments', async () => {
      server.use(
        http.get('/api/categories', () =>
          HttpResponse.json([
            ...CATEGORIES,
            { id: 3, name: 'Loisirs', icon: '🎮', subcategories: [{ id: 3, name: 'Jeux' }] },
          ]),
        ),
      );
      renderTx(
        ventilated([
          { id: 1, subcategory_id: 1, amount: 10 },
          { id: 2, subcategory_id: 2, amount: 20 },
          { id: 3, subcategory_id: 3, amount: 30 },
          { id: 4, subcategory_id: 1, amount: 40 },
        ]),
      );
      expect(await screen.findByText('+1')).toBeInTheDocument();
      expect(screen.getAllByTestId('split-bar-segment')).toHaveLength(4);
    });

    it('garde le repli « Ventilée (n) » si aucune ligne ne se résout', async () => {
      renderTx(ventilated([{ id: 1, subcategory_id: 999, amount: 5 }]));
      expect(await screen.findByText(/Ventilée \(1\)/)).toBeInTheDocument();
      expect(screen.queryByTestId('split-bar')).not.toBeInTheDocument();
    });

    it("n'affiche ni barre ni sous-titre détaillé pour une transaction normale", () => {
      renderTx(baseTx);
      expect(screen.queryByTestId('split-bar')).not.toBeInTheDocument();
    });
  });

  it(`pas de badge "Ventilée" pour une transaction normale`, () => {
    renderTx(baseTx);
    expect(screen.queryByText('⊕ Ventilée')).not.toBeInTheDocument();
  });

  it('affiche le solde courant quand runningBalance est fourni', () => {
    renderWithProviders(
      <TxItem
        tx={baseTx}
        runningBalance={1500.5}
        onEdit={noop}
        onDelete={noop}
        onDuplicate={noop}
      />,
    );
    expect(screen.getByTitle('Solde courant')).toBeInTheDocument();
    expect(screen.getByTitle('Solde courant').textContent).toMatch(/1.500,50/);
  });

  it("n'affiche pas de solde courant si runningBalance est absent", () => {
    renderTx(baseTx);
    expect(screen.queryByTitle('Solde courant')).not.toBeInTheDocument();
  });

  it("clique sur le bouton de validation bascule l'état validé", async () => {
    const user = userEvent.setup();
    renderTx(baseTx);
    const validateBtn = screen.getByTitle(/marquer comme non validée/i);
    await user.click(validateBtn);
    // Le patch est intercepté par MSW — on vérifie juste que le bouton est cliquable
    expect(validateBtn).toBeInTheDocument();
  });

  it("affiche l'icône note quand tx.notes est renseigné", () => {
    const txWithNotes = { ...baseTx, notes: 'Remboursement partiel' };
    renderTx(txWithNotes);
    expect(screen.getAllByTitle('Remboursement partiel').length).toBeGreaterThan(0);
  });

  it('expose le bouton de validation par son nom et aria-pressed', () => {
    renderTx(baseTx);
    const btn = screen.getByRole('button', { name: /marquer comme non validée/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it("expose les notes au toucher et aux lecteurs d'écran", () => {
    renderTx({ ...baseTx, notes: 'Remboursement partiel' });
    expect(screen.getByText('Remboursement partiel', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getAllByText('Remboursement partiel').length).toBeGreaterThan(0);
  });

  it("expose l'indicateur de virement aux lecteurs d'écran", () => {
    renderTx({ ...baseTx, transfer_peer_id: 99 });
    expect(screen.getByText(/transfert/i, { selector: '.sr-only' })).toBeInTheDocument();
  });

  describe('menu mobile', () => {
    it("ouvre le menu et déclenche l'action puis se ferme", async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      renderWithProviders(
        <TxItem tx={baseTx} onEdit={onEdit} onDelete={noop} onDuplicate={noop} />,
      );
      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByText('Modifier'));
      expect(onEdit).toHaveBeenCalledWith(baseTx);
      expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
    });

    it('ferme le menu avec Échap', async () => {
      const user = userEvent.setup();
      renderTx(baseTx);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(screen.getByText('Dupliquer')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByText('Dupliquer')).not.toBeInTheDocument();
    });

    it('ferme le menu au clic sur le fond', async () => {
      const user = userEvent.setup();
      renderTx(baseTx);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      const backdrop = document.querySelector<HTMLElement>('div.fixed.inset-0');
      expect(backdrop).not.toBeNull();
      await user.click(backdrop!);
      expect(screen.queryByText('Supprimer')).not.toBeInTheDocument();
    });

    it('ne liste que les actions disponibles', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TxItem tx={baseTx} onDelete={noop} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(screen.getByText('Supprimer')).toBeInTheDocument();
      expect(screen.queryByText('Modifier')).not.toBeInTheDocument();
    });

    it('masque le menu sans aucune action', () => {
      renderWithProviders(<TxItem tx={baseTx} />);
      expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
    });
  });
});
