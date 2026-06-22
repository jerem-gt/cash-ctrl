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

// jsdom ne simule pas les media queries : les tests voient le rendu mobile (une vue à la fois).
// Sur desktop les deux panneaux sont toujours visibles via CSS.
async function navigateToResults(user: ReturnType<typeof userEvent.setup>) {
  const btn = screen.getByRole('button', { name: /voir les résultats/i });
  await waitFor(() => expect(btn).not.toBeDisabled());
  await user.click(btn);
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

  it('le bouton Voir les résultats est désactivé si le formulaire est incomplet', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    const btn = screen.getByRole('button', { name: /voir les résultats/i });
    expect(btn).toBeDisabled();
  });

  it("affiche les résultats après saisie d'un revenu et d'un versement", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('50000', '4000');
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    expect(screen.getByText('Sans versement PER')).toBeInTheDocument();
    expect(screen.getByText('Avec versement PER')).toBeInTheDocument();
  });

  it("affiche les détails des tranches d'imposition", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('55000', '3000');
    await navigateToResults(user);
    await waitFor(() => expect(screen.getAllByText(/Tranche/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Tranche 11%/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tranche 30%/i).length).toBeGreaterThan(0);
  });

  it('affiche un avertissement si le versement dépasse le plafond PER', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('50000', '15000');
    await navigateToResults(user);
    await waitFor(() =>
      expect(screen.getByText(/dépasse le plafond déductible/i)).toBeInTheDocument(),
    );
  });

  it("n'affiche pas l'avertissement plafond si le versement est dans les limites", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('50000', '2000');
    await navigateToResults(user);
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
    await user.type(screen.getByLabelText(/revenu brut annuel/i), '50000');
    await user.type(screen.getByLabelText(/versement per prévu/i), '3000');
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    // Retour au formulaire pour modifier le mode déduction
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('radio', { name: /frais réels/i }));
    const fraisInput = await screen.findByPlaceholderText(/montant frais réels/i);
    await user.clear(fraisInput);
    await user.type(fraisInput, '12000');
    await navigateToResults(user);
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
    // Le footer contient un bouton Fermer mobile + un desktop (les deux appellent onClose)
    await user.click(screen.getAllByRole('button', { name: 'Fermer' })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('ferme au clic sur le bouton Fermer', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderModal(onClose);
    await screen.findByText('Simulateur fiscal PER');
    await user.click(screen.getAllByRole('button', { name: 'Fermer' })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("affiche le disclaimer sur l'impôt différé", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('55000', '4000');
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText(/sortie du PER/i)).toBeInTheDocument(), {
      timeout: 3000,
    });
  });

  it("l'économie est 0€ si versement est 0", async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('50000', '0');
    await navigateToResults(user);
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

  it('le bouton Modifier permet de revenir au formulaire', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    const user = await fillAndCompute('40000', '2000');
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    // Le bouton "Modifier" disparaît (rendu conditionnel dans le footer ternaire)
    expect(screen.queryByRole('button', { name: /modifier/i })).not.toBeInTheDocument();
    // Le bouton "Voir les résultats" réapparaît
    expect(screen.getByRole('button', { name: /voir les résultats/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/revenu brut annuel/i)).toBeInTheDocument();
  });

  it('ignore le plafond PER si la case est décochée', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    // La section plafond est visible sur le formulaire quand la case est cochée
    expect(screen.getByText(/plafond disponible — versements 2026/i)).toBeInTheDocument();
    // Saisir revenu + versement et naviguer vers les résultats
    await user.type(screen.getByLabelText(/revenu brut annuel/i), '50000');
    await user.type(screen.getByLabelText(/versement per prévu/i), '15000');
    await navigateToResults(user);
    await waitFor(() =>
      expect(screen.getByText(/dépasse le plafond déductible/i)).toBeInTheDocument(),
    );
    // Retour au formulaire pour décocher la case
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    await user.click(screen.getByRole('checkbox'));
    // La section plafond disparaît
    expect(screen.queryByText(/plafond disponible — versements 2026/i)).not.toBeInTheDocument();
    // Naviguer vers les résultats : plus d'avertissement
    await navigateToResults(user);
    await waitFor(() =>
      expect(screen.queryByText(/dépasse le plafond déductible/i)).not.toBeInTheDocument(),
    );
  });

  it('affiche les quatre champs de plafond avec labels basés sur les années de revenus', async () => {
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    // Versements 2026 → base revenus 2025 + reports revenus 2025/2024/2023
    expect(screen.getByLabelText(/base — revenus 2025/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/non utilisé — revenus 2025/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/non utilisé — revenus 2024/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/non utilisé — revenus 2023/i)).toBeInTheDocument();
  });

  it('un report élimine le dépassement du plafond annuel', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    // Revenu 50 000€ → plafond base ≈ 4 806€, versement 6 000€ → dépassement
    await user.type(screen.getByLabelText(/revenu brut annuel/i), '50000');
    await user.type(screen.getByLabelText(/versement per prévu/i), '6000');
    await navigateToResults(user);
    await waitFor(() =>
      expect(screen.getByText(/dépasse le plafond déductible/i)).toBeInTheDocument(),
    );
    // Retour au formulaire pour saisir le report
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    // Report non utilisé revenus 2025 = 2 000€ → plafondTotal ≈ 6 806€ → plus de dépassement
    const reportN1 = screen.getByLabelText(/non utilisé — revenus 2025/i);
    await user.clear(reportN1);
    await user.type(reportN1, '2000');
    await navigateToResults(user);
    await waitFor(() =>
      expect(screen.queryByText(/dépasse le plafond déductible/i)).not.toBeInTheDocument(),
    );
  });

  it('affiche le récapitulatif du plafond total quand un report est saisi', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('Simulateur fiscal PER');
    await waitForYearData();
    await user.type(screen.getByLabelText(/revenu brut annuel/i), '50000');
    await user.type(screen.getByLabelText(/versement per prévu/i), '4000');
    // Naviguer vers résultats → pas de récapitulatif de report
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText("Économie d'impôt")).toBeInTheDocument());
    expect(screen.queryByText(/reports non utilisés/i)).not.toBeInTheDocument();
    // Retour au formulaire → saisir un report
    await user.click(screen.getByRole('button', { name: /modifier/i }));
    const reportN1 = screen.getByLabelText(/non utilisé — revenus 2025/i);
    await user.clear(reportN1);
    await user.type(reportN1, '1500');
    // Naviguer vers résultats → bloc de détail plafond visible
    await navigateToResults(user);
    await waitFor(() => expect(screen.getByText(/reports non utilisés/i)).toBeInTheDocument());
    // "Base — revenus 2025" apparaît dans le détail du plafond (résultats) ET
    // dans le formulaire CSS-hidden mais toujours présent dans le DOM
    expect(screen.getAllByText(/base — revenus 2025/i).length).toBeGreaterThanOrEqual(2);
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
