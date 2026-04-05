const KEY = "color_favorites";
const MAX = 12;

export function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch { return []; }
}

export function addFavorite(color: string): string[] {
  const favs = getFavorites().filter(c => c.toLowerCase() !== color.toLowerCase());
  const next = [color, ...favs].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeFavorite(color: string): string[] {
  const next = getFavorites().filter(c => c.toLowerCase() !== color.toLowerCase());
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
