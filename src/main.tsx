import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, RootErrorBoundary } from './App';
import { detectOs, logFailure } from './platform';
import { setDesktopLayout } from './ui/useLayout';
import './ui/theme/tokens.css';

// BL-119 (D-450) : un PC Windows garde la disposition PC à toute largeur (zoom de 150 %), déclaré avant le premier rendu.
setDesktopLayout(detectOs() === 'windows');

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable dans index.html');

// I-04 : journal technique persistant (fichier pour la fenêtre principale seulement), chargé à la demande.
void import('./features/app/logJournalBoot').then(
  (module) => module.startLogJournal('main'),
  (error: unknown) => logFailure('logs', error),
);

createRoot(container).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
