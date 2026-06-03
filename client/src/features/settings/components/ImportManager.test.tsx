import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

let ImportManager: typeof import('./ImportManager').default;
let parseQif: typeof import('@/lib/qif-parser.ts').parseQif;
let findTransferPeer: typeof import('@/lib/qif-parser.ts').findTransferPeer;
let parseXhb: typeof import('@/lib/xhb-parser.ts').parseXhb;

beforeAll(async () => {
  vi.doMock('@/lib/qif-parser', () => ({
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

  vi.doMock('@/lib/xhb-parser', () => ({
    parseXhb: vi.fn(() => ({
      accounts: ['CompteXHB'],
      accountDetails: new Map([
        ['CompteXHB', { key: 1, name: 'CompteXHB', bankname: '', initial: 100 }],
      ]),
      transactions: [
        {
          accountName: 'CompteXHB',
          date: '2024-01-15',
          amount: -50,
          description: 'Dépense XHB',
          categoryString: 'Alimentation',
          paymode: 2,
          notes: null,
          validated: true,
        },
      ],
      transfers: [],
      uniqueCategories: ['Alimentation'],
      uniquePaymodes: [2],
    })),
  }));

  vi.resetModules();
  ImportManager = (await import('./ImportManager')).default;
  ({ parseQif, findTransferPeer } = await import('@/lib/qif-parser.ts'));
  ({ parseXhb } = await import('@/lib/xhb-parser.ts'));
});

afterAll(() => {
  vi.doUnmock('@/lib/qif-parser');
  vi.doUnmock('@/lib/xhb-parser');
  vi.resetModules();
});

const validJsonData = {
  version: '1.0',
  amounts_in_cents: true,
  accounts: [{ id: 1, name: 'Compte test' }],
  transactions: [
    { id: 1, transfer_peer_id: null },
    { id: 2, transfer_peer_id: 3 },
    { id: 3, transfer_peer_id: 2 },
  ],
  categories: [{ id: 1, subcategories: [{ id: 11 }] }],
  payment_methods: [{ id: 1 }],
  account_types: [],
  stock_positions: [],
  stock_operations: [],
  scheduled_transactions: [],
  loans: [],
};

function renderImportManager() {
  return renderWithProviders(<ImportManager />);
}

async function uploadQif(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['!Type:Bank'], 'test.qif', { type: 'text/plain' });
  await user.upload(screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i), file);
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

async function uploadJson(user: ReturnType<typeof userEvent.setup>) {
  const file = new File([JSON.stringify(validJsonData)], 'export.json', {
    type: 'application/json',
  });
  await user.upload(screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i), file);
}

async function uploadXhb(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(['<homebank version="1.0"></homebank>'], 'test.xhb', {
    type: 'text/plain',
  });
  await user.upload(screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i), file);
}

async function goToPreviewNoMapping(user: ReturnType<typeof userEvent.setup>) {
  await goToCategories(user);
  // Ne pas mapper la catégorie → elle sera ignorée (skip) dans la prévisualisation
  await user.click(screen.getByRole('button', { name: /aperçu →/i }));
}

// ─── Upload step ──────────────────────────────────────────────────────────────

describe('ImportManager — étape Upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la zone de dépôt par défaut', () => {
    renderImportManager();
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });

  it('refuse un fichier non .qif/.xhb', () => {
    renderImportManager();
    const badFile = new File(['data'], 'export.csv', { type: 'text/csv' });
    const input = screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i);
    fireEvent.change(input, { target: { files: [badFile] } });
    expect(
      screen.getByText(/le fichier doit avoir l'extension .qif, .xhb ou .json/i),
    ).toBeInTheDocument();
  });

  it("passe à l'étape Comptes après un upload .qif", async () => {
    renderImportManager();
    await uploadQif(userEvent.setup());
    await screen.findByText(/mapping des comptes/i);
    expect(screen.getByText('ACC1')).toBeInTheDocument();
  });
});

// ─── Accounts step ────────────────────────────────────────────────────────────

