import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccountBadge } from './AccountBadge';

describe('AccountBadge', () => {
  it('affiche le nom du compte', () => {
    render(<AccountBadge name="Compte courant" />);
    expect(screen.getByText('Compte courant')).toBeInTheDocument();
  });

  it('affiche le nom de la banque entre parenthèses', () => {
    render(<AccountBadge name="Compte courant" bank="BNP" />);
    expect(screen.getByText('(BNP)')).toBeInTheDocument();
  });

  it('affiche le logo si fourni', () => {
    const { container } = render(<AccountBadge name="Compte" bank="BNP" logo="/logos/bnp.png" />);
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('affiche un placeholder si pas de logo mais banque connue', () => {
    const { container } = render(<AccountBadge name="Compte" bank="BNP" logo={null} />);
    const placeholder = container.querySelector('.bg-stone-100');
    expect(placeholder).toBeInTheDocument();
  });

  it("n'affiche pas de placeholder si pas de banque", () => {
    const { container } = render(<AccountBadge name="Compte" />);
    expect(container.querySelector('.bg-stone-100')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
