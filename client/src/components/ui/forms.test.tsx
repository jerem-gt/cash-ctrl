import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DateField, FormGroup, Switch } from './forms';

describe('DateField', () => {
  it("relie le libellé par défaut à l'input", () => {
    render(<DateField id="d" value="2026-06-13" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Date')).toHaveAttribute('id', 'd');
  });

  it('accepte un libellé personnalisé', () => {
    render(<DateField id="d" label="Échéance" value="2026-06-13" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Échéance')).toBeInTheDocument();
  });

  it('transmet required', () => {
    render(<DateField id="d" value="2026-06-13" onChange={vi.fn()} required />);
    expect(screen.getByLabelText('Date')).toBeRequired();
  });

  it('applique min-w-56 au conteneur', () => {
    const { container } = render(<DateField id="d" value="2026-06-13" onChange={vi.fn()} />);
    expect(container.firstElementChild).toHaveClass('min-w-56');
    expect(container.firstElementChild).not.toHaveClass('min-w-25');
  });
});

describe('FormGroup', () => {
  it('a min-w-25 par défaut', () => {
    const { container } = render(
      <FormGroup label="Nom">
        <input />
      </FormGroup>,
    );
    expect(container.firstElementChild).toHaveClass('min-w-25');
  });

  it('remplace min-w-25 avec minWidthClass', () => {
    const { container } = render(
      <FormGroup label="Nom" minWidthClass="min-w-56">
        <input />
      </FormGroup>,
    );
    expect(container.firstElementChild).toHaveClass('min-w-56');
    expect(container.firstElementChild).not.toHaveClass('min-w-25');
  });

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
