import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TRANSACTIONS } from '@/tests/fixtures';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders';

import { TransactionsList } from './TransactionsList';

const noop = vi.fn();

describe('TransactionsList', () => {
  it('affiche les squelettes en cours de chargement', () => {
    const { container } = render(
      <TransactionsList isLoading transactions={[]} onEdit={noop} onDelete={noop} />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('affiche le message vide par défaut', () => {
    render(<TransactionsList isLoading={false} transactions={[]} onEdit={noop} onDelete={noop} />);
    expect(screen.getByText('Aucune transaction trouvée')).toBeInTheDocument();
  });

  it('affiche le message vide personnalisé', () => {
    render(
      <TransactionsList
        isLoading={false}
        transactions={[]}
        onEdit={noop}
        onDelete={noop}
        emptyMessage="Rien à afficher"
      />,
    );
    expect(screen.getByText('Rien à afficher')).toBeInTheDocument();
  });

  it('affiche les transactions de la liste', async () => {
    renderWithProviders(
      <TransactionsList
        isLoading={false}
        transactions={TRANSACTIONS.data}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(await screen.findByText('Courses')).toBeInTheDocument();
  });
});
