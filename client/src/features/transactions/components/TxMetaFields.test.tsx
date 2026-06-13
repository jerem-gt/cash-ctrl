import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SCHEDULED } from '@/tests/fixtures';

import { TxMetaFields } from './TxMetaFields';

const defaultProps = {
  date: '2026-06-13',
  onDateChange: vi.fn(),
  notes: '',
  onNotesChange: vi.fn(),
  validated: false,
  onValidatedChange: vi.fn(),
  schedulingOptions: [],
  scheduledId: null,
  onScheduledChange: vi.fn(),
};

function renderFields(overrides = {}) {
  return render(<TxMetaFields {...defaultProps} {...overrides} />);
}

describe('TxMetaFields', () => {
  it('affiche le champ date avec la valeur initiale', () => {
    renderFields();
    expect(screen.getByDisplayValue('2026-06-13')).toBeInTheDocument();
  });

  it('appelle onDateChange quand la date change', () => {
    const onDateChange = vi.fn();
    renderFields({ onDateChange });
    fireEvent.change(screen.getByDisplayValue('2026-06-13'), { target: { value: '2026-07-01' } });
    expect(onDateChange).toHaveBeenCalledWith('2026-07-01');
  });

  it('affiche la textarea de notes', () => {
    renderFields({ notes: 'Note initiale' });
    expect(screen.getByDisplayValue('Note initiale')).toBeInTheDocument();
  });

  it('appelle onNotesChange à la saisie dans les notes', async () => {
    const user = userEvent.setup();
    const onNotesChange = vi.fn();
    renderFields({ onNotesChange });
    await user.type(screen.getByPlaceholderText(/Informations complémentaires/i), 'Nouvelle note');
    expect(onNotesChange).toHaveBeenCalled();
  });

  it('affiche la case à cocher Transaction validée', () => {
    renderFields();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('appelle onValidatedChange au clic sur la case validée', async () => {
    const user = userEvent.setup();
    const onValidatedChange = vi.fn();
    renderFields({ onValidatedChange });
    await user.click(screen.getByRole('checkbox'));
    expect(onValidatedChange).toHaveBeenCalledWith(true);
  });

  it("n'affiche pas le select de planification quand schedulingOptions est vide", () => {
    renderFields();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('affiche le select de planification quand des options sont présentes', () => {
    renderFields({ schedulingOptions: SCHEDULED });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(SCHEDULED[0].description)).toBeInTheDocument();
  });

  it('appelle onScheduledChange avec null quand on sélectionne — Aucune —', async () => {
    const user = userEvent.setup();
    const onScheduledChange = vi.fn();
    renderFields({ schedulingOptions: SCHEDULED, scheduledId: SCHEDULED[0].id, onScheduledChange });
    await user.selectOptions(screen.getByRole('combobox'), '');
    expect(onScheduledChange).toHaveBeenCalledWith(null);
  });

  it("appelle onScheduledChange avec l'id numérique à la sélection", async () => {
    const user = userEvent.setup();
    const onScheduledChange = vi.fn();
    renderFields({ schedulingOptions: SCHEDULED, onScheduledChange });
    await user.selectOptions(screen.getByRole('combobox'), String(SCHEDULED[0].id));
    expect(onScheduledChange).toHaveBeenCalledWith(SCHEDULED[0].id);
  });
});
