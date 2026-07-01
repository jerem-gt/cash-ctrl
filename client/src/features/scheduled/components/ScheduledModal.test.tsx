import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduledModal } from '@/features/scheduled/components/ScheduledModal';
import { emptyForm, schedToForm } from '@/features/scheduled/lib/form';
import { ACCOUNTS, CATEGORIES, PAYMENT_METHODS, SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

const logoMap: Record<string, string | null> = { BNP: null, LCL: null, Suravenir: null };

const baseProps = {
  accounts: ACCOUNTS,
  logoMap,
  categories: CATEGORIES,
  paymentMethods: PAYMENT_METHODS,
  isPending: false,
};

function renderCreate(overrides?: Partial<Parameters<typeof ScheduledModal>[0]>) {
  return renderWithProviders(
    <ScheduledModal
      {...baseProps}
      initial={emptyForm()}
      title="Nouvelle planification"
      onSave={overrides?.onSave ?? vi.fn()}
      onCancel={overrides?.onCancel ?? vi.fn()}
      {...overrides}
    />,
  );
}

function renderEdit(overrides?: Partial<Parameters<typeof ScheduledModal>[0]>) {
  return renderWithProviders(
    <ScheduledModal
      {...baseProps}
      initial={schedToForm(SCHEDULED[0])}
      title="Modifier la planification"
      onSave={overrides?.onSave ?? vi.fn()}
      onCancel={overrides?.onCancel ?? vi.fn()}
      {...overrides}
    />,
  );
}

describe('ScheduledModal — création', () => {
  it('affiche le titre', () => {
    renderCreate();
    expect(screen.getByText('Nouvelle planification')).toBeInTheDocument();
  });

  it('affiche les onglets Transaction, Transfert et Versement AV/PER', () => {
    renderCreate();
    expect(screen.getByRole('button', { name: 'Transaction' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transfert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Versement AV/PER' })).toBeInTheDocument();
  });

  it('passe en mode Transfert au clic', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    expect(screen.getByText('Compte destination')).toBeInTheDocument();
  });

  it('passe en mode Versement AV/PER au clic', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));
    expect(screen.getByText('Compte AV / PER')).toBeInTheDocument();
  });

  it('toast si les champs obligatoires sont manquants', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('obligatoires'),
    );
  });

  it('toast si pas de compte sélectionné en mode transaction', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Test');
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('obligatoires'),
    );
  });

  it('toast si sous-catégorie ou moyen de paiement manquants en mode transaction', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Test');
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    // Compte choisi, mais ni catégorie ni moyen de paiement
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('obligatoires'),
    );
  });

  it('toast si les comptes transfert sont manquants', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Transfert' }));
    await user.type(screen.getByPlaceholderText(/→/), 'Virement test');
    await user.type(screen.getByPlaceholderText('0,00'), '50');
    fireEvent.submit(screen.getByPlaceholderText('0,00').closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toMatch(/source|destination|compte/i),
    );
  });

  it('toast si les champs versement sont manquants', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));
    // 2 champs "0,00" en mode versement (montant + frais) — prendre le premier
    const amountInputs = screen.getAllByPlaceholderText('0,00');
    await user.type(amountInputs[0], '50');
    await user.type(screen.getByPlaceholderText('Auto-généré à la sélection du support'), 'Test');
    fireEvent.submit(amountInputs[0].closest('form')!);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toMatch(/AV\/PER|support|source/i),
    );
  });

  it('sélectionne un compte AV et un compte source en mode Versement', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: 'Versement AV/PER' }));

    await user.click(document.getElementById('versement-av-account')!);
    await user.click(await screen.findByRole('option', { name: /Suravenir/i }));

    await user.click(document.getElementById('versement-source-account')!);
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));

    const allAmounts = screen.getAllByPlaceholderText('0,00');
    await user.type(allAmounts[1], '5'); // frais
    expect(allAmounts[1]).toBeInTheDocument();
  });

  it('appelle onSave avec les valeurs du formulaire en mode transaction', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderCreate({ onSave });

    await user.type(screen.getByPlaceholderText('Ex : Courses Leclerc'), 'Abonnement Netflix');
    await user.type(screen.getByPlaceholderText('0,00'), '15');
    await user.click(screen.getByRole('button', { name: /choisir/i }));
    await user.click(await screen.findByRole('option', { name: /Compte test/i }));
    await user.selectOptions(document.getElementById('category-select')!, String(CATEGORIES[0].id));
    await user.selectOptions(
      document.getElementById('subcategory-select')!,
      String(CATEGORIES[0].subcategories[0].id),
    );
    await user.selectOptions(
      document.getElementById('payment-method-select')!,
      String(PAYMENT_METHODS[0].id),
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0][0]).toMatchObject({
      mode: 'transaction',
      description: 'Abonnement Netflix',
      amount: '15',
      account_id: '1',
    });
  });

  it('appelle onCancel au clic sur Annuler', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderCreate({ onCancel });
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('ScheduledModal — édition', () => {
  it('pré-remplit avec les données de la planification existante', () => {
    renderEdit();
    expect(screen.getByText('Modifier la planification')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Loyer')).toBeInTheDocument();
  });

  it('modifie des champs et annule', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderEdit({ onCancel });
    await user.type(screen.getByPlaceholderText('Informations complémentaires…'), 'Note test');
    await user.click(screen.getByLabelText('Décaler au vendredi'));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('toast si le montant est nul', async () => {
    renderEdit();
    const amountInput = screen.getByPlaceholderText('0,00');
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.submit(amountInput.closest('form')!);
    await waitFor(() => expect(document.getElementById('toast')?.textContent).toContain('positif'));
  });
});