describe('ImportManager — étape Comptes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le compte QIF détecté', async () => {
    renderImportManager();
    await uploadQif(userEvent.setup());
    expect(await screen.findByText('ACC1')).toBeInTheDocument();
  });

  it('affiche le formulaire de création quand action = Créer', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'create');
    expect(screen.getByPlaceholderText(/nom du compte/i)).toBeInTheDocument();
    expect(screen.getByText(/solde initial/i)).toBeInTheDocument();
    expect(screen.getByText(/date ouverture/i)).toBeInTheDocument();
  });

  it('affiche le sélecteur de compte existant quand action = Mapper', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'map');
    expect(screen.getByText('Compte test')).toBeInTheDocument();
  });

  it("met à jour le solde initial via DecimalInput lors de la création d'un compte", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'create');
    const soldeInput = screen.getByLabelText(/solde initial/i);
    await user.clear(soldeInput);
    await user.type(soldeInput, '500');
    expect(soldeInput).toHaveValue('500');
  });
});

// ─── Categories step ──────────────────────────────────────────────────────────

describe('ImportManager — étape Catégories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche la catégorie QIF détectée', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToCategories(user);
    expect(await screen.findByText('Alimentation')).toBeInTheDocument();
  });

  it('permet de mapper vers une sous-catégorie existante', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToCategories(user);
    const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
    await user.selectOptions(catSelect, 'map');
    expect(screen.getByText(/supermarché/i)).toBeInTheDocument();
  });
});

// ─── Preview step ─────────────────────────────────────────────────────────────

describe('ImportManager — étape Aperçu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les transactions à importer', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    expect(await screen.findByText('Courses')).toBeInTheDocument();
    expect(screen.getByText('Salaire')).toBeInTheDocument();
  });

  it('désactiver le bouton import quand aucune transaction sélectionnée', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    // Désélectionner toutes les transactions via "tout décocher"
    const checkboxes = await screen.findAllByRole('checkbox');
    // Premier checkbox = tout sélectionner
    await user.click(checkboxes[0]);
    expect(screen.getByRole('button', { name: /importer 0/i })).toBeDisabled();
  });

  it('décoche individuellement une transaction', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    const checkboxes = await screen.findAllByRole('checkbox');
    // checkboxes[0] = tout, checkboxes[1] = première transaction
    await user.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: /importer 1/i })).not.toBeDisabled();
  });
});

// ─── Import execution ─────────────────────────────────────────────────────────

