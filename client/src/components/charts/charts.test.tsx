import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ExpensesPieChart from './ExpensesPieChart';
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
});
