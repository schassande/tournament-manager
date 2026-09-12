# Documentation technique

## Vue d'ensemble

Le projet est organise en trois repertoires TypeScript :

- `frontend/` : application Angular 20 + PrimeNG.
- `functions/` : backend Firebase Functions en TypeScript, expose via HTTP.
- `persistent-data-model/` : sources TypeScript partagees entre le front et le back pour les types metier et les noms de collections Firestore.

A la racine on trouve aussi :

- `firebase.json` : configuration Firebase de Functions et Hosting.
- `.firebaserc` : projet Firebase cible `tournament-manager-90045`.
- `firestore.rules` et `firestore.indexes.json` : securite et index Firestore.
- `doc/` : documentation projet.

## Organisation du code

### Frontend

Le front est dans `frontend/src/` :

- `app/` : bootstrap Angular, routes, guard d'authentification.
- `page/` : pages navigables.
- `component/` : composants reutilisables ou pages complexes.
- `service/` : acces Firestore, auth Firebase, logique d'orchestration.
- `environments/` : configuration Firebase.

Le menu principal est defini dans `frontend/src/component/main-menu.component.ts` et depend du tournoi courant charge dans `TournamentService`.

### Backend Firebase

Le backend est dans `functions/src/` :

- `index.ts` : point d'entree Firebase, creation de l'app Express.
- `allocation-statistics.ts` : route HTTP de calcul des statistiques d'allocation des arbitres.
- `common-persistence.ts` : helpers CRUD Firestore.
- `data-cache.ts` : cache de lecture des `Attendee`.

### Modele partage

Le package `persistent-data-model/src/` centralise :

- les interfaces metier : `Tournament`, `Attendee`, `Person`, `Game`, allocations, statistiques, etc.
- les constantes de collections Firestore.
- quelques constantes de palette/couleurs et types de slot.

## Compilation

## Prerequis

- Node.js 22 pour les fonctions Firebase.
- npm.
- Firebase CLI pour l'emulation et le deploiement.

## Installation

Depuis la racine :

```powershell
npm install
```

Les dependances s'installent independamment selon le repertoire concerne :

- racine : outillage partage minimal du depot ;
- `frontend/` : dependances Angular ;
- `functions/` : dependances Firebase Functions.

## Compiler le frontend

```powershell
cd frontend
npm run build
```

## Formatage du code frontend

Prettier est configure a la racine du depot dans `.prettierrc`. Il applique deux espaces,
les quotes simples TypeScript, une largeur de ligne de 120 caracteres et conserve le `>`
des balises HTML sur la derniere ligne de la balise.

Depuis la racine :

```powershell
npm run format
npm run format:check
```

`format` corrige les fichiers TypeScript, HTML et CSS du frontend. `format:check` verifie
le formatage sans modifier les fichiers et doit etre execute avant une livraison.

Le build Angular resolve `@tournament-manager/persistent-data-model` directement vers `../persistent-data-model/src`.

Sortie generee :

- `frontend/dist/browser`

Le point d'entree HTML de l'application est `frontend/src/index.html`. Le repertoire
`frontend/public/` contient uniquement les assets statiques (par exemple le favicon) :
il ne doit pas contenir la page d'accueil generee par Firebase Hosting ni de scripts
`/__/firebase/*`. Firebase est initialise par AngularFire dans
`frontend/src/app/app.config.ts`; les URLs `/__/firebase/*` sont des endpoints
fournis uniquement par Firebase Hosting et ne sont pas disponibles avec `ng serve`.

Pour le developpement local :

```powershell
cd frontend
npm start
```

## Compiler le backend

```powershell
cd functions
npm run build
```

Le build TypeScript du backend compile aussi `../persistent-data-model/src` dans sa sortie `lib/`, ce qui evite toute dependance sur un build separe du datamodel.

Pour developper avec emulation Functions :

```powershell
cd functions
npm run serve
```

## Deploiement

## Secret requis

Le projet attend un secret Firebase Functions nomme `APP_API_KEY`.

```powershell
firebase functions:secrets:set APP_API_KEY
```

## Deploiement des Cloud Functions

Depuis `functions/` :

```powershell
npm run deploy
```

Ce script :

1. compile `functions` ainsi que les sources partagees de `persistent-data-model/src`
2. lance `firebase deploy --only functions`

## Deploiement Firestore

Le depot contient des regles Firestore. Si besoin, elles peuvent etre deployeees explicitement :

```powershell
firebase deploy --only firestore:rules
```

## Deploiement du frontend

Le frontend est configure pour Firebase Hosting avec :

- le repertoire publie `frontend/dist/browser` ;
- une reecriture de toutes les routes vers `index.html`, necessaire au routage Angular cote client ;
- un pre-deploiement qui lance automatiquement le build Angular de production.

Depuis la racine du depot, apres authentification Firebase (`firebase login`), deployer manuellement le frontend avec :

```powershell
firebase deploy --only hosting
```

La commande utilise le projet Firebase selectionne dans `.firebaserc` (`tournament-manager-90045`). Le build peut aussi etre lance seul pour verifier la compilation :

```powershell
cd frontend
npm run build
```

## Flux de build recommande