describe("ImportManager — exécution de l'import", () => {
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
    renderImportManager();
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
    renderImportManager();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    expect(await screen.findByText(/erreur lors de l'importation/i)).toBeInTheDocument();
  });

  it('affiche les erreurs de validation par ligne + le compteur', async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json(
          {
            error: {
              code: 'validation.invalid',
              message: 'Données invalides',
              fields: [
                {
                  path: 'transactions.1.amount',
                  code: 'validation.too_small',
                  params: { minimum: 1 },
                  message: 'x',
                },
              ],
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    // motif d'erreur traduit affiché sur la ligne fautive
    expect(await screen.findByText('La valeur doit être au moins 1')).toBeInTheDocument();
    // compteur d'erreurs en bas
    expect(screen.getByText(/1 erreur/i)).toBeInTheDocument();
  });

  it(`le bouton "Nouvelle importation" réinitialise la page`, async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json({ transactions: 1, transfers: 0 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    await user.click(await screen.findByRole('button', { name: /nouvelle importation/i }));
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });
});

// ─── Format JSON ──────────────────────────────────────────────────────────────

describe('ImportManager — format JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe à l'étape Confirmer après un upload JSON valide", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadJson(user);
    expect(await screen.findByText(/contenu du fichier/i)).toBeInTheDocument();
  });

  it('affiche une erreur pour un JSON avec version incorrecte', async () => {
    const user = userEvent.setup();
    renderImportManager();
    const badJson = JSON.stringify({ version: '2.0', amounts_in_cents: true });
    const file = new File([badJson], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i), file);
    expect(await screen.findByText(/format json invalide/i)).toBeInTheDocument();
  });

  it('affiche une erreur si le JSON est syntaxiquement invalide', async () => {
    const user = userEvent.setup();
    renderImportManager();
    const file = new File(['this is not json'], 'bad.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/sélectionner un fichier qif, xhb ou json/i), file);
    expect(await screen.findByText(/erreur lors de la lecture du fichier/i)).toBeInTheDocument();
  });

  it("affiche les statistiques dans l'étape Confirmer", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadJson(user);
    await screen.findByText(/contenu du fichier/i);
    expect(screen.getByText('comptes')).toBeInTheDocument();
    expect(screen.getByText('virements')).toBeInTheDocument();
    expect(screen.getByText('Moyens de paiement')).toBeInTheDocument();
  });

  it("exécute l'import JSON et affiche le succès avec les stats", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadJson(user);
    await screen.findByText(/contenu du fichier/i);
    await user.click(screen.getByRole('button', { name: /importer/i }));
    await screen.findByText(/importation terminée/i);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('transactions')).toBeInTheDocument();
    expect(screen.getByText('comptes créés')).toBeInTheDocument();
  });

  it("affiche une erreur si l'import JSON échoue", async () => {
    server.use(
      http.post('/api/import/json-full', () =>
        HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderImportManager();
    await uploadJson(user);
    await screen.findByText(/contenu du fichier/i);
    await user.click(screen.getByRole('button', { name: /importer/i }));
    expect(await screen.findByText(/erreur lors de l'importation/i)).toBeInTheDocument();
  });

  it("le bouton Retour réinitialise vers l'upload", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadJson(user);
    await screen.findByText(/contenu du fichier/i);
    await user.click(screen.getByRole('button', { name: /← retour/i }));
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });
});

// ─── Format XHB ──────────────────────────────────────────────────────────────

describe('ImportManager — format XHB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe à l'étape Comptes après un upload XHB", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadXhb(user);
    expect(await screen.findByText(/mapping des comptes/i)).toBeInTheDocument();
    expect(screen.getByText('CompteXHB')).toBeInTheDocument();
  });

  it('affiche une erreur si XHB sans transactions ni virements', async () => {
    vi.mocked(parseXhb).mockReturnValueOnce({
      accounts: [],
      accountDetails: new Map(),
      transactions: [],
      transfers: [],
      uniqueCategories: [],
      uniquePaymodes: [],
    });
    const user = userEvent.setup();
    renderImportManager();
    await uploadXhb(user);
    expect(await screen.findByText(/aucune transaction trouvée/i)).toBeInTheDocument();
  });

  it("progresse jusqu'à l'étape Méthodes de paiement", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadXhb(user);
    await user.click(await screen.findByRole('button', { name: /catégories →/i }));
    await user.click(await screen.findByRole('button', { name: /méthodes de paiement →/i }));
    expect(await screen.findByText(/chèque/i)).toBeInTheDocument();
  });

  it("permet de modifier le mapping d'un mode de paiement et revenir aux catégories", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadXhb(user);
    await user.click(await screen.findByRole('button', { name: /catégories →/i }));
    await user.click(await screen.findByRole('button', { name: /méthodes de paiement →/i }));
    const paymodeSelect = await screen.findByRole('combobox', {
      name: /méthode de paiement pour chèque/i,
    });
    await user.selectOptions(paymodeSelect, '');
    expect(paymodeSelect).toHaveValue('');
    await user.click(screen.getByRole('button', { name: /← retour/i }));
    expect(await screen.findByText(/mapping des catégories/i)).toBeInTheDocument();
  });
});

// ─── AccountMappingRow ────────────────────────────────────────────────────────

describe('ImportManager — AccountMappingRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sélectionner 'Ignorer' masque le formulaire de création", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'skip');
    expect(screen.queryByPlaceholderText(/nom du compte/i)).not.toBeInTheDocument();
  });

  it('changer le compte cible quand action = Mapper', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', { name: /action pour ACC1/i });
    await user.selectOptions(actionSelect, 'map');
    const targetSelect = await screen.findByRole('combobox', { name: /compte cible pour ACC1/i });
    await user.selectOptions(targetSelect, '2');
    expect(targetSelect).toHaveValue('2');
  });

  it('modifier les champs du formulaire de création de compte', async () => {
    const user = userEvent.setup();
    const { container } = renderImportManager();
    await uploadQif(user);

    // Le formulaire est déjà visible (action par défaut = 'create')
    const nameInput = await screen.findByPlaceholderText(/nom du compte/i);
    fireEvent.change(nameInput, { target: { value: 'Mon compte' } });
    expect(nameInput).toHaveValue('Mon compte');

    // Banque et type (selects sans aria-label, après le select d'action)
    const allSelects = container.querySelectorAll('select');
    fireEvent.change(allSelects[1], { target: { value: '' } });
    fireEvent.change(allSelects[2], { target: { value: '' } });

    // Solde initial (type=text → role textbox)
    const balanceInput = screen.getByRole('textbox', { name: /solde initial/i });
    fireEvent.change(balanceInput, { target: { value: '500' } });
    expect(balanceInput).toHaveValue('500');

    // Date d'ouverture
    const dateInput = container.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-01-15' } });
    expect(dateInput).toHaveValue('2024-01-15');
  });
});

