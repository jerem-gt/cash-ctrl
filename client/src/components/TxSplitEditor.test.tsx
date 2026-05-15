import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CATEGORIES } from '@/tests/fixtures';

import type { SplitInput } from './TxSplitEditor';
import { TxSplitEditor } from './TxSplitEditor';

const makeRow = (overrides?: Partial<SplitInput>): SplitInput => ({
  _key: 'k1',
  category_id: '1',
  subcategory_id: '1',
  amount: '100',
  ...overrides,
});

describe('TxSplitEditor', () => {
  it(`affiche le titre "Ventilation"`, () => {
    render(
      <TxSplitEditor splits={[]} onChange={vi.fn()} categories={CATEGORIES} totalAmount={0} />,
    );
    expect(screen.getByText('Ventilation')).toBeInTheDocument();
  });

  it('affiche le bouton Ajouter', () => {
    render(
      <TxSplitEditor splits={[]} onChange={vi.fn()} categories={CATEGORIES} totalAmount={0} />,
    );
    expect(screen.getByRole('button', { name: /\+ ajouter/i })).toBeInTheDocument();
  });

  it('appelle onChange avec une nouvelle ligne vide au clic sur Ajouter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor splits={[]} onChange={onChange} categories={CATEGORIES} totalAmount={0} />,
    );
    await user.click(screen.getByRole('button', { name: /\+ ajouter/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ category_id: '', subcategory_id: '', amount: '' }),
      ]),
    );
  });

  it('affiche le montant dune ligne existante', () => {
    render(
      <TxSplitEditor
        splits={[makeRow()]}
        onChange={vi.fn()}
        categories={CATEGORIES}
        totalAmount={200}
      />,
    );
    expect(screen.getByDisplayValue('100')).toBeInTheDocument();
  });

  it('affiche le reste en rouge quand le total ne correspond pas', () => {
    render(
      <TxSplitEditor
        splits={[makeRow({ amount: '50' })]}
        onChange={vi.fn()}
        categories={CATEGORIES}
        totalAmount={200}
      />,
    );
    expect(screen.getByText(/reste/i)).toHaveClass('text-red-500');
  });

  it('affiche le reste en vert quand les montants correspondent', () => {
    render(
      <TxSplitEditor
        splits={[makeRow({ amount: '200' })]}
        onChange={vi.fn()}
        categories={CATEGORIES}
        totalAmount={200}
      />,
    );
    expect(screen.getByText(/reste/i)).toHaveClass('text-green-600');
  });

  it('appelle onChange sans la ligne supprimée au clic sur ×', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor
        splits={[makeRow()]}
        onChange={onChange}
        categories={CATEGORIES}
        totalAmount={100}
      />,
    );
    await user.click(screen.getByRole('button', { name: '×' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("les sous-catégories sont désactivées tant que la catégorie n'est pas choisie", () => {
    render(
      <TxSplitEditor
        splits={[makeRow({ category_id: '', subcategory_id: '' })]}
        onChange={vi.fn()}
        categories={CATEGORIES}
        totalAmount={0}
      />,
    );
    const selects = screen.getAllByRole('combobox');
    // selects[0] = catégorie, selects[1] = sous-catégorie
    expect(selects[1]).toBeDisabled();
  });

  it('la nouvelle ligne reçoit une _key au format UUID v4', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor splits={[]} onChange={onChange} categories={CATEGORIES} totalAmount={0} />,
    );
    await user.click(screen.getByRole('button', { name: /\+ ajouter/i }));
    const [[rows]] = onChange.mock.calls as [[SplitInput[]]];
    expect(rows[0]._key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('appelle onChange avec le montant mis à jour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor
        splits={[makeRow({ amount: '' })]}
        onChange={onChange}
        categories={CATEGORIES}
        totalAmount={100}
      />,
    );
    await user.type(screen.getByRole('spinbutton'), '8');
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ amount: '8' })]);
  });

  it('appelle onChange avec la catégorie mise à jour et sous-catégorie réinitialisée', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor
        splits={[makeRow({ category_id: '1', subcategory_id: '1' })]}
        onChange={onChange}
        categories={CATEGORIES}
        totalAmount={100}
      />,
    );
    await user.selectOptions(screen.getAllByRole('combobox')[0], '2');
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ category_id: '2', subcategory_id: '' }),
    ]);
  });

  it('appelle onChange avec la sous-catégorie mise à jour', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TxSplitEditor
        splits={[makeRow({ category_id: '1', subcategory_id: '' })]}
        onChange={onChange}
        categories={CATEGORIES}
        totalAmount={100}
      />,
    );
    await user.selectOptions(screen.getAllByRole('combobox')[1], '1');
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ subcategory_id: '1' })]);
  });

  it('affiche uniquement les sous-catégories de la catégorie sélectionnée', () => {
    render(
      <TxSplitEditor
        splits={[makeRow({ category_id: '1', subcategory_id: '' })]}
        onChange={vi.fn()}
        categories={CATEGORIES}
        totalAmount={100}
      />,
    );
    expect(screen.getByRole('option', { name: 'Supermarché' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Loyer' })).not.toBeInTheDocument();
  });

  it('supprime uniquement la bonne ligne parmi plusieurs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const row1 = makeRow({ _key: 'k1', amount: '100' });
    const row2 = makeRow({ _key: 'k2', amount: '200' });
    render(
      <TxSplitEditor
        splits={[row1, row2]}
        onChange={onChange}
        categories={CATEGORIES}
        totalAmount={300}
      />,
    );
    await user.click(screen.getAllByRole('button', { name: '×' })[0]);
    expect(onChange).toHaveBeenCalledWith([row2]);
  });
});
