export function appName(): string {
  return import.meta.env.DEV
      ? `${import.meta.env.VITE_APP_NAME} (dev)`
      : import.meta.env.VITE_APP_NAME;
}
