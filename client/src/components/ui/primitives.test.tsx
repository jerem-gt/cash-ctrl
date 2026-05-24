import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Badge, Button, IconButton } from './primitives';

describe('Badge', () => {
  it('affiche son contenu', () => {
    render(<Badge variant="green">Validée</Badge>);
    expect(screen.getByText('Validée')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('est désactivé si disabled', () => {
    render(<Button disabled>Clic</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('déclenche onClick au clic', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Clic</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('IconButton', () => {
  it('a aria-label et title', () => {
    render(<IconButton label="Supprimer">✕</IconButton>);
    const btn = screen.getByRole('button', { name: 'Supprimer' });
    expect(btn).toHaveAttribute('title', 'Supprimer');
  });

  it('est désactivé si disabled', () => {
    render(
      <IconButton label="Action" disabled>
        ✕
      </IconButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
