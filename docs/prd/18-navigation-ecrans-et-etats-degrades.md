## 18. Navigation, écrans et états dégradés

### 18.1 Deux coquilles, un même code

|  | iPhone (16 Pro Max, iOS 18+) | PC (Windows 10/11) |
| --- | --- | --- |
| Navigation | 5 onglets bas : Aujourd'hui, Entraînement, Nutrition, Progrès, Plus | Barre latérale rétractable avec les mêmes 5 sections + Réglages ; raccourcis clavier (`Ctrl+1…5`, `Ctrl+K` recherche) |
| Largeur | Une colonne, safe areas Dynamic Island / home indicator (mécanisme CircleTasks, `src/platform`) | Fenêtre redimensionnable ≥ 1 024 × 700 ; vues maître-détail (liste à gauche, fiche à droite) |
| Gestes | Swipe, long-press, haptique (plugin `haptics` repris) | Clic droit → menus, double-clic, glisser-déposer pour réordonner |
| Séance | Minuteur système (Live Activity si `CONFIRMED`), verrouillage géré (ADR 0013) | Minuteur en fenêtre + badge dans le titre ; pas de notification système requise |
| Rôle principal | Séance, scan, photo, Santé, récupération | Programmation, bibliothèque, profils matériel, bilans, export, saisie nutrition au clavier |

Les écrans sont les mêmes composants React (`src/features/*`) ; seule la coquille change : `src/ui/AppShell.tsx` et `src/ui/TabRail.tsx`, dont la disposition est choisie par `useLayout()` (`src/ui/useLayout.ts`, rupture à 1 024 px, `PC_MIN_WIDTH_PX`) et `detectOs()` (`src/platform/runtime.ts`) ; pas de `MobileShell` / `DesktopShell` ni de `platform.kind` (D-47). Aucun écran n'est réservé à un appareil : une fonction indisponible (caméra, Santé) affiche un état « disponible sur iPhone » explicite, jamais un bouton mort.

### 18.2 Écrans par onglet

| Onglet | Écrans | Itération |
| --- | --- | --- |
| Aujourd'hui | Cadrans récupération / sommeil / effort, séance du jour, cibles nutrition restantes, streak, état de la synchro et de la signature | I1 → I5 |
| Entraînement | Routines, Mes programmes, Lancer, Séance active, Résumé, Historique, Bibliothèque, Profils matériel | I1 → I3 |
| Nutrition | Journal, Recherche / Scan / Photo, Dashboard, Stratégie, Check-in | I4 |
| Progrès | Graphiques, Records, Strength Score, Corps, Bilans | I2 → I6 |
| Plus | Profil, Objectifs, Appareils et synchro, Apple Santé, Clé IA et budget, Export / import, Journaux, À propos et licences | I0 → I6 |

### 18.3 États dégradés (obligatoires, testés)

| Situation | Comportement |
| --- | --- |
| Aucune donnée (première semaine) | Écrans d'apprentissage « J+x », pas de faux zéro, pas de graphique vide |
| Pas de Watch / Santé refusée | Niveau A ou B (§ 16), cadrans masqués avec explication |
| iCloud absent ou hors ligne | Tout fonctionne en local ; bandeau discret « dernière synchro il y a … » ; reprise automatique (ADR 0011) |
| Conflit de synchro | Résolu par HLC par champ ; ligne dans le journal ; jamais de boîte de dialogue bloquante |
| Signature expirée dans < 24 h | Notification + bandeau Aujourd'hui (I-02 repris) ; procédure SideStore en un lien |
| Clé IA absente / budget épuisé | Fonctions IA grisées avec cause ; tout le reste intact |
| Live Activity indisponible | Minuteur en app + notification locale ; même précision |
| Verrouillage pendant une séance | Reprise exacte (timer, série en cours) à la réouverture (ADR 0013) |
| Crash | Séance en cours restaurée depuis SQLite (écriture à chaque série) |

### 18.4 Charte visuelle (D-19)

Identité **laconique, sombre, rouge et bronze**. Tokens dans `src/ui/theme/tokens.css`, consommés par tous les composants ; aucune couleur en dur ailleurs (règle vérifiée par `lint`).