Pour une livraison complete du projet actuel :

```powershell
cd frontend
npm run build
cd ..
firebase deploy --only hosting
cd functions
npm run deploy
```

## Notes importantes

- Les variables Firebase du front sont configurees dans `frontend/src/environments/environment.ts` et `environment.prod.ts`.
- Les appels HTTP vers les Firebase Functions utilisent directement `functionsApiUrl` dans ces fichiers d'environnement ; aucun proxy local Angular n'est requis.
- Le front accede directement a Firestore avec AngularFire.
- Le backend fournit les routers et callables décrits dans doc/functions.md ; le CRUD ordinaire reste principalement direct via Firestore.
- Decision technique : le datamodel partage n'est plus distribue comme package workspace. Le frontend le consomme via le mapping TypeScript et le backend l'embarque directement pendant sa compilation.

## Analyse des specs de changement

Une skill Codex locale est disponible dans `.codex/skills/analyze-change-spec/`. Elle analyse le fichier spec indiqué dans `doc/changes/`, vérifie s'il est prêt pour l'implémentation, pose les questions manquantes une par une avec un compteur et des solutions numérotées, puis met à jour la spec en anglais dans une structure standard avec sa date de mise à jour. Lorsque la spec est prête, elle le signale simplement et propose de passer à l'implémentation, sans afficher de résumé dans le chat. Elle ne modifie pas le code par défaut.

## Vérification du socle referee ranking

Depuis `frontend`, lancer les tests ciblés et la compilation :

```powershell
node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/page/tournament-referee-ranking/tournament-referee-ranking.page.spec.ts --include=src/service/referee-ranking-model.spec.ts
node node_modules/@angular/cli/bin/ng.js build --configuration development
```

Le `baseUrl` de `frontend/tsconfig.spec.json` pointe vers la racine du dépôt pour que le bundler Karma résolve aussi l'alias du modèle partagé.

Depuis la racine, vérifier les règles dans un émulateur Firestore local (Firebase CLI et Java requis) :

```powershell
firebase emulators:exec --only firestore --project demo-ranking-stage1 --config firebase.ranking-test.json "node --test tests/firestore/referee-ranking.test.cjs"
```

Cette configuration de test est distincte de `firebase.json`. Les tests REST utilisent uniquement un hôte local et un projet de démonstration ; ils n'accèdent pas au projet Firebase de production. Ils vérifient les lectures authentifiées, l'identité du coach, la création, les transitions, la clôture et les droits de suppression nécessaires aux managers. Les règles n'ouvrent pas les écritures des onglets avant leur implémentation.

## Organisation des fichiers des composants

Un composant ou une page réparti sur plusieurs fichiers utilise un sous-dossier dédié portant son nom. Le TypeScript/JavaScript, le HTML, le CSS et les tests associés y sont regroupés. Les imports sont adaptés lors d'un déplacement ; les références `templateUrl` et `styleUrl` restent locales au composant.

La page de ranking suit cette convention dans `frontend/src/page/tournament-referee-ranking/`.

### Validation et déploiement de l'étape Referees

Depuis la racine, installer si nécessaire les dépendances backend avec `npm ci --prefix functions`, puis compiler avec `npm --prefix functions run build`.

Les tests de règles et de transactions utilisent exclusivement l'émulateur local et les Functions compilées :

```powershell
firebase emulators:exec --only firestore --project demo-ranking-stage1 --config firebase.ranking-test.json "node --test tests/firestore/referee-ranking.test.cjs tests/firestore/referee-ranking-maintenance.test.cjs"
```

Les tests Angular de la fonctionnalité sont dans `src/page/tournament-referee-ranking/`, `src/component/ranking-referees/` et `src/service/referee-ranking-model.spec.ts` (commande ng test depuis frontend avec --watch=false et les --include correspondants).

Pour activer les retraits et la réparation dans l'environnement Firebase, déployer les deux callables en plus des règles. La configuration racine contient les Functions ; la configuration de test référence les règles Firestore et permet aussi leur déploiement explicite :

```powershell
firebase deploy --only firestore:rules --project tournament-manager-90045 --config firebase.ranking-test.json
firebase deploy --only "functions:removeRankingReferees,functions:repairRefereeRanking" --project tournament-manager-90045
```

Le frontend utilise AngularFire Functions, comme createPerson. Aucun secret supplémentaire ni changement de functionsApiUrl n'est requis. Le déploiement du frontend reste le workflow hosting existant. Aucun déploiement n'a été exécuté par l'agent pour cette étape.

Si l'ajout d'un arbitre affiche « Referee changes could not be saved » alors que la création fonctionne, vérifier que les règles de l'étape 2 ont été déployées : la règle update du parent doit autoriser `validRankingRefereeChange()` en plus de `validRankingStatusChange()`. Les règles de l'étape 1 refusent les ajouts. Le déploiement du frontend seul ne publie pas les règles. Diagnostic confirmé sur le projet tournament-manager-90045 le 2026-09-12 : la version active à 07:40:43 UTC ne contenait pas cette autorisation. La commande firestore:rules ci-dessus publie le fichier local nécessaire ; l'ajout n'utilise aucune callable.
