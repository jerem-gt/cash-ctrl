# PRÉLÈVEMENT COMPTÉ 2 FOIS APRÈS CHANGEMENT DE DATE

**Bug confirmé le 07/08/2026. Correction planifiée — approche choisie.**

## Symptôme
Sur le graphe de solde (carte `AccountBalanceHistoryCard`), un prélèvement dont la
date est déplacée vers aujourd'hui puis **validé** est **compté 2 fois** :
- une fois à la **nouvelle date** (aujourd'hui),
- une fois à l'**ancienne date**.

Persistence : un refresh ne corrige pas (les 2 sources sont recalculées à chaque
requête).

## Cause racine
Le graphe combine **deux sources indépendantes** sur le même compte :
1. **Passé** : uniquement les transactions **validées** (`account-balance-history.repo.ts`).
2. **Futur (forecast)** : **recalculé depuis la config** de la planif via
   `forEachOccurrence`, **en ignorant la table `transactions`** (`forecast.repo.ts`).

Quand une occurrence est déplacée en éditant la transaction pré-générée (le client
conserve `scheduled_id`), la transaction validée apparaît à la nouvelle date dans
le **passé**, mais le **forecast** re-projette toujours l'occurrence à l'ancienne
date config → même montant affiché 2 fois.

Fichiers concernés :
- `server/src/modules/stats/forecast.repo.ts` (`addFlowsFromSchedule`, ~l.48-66)
- `server/src/modules/stats/account-balance-history.repo.ts`
- `client/src/features/accounts/components/AccountBalanceHistoryCard.tsx`

## Correction implémentée (07/08/2026) : table d'abord, config en fallback
**Fichier** : `server/src/modules/stats/forecast.repo.ts`.

Dans `getForecast`, pour chaque planif :
1. Lire **toutes** les lignes `transactions` du plan (date >= aujourd'hui) :
   `SELECT account_id, type, amount, date, validated FROM transactions
   WHERE scheduled_id = :id AND date >= :from AND date <= :to ORDER BY date`.
   - Delta appliqué **uniquement** pour `validated = 0` (les validées sont déjà dans
     `current_balance`, somme sans filtre de date → les réprojeter ferait un doublon).
2. Fallback config ancré sur la **dernière ligne connue** (`MAX(date)`, validée ou
   non) via `resumeFrom` — conserve le rythme d'origine au-delà de la fenêtre de
   pré-génération (J+30). Si aucune ligne → projection de la config comme avant.
   (deltas de rows + fallback extraits dans `addScheduleRows`, construction des
   points dans `buildForecastAccounts` — limite complexité cognitive Sonar.)

### Pourquoi c'est robuste
- Les déplacements se font en général **autour de la date du jour** → capturés dans
  la fenêtre pré-générée (30 j) ; le fallback config n'intervient que bien plus loin.
- **Transferts** : les 2 legs portent `scheduled_id` (`transfers.repo.ts:50,56`) →
  lecture brute = delta correct par compte.
- **Versements AV/PER** : la transaction générée porte `scheduled_id` → idem.
- Traite **trans-mensuel**, **suppression d'occurrence future**, etc.

### Règles anti-doublon
- Ne projeter **jamais** une ligne `validated = 1` : déjà dans `current_balance`
  (somme des validées sans filtre de date).
- Garder l'occurrence non validée **à aujourd'hui** pré-générée dans `points[0]`
  (`date >= today`, comportement actuel, cf. test « occurrence planifiée le jour même »).

### Limites résiduelles
- `weekend_handling` : les dates lues sont réelles (post-ajustement) ; baser le
  fallback sur `MAX(date)` peut dériver le nominal. Impact faible.

### Correctif (08/08/2026) : déplacement d'une occurrence vers le **passé**
Le fix initial n'anchait le fallback config que sur la **fenêtre** pré-générée
(`date >= aujourd'hui`). Avancer un loyer du 10 au 7 (`PUT /api/transactions/:id`,
date passée + `validated: true`, `scheduled_id` conservé) sortait l'occurrence de
cette fenêtre → `lastMaterialized: null` → re-projection de la config : le loyer
réapparaissait à l'ancienne date (double comptage « aujourd'hui + ancienne date »).

**Correctif** (`forecast.repo.ts`) : l'ancre provient désormais de la **dernière
échéance matérialisée toutes périodes confondues**
(`SELECT MAX(date) FROM transactions WHERE scheduled_id = ? AND user_id = ?`, sans
filtre de date). Le fallback reprend le rythme après elle même lorsqu'elle est dans
le passé → l'occurrence déplacée/validée n'est plus re-projetée, les suivantes le
restent.
- [x] TU : « loyer avancé : déplacer l'occurrence à une date passée ne la
      réapparaît pas dans le forecast » (`forecast.routes.test.ts`)
- [x] Suite serveur complète verte (694 tests) + `tsc --noEmit` + eslint

## Étapes réalisées
- [x] `forecast.repo.ts` : table d'abord + fallback + helpers (`addScheduleRows`,
      `buildForecastAccounts`)
- [x] TU serveur (`forecast.routes.test.ts`) : **cas unique** (occurrence déplacée +
      validée → plus projetée) et **cas récurrent** (rythme des semaines suivantes
      conservé, ancienne date absente)
- [x] Suite serveur complète verte (693 tests) + `tsc --noEmit` + eslint
- [x] Tests client (`AccountBalanceHistoryCard`, `ForecastCard`, `useForecast`) +
      `tsc --noEmit` client (contrat API inchangé)

## Reproduction de référence (confirme)
`PUT /api/transactions/:id` — date → aujourd'hui, `validated: true`,
`scheduled_id` conservé :
- `/api/stats/accounts/:accountId/balance-history` → baisse à aujourd'hui,
- avant correction : `/api/stats/forecast` baisse **encore** à l'ancienne date ;
  après correction : `forecast` ne re-projette plus l'ancienne date.