import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExpensesPieChart from './ExpensesPieChart';
import ForecastAreaChart, {
  buildXTicks,
  computeYDomain,
  dedupeTooltipPayload,
  formatDateShort,
} from './ForecastAreaChart';
import IncomeExpenseBarChart from './IncomeExpenseBarChart';
import NetBalanceLineChart from './NetBalanceLineChart';
import PatrimonyBarChart from './PatrimonyBarChart';

// recharts ne dessine rien sans dimensions dans jsdom : on vérifie surtout que
// chaque composant monte sans planter (le chunk recharts est isolé du bundle principal).
describe('charts', () => {
  it('monte ExpensesPieChart sans planter', () => {
    const { container } = render(
      <ExpensesPieChart data={[{ name: 'Courses', value: 120, fill: '#abc' }]} />,
    );
    expect(container).toBeInTheDocument();
  });

  it('monte IncomeExpenseBarChart sans planter', () => {
    const { container } = render(
      <IncomeExpenseBarChart
        data={[{ month: 'janv.', Revenus: 1000, Depenses: 800 }]}
        incomeLabel="Revenus"
        expenseLabel="Dépenses"
      />,
    );
    expect(container).toBeInTheDocument();
  });

  it('monte NetBalanceLineChart sans planter', () => {
    const data = [
      { year: '2024', liquidites: 1000, epargne: 500, _total: 1500 },
      { year: '2025', liquidites: 1200, epargne: 800, _total: 2000 },
    ];
    const { container } = render(<NetBalanceLineChart data={data} label="Solde net" />);
    expect(container).toBeInTheDocument();
  });

  it('monte NetBalanceLineChart sans planter avec total négatif', () => {
    const data = [{ year: '2025', liquidites: 300, prets: -800, _total: -500 }];
    const { container } = render(<NetBalanceLineChart data={data} label="Solde net" />);
    expect(container).toBeInTheDocument();
  });

  it('monte ForecastAreaChart sans planter', () => {
    const points = [
      { date: '2026-07-07', balance: 1500 },
      { date: '2026-08-15', balance: -200 },
    ];
    const { container } = render(
      <ForecastAreaChart points={points} goesNegativeOn="2026-08-15" label="Solde projeté" />,
    );
    expect(container).toBeInTheDocument();
  });

  it('monte ForecastAreaChart sans planter (aucun solde négatif)', () => {
    const points = [
      { date: '2026-07-07', balance: 1500 },
      { date: '2026-08-15', balance: 1800 },
    ];
    const { container } = render(
      <ForecastAreaChart points={points} goesNegativeOn={null} label="Solde projeté" />,
    );
    expect(container).toBeInTheDocument();
  });

  it('monte ForecastAreaChart sans planter avec un splitDate (passé plein + projeté pointillé)', () => {
    const points = [
      { date: '2026-06-01', balance: 1000 },
      { date: '2026-07-07', balance: 1500 },
      { date: '2026-08-15', balance: -200 },
    ];
    const { container } = render(
      <ForecastAreaChart
        points={points}
        goesNegativeOn="2026-08-15"
        label="Solde"
        splitDate="2026-07-07"
      />,
    );
    expect(container).toBeInTheDocument();
  });

  it('dedupeTooltipPayload retire les entrées identiques du point de jonction', () => {
    const payload = [
      { name: 'Solde', value: 1500 },
      { name: 'Solde', value: 1500 },
    ];
    expect(dedupeTooltipPayload(payload)).toHaveLength(1);
  });

  it('dedupeTooltipPayload conserve les entrées de valeurs différentes', () => {
    const payload = [
      { name: 'Solde', value: 1500 },
      { name: 'Solde', value: 1800 },
    ];
    expect(dedupeTooltipPayload(payload)).toHaveLength(2);
  });

  it("monte ForecastAreaChart sans planter avec splitLabel (repère aujourd'hui)", () => {
    const points = [
      { date: '2026-06-01', balance: 1000 },
      { date: '2026-07-07', balance: 1500 },
    ];
    const { container } = render(
      <ForecastAreaChart
        points={points}
        goesNegativeOn={null}
        label="Solde"
        splitDate="2026-07-07"
        splitLabel="Aujourd'hui"
      />,
    );
    expect(container).toBeInTheDocument();
  });

  describe('computeYDomain', () => {
    it('ne démarre pas le domaine à 0 pour une série plate positive', () => {
      const [min, max] = computeYDomain([4712, 4712, 4712, 4712]);
      expect(min).toBeGreaterThan(0);
      expect(min).toBeLessThan(4712);
      expect(max).toBeGreaterThan(4712);
    });

    it('inclut 0 et une ligne zéro quand la série traverse le négatif', () => {
      const values = [-200, 300, 1800];
      const [min, max] = computeYDomain(values);
      expect(min).toBeLessThanOrEqual(0);
      expect(max).toBeGreaterThanOrEqual(0);
    });

    it('produit un domaine non dégénéré pour une série parfaitement plate', () => {
      const [min, max] = computeYDomain([0, 0, 0]);
      expect(min).toBeLessThan(max);
    });

    it('ne clampe pas à 0 quand la série reste entièrement négative', () => {
      const [min, max] = computeYDomain([-500, -500, -500]);
      expect(max).toBeLessThan(0);
      expect(min).toBeLessThan(max);
    });

    it('retourne [0, 0] pour un tableau vide', () => {
      expect(computeYDomain([])).toEqual([0, 0]);
    });
  });

  describe('buildXTicks', () => {
    it('inclut toujours le premier et le dernier point', () => {
      const dates = Array.from(
        { length: 91 },
        (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      );
      const ticks = buildXTicks(dates);
      expect(ticks[0]).toBe(dates[0]);
      expect(ticks.at(-1)).toBe(dates.at(-1));
    });

    it('inclut toujours le premier et le dernier point sur une série de 31 jours', () => {
      const dates = Array.from(
        { length: 31 },
        (_, i) => `2026-07-${String(i + 1).padStart(2, '0')}`,
      );
      const ticks = buildXTicks(dates);
      expect(ticks[0]).toBe(dates[0]);
      expect(ticks.at(-1)).toBe(dates.at(-1));
    });

    it('retourne le tableau tel quel pour 0 ou 1 point', () => {
      expect(buildXTicks([])).toEqual([]);
      expect(buildXTicks(['2026-07-07'])).toEqual(['2026-07-07']);
    });
  });

  it('monte PatrimonyBarChart sans planter', () => {
    const { container } = render(
      <PatrimonyBarChart
        data={[{ year: '2025', liquidites: 1500, epargne: 500, _total: 2000 }]}
        types={['liquidites', 'epargne']}
        negativeTypes={new Set()}
        lastPositiveType="epargne"
        hasLoans={false}
        labelFor={(type) => type}
      />,
    );
    expect(container).toBeInTheDocument();
  });

  describe('ForecastAreaChart formatters', () => {
    it('formatDateShort formate correctement une date', () => {
      expect(formatDateShort('2026-07-07')).toMatch(/07.*juil/i);
      expect(formatDateShort('2026-08-15')).toMatch(/15.*août/i);
    });

    it('formatDateShort accepte unknown et le caste en string', () => {
      expect(formatDateShort('2026-06-01')).toMatch(/01.*juin/i);
    });
  });
});
