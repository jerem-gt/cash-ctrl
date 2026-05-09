import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server';

import ImportPage from './ImportPage';

vi.mock('@/lib/qif-parser', () => ({
  parseQif: vi.fn(() => ({
    transactions: [
      {
        date: '15/01/2024',
        amount: -50,
        description: 'Courses',
        qifAccountName: 'ACC1',
        category: 'Alimentation',
        memo: null,
        cleared: true,
        isTransfer: false,
        transferTarget: null,
      },
      {
        date: '20/01/2024',
        amount: 2000,
        description: 'Salaire',
        qifAccountName: 'ACC1',
        category: '',
        memo: null,
        cleared: false,
        isTransfer: false,
        transferTarget: null,
      },
    ],
    accounts: ['ACC1'],
    uniqueCategories: ['Alimentation'],
    uniqueTransferTargets: [],
    detectedDateFormat: 'DD/MM',
  })),
  parseQifDate: vi.fn((raw: string) => {
    const [d, m, y] = raw.split('/');
    return `${y}-${m}-${d}`;
  }),
  findTransferPeer: vi.fn(() => -1),
}));

function renderImportPage() {
  return renderWithProviders(<ImportPage />);
}

async function uploadQif(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['!Type:Bank'], 'test.qif', { type: 'text/plain' });
  await user.upload(screen.getByLabelText(/sélectionner un fichier qif ou xhb/i), file);
}

async function goToCategories(user: ReturnType<typeof userEvent.setup>) {
  await uploadQif(user);
  await user.click(await screen.findByRole('button', { name: /catégories →/i }));
}

async function goToPreview(user: ReturnType<typeof userEvent.setup>) {
  await goToCategories(user);
  // Mapper la catégorie Alimentation → sous-cat existante
  const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
  await user.selectOptions(catSelect, 'map');
  await user.click(screen.getByRole('button', { name: /aperçu →/i }));
}

// ─── Upload step ──────────────────────────────────────────────────────────────

describe('ImportPage — étape Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la zone de dépôt par défaut', () => {
    renderImportPage();
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });

  it('refuse un fichier non .qif/.xhb', () => {
    renderImportPage();
    const badFile = new File(['data'], 'export.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/sélectionner un fichier qif ou xhb/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(screen.getByText(/le fichier doit avoir l'extension .qif ou .xhb/i)).toBeInTheDocument();
  });

  it("passe à l'étape Comptes après un upload .qif", async () => {
    renderImportPage();
    await uploadQif(userEvent.setup());
    await screen.findByText(/mapping des comptes/i);
    expect(screen.getByText('ACC1')).toBeInTheDocument();
  });
});

// ─── Accounts step ────────────────────────────────────────────────────────────

describe('ImportPage — étape Comptes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le compte QIF détecté', async () => {
    renderImportPage();
    await uploadQif(userEvent.setup());
    expect(await screen.findByText('ACC1')).toBeInTheDocument();
  });

  it('affiche le formulaire de création quand action = Créer', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'create');
    expect(screen.getByPlaceholderText(/nom du compte/i)).toBeInTheDocument();
    expect(screen.getByText(/solde initial/i)).toBeInTheDocument();
    expect(screen.getByText(/date ouverture/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur de compte existant quand action = Mapper', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'map');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });
});

// ─── Categories step ──────────────────────────────────────────────────────────

describe('ImportPage — étape Catégories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la catégorie QIF détectée', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await goToCategories(user);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
  });

  it('permet de mapper vers une sous-catégorie existante', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await goToCategories(user);
    const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
    await user.selectOptions(catSelect, 'map');
    expect(screen.getByText(/supermarché/i)).toBeInTheDocument();
  });
});

// ─── Preview step ─────────────────────────────────────────────────────────────

describe('ImportPage — étape Aperçu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les transactions à importer', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    expect(await screen.findByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
  });

  it('désactiver le bouton import quand aucune transaction sélectionnée', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    // Désélectionner toutes les transactions via "tout décocher"
    const checkboxes = await screen.findAllByRole('checkbox');
    // Premier checkbox = tout sélectionner
    await user.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /importer 0/i })).toBeDisabled();
  });

  it('décoche individuellement une transaction', async () => {
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    const checkboxes = await screen.findAllByRole('checkbox');
    // checkboxes[0] = tout, checkboxes[1] = première transaction
    await user.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: /importer 1/i })).not.toBeDisabled();
  });
});

// ─── Import execution ─────────────────────────────────────────────────────────

describe("ImportPage — exécution de l'import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appelle POST /api/import/qif et affiche l'écran de succès", async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json({ transactions: 2, transfers: 0 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    await screen.findByText(/importation terminée/i);
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it("affiche une erreur si l'API échoue", async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    expect(await screen.findByText(/erreur lors de l'importation/i)).toBeInTheDocument();
  });

  it('le bouton "Nouvelle importation" réinitialise la page', async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json({ transactions: 1, transfers: 0 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderImportPage();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    await user.click(await screen.findByRole('button', { name: /nouvelle importation/i }));
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });
});
