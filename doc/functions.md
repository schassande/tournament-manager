# Backend Firebase Functions

## Vue generale

Le backend Firebase actuel est tres concentre :

- une seule Cloud Function exportee : `api`
- cette fonction encapsule une application Express
- une seule route metier est branchee aujourd'hui : `/refereeAllocationStatistics/compute`

Le reste du CRUD metier est fait directement par le frontend via Firestore.

## Initialisation

Fichier : `functions/src/index.ts`

Responsabilites :

- initialise `firebase-admin`
- cree une app Express
- active CORS avec `origin: true`
- monte le router `allocationStatisticsRouter`
- exporte `api = onRequest({ secrets: ['APP_API_KEY'] }, app)`

Point important :

- `APP_API_KEY` est declare comme secret requis, mais la verification du secret n'est pas encore implementee dans la route.

## Fonction exposee : `api`

Type :

- Cloud Function HTTP v2

Chemin de base :

- `/api`

Sous-routes montees :

- `/api/refereeAllocationStatistics/compute`

## Route HTTP : `/refereeAllocationStatistics/compute`

Fichier : `functions/src/allocation-statistics.ts`

Methode :

- `GET`

But :

- calculer les statistiques d'allocation d'un ou plusieurs arbitres
- persister les statistiques au niveau fragment
- agreger ces statistiques au niveau allocation tournoi

## Parametres attendus

Le commentaire du code indique les parametres suivants :

- `tournamentAllocationId`
- `fragmentAllocationId`
- `refereeAttendeeIds` : liste separee par virgules
- `gameId` optionnel

Intention metier :

- si `gameId` est fourni, la route recupere les arbitres deja alloues a ce match et les ajoute a la liste de calcul
- sinon elle calcule directement sur `refereeAttendeeIds`

Attention :

- le commentaire parle de query params
- l'implementation lit `req.params`

Il y a donc aujourd'hui un decalage entre la documentation inline et le code reel.

## Reponse

La route renvoie un objet de la forme :

```json
{
  "tournamentAllocationId": "...",
  "fragmentAllocationId": "...",
  "refereeAllocationStatistics": [
    {
      "refereeAttendeeId": "...",
      "fragmentAllocationRefereeStatistics": {},
      "tournamentAllocationRefereeStatistics": {}
    }
  ]
}
```

## Collections lues

La route lit :

- `tournament-referee-allocation`
- `fragment-referee-allocation`
- `tournament`
- `game`
- `attendee`
- `game-attendee-allocation`
- `fragment-referee-allocation-statistics`
- `tournament-referee-allocation-statistics`

## Collections ecrites

La route cree ou met a jour :

- `fragment-referee-allocation-statistics`
- `tournament-referee-allocation-statistics`

Elle peut aussi supprimer des doublons detectes dans ces collections de statistiques.

## Fonctions internes principales

## `computeRefereeStatistics(...)`

Role :

- point d'orchestration principal
- charge l'allocation tournoi, le fragment et le tournoi
- calcule les stats pour chaque arbitre demande
- declenche la sauvegarde des stats fragment et tournoi

## `computeRefereeStatistic(...)`

Role :

- calcule les stats d'un arbitre sur un fragment d'allocation

Logique :

1. recupere les matchs de l'arbitre dans le fragment
2. initialise un objet `FragmentRefereeAllocationStatistics`
3. complete les stats match par match
4. calcule la moyenne de niveau des buddies

## `completeRefereStatsWithGame(...)`

Role :

- enrichit les stats avec un match donne

Donnees calculees :

- dernier changement d'allocation
- nombre de matchs sur terrain de mauvaise qualite
- nombre de matchs video
- premier / dernier slot
- coachings recus via les coaches d'arbitres
- buddies arbitres rencontres
- equipes arbitrees
- detail des matchs

## `saveFragmentRefereeAllocationStatistics(...)`

Role :

- remplace ou cree la statistique fragment pour un arbitre

## `assignFragmentToTournamentRefereeAllocationStatistics(...)`

Role :

- rattache une statistique fragment a la statistique tournoi correspondante
- cree l'objet tournoi si besoin
- recalcule l'agregation

## `computeTournamentRefereeAllocationStatistics(...)`

Role :

- fusionne plusieurs statistiques fragment en une statistique tournoi

Agregations calculees :

- buddies
- teams
- coaching
- plages horaires
- liste de matchs
- compteurs de terrains / video

## `getGameAttendees(...)`, `getGameReferees(...)`, `getAttendeeGameIds(...)`

Role :

- helpers Firestore pour retrouver les allocations sur les matchs

## `getFragementRefereeAllocationStatistics(...)`

Role :

- retrouve la statistique fragment existante pour un arbitre
- si plusieurs documents existent, garde le plus recent et supprime les doublons

## `getTournamentRefereeAllocationStatistics(...)`

Role :

- meme principe au niveau allocation tournoi

## Utilitaires backend

## `common-persistence.ts`

Helpers generiques Firestore :

- `byId`
- `byIdRequired`
- `create`
- `save`
- `deleteById`
- `epochToDate`
- `dateToEpoch`

## `data-cache.ts`

Cache memoise :

- `getReferee(attendeeId)`
- `getRefereeCoach(attendeeId)`

But :

- limiter les lectures Firestore repetitives lors des calculs de stats

## Etat actuel du backend

Le backend Firebase est aujourd'hui specialise sur le calcul de statistiques d'allocation. Il ne porte pas encore :

- de CRUD HTTP pour les tournois
- de CRUD HTTP pour les arbitres, matchs ou affectations
- de trigger Firestore
- de taches planifiees

En consequence, l'architecture actuelle est hybride :

- frontend -> Firestore pour la majorite des operations metier
- frontend -> Cloud Function HTTP pour les calculs de statistiques complexes
