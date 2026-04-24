export function appName(): string {
  return import.meta.env.DEV ? 'CashCtrl (dev)' : 'CashCtrl';
}
