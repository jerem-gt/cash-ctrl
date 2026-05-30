import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { PerFiscalSimulatorModal } from '@/features/insurance/components/PerFiscalSimulatorModal';
import { TAX_YEAR_DATA_2025 } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

function renderModal(onClose = vi.fn()) {
  return renderWithProviders(<PerFiscalSimulatorModal onClose={onClose} />);
}

async function waitForYearData() {
  // Attend que le barème soit chargé — abattement_min 2026 (barème par défaut en 2026)
  await waitFor(() => expect(screen.getByText(/509/)).toBeInTheDocument(), { timeout: 3000 });
}

async function fillAndCompute(revenu: string, versement: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText(/revenu brut annuel/i));
  await user.type(screen.getByLabelText(/revenu brut annuel/i), revenu);
  await user.clear(screen.getByLabelText(/versement per prévu/i));
  await user.type(screen.getByLabelText(/versement per prévu/i), versement);
  return user;
}

describe('PerFiscalSimulatorModal', () => {
  it('affiche le titre et le formulaire', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    expect(screen.getByLabelText(/revenu brut annuel/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/versement per prévu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre de parts/i)).toBeInTheDocument();
  });

  it("affiche le sélecteur d'année avec les années disponibles", async () => {
    renderModal();
    await waitFor(() => expect(screen.getByRole('option', { name: '2026' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: '2025' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2024' })).toBeInTheDocument();
  });

  it("n'affiche pas les résultats tant que les champs sont vides", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    expect(screen.queryByText(/IR total/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Économie d'impôt")).not.toBeInTheDocument();
  });

  it("affiche les résultats après saisie d'un revenu et d'un versement", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('50000', '4000');
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    expect(screen.getByText('Sans versement PER')).toBeInTheDocument();
    expect(screen.getByText('Avec versement PER')).toBeInTheDocument();
  });

  it("affiche les détails des tranches d'imposition", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('55000', '3000');
    await waitFor(() => expect(screen.getAllByText(/Tranche/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Tranche 11%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tranche 30%/i).length).toBeGreaterThan(0);
  });

  it('affiche un avertissement si le versement dépasse le plafond PER', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('50000', '15000');
    await waitFor(() =>
      expect(screen.getByText(/dépasse le plafond déductible/i)).toBeInTheDocument(),
    );
  });

  it("n'affiche pas l'avertissement plafond si le versement est dans les limites", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('50000', '2000');
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    expect(screen.queryByText(/dépasse le plafond déductible/i)).not.toBeInTheDocument();
  });

  it('passe en mode frais réels au clic sur le radio', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    const radio = screen.getByRole('radio', { name: /frais réels/i });
    await user.click(radio);
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/montant frais réels/i)).toBeInTheDocument(),
    );
  });

  it('utilise les frais réels dans le calcul', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('50000', '3000');
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    await user.click(screen.getByRole('radio', { name: /frais réels/i }));
    const fraisInput = await screen.findByPlaceholderText(/montant frais réels/i);
    await user.clear(fraisInput);
    await user.type(fraisInput, '12000');
    await waitFor(() => {
      const columns = screen.getAllByText(/Revenu imposable/i);
      expect(columns.length).toBeGreaterThan(0);
    });
  });

  it('ferme la modale au clic sur le bouton Fermer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(onClose);
    await screen.findByText('Simulateur fiscal PER');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('ferme au clic sur le bouton Fermer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(onClose);
    await screen.findByText('Simulateur fiscal PER');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche le disclaimer sur l'impôt différé", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('55000', '4000');
    await waitFor(() => expect(screen.getByText(/sortie du PER/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("l'économie est 0€ si versement est 0", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await fillAndCompute('50000', '0');
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it('affiche les abattements min/max du barème sélectionné', async () => {
    renderModal();
    await waitForYearData();
    // abattement_max 2026 = 14 555€
    expect(screen.getByText(/14.*555/)).toBeInTheDocument();
  });

  it('ignore le plafond PER si la case est décochée', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    // Revenu 50 000€ → plafond ~4 500€, versement 15 000€ → dépasse normalement
    await fillAndCompute('50000', '15000');
    await waitFor(() =>
      expect(screen.getByText(/dépasse le plafond déductible/i)).toBeInTheDocument(),
    );
    // Décocher la case plafond
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() =>
      expect(screen.queryByText(/dépasse le plafond déductible/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/report des années précédentes/i)).toBeInTheDocument();
  });

  it('affiche un message de chargement si les barèmes ne sont pas disponibles', async () => {
    server.use(
      http.get('/api/tax/years', () => HttpResponse.json([2025])),
      http.get('/api/tax/:year', async () => {
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json(TAX_YEAR_DATA_2025);
      }),
    );
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    expect(screen.getByLabelText(/revenu brut annuel/i)).toBeInTheDocument();
  });
});
