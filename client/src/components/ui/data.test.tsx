import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './data';

describe('Pagination', () => {
  const base = {
    page: 2,
    totalPages: 5,
    total: 100,
    limit: 25,
    onChange: vi.fn(),
    onLimitChange: vi.fn(),
  };

  it('affiche la plage et le total', () => {
    render(<Pagination {...base} />);
    expect(screen.getByText('26–50 sur 100')).toBeInTheDocument();
  });

  it('affiche le total de pages', () => {
    render(<Pagination {...base} />);
    expect(screen.getByText('/ 5')).toBeInTheDocument();
  });

  it("affiche la page courante comme placeholder de l'input", () => {
    render(<Pagination {...base} />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('placeholder', '2');
  });

  it('désactive le bouton ← à la première page', () => {
    render(<Pagination {...base} page={1} />);
    expect(screen.getByText('←').closest('button')).toBeDisabled();
  });

  it('désactive le bouton → à la dernière page', () => {
    render(<Pagination {...base} page={5} />);
    expect(screen.getByText('→').closest('button')).toBeDisabled();
  });

  it('désactive le bouton « à la première page', () => {
    render(<Pagination {...base} page={1} />);
    expect(screen.getByText('«').closest('button')).toBeDisabled();
  });

  it('désactive le bouton » à la dernière page', () => {
    render(<Pagination {...base} page={5} />);
    expect(screen.getByText('»').closest('button')).toBeDisabled();
  });

  it('appelle onChange avec la page suivante au clic →', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    await user.click(screen.getByText('→'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('appelle onChange avec la page précédente au clic ←', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    await user.click(screen.getByText('←'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('appelle onChange avec 1 au clic «', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    await user.click(screen.getByText('«'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('appelle onChange avec totalPages au clic »', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    await user.click(screen.getByText('»'));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('navigue à la page saisie après Entrée', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await user.type(input, '4{Enter}');
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("n'appelle pas onChange si la page saisie est hors plage", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await user.type(input, '99{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it("n'appelle pas onChange si la valeur saisie n'est pas un nombre", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Pagination {...base} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    await user.type(input, '{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });
});
