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

  it('affiche le badge de tendance (pourcentage arrondi + label) à la place du sous-titre', () => {
    render(
      <Metric
        label="Revenus"
        value="1 200 €"
        sub="ignoré"
        variant="positive"
        trend={{ direction: 'up', value: '12 %', positive: true }}
        trendLabel="vs mois dernier"
      />,
    );
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText('vs mois dernier')).toBeInTheDocument();
    expect(screen.queryByText('ignoré')).not.toBeInTheDocument();
  });

  it('affiche le sous-titre quand aucune tendance n’est fournie', () => {
    render(<Metric label="Solde total" value="3 000 €" sub="3 compte(s)" />);
    expect(screen.getByText('3 compte(s)')).toBeInTheDocument();
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

describe('Tabs variant sidebar', () => {
  const tabs = [
    { key: 'bank', label: 'Banque' },
    { key: 'type', label: 'Type' },
  ];

  it('affiche les onglets', () => {
    render(<Tabs tabs={tabs} active="bank" onChange={vi.fn()} variant="sidebar" />);
    expect(screen.getByText('Banque')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
  });

  it('appelle onChange au clic', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} active="bank" onChange={onChange} variant="sidebar" />);
    await user.click(screen.getByText('Type'));
    expect(onChange).toHaveBeenCalledWith('type');
  });
});
