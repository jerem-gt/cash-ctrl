import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge, Button, DateInput, IconButton } from './primitives';

describe('DateInput', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('expose les boutons avec leurs aria-labels', () => {
    render(<DateInput value="2026-06-13" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Jour précédent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jour suivant' })).toBeInTheDocument();
  });

  it('appelle onChange avec la veille et le lendemain', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DateInput value="2026-01-01" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Jour précédent' }));
    expect(onChange).toHaveBeenLastCalledWith('2025-12-31');
    await user.click(screen.getByRole('button', { name: 'Jour suivant' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-01-02');
  });

  it('ne soumet pas le formulaire au clic', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DateInput value="2026-06-13" onChange={vi.fn()} />
      </form>,
    );
    await user.click(screen.getByRole('button', { name: 'Jour suivant' }));
    await user.click(screen.getByRole('button', { name: 'Jour précédent' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('désactive les boutons et le champ quand disabled', () => {
    render(<DateInput id="d" value="2026-06-13" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Jour précédent' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Jour suivant' })).toBeDisabled();
    expect(document.getElementById('d')).toBeDisabled();
  });

  it("porte l'attribut required sur l'input quand la prop est passée", () => {
    render(<DateInput id="d" value="2026-06-13" onChange={vi.fn()} required />);
    expect(document.getElementById('d')).toBeRequired();
  });

  it("porte border-danger sur le conteneur en cas d'erreur", () => {
    render(<DateInput id="d" value="2026-06-13" onChange={vi.fn()} error />);
    expect(document.getElementById('d')?.parentElement).toHaveClass('border-danger');
  });

  it('part de demain au clic sur + quand la valeur est vide', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 5, 13, 12, 0, 0));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    render(<DateInput value="" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Jour suivant' }));
    expect(onChange).toHaveBeenCalledWith('2026-06-14');
  });
});

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
