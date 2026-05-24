import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Card, CardTitle, Metric, Tabs } from './layout';

describe('Card', () => {
  it('affiche ses enfants', () => {
    render(<Card>Contenu</Card>);
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });
});

describe('CardTitle', () => {
  it('affiche son texte', () => {
    render(<CardTitle>Ma section</CardTitle>);
    expect(screen.getByText('Ma section')).toBeInTheDocument();
  });
});

describe('Metric', () => {
  it('affiche le label, la valeur et le sous-titre', () => {
    render(<Metric label="Solde total" value="1 500 €" sub="1 compte(s)" />);
    expect(screen.getByText('Solde total')).toBeInTheDocument();
    expect(screen.getByText('1 500 €')).toBeInTheDocument();
    expect(screen.getByText('1 compte(s)')).toBeInTheDocument();
  });

  it("n'affiche pas de sous-titre si absent", () => {
    render(<Metric label="Solde" value="0 €" />);
    expect(screen.queryByText('compte')).not.toBeInTheDocument();
  });
});

describe('Tabs', () => {
  const tabs = [
    { key: 'a', label: 'Onglet A' },
    { key: 'b', label: 'Onglet B' },
  ];

  it('affiche tous les onglets', () => {
    render(<Tabs tabs={tabs} active="a" onChange={vi.fn()} />);
    expect(screen.getByText('Onglet A')).toBeInTheDocument();
    expect(screen.getByText('Onglet B')).toBeInTheDocument();
  });

  it("appelle onChange avec la key de l'onglet cliqué", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} active="a" onChange={onChange} />);
    await user.click(screen.getByText('Onglet B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Tabs variant dark', () => {
  const tabs = [
    { key: 'bank', label: 'Banque' },
    { key: 'type', label: 'Type' },
  ];

  it('affiche les onglets', () => {
    render(<Tabs tabs={tabs} active="bank" onChange={vi.fn()} variant="dark" />);
    expect(screen.getByText('Banque')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('appelle onChange au clic', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} active="bank" onChange={onChange} variant="dark" />);
    await user.click(screen.getByText('Type'));
    expect(onChange).toHaveBeenCalledWith('type');
  });
});
