import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BANKS } from '@/tests/fixtures';

import { BankSelect } from './BankSelect';

describe('BankSelect', () => {
  it('affiche le placeholder par défaut', () => {
    render(<BankSelect value="" onChange={vi.fn()} banks={BANKS} />);
    expect(screen.getByText('— Choisir —')).toBeInTheDocument();
  });

  it('affiche la banque sélectionnée', () => {
    render(<BankSelect value="1" onChange={vi.fn()} banks={BANKS} />);
    expect(screen.getByText('BNP')).toBeInTheDocument();
  });

  it('ouvre la liste des banques au clic', async () => {
    const user = userEvent.setup();
    render(<BankSelect value="" onChange={vi.fn()} banks={BANKS} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getByText('BNP')).toBeInTheDocument();
  });

  it("appelle onChange avec l'id stringifié lors de la sélection", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BankSelect value="" onChange={onChange} banks={BANKS} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('BNP'));
    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('appelle onChange("") au clic sur le placeholder de la liste', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BankSelect value="1" onChange={onChange} banks={BANKS} />);
    await user.click(screen.getByRole('button'));
    // Quand value="1", le trigger montre "BNP" — "— Choisir —" est uniquement dans la liste
    await user.click(screen.getByText('— Choisir —'));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
