# ADR 0017 — Séparation Spartiate / CircleTasks

- Statut : accepté (décision d'Ali du 2026-11-01 ; auteur `architect`, relectures `sync-icloud` et `security-privacy` consignées dans `docs/SPA-001.md`)
- Date : 2026-11-01
- Ticket : SPA-001a (appliqué avant toute donnée Spartiate, donc sans migration)
- Complète : ADR 0011 (synchro par dossier iCloud chiffré), D-26 (aucune évolution du protocole de synchro), D-38, D-41. Amende D-26 sur un seul point : les constantes d'identification du format (listées ci-dessous), jamais la logique.

## Contexte

Spartiate est un fork de CircleTasks. Les deux apps coexistent sur le PC et l'iPhone d'Ali, et les données réelles de CircleTasks sont intouchables (AGENTS.md). Hérité tel quel, le protocole de synchro était identique : même sel HKDF, mêmes balises de fichier, même préfixe de QR. Conséquence : une clé de CircleTasks, importée à la main dans Spartiate avec le dossier `iCloud Drive/CircleTasks` choisi, aurait déchiffré les fichiers de CircleTasks et Spartiate y aurait écrit (relecture de SPA-001a, suggestion S3). Le risque est la corruption silencieuse de données réelles par une app qui ne doit jamais les voir.

## Décision

Séparer les deux apps **par construction**, de deux façons indépendantes (aucune ne dépend de l'autre) : cryptographique, puis garde de dossier.

### 1. Séparation cryptographique (constantes d'identification seulement)

| Constante | CircleTasks | Spartiate |
| --- | --- | --- |
| Texte du QR d'appairage | `CTPAIR1.` | `SPPAIR1.` |
| Clé de secours imprimée | `CT1-` | `SP1-` |
| Sel HKDF-SHA256 | `circletasks` | `spartiate` |
| Infos HKDF (clé d'enregistrement, `kid`) | `ct/1 records`, `ct/1 kid` | `sp/1 records`, `sp/1 kid` |
| Préfixe des AAD | `ct/1` | `sp/1` |
| Balises de format des fichiers (`f`) | `ct-j`, `ct-s`, `ct-state` | `sp-j`, `sp-s`, `sp-state` |

Effets : une clé de CircleTasks dérive d'autres clés d'enregistrement et un autre `kid` ; une ligne chiffrée de CircleTasks ne se déchiffre pas (clé et AAD différentes) ; un en-tête `ct-*` est refusé à l'analyse (`bad-header`) ; un QR `CTPAIR1.` est refusé (`invalid-pairing`) ; une clé de secours `CT1-` est refusée. L'inverse vaut pour CircleTasks, dont le code n'est pas modifié ici et qui rejette donc déjà `SPPAIR1.`, `SP1-` et `sp-*` (préfixes inconnus). Les longueurs sont inchangées (`ct-j` et `sp-j` ont la même taille) : aucune borne, aucun plafond, aucun calcul d'octets ne bouge.

Ne changent pas : la logique de fusion, les époques, les HLC, les tombstones, la reprise, les bornes, la version majeure du format (`sm` = 1), les extensions `.ctj` / `.cts` / `state.ctx` (noms de fichiers, sans valeur de sécurité), les noms de dossier `devices/`.

### 2. Garde de dossier (Rust, `src-tauri/src/sync/folder.rs`, `service.rs`, `store.rs`)

Avant toute liaison (`choose_folder`, `choose_bookmarked_folder`, donc PC et iPhone), et avant d'écrire quoi que ce soit (`folder.json`, `own.json`, clé) :

1. refus du dossier dont le nom, ou celui de l’un de ses ancêtres, est `CircleTasks`, sans tenir compte de la casse ni des espaces de bord (`is_circletasks_folder_name`) ;
2. refus du dossier dont un `devices/<uuid>/state.ctx` déjà présent sur le disque porte un en-tête `"f":"ct-…"` (`Store::folder_has_foreign_data`) ; un fichier resté dans le nuage n'est pas hydraté pour cela (le nom du dossier fait alors garde) ; même budget d'entrées que `folder_has_data` ;
3. code d'erreur `foreign-folder` (nouveau, 39e code de `SYNC_ERROR_CODES`, même ordre en Rust et en TypeScript), famille « dossier », message clair en français : « Ce dossier appartient à CircleTasks : Spartiate ne le lie jamais. Choisissez un autre dossier. » ; « Choisir le dossier » est proposé à côté.

### 3. Tests et fixtures

- Fixture figée `tests/fixtures/sync/circletasks-foreign.json` : vecteurs synthétiques au format CircleTasks (clé de test, jamais une vraie clé). Elle ne se régénère jamais.
- Tests rouges d'abord (commit 943bfa3b) : QR CircleTasks refusé, clé de secours refusée, en-têtes refusés, ligne chiffrée non déchiffrable, dossier `CircleTasks` refusé, dossier à en-tête `ct-*` refusé, dossier vide ou `Spartiate` accepté.
- `tests/fixtures/sync/vectors.json` est régénéré avec les constantes de Spartiate (`CT_WRITE_SYNC_VECTORS=1`) ; ses lignes `rustSealed` ont été rescellées par le codec de référence TypeScript (même algorithme, nonce tiré par la bibliothèque) faute de Rust local ; `print_rust_sealed` les remplacera par des lignes écrites par Rust à la prochaine occasion sans changer le contrat.

## Alternatives écartées

- Ne garder que la garde de dossier : une clé importée dans un autre dossier resterait compatible. Écarté (défense en profondeur).
- Ne garder que la séparation cryptographique : un dossier `CircleTasks` serait lié puis rejeté fichier par fichier, avec des erreurs `bad-header` en rafale et sans message clair. Écarté.
- Marqueur d'app dans le dossier : ajoute un format ; inutile quand le contenu est déjà incompatible. Écarté.

## Conséquences

- Les vecteurs, les tests de format et les e2e d'appairage portent les nouvelles chaînes ; aucun test n'est supprimé.
- Les données Spartiate n'existant pas encore (D-38), aucune migration ni lecture de l'ancien format n'est écrite : il n'y a pas de pont, par décision.
- Toute future constante d'identification du format (nouvelle balise, nouveau préfixe) reste propre à Spartiate ; un changement de la logique du protocole garde sa règle D-26 (ADR, relecture `sync-icloud`).
- Limite connue : la garde ne lit pas un `state.ctx` encore dans le nuage ; la séparation cryptographique couvre ce cas (les fichiers ne seraient jamais déchiffrés ni écrits sous la mauvaise clé).

## Vérification

Vitest (`tests/unit/syncSeparation.test.ts`, `tests/unit/syncCodec*.test.ts`, `src/domain/sync/format*.test.ts`) ; `cargo test --locked --features test-hooks --test desktop` (dont `sync_separation.rs`, en CI) ; `scripts/release/identity.test.ts` pour l'absence de l'ancienne identité active.
- Limite acceptée à confirmer par Ali (revue security-privacy) : une copie renommée du dossier dont les `state.ctx` sont restés dans le nuage, ou qui ne contient que des `.ctj`, est liée ; Spartiate y écrirait son propre dossier `devices/<uuid>/`, sans jamais déchiffrer ni modifier un fichier de CircleTasks.
