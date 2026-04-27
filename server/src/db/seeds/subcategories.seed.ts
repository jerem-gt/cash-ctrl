import type { Database } from 'better-sqlite3';

import { logger } from '../../logger';

const DEFAULT_SUBCATEGORIES = [
  { name: 'Assurance', category_name: 'Logement' },
  { name: 'Loyer', category_name: 'Logement' },
  { name: 'Électricité', category_name: 'Logement' },
  { name: 'Gaz', category_name: 'Logement' },
  { name: 'Internet', category_name: 'Logement' },
  { name: 'Mobile', category_name: 'Logement' },
  { name: 'Mobilier', category_name: 'Logement' },
  { name: 'Travaux', category_name: 'Logement' },

  { name: 'Achat', category_name: 'Automobile' },
  { name: 'Administratif', category_name: 'Automobile' },
  { name: 'Amende', category_name: 'Automobile' },
  { name: 'Assurance', category_name: 'Automobile' },
  { name: 'Autoroute', category_name: 'Automobile' },
  { name: 'Carburant', category_name: 'Automobile' },
  { name: 'Entretien', category_name: 'Automobile' },

  { name: 'Bus/Tram/Metro', category_name: 'Transports en commun' },
  { name: 'Covoiturage', category_name: 'Transports en commun' },
  { name: 'Train', category_name: 'Transports en commun' },
  { name: 'VTC', category_name: 'Transports en commun' },

  { name: 'Hôpital', category_name: 'Santé' },
  { name: 'Médecin', category_name: 'Santé' },
  { name: 'Pharmacie', category_name: 'Santé' },
  { name: 'CPAM', category_name: 'Santé' },
  { name: 'Mutuelle', category_name: 'Santé' },

  { name: 'Supermarché', category_name: 'Alimentation' },
  { name: 'Restaurant', category_name: 'Alimentation' },
  { name: 'Café', category_name: 'Alimentation' },

  { name: 'Assurance autre', category_name: 'Vie quotidienne' },
  { name: 'Assurance décès', category_name: 'Vie quotidienne' },
  { name: 'Coiffeur', category_name: 'Vie quotidienne' },
  { name: 'Courrier', category_name: 'Vie quotidienne' },
  { name: 'Retrait', category_name: 'Vie quotidienne' },
  { name: 'Vêtements', category_name: 'Vie quotidienne' },
  { name: 'Frais bancaires', category_name: 'Vie quotidienne' },

  { name: 'Cadeau', category_name: 'Loisirs' },
  { name: 'Chèques vacances', category_name: 'Loisirs' },
  { name: 'Cinéma', category_name: 'Loisirs' },
  { name: 'Culturel', category_name: 'Loisirs' },
  { name: 'Informatique', category_name: 'Loisirs' },
  { name: 'Streaming', category_name: 'Loisirs' },
  { name: 'Spectacle', category_name: 'Loisirs' },
  { name: 'Sport', category_name: 'Loisirs' },
  { name: 'Vacances', category_name: 'Loisirs' },

  { name: 'Impôt sur le revenu', category_name: 'Impôts' },
  { name: 'Taxe foncière', category_name: 'Impôts' },
  { name: "Taxe d'habitation", category_name: 'Impôts' },
  { name: 'Prélèvements sociaux', category_name: 'Impôts' },

  { name: 'Salaire', category_name: 'Revenus du travail' },
  { name: 'Abondement', category_name: 'Revenus du travail' },
  { name: 'Intéressement', category_name: 'Revenus du travail' },
  { name: 'Participation', category_name: 'Revenus du travail' },
  { name: 'Remboursement de frais', category_name: 'Revenus du travail' },

  { name: 'APL', category_name: 'Prestations sociales' },
  { name: 'Chômage', category_name: 'Prestations sociales' },

  { name: 'Intérêts', category_name: 'Revenus financiers' },
  { name: 'Plus value latente', category_name: 'Revenus financiers' },
  { name: 'Dividende', category_name: 'Revenus financiers' },

  { name: 'Cadeau', category_name: 'Revenus divers' },
  { name: 'Cashback', category_name: 'Revenus divers' },
  { name: 'Prime', category_name: 'Revenus divers' },
  { name: 'Vente', category_name: 'Revenus divers' },
  { name: 'Autre', category_name: 'Revenus divers' },

  { name: 'Transfert', category_name: 'Transfert' },

  { name: 'Autre', category_name: 'Autre' },
];

export function seedSubcategories(db: Database) {
  const categories = db.prepare('SELECT id, name FROM categories').all() as {
    id: number;
    name: string;
  }[];
  const categoryMap = new Map(categories.map((c) => [c.name, c.id]));

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO subcategories (name, category_id)
    VALUES (?, ?)
  `);

  db.transaction(() => {
    for (const sub of DEFAULT_SUBCATEGORIES) {
      const parentId = categoryMap.get(sub.category_name);

      if (parentId) {
        stmt.run(sub.name, parentId);
      } else {
        logger.warn(
          `Attention : La catégorie parente "${sub.category_name}" n'existe pas pour la sous-catégorie "${sub.name}"`,
        );
      }
    }
  })();
}
