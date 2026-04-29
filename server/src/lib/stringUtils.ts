export const toFileName = (s: string) => {
  let res = s
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-');

  // Nettoyage manuel des bords (Beaucoup plus rapide et 100% sûr)
  if (res.startsWith('-')) res = res.slice(1);
  if (res.endsWith('-')) res = res.slice(0, -1);

  return res;
};
