/** Décode un texte JSON stocké : la valeur, ou `undefined` si le texte est illisible (jamais d'exception). */
export function decodeJson(text: string | null): unknown {
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
