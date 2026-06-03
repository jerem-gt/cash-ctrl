/**
 * Limiteur de tentatives en mémoire, pensé pour freiner le brute-force sur le
 * login. Le serveur tournant en mono-process (better-sqlite3), un état en RAM
 * suffit — pas besoin de store partagé ni de dépendance externe.
 *
 * On ne compte que les échecs : une authentification réussie remet le compteur
 * à zéro. Les entrées expirées sont purgées paresseusement à chaque accès.
 */
export class FailureRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxAttempts = 10,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  /** true si la clé est sous le seuil (tentative autorisée). */
  isAllowed(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return true;
    if (entry.resetAt <= Date.now()) {
      this.attempts.delete(key);
      return true;
    }
    return entry.count < this.maxAttempts;
  }

  /** Enregistre un échec et (re)démarre la fenêtre si nécessaire. */
  recordFailure(key: string): void {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
  }

  /** Réinitialise le compteur d'une clé (succès). */
  reset(key: string): void {
    this.attempts.delete(key);
  }
}
