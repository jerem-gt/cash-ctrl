import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FormGroup, Switch } from './forms';

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
