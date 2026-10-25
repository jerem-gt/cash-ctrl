import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { MaybeLink } from './MaybeLink';

describe('MaybeLink', () => {
  it('rend un lien avec le href quand to est défini', () => {
    render(
      <MemoryRouter>
        <MaybeLink to="/transactions?type=income">Revenus</MaybeLink>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Revenus' });
    expect(link).toHaveAttribute('href', '/transactions?type=income');
    expect(link.className).toContain('hover:underline');
  });

  it('ajoute la className au lien', () => {
    render(
      <MemoryRouter>
        <MaybeLink to="/x" className="text-xs">
          Lien
        </MaybeLink>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Lien' }).className).toContain('text-xs');
  });

  it('rend un span sans lien quand to est absent', () => {
    render(<MaybeLink className="text-xs">Texte</MaybeLink>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Texte').tagName).toBe('SPAN');
  });
});
