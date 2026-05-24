import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, Empty, showToast, Skeleton, Spinner, Toast } from './feedback';

describe('Skeleton', () => {
  it('rend un div avec la classe animate-pulse', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

describe('Empty', () => {
  it('affiche le message passé en enfant', () => {
    render(<Empty>Aucune donnée</Empty>);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
  });
});

describe('Spinner', () => {
  it('rend un SVG avec animate-spin', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('Alert', () => {
  it('affiche son contenu', () => {
    render(<Alert variant="info">Message informatif</Alert>);
    expect(screen.getByText('Message informatif')).toBeInTheDocument();
  });

  it('applique les classes de la variante error', () => {
    const { container } = render(<Alert variant="error">Erreur</Alert>);
    expect(container.firstChild).toHaveClass('bg-red-50');
  });
});

describe('Toast / showToast', () => {
  it('affiche le message via showToast', () => {
    render(<Toast />);
    showToast('Opération réussie');
    expect(document.getElementById('toast')?.textContent).toBe('Opération réussie');
  });
});