// ─── CategoryMappingRow ───────────────────────────────────────────────────────

describe('ImportManager — CategoryMappingRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sélectionner 'Créer' affiche le formulaire de catégorie", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToCategories(user);
    const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
    await user.selectOptions(catSelect, 'create');
    expect(screen.getByPlaceholderText(/nom sous-catégorie/i)).toBeInTheDocument();
  });

  it('changer la sous-catégorie cible quand action = Mapper', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToCategories(user);
    const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
    await user.selectOptions(catSelect, 'map');
    const subCatSelect = await screen.findByRole('combobox', {
      name: /catégorie cible pour Alimentation/i,
    });
    await user.selectOptions(subCatSelect, '1');
    expect(subCatSelect).toHaveValue('1');
  });

  it('modifier les champs du formulaire de création de catégorie', async () => {
    const user = userEvent.setup();
    const { container } = renderImportManager();
    await goToCategories(user);
    const catSelect = await screen.findByRole('combobox', { name: /action pour Alimentation/i });
    await user.selectOptions(catSelect, 'create');

    // Nom de la sous-catégorie
    const subcatInput = screen.getByPlaceholderText(/nom sous-catégorie/i);
    fireEvent.change(subcatInput, { target: { value: 'Courses bio' } });
    expect(subcatInput).toHaveValue('Courses bio');

    // Catégorie parente → sélectionner '+ Nouvelle catégorie…' pour afficher le champ nom
    const parentSelect = container.querySelector('select option[value="__new__"]')
      ?.parentElement as HTMLSelectElement | null;
    if (parentSelect) {
      fireEvent.change(parentSelect, { target: { value: '__new__' } });
      const newCatInput = screen.getByPlaceholderText(/nouvelle catégorie/i);
      fireEvent.change(newCatInput, { target: { value: 'Bio' } });
      expect(newCatInput).toHaveValue('Bio');
    }
  });
});

// ─── Navigation et interactions QIF supplémentaires ──────────────────────────

