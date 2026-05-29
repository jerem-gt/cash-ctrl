import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

import { SystemRefsManager } from './SystemRefsManager';

describe('SystemRefsManager', () => {
  it('affiche les 6 selects après chargement', async () => {
    renderWithProviders(<SystemRefsManager />);
    expect(await screen.findByLabelText('Catégorie revenus financiers')).toBeInTheDocument();
    expect(screen.getByLabelText('Sous-catégorie transfert')).toBeInTheDocument();
    expect(screen.getByLabelText('Moyen de paiement transfert')).toBeInTheDocument();
    expect(screen.getByLabelText('Sous-catégorie frais bancaires')).toBeInTheDocument();
    expect(screen.getByLabelText('Sous-catégorie prélèvements sociaux')).toBeInTheDocument();
    expect(screen.getByLabelText('Moyen de paiement prélèvement')).toBeInTheDocument();
  });

  it('affiche les catégories dans le select catégorie revenus financiers', async () => {
    renderWithProviders(<SystemRefsManager />);
    const select = await screen.findByLabelText('Catégorie revenus financiers');
    expect(select).toBeInTheDocument();
    // L'option catégorie est "🍴 Alimentation" (sans sous-catégorie)
    const options = select.querySelectorAll('option');
    const labels = Array.from(options).map((o) => o.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('Alimentation') && !l.includes('›'))).toBe(true);
  });

  it('affiche les sous-catégories dans le select sous-catégorie transfert', async () => {
    renderWithProviders(<SystemRefsManager />);
    const select = await screen.findByLabelText('Sous-catégorie transfert');
    const options = select.querySelectorAll('option');
    const labels = Array.from(options).map((o) => o.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('Supermarché'))).toBe(true);
  });

  it('affiche les moyens de paiement dans le select moyen de paiement transfert', async () => {
    renderWithProviders(<SystemRefsManager />);
    const select = await screen.findByLabelText('Moyen de paiement transfert');
    const options = select.querySelectorAll('option');
    const labels = Array.from(options).map((o) => o.textContent?.trim() ?? '');
    expect(labels.some((l) => l.includes('CB'))).toBe(true);
  });

  it('appelle la mutation et affiche un toast de succès au changement', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SystemRefsManager />);
    const select = await screen.findByLabelText('Catégorie revenus financiers');
    await user.selectOptions(select, '1');
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mise à jour'),
    );
  });

  it("affiche un toast d'erreur si la mutation échoue", async () => {
    server.use(
      http.patch('/api/settings/system-refs', () =>
        HttpResponse.json({ error: 'Erreur système' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SystemRefsManager />);
    const select = await screen.findByLabelText('Catégorie revenus financiers');
    await user.selectOptions(select, '1');
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Erreur système'),
    );
  });
});