| Token | Sombre (défaut) | Clair | Usage |
| --- | --- | --- | --- |
| `--bg` | `#0D0E11` | `#F4F1EA` | Fond de page |
| `--surface` / `--surface-2` | `#15171C` / `#1D2027` | `#FFFFFF` / `#ECE8DF` | Cartes, barres |
| `--line` | `#2A2E37` | `#D8D2C6` | Séparateurs |
| `--fg` / `--fg-2` | `#EDE7DC` / `#A39C90` | `#15171C` / `#5E584F` | Texte ivoire / secondaire |
| `--accent` | `#B8322A` (hover `#D23B31`) | `#B8322A` | Rouge : bouton principal, série validée, zone rouge |
| `--bronze` / `--bronze-2` | `#C28E4C` / `#E0B577` | `#8E6530` / `#C28E4C` | Records, 1RM, scores, titres de section |
| `--ok` / `--warn` / `--info` | `#5E9E6B` / `#D9A441` / `#6F8FB3` | mêmes | Zones verte / jaune de récupération, états |

Règles de contraste (WCAG AA, vérifiées : ivoire sur fond 15,7 ; secondaire sur surface 6,6 ; bronze sur surface 6,2 ; ivoire sur rouge 4,8) : le rouge **n'est jamais une couleur de texte** sur fond sombre (3,0) — uniquement un fond portant du texte ivoire ; le vert porte du texte sombre, jamais ivoire (2,6). Un test `test:contrast` (script Node) recalculant ces ratios à chaque modification des tokens est **à créer** (D-35, ticket dédié rattaché à SPA-009) ; il n'existe pas dans CircleTasks et `lint` seul ne prouve pas toutes les règles de couleur.

| Élément | Choix |
| --- | --- |
| Typographie | Corps : police système (SF Pro sur iPhone, Segoe UI sur Windows), zéro poids embarqué ; titres et grands chiffres : capitales romaines « Cinzel » (SIL OFL, une graisse, \~60 Ko, dans le bundle) ; chiffres tabulaires partout où une valeur change (charges, timer) |
| Mode | Sombre par défaut, clair disponible, suit le système, forçable dans Plus |
| Icônes | Jeu d'icônes déjà présent dans CircleTasks s'il existe, sinon Lucide (ISC) ; trait 1,75 px ; pas d'emoji dans l'interface |
| Icône d'app | Bouclier rond bronze sur fond `#0D0E11`, lambda (Λ) rouge au centre ; SVG source dans `content/brand/`, exports 1024 px (iOS) et ICO (Windows) générés par script |
| Formes | Rayons 10 px ; grille 4 pt ; cibles tactiles ≥ 44 pt sur iPhone ; densité plus forte sur PC (tables à 32 px de ligne) |
| Ton | Libellés courts, impératifs, sans point d'exclamation ni confetti ; le chiffre d'abord, l'explication en dessous ; aucune mascotte |
| Mouvement | Transitions ≤ 200 ms ; aucune animation décorative ; respect de « réduire les animations » |

### 18.5 Maquettes

L'interface est **responsive** : un seul code, les composants se réorganisent selon la largeur (`useLayout()` ne choisit que la disposition de la coquille § 18.1). Responsive ne veut pas dire identique : à 440 px un écran tient en une colonne défilante, à 1 440 px il devient maître-détail ou multi-colonnes. Les maquettes fixent donc **la disposition à chaque largeur**, pas une image par appareil ; une seule largeur suffit quand la mise en page ne fait que se reflouer.

| Maquette | 440 px | 1 440 px | Raison |
| --- | --- | --- | --- |
| Onboarding (8 écrans) | ✓ | — | Formulaire pas à pas, même disposition centrée sur PC |
| Aujourd'hui | ✓ | ✓ | Cadrans empilés vs grille 3 + 2 |
| Routine / Programme | ✓ | ✓ | Liste par jour vs grille jours × exercices |
| Séance active | ✓ | ✓ | Un écran tactile vs saisie clavier avec historique à droite |
| Résumé de séance | ✓ | — | — |
| Fiche exercice | ✓ | ✓ | Onglets vs trois colonnes |
| Profil de matériel | — | ✓ | Édition principalement sur PC ; reflow suffisant sur iPhone |
| Journal nutrition | ✓ | ✓ | Timeline vs timeline + recherche permanente |
| Dashboard nutrition | ✓ | ✓ | Cartes empilées vs grille |
| Check-in hebdo | ✓ | — | Carte unique |
| Récupération | ✓ | — | Lecture seule sur PC, même carte |
| Progrès | ✓ | ✓ | Un graphique à la fois vs tableau de bord |
| Plus → Appareils et synchro | ✓ | ✓ | QR à scanner vs QR à afficher |
| États dégradés (3) | ✓ | — | Bandeaux et cartes vides, identiques |

