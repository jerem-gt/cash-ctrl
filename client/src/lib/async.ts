// Promise.resolve + catch no-op : concilie no-floating-promises (ESLint) et l'interdiction de `void` (Sonar).
// Le paramètre accepte aussi `void` car certaines API (ex. navigate() de react-router) sont typées `void | Promise<void>`.
export function fireAndForget(promise: Promise<unknown> | void): void {
  Promise.resolve(promise).catch(() => undefined);
}
