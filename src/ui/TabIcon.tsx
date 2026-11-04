/**
 * Icônes des cinq sections (maquettes docs/maquettes/ : trait de 1,6 px, 22 × 22). Dessinées en `currentColor` : la couleur vient des
 * jetons de la barre. Un identifiant inconnu ne dessine rien.
 */
const PATHS: Readonly<Record<string, string>> = {
  today: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v10M7 12h10',
  training: 'M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12',
  nutrition: 'M5 9h14l-1.2 10.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 9ZM9 9V7a3 3 0 0 1 6 0v2',
  progress: 'M4 19h16M5 15l4-4 3 3 6-7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};

export function TabIcon({ id, size = 22 }: { readonly id: string; readonly size?: number }) {
  const path = Object.hasOwn(PATHS, id) ? PATHS[id] : undefined;
  return (
    <svg className="ct-tab-rail__icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {path ? <path d={path} /> : null}
    </svg>
  );
}
