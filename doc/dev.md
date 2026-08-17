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

Le build Angular resolve `@tournament-manager/persistent-data-model` directement vers `../persistent-data-model/src`.

Sortie generee :

- `frontend/dist/test-prime/browser`

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
- Le backend ne fournit actuellement qu'une API HTTP de calcul de statistiques d'allocation ; le reste du CRUD passe par Firestore depuis le frontend.
- Decision technique : le datamodel partage n'est plus distribue comme package workspace. Le frontend le consomme via le mapping TypeScript et le backend l'embarque directement pendant sa compilation.

## Analyse des specs de changement

Une skill Codex locale est disponible dans `.codex/skills/analyze-change-spec/`. Elle analyse le fichier spec indiqué dans `doc/changes/`, vérifie s'il est prêt pour l'implémentation, pose les questions manquantes une par une avec un compteur et des solutions numérotées, puis met à jour la spec en anglais dans une structure standard avec sa date de mise à jour. Lorsque la spec est prête, elle le signale simplement et propose de passer à l'implémentation, sans afficher de résumé dans le chat. Elle ne modifie pas le code par défaut.
