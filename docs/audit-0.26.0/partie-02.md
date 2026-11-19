# Partie 2 — données, repositories et migrations (en cours)

Tag `v0.26.0`, SHA `8686a8fc2860f7a94eb193426cbcc640a33bac80`. Budget L. Poursuite de toutes les parties demandée par Ali le 19/11 : les commits intermédiaires ne sont pas des arrêts de travail.

## Lectures et premières conclusions

- PRD § 20/21 lu ; détails historiques à confronter aux décisions et migrations réellement publiées.
- Migrateur, sauvegarde avant migration, sérialiseur, driver Wasm, signaux d'écriture, observation des écritures, registre et **19 migrations intégralement lus**. Aucun changement du schéma réalisé par l'audit.
- Migrations par transaction, vérification des sommes et refus d'une version supérieure ; tableaux de capture figés, extensions de champs capturées par déclencheurs supplémentaires. Séances ouvertes exclues des captures ; clôture met séance/séries/décisions en file. Concordance exhaustive catalogue/déclencheurs à établir par outils dans la suite de cette partie.
- La piste « réintégration seulement au journal » de partie 1 est **nuancée** par `src/db/repositories/sql/syncUnknown.ts`, lu entièrement : un état `REINTEGRATION_FAILURE_META` est persisté pour les échecs de ligne et au mieux pour l'échec global. Il reste à vérifier l'affichage et le cas où la persistance échoue aussi ; ne pas transformer la piste en constat sans ces vérifications.
- **A-008 bloquant sous injection de panne** : rollback en échec, connexion réutilisée, écriture suivante acquittée mais perdue à la réouverture. Détail et limites dans `bloquants.md`. Le test existant `serializedDriver.test.ts` a été lu intégralement : il couvre le rollback normal et la perte de transaction, mais son cas de nettoyage en échec ne vérifie pas une écriture suivante durable. Aucun test existant modifié.

## Suite exacte

Poursuivre les repositories SQL (d'abord écriture de séance, import/export et reset), les interfaces/parseurs, puis les preuves ciblées et la synthèse de partie. Ne pas clôturer sur la seule lecture des migrations. Les garanties natives de sauvegarde seront croisées avec la partie 8, sans build Rust local.

Les fichiers lus sont consignés progressivement dans `preuves/lectures.json`. Aucun bloquant n'attend la fin de partie pour être publié. Restriction mémoire du 19/11 inchangée ; dispense de nouvelle construction du bundle pour les pushes documentaires motivée dans `avancement.md` et `partie-01.md`.
