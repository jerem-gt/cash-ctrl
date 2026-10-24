import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateInput, FormGroup, Switch } from './forms';

describe('DateInput', () => {
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

  it('désactive les boutons quand disabled', () => {
    render(<DateInput value="2026-06-13" onChange={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Jour suivant' })).toBeDisabled();
  });
});

describe('FormGroup', () => {
  it('affiche le label et les enfants', () => {
    render(
      <FormGroup label="Nom">
        <input />
      </FormGroup>,
    );
    expect(screen.getByText('Nom')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('reflète checked=true via aria-checked', () => {
    render(<Switch checked onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflète checked=false via aria-checked', () => {
    render(<Switch checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('appelle onChange avec true au clic quand non coché', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch checked={false} onChange={onChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('affiche le label si fourni', () => {
    render(<Switch checked onChange={vi.fn()} label="Activer" />);
    expect(screen.getByText('Activer')).toBeInTheDocument();
  });

  it('est désactivé si disabled', () => {
    render(<Switch checked={false} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });
});
