import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ACCOUNTS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';
import type { Account } from '@/types';

import { CloseAccountModal } from './CloseAccountModal';

const accountZero: Account = { ...ACCOUNTS[0], id: 1, balance: 0 };
const accountPositive: Account = { ...ACCOUNTS[0], id: 1, balance: 500 };
const accountNegative: Account = { ...ACCOUNTS[0], id: 1, balance: -300 };
const otherAccount: Account = { ...ACCOUNTS[1], id: 2 };

describe('CloseAccountModal — solde nul', () => {
  it('affiche le message solde nul et pas de sélecteur de compte', () => {
    renderWithProviders(
      <CloseAccountModal
        account={accountZero}
        activeAccounts={[accountZero, otherAccount]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/solde est nul/i)).toBeInTheDocument();
    expect(screen.queryByText(/virer le solde/i)).not.toBeInTheDocument();
  });

  it('appelle onClose et affiche le toast après clôture réussie', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CloseAccountModal
        account={accountZero}
        activeAccounts={[accountZero, otherAccount]}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: /clôturer/i }));
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toMatch(/clôturé/i);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('appelle onClose au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CloseAccountModal account={accountZero} activeAccounts={[]} onClose={onClose} />,
    );
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CloseAccountModal — solde positif', () => {
  it('affiche le solde et le sélecteur de compte de destination', () => {
    renderWithProviders(
      <CloseAccountModal
        account={accountPositive}
        activeAccounts={[accountPositive, otherAccount]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/virer le solde/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('exclut le compte clôturé lui-même de la liste des destinations', () => {
    renderWithProviders(
      <CloseAccountModal
        account={accountPositive}
        activeAccounts={[accountPositive, otherAccount]}
        onClose={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    expect(select).not.toHaveTextContent(accountPositive.name);
    expect(select).toHaveTextContent(otherAccount.name);
  });

  it("affiche un toast d'erreur si aucun compte de destination n'est sélectionné", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <CloseAccountModal
        account={accountPositive}
        activeAccounts={[accountPositive, otherAccount]}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: /clôturer/i }));
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toMatch(/choisissez/i);
    });
  });

  it('clôture avec virement après sélection du compte cible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CloseAccountModal
        account={accountPositive}
        activeAccounts={[accountPositive, otherAccount]}
        onClose={onClose}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox'), String(otherAccount.id));
    await user.click(screen.getByRole('button', { name: /clôturer/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('CloseAccountModal — solde négatif', () => {
  it('affiche le solde négatif et le sélecteur', () => {
    renderWithProviders(
      <CloseAccountModal
        account={accountNegative}
        activeAccounts={[accountNegative, otherAccount]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/-300/)).toBeInTheDocument();
    expect(screen.getByText(/virer le solde/i)).toBeInTheDocument();
  });
});

describe('CloseAccountModal — erreur API', () => {
  it("affiche le message d'erreur de l'API", async () => {
    server.use(
      http.post('/api/accounts/:id/close', () =>
        HttpResponse.json({ error: 'Clôture impossible' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(
      <CloseAccountModal account={accountZero} activeAccounts={[]} onClose={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: /clôturer/i }));
    await waitFor(() => {
      expect(document.getElementById('toast')?.textContent).toMatch(/clôture impossible/i);
    });
  });
});
