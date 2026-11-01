# Benchmark apps fitness — 6 références

30 octobre 2026 · Ali Cherif · référence du PRD § 1.3 et § 27.3 ; prix et notes relevés le 30 octobre 2026

> **Archive de recherche non normative.** Les listes « retenues » et la cible décrite ci-dessous sont historiques : elles ne constituent pas le périmètre autorisé. Le PRD et les décisions approuvées priment, notamment les exclusions (social, commercialisation, Apple Watch) et les cinq onglets. Les prix et capacités des apps ne sont pas revérifiés par cette note. Aucun ticket ne peut être déduit du benchmark seul.

## Objectif et méthode

Ce benchmark retient six apps, une par brique fonctionnelle, pour servir de référence à la nouvelle app : chacune est la meilleure du marché sur sa brique, pas globalement. Pour chaque app, le doc inventorie les fonctionnalités puis les écrans (ce que l'utilisateur voit et manipule), avant une matrice comparative et une sélection « best of » qui alimentera la spécification.

| Brique | App de référence | Pourquoi elle |
| --- | --- | --- |
| Moteur de progression et logistique de salle | Gravl | Algorithme 1RM + rep ladder publié, charges snappées au matériel réel, profils de salle, injury-aware |
| Programmation long terme | Alpha Progression | Périodisation auto séries/reps/RIR sur mésocycle, deloads intégrés, 795 exercices évalués |
| Écran de séance et social | Hevy | Saisie la plus rapide du marché, routines, feed type Strava, 10 M+ d'utilisateurs |
| Nutrition adaptative | MacroFactor | Recalcule chaque semaine les objectifs à partir du poids réel et de la dépense observée |
| Récupération, strain, sommeil | WHOOP (Athlytic en variante Apple Watch) | Modèle Recovery / Strain / Sleep devenu le standard copié partout |
| Intégration iPhone et gamification | Reboot Plan | Dynamic Island, widgets, Apple Santé bidirectionnel, cardio GPS, duels de pas, avatar XP |

uFit AI est écarté du socle : son body scan est jugé peu fiable par les utilisateurs et ses points forts (radar musculaire, readiness) sont mieux traités par Alpha Progression et WHOOP. Il reste une inspiration pour deux écrans : la comparaison avant/après et le replay de séance set par set.

## Vue d'ensemble

Les six apps couvrent le spectre complet : deux ont dépassé le million de téléchargements sur Android (Gravl, Alpha Progression), Hevy est à 5 M+, WHOOP est un écosystème matériel, MacroFactor vit sans gratuit, Reboot Plan est un produit solo à 1 000 téléchargements. Prix annuels relevés au 30 octobre 2026.

| App | Éditeur | Brique de référence | Plateformes | Gratuit | Prix annuel (EUR) | Note App Store (nb notes) |
| --- | --- | --- | --- | --- | --- | --- |
| [Gravl](https://gravl.ai/) | GAINS COACH, Australie | Moteur de progression, salle | iOS, Android, web, Apple Watch, Wear OS, Garmin | 3 séances | 59,99–89,99 $ | 4,9 (5 500) |
| [Alpha Progression](https://alphaprogression.com/en) | Alpha Progression GmbH, Allemagne | Programmation mésocycle | iOS, Android | Illimité (tracker) | 79,99 € | 4,9 (2 300) |
| [Hevy](https://www.hevyapp.com/) | Hevy Studios, Espagne | Log de séance, social | iOS, Android, web, Apple Watch, Wear OS | Illimité (plafonds) | 26,49 € (lifetime 89,99 €) | 4,9 (100 000+) |
| [MacroFactor](https://macrofactor.com/) | Stronger By Science, USA | Nutrition adaptative | iOS, Android, Apple Watch | Non (essai 7 j) | 73,99 € (bundle Workouts 99,99 €) | 4,8 (24 000) |
| [WHOOP](https://www.whoop.com/) / [Athlytic](https://www.athlyticapp.com/) | WHOOP Inc., USA / MyndArc, USA | Récupération, strain, sommeil | iOS, Android + capteur / iOS + Apple Watch | Essai 30 j / gratuit limité | 199–399 € matériel inclus / 31,99 € | 4,8 (91 000) / 4,8 (11 000) |
| [Reboot Plan](https://mwm.ai/apps/reboot-plan/6762472013) | Paul Fabre, France | Intégration iPhone, gamification | iOS, Apple Watch | Essai 7 j + classement de pas | 39,99 € | 4,7 (49) |

## Gravl — moteur de progression et logistique de salle

[Gravl](https://gravl.ai/) (GAINS COACH PTY LTD, Bondi, Australie, sorti en août 2023) est la référence pour le moteur de progression : l'algorithme est publié, chaque charge cible est explicable, et la logistique de salle (disques, machines, plusieurs salles) est la plus aboutie du marché. 4,9/5 sur 5 500 notes App Store US, 4,8/5 sur 16 800 avis Google Play, plus d'un million d'utilisateurs annoncés.

### Fonctionnalités

| Domaine | Fonctionnalités |
| --- | --- |
| Génération de séance | Objectifs muscle / force / condition / fitness général ; expérience, fréquence, durée 30–90 min, matériel ; Recovery Split (muscles choisis selon la récupération estimée), splits prédéfinis (Full Body, Upper/Lower, PPL…), split custom jusqu'à 7 séances ; variété Consistent / Balanced / Varied ; structure Variable / Fixe / Statique pour les séances custom ; jusqu'à 2 muscles focus et 4 muscles exclus ; durée de la prochaine séance modifiable sans toucher au plan |
| Progression | 1RM estimé à partir de chaque série (8 × 100 kg ≈ 124 kg, plafonné après 15 reps) ; 1RM initial déduit du niveau via standards de force ; décote de fatigue \~7 % pour le 2ᵉ exercice d'un même muscle ; charges arrondies aux disques / haltères / stacks réels avec compensation en reps ; note Easy / Ideal / Hard par exercice (désactivable) → rep ladder 8-7-6 → 8-8-8 puis +1 cran ; hausse plafonnée \~10 % par séance ; décote \~1 %/semaine après 2 semaines d'arrêt ; « Why this weight today? » ; deload daté avec multiplicateur d'intensité ; le nombre de séries ne progresse pas automatiquement |
| Logging | Séries, warm-up, supersets, dropsets, exercices chronométrés, poids de corps, timer de repos, substitutions, PR, calculateur de disques |
| Profils de salle | Plusieurs salles ; barres, disques, haltères, incréments ; machines custom ; import des charges d'une machine par photo ; salles réelles recherchables et vérifiées ; 1RM machine séparé par salle, free weights partagés |
| Blessures | Déclaration des mouvements douloureux par zone (épaule, coude, poignet, nuque, lombaires, hanche, genou, cheville) ; exclusion et substitution automatiques ; check-in toutes les 2 semaines |
| Bibliothèque et IA | 300+ vidéos coach hors-ligne ; exercices custom par import YouTube/Instagram/TikTok ou complétion IA, utilisables par le générateur ; AI Import de programmes (lien, post, photo, capture, PDF) ; AI form checker (vidéo → score /100, form, tempo, amplitude, historique) ; Academy |
| Analytics | Historique par exercice, 1RM estimé, PR, récupération par muscle, Strength Score et Levels (8 groupes, ajusté poids et sexe, free weights uniquement), force par muscle, constance, mensurations, Monthly Review Stories |
| Social | Amis, feed, claps, cartes de partage, leaderboard Strength Score, plans créateurs, Workout Focus (blocage d'apps pendant la séance) |
| Montres | Apps autonomes Apple Watch, Wear OS, Garmin (\~70 modèles, Connect IQ 3.4+) : log, édition, timer, notation d'effort, FC et calories ; FC via AirPods Pro 3 |
| Intégrations | Apple Health et Health Connect bidirectionnels ; push Strava ; cardio importé noté Low / Moderate / Hard et intégré à la récupération ; API REST publique et serveur MCP ; web app |
| Nutrition | Gravl Macros, app séparée (photo → calories), vendue en bundle web uniquement |

### Écrans

- Onboarding : objectif, expérience, fréquence, durée, matériel ou salle, split, variété, muscles focus.
- Accueil / semaine : la semaine en cours (une seule affichée, la suivante dépend de ce qui est loggé), prochaine séance, récupération par muscle.
- Séance active : exercice, séries pré-remplies (charge + reps cibles), substitution, timer de repos, notation Easy / Ideal / Hard après l'exercice, tap sur la charge → « pourquoi cette charge ».
- Fin de séance : récap, PR, carte de partage.
- Profil de salle : matériel, disques, machines et leurs stacks, salles vérifiées.
- Analytics : Strength Score et Levels, force par muscle, 1RM par exercice, récupération, constance, mensurations.
- Social : feed amis, claps, leaderboard.
- Blessures : zones et mouvements douloureux, séances marquées « Adjusted for injuries ».
- Form check : enregistrement vidéo, scores, historique par exercice.
- Deload : période, intensité.
- Montre : séance pilotée au poignet.

### Modèle économique

3 séances gratuites (5 en Amérique du Sud), puis Premium : 14,99 $/mois, 34,99 $/3 mois, 59,99–89,99 $/an selon le palier proposé ; bundle Workouts + Macros 89,99 $/an sur le web.

### Forces et limites

- Forces : transparence totale du moteur ; snap aux charges réelles ; profils de salle et 1RM machine par salle ; injury-aware ; trois écosystèmes de montres ; API et MCP.
- Limites : pas de progression automatique du nombre de séries ni de périodisation sur mésocycle ; n'utilise ni sommeil ni HRV ; pas de coach course/vélo (assumé) ; nutrition externe et payante ; 3 séances gratuites seulement.

## Alpha Progression — programmation long terme

[Alpha Progression](https://alphaprogression.com/en) (Alpha Progression GmbH, Eschborn, Allemagne) est la référence pour la couche « programme » au-dessus du moteur de progression : c'est la seule app du panel qui périodise automatiquement séries, reps et RIR sur un mésocycle et qui place le deload elle-même. 4,9/5 sur 2 300 notes App Store US, 4,8/5 sur 21 300 avis Google Play (1 M+ téléchargements), 5 M+ téléchargements annoncés.

### Fonctionnalités

| Domaine | Fonctionnalités |
| --- | --- |
| Générateur de plan (Pro) | Wizard en 7–8 étapes : sexe et expérience (débutant → élite), salle active ; objectif force max (4–10 reps) / prise de muscle (6–15) / endurance de force (12–20) ; focus musculaire sur body map (prioriser / négliger) ; fréquence 1–6 j/sem ; durée courte \~50 min / moyenne \~1 h 05 / longue \~1 h 25 ; split automatique, Full body, Upper-Lower, Push-Pull, PPL, PPL-Upper-Lower ; durée du plan illimitée ou 4–7 semaines ; options expertes RIR / périodisation / deload ; édition complète après génération ; générateur de séance unique (Full body / Upper / Lower) |
| Périodisation (Pro) | Variation semaine par semaine des séries, reps, dropsets et RIR (plan ≥ 2 semaines) ; exemple relevé sur un bloc de 4 semaines : séries 2 → 4, RIR 3 → 0, puis deload à 2 séries et RIR 5+ ; deload placé en fin de plan ou marqué sur une séance isolée ; les deloads suivent le calendrier, pas la stagnation |
| Recommandations (Pro) | Poids + reps cible pour chaque série de travail, à partir des séances passées et des séries du jour ; propose plus de reps si le saut de charge est trop grand ; s'adapte aux séances sous les attentes ; respecte les incréments du profil de salle ; démarre à la 2ᵉ séance d'un exercice |
| Plans manuels (gratuit) | Durée illimitée ou 1–52 semaines ; éditeur exercices, ordre, jours, séries, cibles reps et RIR, dropsets, supersets ; édition en masse (tout le plan, un jour, une semaine) |
| Bibliothèque | 795 exercices, vidéos réelles tournées en salle par des coachs certifiés, consignes setup / exécution / erreurs, filtres muscle / équipement / type, offline basse résolution ; évaluations hypertrophie (Pro) : amplitude, stabilité, qualité de charge du muscle cible ; exercices custom (non utilisés par le générateur) |
| Profils de salle | Équipement, plages de poids min / max / intervalle, poids de barre, inventaire de disques (active le calculateur), whitelist / blacklist d'exercices ; multi-profils salle / maison / voyage en Pro |
| Logging | Illimité et offline ; timer de repos auto avec alarme ; supersets, dropsets préréglés ; notes de séance et d'exercice épinglées ; 1RM / 10RM estimés ; calculateurs de disques et d'échauffement (Pro) ; Live Activity iOS (écran verrouillé + Dynamic Island) ; notifications live Android ; pas d'app montre (annoncée fin 2026) |
| Analytics | Historique éditable, records (poids, reps, volume, 1RM / 10RM, par muscle), streaks avec objectif 1–7 j/sem, achievements, rapports hebdo / mensuel / annuel, mesures (poids, % MG, 10 circonférences), export CSV ; graphiques Pro : performance, force, volume, séries par muscle, séances/semaine |
| Autre | 13 langues, Apple Health / Health Connect, compte optionnel, partage de plan par lien / QR, pas de pub, mode sombre ; absents : social, web, API, Strava / Garmin, import de routines |

### Écrans

- Accueil / Plans : liste des plans, séance du jour avec Start / Skip / Deload, boutons Create plan et Exercises.
- Générateur : wizard pas à pas (sexe, expérience, objectif, body map, fréquence, durée, split, durée du plan, options expertes).
- Éditeur de plan : grille jours × exercices, séries, cibles reps et RIR, toggles périodisation.
- Bibliothèque et fiche exercice : onglets Info / Instructions / Historique, vidéo, évaluation hypertrophie, PR, graphique.
- Séance active : bandeau horizontal de vignettes d'exercices réordonnable ; tableau de séries (cible, poids, reps, RIR, métrique 1RM / 10RM / volume) ; bulle de recommandation ; performance précédente et notes ; picker de valeurs probables ; raccourcis vers les poids de la salle ; calculateurs.
- Résumé de séance : PR, comparaison, capture partageable.
- Progress / Analytics : graphiques, streak, achievements, calendrier et rapports.
- Profil : mesures corporelles.
- Réglages : langue, kg / lb, début de semaine, hiérarchie global → équipement → exercice ; Gym setup ; Abonnement.

### Modèle économique

Gratuit à vie, sans pub ni compte (logging illimité, plans manuels, 795 vidéos). Pro : 12,99 €/mois sans essai, 79,99 €/an avec essai 14 jours ; pas de lifetime ; remboursement intégral sur demande.

### Forces et limites

- Forces : cibles série par série réalistes ; périodisation et deload automatiques que personne d'autre n'a ; bibliothèque vidéo réelle filtrable par salle ; tracker gratuit illimité.
- Limites : pas d'app montre, ni web, ni API ; tout ce qui compte (générateur, recommandations, graphiques) est Pro et le mensuel est jugé cher ; pas de social, pas de photos de progression, pas d'import de routines.

## Hevy — écran de séance et social

[Hevy](https://www.hevyapp.com/) (Hevy Studios S.L., Espagne, \~2019, bootstrappé) est la référence UX pour le log de séance et le social : une séance démarre en 10 secondes et tient sur un seul écran, le feed est optionnel, et le gratuit est le plus généreux du panel. 4,9/5 sur 100 000+ notes App Store US, 4,9/5 sur \~282 000 avis Google Play (5 M+ téléchargements), 17 M+ athlètes annoncés.

### Fonctionnalités

| Domaine | Fonctionnalités |
| --- | --- |
| Log de séance (gratuit) | Démarrage par séance vide, routine ou copie d'une séance (la sienne ou celle d'un autre) ; poids / reps / durée / RPE 6–10 activable ; types de séries Warm-up, Normal, Drop set, Failure ; supersets et circuits ; valeurs de la séance précédente pré-remplies ; timer de repos auto ; chrono ; notes épinglables ; notification de PR en direct ; calculateur de disques ; calculateur d'échauffement (Pro) ; Live Activity iOS et widgets ; offline et sync multi-appareils ; plafond 150 séries par séance |
| Routines | Création, duplication, dossiers, sauvegarde des routines d'autres utilisateurs, bibliothèque gratuite de programmes ; prompt de mise à jour de la routine si modifiée en séance ; 4 routines en gratuit, illimitées en Pro |
| Bibliothèque | 400+ exercices (animations, instructions, max, 1RM projeté, meilleure série, volume, historique) ; custom avec image / vidéo / GIF : 7 en gratuit, illimités en Pro |
| Social (gratuit) | Feed Home (likes, commentaires, Discover, athlètes suggérés), follow, leaderboards, Strength Level (13 mouvements par sexe / âge / poids), partage Instagram / Facebook / X / Snapchat / lien, Strava ; profil privé possible mais Discover non désactivable |
| Hevy Trainer (Pro, février 2026) | Questionnaire 10 points → programme rule-based : séances, fourchettes de reps, repos, poids de départ ; progression auto quand toutes les séries atteignent le haut de la fourchette ; Program Variety stable / rotation \~6 semaines / hebdo ; gestion des blessures ; Progress Report (constance, séries, volume par muscle vs recommandé) ; aucune donnée de récupération |
| ChatGPT / Claude | « Hevy app for ChatGPT » (@hevy) : analyse l'historique, génère et sauvegarde des routines, gratuit ; bouton d'envoi de la séance à ChatGPT ou Claude (v3.2.0) |
| Montres (gratuit) | Apple Watch et Wear OS (Galaxy Watch 4+) : séries, timer, fin de séance sans téléphone, FC, complications ; pas de Garmin ; Apple Health / Health Connect |
| Analytics | Graphiques par exercice, PR, 1RM, volume, calendrier / streak, photos de progression (1/jour), mesures (gratuit : poids + taille), distribution musculaire, séries par muscle, rapport mensuel, year in review ; 3 mois d'historique en gratuit ; export CSV ; import depuis Strong |
| Plateforme | Web app hevy.com, API publique, Hevy Coach (25 $/mois, 1–10 clients) |

### Écrans

- Tab bar à 3 onglets : Home, Workout, Profile.
- Home : feed, Discover en haut à gauche, carrousel d'athlètes suggérés, invitation d'amis.
- Workout : bouton « + Start Empty Workout », routines et dossiers, menu Workout / Trainer en haut → « Start with Hevy Trainer ».
- Séance active : séries, reps, timer et notes sur un seul écran, « Finish » en haut à droite.
- Sauvegarde : titre, durée, date, 3 images ou 2 images + vidéo, description avec @, visibilité, intégrations.
- Post-séance : numéro de séance, streak, slides PR / constance 7 j / overview / muscle map / comparaison de volume, image partageable claire / sombre / transparente.
- Profile : liste des séances avec menu Save as Routine / edit / delete, Statistics, Exercises, Measures, calendrier ; Settings : abonnement, Privacy & Social, Export & Import, Contact.

### Modèle économique

Gratuit sans pub ni expiration (4 routines, 7 exercices custom, 3 mois de stats, mesures limitées). Pro : 3,49 €/mois, 26,49 €/an, 89,99 € lifetime (US : 2,99 $/mois, 23,99 $/an, 74,99 $ lifetime) ; promos −50 % la première année ; pas de Family Sharing.

### Forces et limites

- Forces : flux de log le plus rapide du marché ; prix très bas avec lifetime et gratuit généreux ; iOS, Android, Watch, Wear OS, web, API ; social facultatif.
- Limites : pas de progression automatique hors Trainer, et Trainer est rule-based sans récupération ; plafonds du gratuit (4 routines, 7 custom, 3 mois) ; feed Discover non désactivable ; pas de Garmin ; 150 séries max.

## MacroFactor — nutrition adaptative

[MacroFactor](https://macrofactor.com/) (Stronger By Science Technologies LLC) est la référence nutrition parce qu'il ne compte pas, il pilote : chaque semaine il recalcule les cibles calories / macros à partir de la dépense énergétique estimée depuis les apports loggés et la tendance de poids lissée. 4,8/5 sur \~24 000 notes App Store US, 4,7/5 sur \~17 300 avis Google Play (1 M+ téléchargements), 400 000+ utilisateurs annoncés en septembre 2025.

### Fonctionnalités

| Domaine | Fonctionnalités |
| --- | --- |
| Algorithme de dépense | TDEE estimé en continu à partir de deux entrées : calories loggées et tendance de poids ; aucune donnée d'activité dans le calcul de base ; check-in hebdomadaire après 7 jours (nutrition ≥ 4 j/7, poids ≥ 1 pesée/7 j) avec nouvelles cibles à accepter ou refuser ; lissage anti-sur-réaction (une baisse réelle de 500 kcal ne se traduit que par 200–300 kcal de réduction sur 3 semaines) ; protéines stables, lipides jamais sous un plancher, les coupes portent sur les glucides ; V3 (2024) impute les jours non loggés et détecte la tendance 1–5 jours plus tôt ; Expenditure Modifiers (2025) : Step-Informed Updates et Predictive Goal Adjustment |
| Styles de programme | Coached (l'app fixe tout), Collaborative (l'utilisateur fixe les macros, l'app ajuste les calories), Manual (contrôle total) ; plancher calorique (1 200 kcal par défaut), répartition jours hauts / bas, styles équilibré / low-fat / low-carb / céto ; rythme cible en % du poids corporel par semaine |
| Logging | Recherche classée Historique / Personnalisés / Communs / Marques avec favoris, go-tos horaires et récents avant même de taper ; code-barres ; lecture d'étiquette nutritionnelle et création de fiche par IA ; photo IA d'un repas ; « Describe » tapé ou dicté ; saisie vocale depuis l'Apple Watch ; Quick Add ; recettes avec import par lien ou photo ; assiette pour composer avant de logger ; journal en timeline horaire, sans repas imposés ni rouge au dépassement |
| Base alimentaire | Base vérifiée et curée, étendue aux produits européens, complétée par Open Food Facts |
| Suivi corporel | Tendance de poids lissée, dépense estimée, mensurations, photos de progression, ratios taille / hauteur et taille / hanches, micronutriments avec seuils min / cible / max, habitudes, cycle menstruel, Nutrient Explorer (8 nutriments épinglés), export |
| Intégrations | Apple Santé, Health Connect, Fitbit (poids), Apple Watch, widgets iOS / Android, Mac, Vision Pro ; pas de web ; anglais et japonais seulement |
| MacroFactor Workouts (app séparée, janvier 2026) | Programme généré par questionnaire ; surcharge progressive automatique (poids et reps ajustés séance à séance, fatigue intra-séance, substitutions) ; 900+ exercices et 600+ vidéos Jeff Nippard sous 3 angles ; RIR, drop sets, partielles, myoreps, supersets ; profils de salle ; Levels (séries hebdo par muscle) ; photos et mesures partagées avec l'app Nutrition |

### Écrans

- Tab bar : Dashboard · Food Log · bouton + central (Quick Add, recettes, pesée, raccourcis) · Strategy · More.
- Dashboard : cartes calories / macros du jour, Nutrition & Target, Weight Trend, Expenditure, Nutrient Explorer, body metrics ; cartes personnalisables.
- Food Log : timeline horaire avec « + » par heure, recherche / scan / Quick Add / Bibliothèque / Describe / photo, assiette, sélecteur de date.
- Strategy : style de programme, Edit Goal / New Goal, carte de check-in hebdomadaire à accepter ou refuser.
- More : compte, abonnement, Body Metrics, thème, personnalisation du logger et de la timeline, Expenditure Modifiers, intégrations.
- Onboarding (\~10 min) : connexion, import santé, profil, estimation initiale de dépense, objectif et rythme, préférences diététiques.

### Modèle économique

Aucune version gratuite ; essai 7 jours. Nutrition : 11,99 €/mois, 48,99 €/6 mois, 73,99 €/an. Workouts : 12,99 €/mois, 79,99 €/an. Bundle Nutrition + Workouts : 99,99 €/an (89,99 $ aux US). Pas de pub, données non vendues.

### Forces et limites

- Forces : algorithme de dépense unique sur le marché, transition vers le maintien bien gérée ; base alimentaire fiable et saisie rapide au gramme ; approche sans culpabilisation ni gamification.
- Limites : pas de gratuit et abonnement jugé cher ; 2–4 semaines de calibrage avant des cibles fiables ; un logging partiel fausse l'algorithme ; pas de web ; pas de français.

## WHOOP / Athlytic — récupération, strain, sommeil

[WHOOP](https://www.whoop.com/) a imposé le modèle Recovery / Strain / Sleep que tout le marché copie ; [Athlytic](https://www.athlyticapp.com/) (MyndArc LLC, 2 personnes) le reproduit sur Apple Watch sans matériel dédié, ce qui en fait la référence réaliste pour une app iPhone. WHOOP : 4,8/5 sur 91 000 notes App Store US, 2,5 M+ membres, 1,1 Md$ de CA annualisé. Athlytic : 4,8/5 sur 11 000 notes, Best Watch App MacStories 2025.

### Fonctionnalités WHOOP

| Domaine | Fonctionnalités |
| --- | --- |
| Recovery | Score 0–100 % calculé pendant le sommeil : HRV (facteur dominant), FC de repos, fréquence respiratoire, performance de sommeil, SpO2, température cutanée ; zones verte / jaune / rouge vs baseline personnelle |
| Strain | Score 0–21 logarithmique : charge cardio par zones de FC + charge musculaire (Strength Trainer, à partir des charges / reps / séries) ; Strain Target quotidien selon la Recovery, mis à jour en temps réel |
| Sleep | Stades (SWS, REM, léger, éveil) ; Sleep Need = besoin de base + strain du jour + dette accumulée − siestes ; performance en % du besoin, efficacité, réveils ; Sleep Planner par objectif Peak / Perform / Get by ; alarme haptique |
| Santé | Stress Monitor 0–3 avec respiration guidée ; Health Monitor avec alertes hors baseline ; Healthspan / WHOOP Age / Pace of Aging ; Hormonal Insights ; VO2 max, zones FC, pas ; ECG et tension (MG) |
| Journal | 160+ comportements (alcool, caféine, médicaments…) corrélés à Recovery et Sleep via le bilan mensuel |
| WHOOP Coach | Chatbot (OpenAI) sur les données biométriques + contexte déclaré + communauté ; questions suggérées depuis Sleep / Strain / Recovery ; mémoire des échanges ; Daily Outlook ; Day in Review ; plans dynamiques ; désactivable |
| Entraînement et social | Détection auto, workout builder, WHOOP Live, Teams et classements, vue coach, Apple Santé |
| Matériel | Capteur sans écran ni GPS, 14+ jours d'autonomie, port poignet / biceps / vêtements |

### Écrans WHOOP

- Tab bar 4 onglets : Home, Coaching (Strain Target, Sleep Planner, bilans hebdo / mensuel, Weekly Plans), Community, More ; bouton + central (activité) et bouton Coach à droite.
- Home (refonte octobre 2025) : trois cadrans Sleep / Recovery / Strain → pages de détail ; sections My Day (timeline), My Plan, My Journal, My Dashboard (tuiles personnalisables : Health Monitor, Stress, pas, VO2 max).
- Profil : moyennes 30 jours, records.

### Athlytic : le même modèle sans matériel

- Recovery 0–100 % chaque matin : HRV et FC de repos nocturnes vs baseline personnelle (Recovery HRV Apple sur Series 12 / Ultra 4).
- Exertion 0–10 cumulé sur la journée, y compris hors séance ; Target Exertion Zone adaptée à la Recovery avec suggestions d'activité, durée, intensité, et séances structurées envoyées à la Watch.
- Sleep : score combinant qualité, dette, régularité, efficacité ; Target Sleep et heure de coucher cible.
- Battery (énergie dans la journée), Stress, Athlytic Age avec simulateur « What if », santé 24/7 avec alertes, Journal de facteurs et analyse d'impact, Trends (charge, ratio de charge, Net Energy), records, Ask Athlytic (Apple Intelligence), 24 widgets et 16 complications, export (Pro).
- Écrans : Today avec 4 indicateurs (Recovery, Exertion, Target Exertion, Sleep) → détails au tap ; Trends ; Journal ; app Watch.
- Tout est traité sur l'appareil, aucune collecte de données.

### Modèle économique

- WHOOP : matériel inclus dans l'abonnement obligatoire. France : One 199 €/an, Peak 264 €/an, Life 399 €/an ; essai 30 jours avec CB.
- Athlytic : gratuit avec Pro à 5,99 €/mois ou 31,99 €/an, essai 7 jours ; iPhone + Apple Watch requis ; pas d'Android.

### Forces et limites

- WHOOP, forces : app et coaching de récupération les plus aboutis ; sans écran, discret, longue autonomie ; Coach IA contextualisé avec mémoire. Limites : prix élevé et abonnement obligatoire ; pas de GPS ni d'écran ; suivi musculation jugé peu évolué ; données peu exportables.
- Athlytic, forces : \~10× moins cher que WHOOP, aucun matériel ajouté ; suggestions mises à jour après chaque séance ; développeur très réactif. Limites : Recovery centrée cardio, ne capte pas la fatigue musculaire ; dépend du port nocturne de la Watch ; pas de plans d'entraînement.

## Reboot Plan — intégration iPhone et gamification

[Reboot Plan](https://mwm.ai/apps/reboot-plan/6762472013) (Paul Fabre, France, sorti le 26 avril 2026, version 4.7.0) est la référence « produit iPhone bien fini » : Dynamic Island, widgets, app Apple Watch, Apple Santé dans les deux sens, cardio GPS natif, et une couche de gamification (classement et duels de pas, avatar XP, parrainage) qui fait revenir. 4,7/5 sur 49 notes App Store, 1 000+ téléchargements : jeune, mais la densité fonctionnelle est déjà celle d'un tout-en-un.

### Fonctionnalités

| Domaine | Fonctionnalités |
| --- | --- |
| Training | Mode guidé : programme homme / femme régénérable à l'infini, charges plus lourdes à chaque cycle ; mode libre modifiable à tout moment ; circuits maison en images réelles, sans matériel, sur 4 semaines ; suivi des charges ; timer de repos automatique dans la Dynamic Island et sur écran verrouillé, alertes sonores et vibrations |
| Cardio | Course, marche, vélo lancés depuis l'app : tracé en direct (écran verrouillé compris), allure, distance, voix au kilomètre ; avec montre : courbe cardiaque minute par minute et temps par zone ; séance envoyée dans Apple Santé avec son tracé |
| Nutrition | Photo → calories et macros par IA ; recherche d'aliment, code-barres, recettes ; note d'équilibre par aliment (équilibré / à surveiller / à limiter, avec ce qui coince) ; section Compléments cochée en 10 s avec rappels ; objectifs adaptés aux phases du cycle pour les abonnées |
| Marche | Pas heure par heure, moyenne, record ; classement sur 7 jours glissants avec paliers TOP 50 → TOP 3, accessible sans abonnement ; duels de pas 48 h, le vainqueur prend l'ELO du perdant |
| Suivi | Poids, photos de transformation, records, force gagnée par muscle ; sel, sucres, graisses saturées, fibres face aux repères OMS ; toutes les séances (app, montre, manuelles) sur 30 jours sans doublon avec leur source ; dépense du jour poste par poste |
| Bilans IA | Analyses quotidienne, hebdomadaire, mensuelle de progression, nutrition et entraînement, intégrant sommeil et phase de cycle (abonnés) |
| Ton Reflet | Avatar nommé par l'utilisateur ; chaque séance et chaque repas suivi donnent de l'XP, évolution par stades |
| Apple Santé | Lecture : pas, sommeil, séances de montre ; écriture : pesées, durée et dépense des séances, calories et macros des repas (si accepté) |
| Widgets et Watch | Widgets : pas et calories du jour, prochaine séance, récap Ma Journée, force par muscle, cycle (abonnés) ; app Apple Watch autonome : pas, FC, dépense |
| Bibliothèque | 4 formations sourcées (sommeil, assiette, séances, marche) et 4 guides offerts pendant l'essai, lisibles dans l'app |
| Partage et parrainage | Stories : journée alimentaire, cardio avec tracé, avant / après ; programme libre partagé par lien, import en un tap ; chaque ami abonné = 1 mois offert crédité automatiquement |
| Communauté | Chat entre utilisateurs, feedback produit |
| Synchronisation | Cloud, accès au programme depuis n'importe quel appareil |

### Écrans

- Accueil « Ma Journée » : balance calorique sur 7 jours (déficit / surplus), apports et dépenses du jour, pas, prochaine séance.
- Programme : cycles, semaines, exercices, bouton « démarrer la séance », détail du programme.
- Séance active : charges, séries, timer de repos dans la Dynamic Island ; version Apple Watch.
- Cardio : carte en direct, distance, allure, tracé ; choix course / marche / vélo sur la montre.
- Nutrition : objectif calorique et restant, macros protéines / glucides / lipides, ajout par photo, recherche, code-barres, recettes ; section Compléments.
- Marche : pas heure par heure, classement 7 jours et paliers, duels 48 h et ELO.
- Suivi : calendrier de régularité, total séances, tonnage, records, poids, photos avant / après, force par muscle.
- Bilans : rapport IA quotidien / hebdo / mensuel.
- Ton Reflet : avatar, XP, stade.
- Partage : cartes de story, code de partage de programme, import.
- Communauté : chat.
- Widgets sur l'écran d'accueil iOS.

### Modèle économique

Essai gratuit 7 jours, puis Premium 9,99 €/mois ou 39,99 €/an (89,99 €/an affiché sur certaines fiches). Classement de pas, bibliothèque et une partie du suivi accessibles sans abonnement.

### Forces et limites

- Forces : intégration iOS exemplaire (Dynamic Island, widgets, Watch, Apple Santé bidirectionnel) ; nutrition et cardio intégrés là où Gravl les externalise ; gamification concrète et gratuite (paliers, duels, avatar) ; prix annuel le plus bas du panel ; produit français.
- Limites : moteur de progression simple (cycle régénéré avec charges plus lourdes, pas de 1RM estimé ni de snap au matériel) ; base d'utilisateurs très réduite (49 notes), donc peu de retours sur la fiabilité ; iPhone uniquement malgré un lien Google Play ; bilans IA et widgets avancés réservés aux abonnés.

## Matrice comparative par brique

Aucune app ne tient plus de deux briques au niveau référence ; la nouvelle app vise la colonne de droite en assemblant les six. Légende : ◉ référence, ● bon, ○ basique, — absent.

| Brique | Gravl | Alpha Progression | Hevy | MacroFactor | WHOOP / Athlytic | Reboot Plan | Cible nouvelle app |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Génération de séance | ◉ Recovery Split, variété, focus | ● wizard 8 étapes, body map | ● Trainer rule-based | ● Workouts (app séparée) | — | ○ programme régénérable | Gravl + wizard Alpha |
| Progression charge / reps | ◉ 1RM estimé, rep ladder, snap matériel, « pourquoi » | ◉ cible par série, incréments de la salle | ○ Trainer : hausse au haut de fourchette | ● Workouts : fatigue intra-séance | — | ○ charges plus lourdes par cycle | Gravl |
| Périodisation, deload | ○ deload manuel | ◉ séries / reps / RIR par semaine, deload planifié | — | — | — | — | Alpha Progression |
| Profils de salle | ◉ salles vérifiées, machines par photo, 1RM par salle | ● équipement, disques, whitelist | — | ● Workouts | — | — | Gravl |
| Blessures | ◉ par mouvement, substitution auto | ○ remplacement manuel | ○ Trainer | — | — | — | Gravl |
| Écran de séance | ● notation Easy / Ideal / Hard | ● vignettes, picker, calculateurs | ◉ un écran, 10 s pour démarrer | ● | — | ● Dynamic Island | Hevy + notation Gravl |
| Bibliothèque d'exercices | ● 300+ vidéos, import IA, custom dans le générateur | ◉ 795 vidéos réelles, évaluations hypertrophie | ● 400+ animations | ● 900+ Nippard | — | ○ images réelles maison | Alpha + import IA Gravl |
| Form check vidéo | ◉ score /100 | — | — | — | — | — | Gravl (V2) |
| Nutrition | ○ app séparée | — | — | ◉ TDEE adaptatif, check-in hebdo | — | ● photo, code-barres, recettes, compléments | MacroFactor + saisie Reboot |
| Récupération, sommeil, HRV | ● par muscle, cardio importé | — | — | — | ◉ Recovery / Strain / Sleep | ○ sommeil dans les bilans | Athlytic + muscle Gravl |
| Cardio GPS | — | — | — | — | ○ détection auto | ◉ tracé, allure, voix, zones FC | Reboot Plan |
| Montres | ◉ Apple Watch, Wear OS, Garmin | — | ● Apple Watch, Wear OS | ● Apple Watch | ◉ capteur / Watch | ● Apple Watch | Gravl |
| Widgets, Live Activity, Dynamic Island | ○ | ● Live Activity | ● Live Activity, widgets | ● widgets | ● widgets, complications | ◉ Dynamic Island, widgets riches | Reboot Plan |
| Apple Santé bidirectionnel | ◉ + Health Connect, Strava | ● | ● | ● | ● | ◉ lecture et écriture | Gravl + Reboot |
| Analytics | ● Strength Score, Levels, récupération | ● force, volume, séries par muscle, rapports | ● PR, muscle map, year in review | ◉ tendance de poids, dépense | ◉ bilans hebdo / mensuels | ● force par muscle, dépense par poste | WHOOP (bilans) + Gravl (score) |
| Social | ● feed, leaderboard Strength Score | ○ partage de plan | ◉ feed, follow, Strength Level | — | ● Teams | ● duels, parrainage | Hevy |
| Gamification | ○ Levels | ○ streaks, trophées | ○ streak, post-séance | — | ○ | ◉ paliers, duels ELO, avatar XP, parrainage | Reboot Plan |
| Coach IA conversationnel | ○ MCP externe | — | ○ via ChatGPT / Claude | — | ◉ WHOOP Coach avec mémoire | ● bilans IA | WHOOP Coach |
| API / MCP | ◉ | — | ● API | — | — | — | Gravl |
| Gratuit | ○ 3 séances | ◉ tracker illimité | ◉ généreux | — | ○ | ● classement de pas | Hevy / Alpha |

## Synthèse « best of » pour la nouvelle app

La nouvelle app assemble six briques, chacune reprise de sa référence, avec une priorité MVP / V2 pour ne pas tout construire d'un coup. Le socle MVP tient en quatre briques : moteur Gravl, écran de séance Hevy, nutrition MacroFactor, enrobage iPhone Reboot Plan ; la périodisation Alpha et la récupération Athlytic viennent en V2 parce qu'elles exigent des semaines de données pour devenir utiles.

### Fonctionnalités retenues

| Brique | Fonctionnalité retenue | Source | Priorité |
| --- | --- | --- | --- |
| Moteur | 1RM estimé par série, rep ladder puis +1 cran de charge, charges snappées au matériel réel, « pourquoi cette charge » | Gravl | MVP |
| Moteur | Notation d'effort à 3 niveaux (Easy / Ideal / Hard), désactivable ; RIR optionnel pour les avancés | Gravl, Alpha | MVP |
| Moteur | Décote de fatigue intra-séance, plafond de hausse par séance, décote après arrêt | Gravl | MVP |
| Génération | Wizard : objectif, expérience, fréquence, durée, split, body map de priorités, variété Consistent / Balanced / Varied | Alpha (wizard), Gravl (variété) | MVP |
| Génération | Durée de la prochaine séance modifiable sans toucher au plan | Gravl | MVP |
| Programmation | Mésocycle de 4–7 semaines avec progression des séries, reps, RIR et deload planifié | Alpha | V2 |
| Salle | Profils multi-salles, disques, machines et stacks, 1RM machine par salle, import d'une machine par photo | Gravl | MVP (sans photo), V2 (photo, salles vérifiées) |
| Blessures | Déclaration par mouvement douloureux, substitution automatique, check-in bimensuel | Gravl | V2 |
| Séance | Un seul écran : séries pré-remplies, timer, notes, « Finish » ; démarrage en 10 s par séance vide / routine / copie | Hevy | MVP |
| Séance | Timer de repos dans la Dynamic Island et sur écran verrouillé, Live Activity | Reboot Plan, Alpha | MVP |
| Séance | Calculateur de disques et d'échauffement ; replay set par set | Gravl, Alpha, uFit | MVP / V2 |
| Bibliothèque | Vidéos réelles avec consignes et erreurs, évaluation hypertrophie, exercices custom utilisables par le générateur, import IA de programmes (lien, capture, PDF) | Alpha, Gravl | MVP (bibliothèque), V2 (import IA) |
| Form check | Vidéo → score form / tempo / amplitude, historique par exercice | Gravl | V3 |
| Nutrition | TDEE estimé depuis apports et tendance de poids, check-in hebdo à accepter / refuser, styles Coached / Collaborative / Manual | MacroFactor | MVP |
| Nutrition | Saisie : photo IA, code-barres, étiquette, recherche avec go-tos, Describe vocal, recettes par lien ou photo ; section Compléments avec rappels ; note d'équilibre par aliment ; sel / sucres / fibres vs OMS | MacroFactor, Reboot | MVP (photo, code-barres, recherche), V2 (reste) |
| Récupération | Recovery 0–100 % (HRV, FC repos nocturnes), Exertion et zone cible du jour, score de sommeil et dette, depuis Apple Watch ; récupération par muscle alimentée par le cardio importé | Athlytic, Gravl | V2 |
| Récupération | Recovery Split : muscles du jour choisis selon la récupération | Gravl | V2 |
| Cardio | Course / marche / vélo GPS : tracé en direct, allure, voix au km, zones FC, écriture dans Apple Santé | Reboot | V2 |
| Analytics | Strength Score et Levels, force par muscle, PR, constance ; bilans hebdo / mensuel générés ; tendance de poids et dépense | Gravl, WHOOP, MacroFactor | MVP (scores), V2 (bilans) |
| Social | Feed optionnel, follow, likes, cartes post-séance partageables, Strength Level, leaderboard | Hevy, Gravl | V2 |
| Gamification | Classement de pas 7 jours avec paliers, duels 48 h à ELO, avatar XP, parrainage = 1 mois offert | Reboot | V2 |
| Coach IA | Chat sur les données de l'utilisateur avec mémoire, questions suggérées, Day in Review | WHOOP | V3 |
| Écosystème | Apple Santé bidirectionnel, Health Connect, Strava, widgets, app Apple Watch autonome | Gravl, Reboot | MVP (Santé, widgets), V2 (Watch, Strava) |
| Plateforme | API publique et serveur MCP | Gravl | V3 |
| Modèle économique | Tracker gratuit illimité avec plafonds, Premium annuel sous 50 €, essai 7 jours, lifetime | Hevy, Reboot | MVP |

### Écrans retenus

| Écran | Référence copiée | Ce qu'on reprend |
| --- | --- | --- |
| Tab bar | Hevy + MacroFactor | 4 onglets Aujourd'hui · Entraînement · Nutrition · Profil, bouton + central (séance vide, repas, pesée) |
| Aujourd'hui | WHOOP Home + Reboot Ma Journée | Trois cadrans Récupération / Strain / Sommeil, balance calorique 7 jours, prochaine séance, pas, tuiles personnalisables |
| Onboarding | Alpha wizard | 8 étapes avec body map, estimation initiale de dépense (MacroFactor) |
| Programme / semaine | Gravl | Semaine en cours, récupération par muscle, Start / Skip / Deload |
| Séance active | Hevy | Un écran, bandeau d'exercices réordonnable (Alpha), notation d'effort en fin d'exercice (Gravl), tap sur la charge → explication |
| Post-séance | Hevy | Streak, slides PR / muscle map / volume, image partageable claire / sombre |
| Fiche exercice | Alpha | Onglets Info / Instructions / Historique, vidéo, évaluation, PR, graphique |
| Profil de salle | Gravl | Matériel, disques, machines et stacks, salles enregistrées |
| Journal alimentaire | MacroFactor | Timeline horaire, « + » par heure, assiette, recherche avec go-tos, photo / scan / Describe |
| Stratégie nutrition | MacroFactor | Style de programme, objectif et rythme, carte de check-in hebdo |
| Récupération | Athlytic Today | 4 indicateurs → détails, zone d'effort cible, journal de facteurs |
| Cardio | Reboot | Carte en direct, allure, tracé, zones FC |
| Analytics | Gravl + Alpha | Strength Score, force par muscle, séries par muscle, tendance de poids, rapports |
| Social / Marche | Hevy + Reboot | Feed, classement de pas et paliers, duels |
| Widgets | Reboot | Pas et calories, prochaine séance, récap du jour, force par muscle |
| Apple Watch | Gravl | Séance pilotée au poignet, timer, notation d'effort, FC |

### Ce que personne ne fait et que la nouvelle app peut prendre

- Relier la récupération (HRV, sommeil) au moteur de progression : Gravl l'ignore, WHOOP ne programme pas. Athlytic + moteur Gravl = différenciateur.
- Nutrition adaptative et entraînement dans la même app : MacroFactor les vend en deux apps, Gravl en bundle web, Reboot le fait mais avec un moteur faible.
- Périodisation automatique sur mésocycle avec surcharge explicable : Alpha a l'une, Gravl l'autre.
- Interface française native : Alpha et Gravl sont traduits, MacroFactor non, Reboot est français mais seul.

## Sources consultées

Fiches officielles et App Store ouvertes le 29–30 octobre 2026. Plusieurs tests sont publiés par des concurrents (SensAI, Alpha Progression, GainFrame, Nutrola) ou sponsorisés ; les chiffres de notes varient selon la vitrine par pays.

- Gravl : [site](https://gravl.ai/), [algorithme publié](https://gravl.ai/blog/how-gravl-algorithm-works), [App Store](https://apps.apple.com/us/app/gravl-ai-personal-trainer/id6450921637), [test SensAI](https://www.sensai.fit/blog/gravl-app-review-2026), [Alpha Progression vs Gravl](https://alphaprogression.com/en/blog/alpha-progression-vs-gravl)
- Alpha Progression : [site](https://alphaprogression.com/en), [guide](https://alphaprogression.com/en/blog/alpha-progression-guide), [profils de salle](https://alphaprogression.com/en/glossary/gym-profile), [App Store US](https://apps.apple.com/us/app/id1462277793), [App Store FR](https://apps.apple.com/fr/app/id1462277793), [Google Play](https://play.google.com/store/apps/details?id=com.alphaprogression.alphaprogression), [test Fitness Drum](https://fitnessdrum.com/alpha-progression-app-review/)
- Hevy : [site](https://www.hevyapp.com/), [Hevy Trainer](https://www.hevyapp.com/announcing-hevy-trainer/), [Free vs Pro](https://help.hevyapp.com/hc/en-us/articles/35119778922263), [logging](https://help.hevyapp.com/hc/en-us/articles/35361530647959), [App Store US](https://apps.apple.com/us/app/id1458862350), [App Store FR](https://apps.apple.com/fr/app/id1458862350), [Google Play](https://play.google.com/store/apps/details?id=com.hevy), [test GainFrame](https://gainframe.app/blog/hevy-app-review/)
- MacroFactor : [site](https://macrofactor.com/), [Workouts](https://macrofactor.com/workouts/), [Expenditure V3](https://macrofactor.com/expenditure-v3/), [abonnements](https://help.macrofactorapp.com/en/articles/393-how-macrofactor-subscriptions-and-bundles-work), [ajustements](https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal), [App Store US](https://apps.apple.com/us/app/macrofactor-macro-tracker/id1553503471), [App Store FR](https://apps.apple.com/fr/app/macrofactor-macro-tracker/id1553503471), [test Garage Gym Reviews](https://www.garagegymreviews.com/equipment/macrofactor)
- WHOOP : [abonnements FR](https://www.whoop.com/ax/fr/membership), [données](https://www.whoop.com/de/en/the-data/), [nouvel écran Home](https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/), [WHOOP Coach](https://www.whoop.com/au/en/thelocker/introducing-whoop-coach-powered-by-openai), [App Store US](https://apps.apple.com/us/app/whoop-performance-optimization/id933944389), [test TechRadar](https://www.techradar.com/health-fitness/fitness-trackers/whoop-mg-review), [test the5krunner](https://the5krunner.com/2025/10/31/2026-whoop-5-0-mg-review-discount-accuracy-strain-recovery-athletes/)
- Athlytic : [site](https://www.athlyticapp.com/), [App Store US](https://apps.apple.com/us/app/athlytic-ai-fitness-coach/id1543571755), [test iBikeRun](https://ibikerun.substack.com/p/athlytic-app-review-iosapple-watch), [Wareable](https://www.wareable.com/apple/turn-your-apple-watch-into-whoop)
- Reboot Plan : [fiche MWM](https://mwm.ai/apps/reboot-plan/6762472013), [App Store](https://apps.apple.com/app/id6762472013)
- uFit AI (écarté) : [App Store](https://apps.apple.com/us/app/ufit-ai-gym-workout-planner/id6752967140)
