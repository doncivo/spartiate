import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setCatalogFailureReporter } from './i18n';
import { logFailure } from './platform';
import './ui/theme/tokens.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable dans index.html');

// Catalogues de langue chargés à la demande (PERF-02) : un échec de chargement est journalisé, le français sert de repli.
setCatalogFailureReporter((locale, error) => logFailure(`catalog-${locale}`, error));

// I-04 : journal technique persistant (fichier pour la fenêtre principale seulement), chargé à la demande.
void import('./features/app/logJournalBoot').then(
  (module) => module.startLogJournal('main'),
  (error: unknown) => logFailure('logs', error),
);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
