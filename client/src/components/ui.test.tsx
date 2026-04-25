import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  Badge,
  Button,
  Card,
  CardTitle,
  ConfirmModal,
  Empty,
  FormGroup,
  Metric,
  Pagination,
  showToast,
  Skeleton,
  Toast,
} from './ui';

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

describe('Badge', () => {
  it('affiche son contenu', () => {
    render(<Badge variant="green">Validée</Badge>);
    expect(screen.getByText('Validée')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('est désactivé si disabled', () => {
    render(<Button disabled>Clic</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('déclenche onClick au clic', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Clic</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

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

describe('Empty', () => {
  it('affiche le message passé en enfant', () => {
    render(<Empty>Aucune donnée</Empty>);
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('rend un div avec la classe animate-pulse', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});

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

  it('affiche la page courante sur le total de pages', () => {
    render(<Pagination {...base} />);
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
  });

  it('désactive le bouton ← à la première page', () => {
    render(<Pagination {...base} page={1} />);
    expect(screen.getByText('←').closest('button')).toBeDisabled();
  });

  it('désactive le bouton → à la dernière page', () => {
    render(<Pagination {...base} page={5} />);
    expect(screen.getByText('→').closest('button')).toBeDisabled();
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
});

describe('ConfirmModal', () => {
  const base = {
    title: 'Supprimer ?',
    body: 'Action irréversible.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('affiche le titre et le corps', () => {
    render(<ConfirmModal {...base} />);
    expect(screen.getByText('Supprimer ?')).toBeInTheDocument();
    expect(screen.getByText('Action irréversible.')).toBeInTheDocument();
  });

  it('appelle onConfirm au clic sur Confirmer', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmModal {...base} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('appelle onCancel au clic sur Annuler', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmModal {...base} onCancel={onCancel} />);
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('désactive les boutons si isPending', () => {
    render(<ConfirmModal {...base} isPending />);
    screen.getAllByRole('button').forEach((btn) => expect(btn).toBeDisabled());
  });
});

describe('Toast / showToast', () => {
  it('affiche le message via showToast', () => {
    render(<Toast />);
    showToast('Opération réussie');
    expect(document.getElementById('toast')?.textContent).toBe('Opération réussie');
  });
});
