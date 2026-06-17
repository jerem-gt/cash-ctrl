import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CategoryPieCard } from './CategoryPieCard';

describe('CategoryPieCard', () => {
  it('affiche le message vide quand data est vide', () => {
    render(
      <CategoryPieCard
        sectionLabel="Dépenses par catégorie"
        data={[]}
        total={0}
        emptyMessage="Aucune dépense sur cette période"
      />,
    );
    expect(screen.getByText('Aucune dépense sur cette période')).toBeInTheDocument();
  });

  it('affiche la liste des catégories quand des données sont présentes', async () => {
    render(
      <CategoryPieCard
        sectionLabel="Dépenses par catégorie"
        data={[
          { name: 'Alimentation', value: 700, fill: '#aaa' },
          { name: 'Transport', value: 500, fill: '#bbb' },
        ]}
        total={1200}
        emptyMessage="Aucune dépense sur cette période"
      />,
    );
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
  });
});