**Maquettes validées le 31 octobre 2026 (D-21)** : 24 planches HTML autonomes à taille réelle (iPhone 16 Pro Max 440 × 956 pt, PC 1440 × 900), même méthode que CircleTasks, mode sombre selon § 18.4, données d'exemple figées (ven. 30 oct. 2026, programme Haut / Bas 4 j, semaine 2 / 5). Livrées dans `docs/maquettes/` du fork avec `index.html` ; le PRD les désigne comme **référence visuelle** : écart PRD / maquette → la maquette est suivie et l'écart noté dans `docs/decisions.md` ; écran sans maquette → composé à partir des motifs de Plus / Réglages et consigné. `npm run visual` capture l'app et la maquette à la même taille pour comparaison à chaque lot ; les paires de captures sont relues par un humain, sans seuil de pixels automatique (D-35). Point de rupture unique `≥ 900 px` = disposition PC (H-19a : aucune largeur intermédiaire, pas d'iPad).

| Fichier | Écran | Ce que la planche fixe |
| --- | --- | --- |
| `iPhone-Onboarding.html` | Onboarding, étape 6 / 8 | Body map priorités / évités, mouvements douloureux, « ignorer » toujours possible ; gabarit des 7 autres étapes |
| `iPhone-Aujourdhui.html` · `PC-Aujourdhui.html` | Aujourd'hui | Trois cadrans, séance du jour avec charges, nutrition restante, semaine, poids ; PC en trois colonnes bornées |
| `iPhone-Routine.html` · `PC-Routine.html` | Programme | Mésocycle et périodisation S1–S5, jours, Lancer / Sauter / Deload, pause ; PC grille jours × exercices, actions de page en haut |
| `iPhone-Seance.html` · `PC-Seance.html` | Séance active | Un écran, série en cours, « Pourquoi ? », repos collant, Facile / Juste / Dur ; PC clavier, historique et explication à droite |
| `iPhone-Resume.html` | Résumé de séance | Records, écart au plan, muscle map, Apple Santé, « Mettre à jour la routine ? » |
| `iPhone-Fiche.html` · `PC-Fiche.html` | Fiche exercice | Info / Instructions / Historique ; PC recherche permanente + trois colonnes |
| `PC-Materiel.html` | Profil de matériel | Barres, disques par côté, haltères, machines et 1RM, incréments, forcés / interdits, aperçu des charges |
| `iPhone-Journal.html` · `PC-Journal.html` | Journal nutrition | Timeline horaire, provenance par aliment, jour partiel ; PC recherche au clavier, cibles à droite |
| `iPhone-Dashboard.html` · `PC-Dashboard.html` | Dashboard nutrition | Balance 7 j, tendance 28 j, dépense avec confiance et couverture ; PC + Stratégie et historique des check-ins |
| `iPhone-CheckIn.html` | Check-in hebdomadaire | Résumé, proposition motivée (lissage 4 semaines), Accepter / Personnaliser / Refuser |
| `iPhone-Recuperation.html` | Récupération | Contributeurs vs baseline, zone cible, coucher cible, par muscle, journal de facteurs |
| `iPhone-Progres.html` · `PC-Progres.html` | Progrès | Un graphique à la fois ; PC tableau de bord, Strength Score, constance, export |
| `iPhone-Appairage.html` · `PC-Appairage.html` | Appareils et synchro | Scanner / afficher le QR, clé de récupération, journal ; destructif en bas et annoncé |
| `iPhone-Degrade-Apprentissage.html` · `-HorsLigne.html` · `-Signature.html` | États dégradés | J+3 sans faux zéro, hors ligne local, signature qui expire (bannière + bandeau) |

Décisions de dessin consignées (D-21) : actions de page en barre du haut sur PC ; caméra d'appairage en bloc et non plein écran ; cadrans remplacés par « en apprentissage » la première semaine ; bandeau de signature prioritaire sur le contenu.

### 18.6 Accessibilité

Dynamic Type suivi jusqu'à « Très grand » sans troncature des charges et du timer ; zoom 100–150 % sur PC ; contraste AA (§ 18.4) ; chaque action tactile a un équivalent clavier sur PC ; « réduire les animations » et « réduire la transparence » respectés ; aucune information portée par la couleur seule (zones de récupération doublées d'un libellé).
