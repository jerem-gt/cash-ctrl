import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ListContent } from './ListContent';

describe('ListContent', () => {
  it('affiche le skeleton pendant le chargement', () => {
    render(<ListContent isLoading={true} items={[]} empty="Aucun élément" render={vi.fn()} />);
    expect(screen.queryByText('Aucun élément')).not.toBeInTheDocument();
  });

  it('affiche le message vide quand items est vide', () => {
    render(<ListContent isLoading={false} items={[]} empty="Aucun élément" render={vi.fn()} />);
    expect(screen.getByText('Aucun élément')).toBeInTheDocument();
  });

  it('appelle render pour chaque item et affiche le résultat', () => {
    const items = ['Alimentation', 'Logement', 'Loisirs'];
    render(
      <ListContent
        isLoading={false}
        items={items}
        empty="Vide"
        render={(item) => <div key={item}>{item}</div>}
      />,
    );
    expect(screen.getByText('Alimentation')).toBeInTheDocument();
    expect(screen.getByText('Logement')).toBeInTheDocument();
    expect(screen.getByText('Loisirs')).toBeInTheDocument();
  });

  it('affiche le nombre de lignes skeleton personnalisé', () => {
    const { container } = render(
      <ListContent isLoading={true} items={[]} empty="Vide" render={vi.fn()} skeletonCount={5} />,
    );
    const rows = container.querySelectorAll('.border-b');
    expect(rows).toHaveLength(5);
  });
});
