import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, RootErrorBoundary } from './App';
import { logFailure } from './platform';
import './ui/theme/tokens.css';

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
