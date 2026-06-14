import type { Database } from 'better-sqlite3';

import type {
  CategorizationRule,
  CreateRuleInput,
  UpdateRuleInput,
} from './categorization-rules.types';

function longestCommonWordPrefix(descriptions: string[]): string {
  if (descriptions.length === 1) return descriptions[0];
  const wordLists = descriptions.map((d) => d.split(/\s+/).filter(Boolean));
  const shortest = wordLists.reduce((a, b) => (a.length <= b.length ? a : b), wordLists[0]);
  let commonLen = 0;
  for (const [i, element] of shortest.entries()) {
    if (wordLists.every((words) => words[i] === element)) {
      commonLen = i + 1;
    } else {
      break;
    }
  }
  return shortest.slice(0, commonLen).join(' ');
}

export function createCategorizationRulesRepo(db: Database, userId: number) {
  const getAllStmt = db.prepare<{ userId: number }, CategorizationRule>(
    'SELECT * FROM categorization_rules WHERE user_id = :userId ORDER BY sort_order, id',
  );

  const getByIdStmt = db.prepare<{ id: number; userId: number }, CategorizationRule>(
    'SELECT * FROM categorization_rules WHERE id = :id AND user_id = :userId',
  );

  const createStmt = db.prepare<{
    userId: number;
    pattern: string;
    subcategoryId: number;
    sortOrder: number;
  }>(
    'INSERT INTO categorization_rules (user_id, pattern, subcategory_id, sort_order) VALUES (:userId, :pattern, :subcategoryId, :sortOrder)',
  );

  const updateStmt = db.prepare<{
    id: number;
    userId: number;
    pattern: string;
    subcategoryId: number;
  }>(
    'UPDATE categorization_rules SET pattern = :pattern, subcategory_id = :subcategoryId WHERE id = :id AND user_id = :userId',
  );

  const deleteStmt = db.prepare<{ id: number; userId: number }>(
    'DELETE FROM categorization_rules WHERE id = :id AND user_id = :userId',
  );

  const deleteAllStmt = db.prepare<{ userId: number }>(
    'DELETE FROM categorization_rules WHERE user_id = :userId',
  );

  const matchStmt = db.prepare<{ userId: number; description: string }, CategorizationRule>(`
    SELECT * FROM categorization_rules
    WHERE user_id = :userId AND LOWER(:description) LIKE LOWER(pattern)
    ORDER BY sort_order, id
    LIMIT 1
  `);

  const maxSortOrderStmt = db.prepare<{ userId: number }, { max: number | null }>(
    'SELECT MAX(sort_order) as max FROM categorization_rules WHERE user_id = :userId',
  );

  const existsPatternStmt = db.prepare<{ userId: number; pattern: string }, { cnt: number }>(
    'SELECT COUNT(*) as cnt FROM categorization_rules WHERE user_id = :userId AND LOWER(pattern) = LOWER(:pattern)',
  );

  const historyRawStmt = db.prepare<
    { userId: number },
    { description: string; subcategory_id: number; cnt: number }
  >(`
    SELECT LOWER(TRIM(description)) as description, subcategory_id, COUNT(*) as cnt
    FROM transactions
    WHERE user_id = :userId AND subcategory_id IS NOT NULL AND TRIM(description) != ''
    GROUP BY LOWER(TRIM(description)), subcategory_id
    HAVING COUNT(*) >= 2
    ORDER BY cnt DESC
  `);

  return {
    getAll(): CategorizationRule[] {
      return getAllStmt.all({ userId });
    },

    getById(id: number): CategorizationRule | undefined {
      return getByIdStmt.get({ id, userId });
    },

    create(data: CreateRuleInput): CategorizationRule {
      const maxRow = maxSortOrderStmt.get({ userId });
      const sortOrder = (maxRow?.max ?? -1) + 1;
      const result = createStmt.run({
        userId,
        pattern: data.pattern,
        subcategoryId: data.subcategory_id,
        sortOrder,
      });
      return getByIdStmt.get({ id: Number(result.lastInsertRowid), userId })!;
    },

    update(id: number, data: UpdateRuleInput): CategorizationRule | undefined {
      const info = updateStmt.run({
        id,
        userId,
        pattern: data.pattern,
        subcategoryId: data.subcategory_id,
      });
      if (info.changes === 0) return undefined;
      return getByIdStmt.get({ id, userId });
    },

    delete(id: number): boolean {
      return deleteStmt.run({ id, userId }).changes > 0;
    },

    deleteAll(): number {
      return deleteAllStmt.run({ userId }).changes;
    },

    match(description: string): CategorizationRule | undefined {
      return matchStmt.get({ userId, description });
    },

    initFromHistory(): number {
      const rows = historyRawStmt.all({ userId });

      // Pour chaque description, garder la sous-catégorie la plus fréquente
      const descToSubcat = new Map<string, { subcategoryId: number; cnt: number }>();
      for (const row of rows) {
        const existing = descToSubcat.get(row.description);
        if (!existing || row.cnt > existing.cnt) {
          descToSubcat.set(row.description, { subcategoryId: row.subcategory_id, cnt: row.cnt });
        }
      }

      // Grouper les libellés par sous-catégorie
      const bySubcat = new Map<number, string[]>();
      for (const [desc, { subcategoryId }] of descToSubcat) {
        const list = bySubcat.get(subcategoryId) ?? [];
        list.push(desc);
        bySubcat.set(subcategoryId, list);
      }

      // Calculer le pattern pour chaque groupe
      const toInsert: { pattern: string; subcategoryId: number }[] = [];
      for (const [subcategoryId, descs] of bySubcat) {
        const prefix = longestCommonWordPrefix(descs);
        if (prefix.length >= 3) {
          toInsert.push({ pattern: `%${prefix}%`, subcategoryId });
        } else {
          for (const desc of descs) {
            toInsert.push({ pattern: `%${desc}%`, subcategoryId });
          }
        }
      }

      let inserted = 0;
      const insertOne = db.transaction((entry: { pattern: string; subcategoryId: number }) => {
        const exists = existsPatternStmt.get({ userId, pattern: entry.pattern });
        if ((exists?.cnt ?? 0) > 0) return;
        const maxRow = maxSortOrderStmt.get({ userId });
        const sortOrder = (maxRow?.max ?? -1) + 1;
        createStmt.run({
          userId,
          pattern: entry.pattern,
          subcategoryId: entry.subcategoryId,
          sortOrder,
        });
        inserted++;
      });
      for (const entry of toInsert) insertOne(entry);
      return inserted;
    },
  };
}
