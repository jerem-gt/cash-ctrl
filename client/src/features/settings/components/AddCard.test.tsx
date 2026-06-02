import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AddCard } from './AddCard';

describe('AddCard', () => {
  it('affiche le titre et le contenu', () => {
    render(
      <AddCard title="Nouvelle banque">
        <input aria-label="Nom" />
      </AddCard>,
    );
    expect(screen.getByText('Nouvelle banque')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
  });
});
