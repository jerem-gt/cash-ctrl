import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { InsuranceSection } from '@/components/InsuranceSection';
import { INSURANCE_POSITIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderSection(accountId = 10) {
  return renderWithProviders(<InsuranceSection accountId={accountId} />);
}

describe('InsuranceSection', () => {
  it('affiche les supports après chargement', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByText('Amundi MSCI World')).toBeInTheDocument();
  });

  it('affiche le badge Euro pour un fonds euro', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByText('Euro')).toBeInTheDocument();
  });

  it('affiche le badge UC pour une UC', async () => {
    renderSection();
    await screen.findByText('Amundi MSCI World');
    expect(screen.getByText('UC')).toBeInTheDocument();
  });

  it('affiche la valeur pour un support', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getAllByText(/5\s*000/).length).toBeGreaterThan(0);
  });

  it('affiche "Aucun support" quand portefeuille vide', async () => {
    server.use(http.get('/api/insurance/:accountId/positions', () => HttpResponse.json([])));
    renderSection();
    await waitFor(() =>
      expect(
        screen.getByText(/Aucun support — ajoutez un fonds euro ou une UC/i),
      ).toBeInTheDocument(),
    );
  });

  it("n'affiche pas le bouton Actualiser les VL", async () => {
    renderSection();
    await screen.findByText('Amundi MSCI World');
    expect(screen.queryByRole('button', { name: /actualiser les vl/i })).not.toBeInTheDocument();
  });

  it('affiche le bouton Revaloriser uniquement pour les UC', async () => {
    renderSection();
    await screen.findByText('Amundi MSCI World');
    expect(screen.getByRole('button', { name: /revaloriser/i })).toBeInTheDocument();
  });

  it('ouvre le modal Verser au clic sur Verser', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const versBtn = screen.getAllByRole('button', { name: /verser/i })[0];
    await user.click(versBtn);
    expect(screen.getByText(/Versement — Fonds Euro Sécurité/i)).toBeInTheDocument();
  });

  it('ouvre le modal Racheter au clic sur Racheter', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const rachatBtn = screen.getAllByRole('button', { name: /racheter/i })[0];
    await user.click(rachatBtn);
    expect(screen.getByText(/Rachat — Fonds Euro Sécurité/i)).toBeInTheDocument();
  });

  it('ouvre le modal Arbitrer au clic sur Arbitrer', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const arbitreBtn = screen.getAllByRole('button', { name: /arbitrer/i })[0];
    await user.click(arbitreBtn);
    expect(screen.getByText(/Arbitrage depuis/i)).toBeInTheDocument();
  });

  it('affiche le bouton Intérêts uniquement pour les fonds euro', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    expect(screen.getByRole('button', { name: /intérêts/i })).toBeInTheDocument();
  });

  it('ouvre le modal Revaloriser pour une UC', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('Amundi MSCI World');
    await user.click(screen.getByRole('button', { name: /revaloriser/i }));
    expect(screen.getByText(/Revalorisation — Amundi MSCI World/i)).toBeInTheDocument();
  });

  it('ouvre le modal Ajouter un support', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getByRole('button', { name: /\+ support/i }));
    expect(screen.getByText('Ajouter un support')).toBeInTheDocument();
  });

  it('affiche la ligne Total quand plusieurs supports', async () => {
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await screen.findByText('Amundi MSCI World');
    expect(screen.getByText('Total enveloppe')).toBeInTheDocument();
  });

  it('soumet le versement fonds euro et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getAllByRole('button', { name: /verser/i })[0]);
    await screen.findByText(/Versement — Fonds Euro Sécurité/i);
    const amountInput = screen.getByRole('spinbutton', { name: /montant versé/i });
    await user.clear(amountInput);
    await user.type(amountInput, '1000');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Versement enregistré'),
    );
  });

  it('soumet les intérêts fonds euro et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getByRole('button', { name: /intérêts/i }));
    await screen.findByText(/Intérêts — Fonds Euro Sécurité/i);
    const amountInput = screen.getByRole('spinbutton', { name: /montant des intérêts/i });
    await user.clear(amountInput);
    await user.type(amountInput, '150');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Intérêts enregistrés'),
    );
  });

  it('soumet le rachat fonds euro et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getAllByRole('button', { name: /racheter/i })[0]);
    await screen.findByText(/Rachat — Fonds Euro Sécurité/i);
    const amountInput = screen.getByRole('spinbutton', { name: /montant racheté/i });
    await user.clear(amountInput);
    await user.type(amountInput, '500');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Rachat enregistré'),
    );
  });

  it("soumet l'arbitrage et affiche un toast", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    await user.click(screen.getAllByRole('button', { name: /arbitrer/i })[0]);
    await screen.findByText(/Arbitrage depuis Fonds Euro Sécurité/i);
    await user.type(screen.getByRole('spinbutton', { name: /montant arbitré/i }), '1000');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Arbitrage enregistré'),
    );
  });

  it('soumet une revalorisation UC et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('Amundi MSCI World');
    await user.click(screen.getByRole('button', { name: /revaloriser/i }));
    await screen.findByText(/Revalorisation — Amundi MSCI World/i);
    await user.type(screen.getByRole('spinbutton', { name: /plus\/moins-value/i }), '150');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Revalorisation enregistrée'),
    );
  });

  it('supprime un support et affiche un toast', async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findAllByText('Fonds Euro Sécurité');
    const deleteButtons = screen.getAllByTitle('Supprimer le support');
    await user.click(deleteButtons[0]);
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Support supprimé'),
    );
  });

  it("n'affiche pas le bouton Intérêts pour les UC", async () => {
    server.use(
      http.get('/api/insurance/:accountId/positions', () =>
        HttpResponse.json([INSURANCE_POSITIONS[1]]),
      ),
    );
    renderSection();
    await screen.findByText('Amundi MSCI World');
    expect(screen.queryByRole('button', { name: /intérêts/i })).not.toBeInTheDocument();
  });
});
