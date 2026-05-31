import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { ScheduledTxModal } from '@/features/scheduled/components/ScheduledTxModal';
import { SCHEDULED } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';
import { server } from '@/tests/msw/server';

const sched = SCHEDULED[0];

describe('ScheduledTxModal', () => {
  it('affiche le titre et le sous-titre', async () => {
    renderWithProviders(<ScheduledTxModal sched={sched} onClose={vi.fn()} />);
    expect(screen.getByText(sched.description)).toBeInTheDocument();
    expect(await screen.findByText('Transactions liées à cette planification')).toBeInTheDocument();
  });

  it('affiche les transactions liées à cette planification', async () => {
    renderWithProviders(<ScheduledTxModal sched={sched} onClose={vi.fn()} />);
    // MSW retourne TRANSACTIONS qui contient "Courses"
    expect(await screen.findByText('Courses')).toBeInTheDocument();
  });

  it('affiche "Aucune transaction liée" quand la liste est vide', async () => {
    server.use(
      http.get('/api/transactions', () =>
        HttpResponse.json({ data: [], total: 0, page: 1, totalPages: 1 }),
      ),
    );
    renderWithProviders(<ScheduledTxModal sched={sched} onClose={vi.fn()} />);
    expect(await screen.findByText('Aucune transaction liée.')).toBeInTheDocument();
  });

  it('appelle onClose au clic sur Fermer', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ScheduledTxModal sched={sched} onClose={onClose} />);
    await screen.findByText('Transactions liées à cette planification');
    await user.click(screen.getByRole('button', { name: 'Fermer' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