describe('ImportManager — navigation et interactions QIF supplémentaires', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("le bouton ← Retour de l'étape Comptes revient à l'upload", async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    await user.click(await screen.findByRole('button', { name: /← retour/i }));
    expect(screen.getByText(/déposez votre fichier ici/i)).toBeInTheDocument();
  });

  it("modifie le mapping d'un compte de virement détecté", async () => {
    vi.mocked(parseQif).mockReturnValueOnce({
      transactions: [
        {
          date: '15/01/2024',
          amount: -100,
          description: 'Virement',
          qifAccountName: 'ACC1',
          category: '',
          memo: null,
          cleared: true,
          isTransfer: true,
          transferTarget: 'CompteVirement',
        },
      ],
      accounts: ['ACC1'],
      uniqueCategories: [],
      uniqueTransferTargets: ['CompteVirement'],
      detectedDateFormat: 'DD/MM',
    });
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const actionSelect = await screen.findByRole('combobox', {
      name: /action pour CompteVirement/i,
    });
    await user.selectOptions(actionSelect, 'skip');
    expect(actionSelect).toHaveValue('skip');
  });

  it('affiche une erreur si le QIF ne contient aucune transaction', async () => {
    vi.mocked(parseQif).mockReturnValueOnce({
      transactions: [],
      accounts: [],
      uniqueCategories: [],
      uniqueTransferTargets: [],
      detectedDateFormat: 'DD/MM',
    });
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    expect(await screen.findByText(/aucune transaction trouvée/i)).toBeInTheDocument();
  });

  it("affiche les comptes de virement détectés dans l'étape Comptes", async () => {
    vi.mocked(parseQif).mockReturnValueOnce({
      transactions: [
        {
          date: '15/01/2024',
          amount: -100,
          description: 'Virement vers épargne',
          qifAccountName: 'ACC1',
          category: '',
          memo: null,
          cleared: true,
          isTransfer: true,
          transferTarget: 'CompteVirement',
        },
      ],
      accounts: ['ACC1'],
      uniqueCategories: [],
      uniqueTransferTargets: ['CompteVirement'],
      detectedDateFormat: 'DD/MM',
    });
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    expect(await screen.findByText(/comptes de virement détectés/i)).toBeInTheDocument();
    expect(screen.getByText('CompteVirement')).toBeInTheDocument();
  });

  it("handleDrop déclenche le chargement d'un fichier QIF", async () => {
    renderImportManager();
    const file = new File(['!Type:Bank'], 'test.qif', { type: 'text/plain' });
    const dropZone = screen.getByText(/déposez votre fichier ici/i).closest('label');
    fireEvent.drop(dropZone!, { dataTransfer: { files: [file] } });
    expect(await screen.findByText(/mapping des comptes/i)).toBeInTheDocument();
  });

  it("les événements dragOver et dragLeave s'exécutent sans erreur", () => {
    renderImportManager();
    const dropZone = screen.getByText(/déposez votre fichier ici/i).closest('label');
    fireEvent.dragOver(dropZone!);
    fireEvent.dragLeave(dropZone!);
    expect(dropZone).toBeInTheDocument();
  });

  it('bascule le format de date vers MM/DD', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    const mmddButton = await screen.findByRole('button', { name: /mm\/dd/i });
    await user.click(mmddButton);
    expect(mmddButton).toHaveClass('bg-brand-600');
  });

  it('le bouton ← Retour de Catégories revient à Comptes', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToCategories(user);
    await user.click(screen.getByRole('button', { name: /← retour/i }));
    expect(await screen.findByText(/mapping des comptes/i)).toBeInTheDocument();
  });

  it('le bouton ← Retour de Prévisualisation revient à Catégories', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /← retour/i }));
    expect(await screen.findByText(/mapping des catégories/i)).toBeInTheDocument();
  });

  it('selectAll après deselectAll resélectionne tous les éléments', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    const checkboxes = await screen.findAllByRole('checkbox');
    await user.click(checkboxes[0]); // deselectAll
    expect(screen.getByRole('button', { name: /importer 0/i })).toBeDisabled();
    await user.click(checkboxes[0]); // selectAll
    expect(screen.getByRole('button', { name: /importer 2/i })).not.toBeDisabled();
  });

  it('coche un élément après deselectAll (branche n.add)', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    const checkboxes = await screen.findAllByRole('checkbox');
    await user.click(checkboxes[0]); // deselectAll → selected = {}
    await user.click(checkboxes[1]); // toggleItem → n.add(0)
    expect(screen.getByRole('button', { name: /importer 1/i })).not.toBeDisabled();
  });

  it('affiche les lignes ignorées dans la table de prévisualisation', async () => {
    const user = userEvent.setup();
    renderImportManager();
    await goToPreviewNoMapping(user);
    expect(await screen.findByText(/catégorie ignorée/i)).toBeInTheDocument();
  });

  it('affiche et décoche un virement dans la table de prévisualisation', async () => {
    vi.mocked(parseQif).mockReturnValueOnce({
      transactions: [
        {
          date: '15/01/2024',
          amount: -100,
          description: 'Virement',
          qifAccountName: 'ACC1',
          category: '',
          memo: null,
          cleared: true,
          isTransfer: true,
          transferTarget: 'ACC2',
        },
      ],
      accounts: ['ACC1'],
      uniqueCategories: [],
      uniqueTransferTargets: ['ACC2'],
      detectedDateFormat: 'DD/MM',
    });
    vi.mocked(findTransferPeer).mockReturnValueOnce(-1);

    const user = userEvent.setup();
    renderImportManager();
    await uploadQif(user);
    await user.click(await screen.findByRole('button', { name: /catégories →/i }));
    await user.click(await screen.findByRole('button', { name: /aperçu →/i }));
    expect(await screen.findByText('virement')).toBeInTheDocument();

    // Décoche le virement → toggleItem (ligne 1055)
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    expect(screen.getByRole('button', { name: /importer 0/i })).toBeDisabled();
  });
});

// ─── Voir les transactions ────────────────────────────────────────────────────

describe("ImportManager — 'Voir les transactions'", () => {
  afterEach(() => vi.unstubAllGlobals());

  it('navigue vers /transactions au clic', async () => {
    server.use(
      http.post('/api/import/qif', () =>
        HttpResponse.json({ transactions: 1, transfers: 0 }, { status: 201 }),
      ),
    );
    const user = userEvent.setup();
    renderImportManager();
    await goToPreview(user);
    await user.click(await screen.findByRole('button', { name: /importer/i }));
    await screen.findByText(/importation terminée/i);

    // Stub location APRÈS l'import pour ne pas casser MSW
    const fakeLocation = { href: '' };
    vi.stubGlobal('location', fakeLocation);

    await user.click(screen.getByRole('button', { name: /voir les transactions/i }));
    expect(fakeLocation.href).toBe('/transactions');
  });
});
