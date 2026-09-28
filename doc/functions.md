# Backend Firebase Functions

## Vue generale

Le backend Firebase actuel est tres concentre :

- Exported functions: `api`, `createPerson`, `deletePerson`, `saveAttendee`, `deleteAttendee`, `createTournament`, `deleteTournament`, `removeRankingReferees`, `repairRefereeRanking`, `deleteRefereeRanking`.
- `api` encapsule une application Express
- trois routers metier sont branches : `/refereeAllocationStatistics`, `/fitImport` et `/tournamentHome`

Profile updates and other permitted business writes still use Firestore directly. Identity, attendee, and tournament lifecycle writes use the callables below.

Les collections `referee-upgrade-coach-vote` et `referee-upgrade-panel-vote` sont validees par les regles Firestore : valeurs de vote autorisees, arbitre eligible, identite du referee coach pour les votes individuels et invariants d'identite lors des mises a jour. Les votes ne sont pas supprimables afin de conserver l'historique.

## Initialisation

Fichier : `functions/src/index.ts`

Responsabilites :

- initialise `firebase-admin`
- cree une app Express
- active CORS avec `origin: true`
- monte le router `allocationStatisticsRouter`
- exporte la callable function `createPerson`
- exporte `api = onRequest({ secrets: ['APP_API_KEY'] }, app)`

The allocation-statistics endpoint now verifies an Authorization bearer token and indexed manager/admin access. It never logs authentication headers or APP_API_KEY. FIT proxy and the anonymized tournament home aggregate retain their existing public behavior.

## Fonction exposee : `api`

Type :

- Cloud Function HTTP v2

Chemin de base :

- `/api`

Sous-routes montees :

- `/api/refereeAllocationStatistics/compute`
- `/api/fitImport/competitions`
- `/api/fitImport/competitions/:competitionSlug/seasons`
- `/api/fitImport/download?competitionSlug=...&season=...`
- `/api/tournamentHome?tournamentId=...`

### Agrégat public de la page d'accueil tournoi

La route `/tournamentHome` est accessible sans authentification. Elle lit côté serveur les collections privées nécessaires et renvoie uniquement un agrégat anonymisé : métadonnées publiques du tournoi, statistiques d'arbitres, pyramide par niveau et genre, nombre de matchs et compteurs persistés de l'allocation courante. Les emails, disponibilités, votes et statistiques individuelles ne sont jamais renvoyés.

### Proxy FIT

Le router `fitImportRouter` (`functions/src/fit-import.ts`) relaie les appels vers l'API publique FIT côté serveur. Le frontend appelle directement l'URL publique de la fonction `api` (`...cloudfunctions.net/api/fitImport/...`), ce qui évite le blocage CORS du site FIT sans proxy local. Le relais charge la saison, les divisions et les stages pour la route `download`, vérifie les erreurs HTTP et JSON, et renvoie les erreurs sous la forme `{ "error": "..." }`.

## Identity, attendee, and tournament callables (2026-09-14)

All these callables require verified Firebase email. Supplied UID/email or role flags are never proof of authorization. Admin SDK operations enforce their own permissions because they bypass Firestore rules.

| Callable | Request | Response | Authorization and effect |
|---|---|---|---|
| `createPerson` | `{ person: Person }` | `Person` | Verified self-registration only. Creates Person/email index transactionally, then links all matching attendees. |
| `deletePerson` | `{ personId: string, deleteAccount: true }` | empty | Owner or platform admin. Deletes Authentication, Person, and account email index; preserves attendees and tournament indexes. |
| `saveAttendee` | `{ attendee: Attendee }` | `Attendee` | Indexed manager or platform admin. Empty ID creates; a supplied ID must exist. Normalizes email, derives flags, validates Person links, and updates the index atomically. |
| `deleteAttendee` | `{ id: string }` | empty | Indexed manager or platform admin. Deletes attendee and only its owned index entry. |
| `createTournament` | `{ tournament: Tournament, attendee: Attendee }` | `{ tournament, attendee }` | Verified creator with an existing profile. Allocates IDs and creates tournament, first manager, and index atomically. |
| `deleteTournament` | `{ tournamentId: string }` | `{ deletedDocuments: number }` | Current manager/admin on every attempt. Deletes related collections, attendees/index, then tournament. |

`createPerson` rejects another owner's email/UID. A repeat for the same identity returns the existing Person and repeats linking. Linking queries `where("person.email", "==", createdPerson.email)` and paginates only matching attendees in pages of 150. Attendee emails are normalized by creation/update; registration never scans the whole collection. Transactions recheck current identity and email and update only `person.personId` and `lastChange`. Each invocation queries matching attendees again; no completion state is persisted. Concurrent attendee saves consult the Person index, so new membership converges to the correct link.

`createPerson` and `deleteTournament` have 540-second timeouts, matched by the frontend. Registration retries reuse the newly created account and repeat the filtered linking operation.

`deleteTournament` processes pages of 150 documents. It executes directly without freezing concurrent writes or recording progress. A partial failure after manager membership is removed requires a platform administrator to finish. Counters describe the current attempt. The frontend displays preparation and confirmed completion rather than simulated intermediate progress.

Errors: `unauthenticated`, `permission-denied`, `invalid-argument`, `already-exists` for email collisions, `not-found` for an absent attendee update, and `failed-precondition` for deletion in progress or identity repair needs.

Internal collections and migration are documented in `doc/datamodel.md` and `doc/dev.md`. No additional secret is required.

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

Les paramètres sont transmis comme query params (`req.query`). Le frontend les encode via `RefereeAllocationStatisticsApiService`.

La route accepte aussi des recalculs complets déclenchés depuis le panneau de statistiques : le frontend envoie les arbitres existants du périmètre par lots parallèles de dix requêtes maximum.

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

Le backend Firebase porte aujourd'hui :

- une API HTTP Express pour les statistiques d'allocation
- Account, attendee, and tournament lifecycle callables enforce identity, authorization, and transactional index consistency.

Il ne porte pas encore :

- de CRUD HTTP pour les tournois
- de CRUD HTTP pour les arbitres, matchs ou affectations
- de trigger Firestore
- de taches planifiees

En consequence, l'architecture actuelle est hybride :

- frontend -> Firestore pour la majorite des operations metier
- frontend -> Cloud Function callable pour la creation de `Person`
- frontend -> Cloud Function HTTP pour les calculs de statistiques complexes

## Maintenance des referee rankings (étape 2)

The v2 callables `removeRankingReferees` and `repairRefereeRanking` require a verified email and an indexed tournament coach matching `actorCoachAttendeeId`, plus the enabled RANKING module. A linked Person and panel-leader role are not required. Tournament deletion in progress rejects these operations.

Contrat partagé dans `persistent-data-model/src/referee-ranking.ts` :

- Contexte commun : `{ tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId }`.
- Retrait : ajoute `refereeAttendeeIds: string[]`, non vide ; chaque ID doit être actuellement sélectionné. CLOSED est refusé.
- Réparation : déduit les références invalides des attendees persistés et de la sélection. CLOSED retourne les données inchangées.
- Réponse commune : `{ ranking, coachRankings, changed: boolean }`, avec les statistiques sous forme `number[][]` en mémoire.

Une transaction lit et valide les données avant toute écriture. Elle nettoie la sélection et tous les classements associés, conserve les verrous et l'ordre restant, aligne les statistiques du panel et marque STALE un résultat existant. Les dates individuelles ne changent que si la liste change. Les références qui ne sont plus sélectionnées sont également nettoyées. Un échec, y compris lors du commit ou du dépassement des limites Firestore, ne laisse aucune écriture partielle. Une réparation sans changement n'écrit rien.

Les chargements normaux, le nom, N, les ajouts de sélection et le calcul du panel restent des opérations Firestore directes. Le frontend ne demande une réparation qu'après avoir détecté des références invalides dans ses lectures groupées. La suppression complète dispose du contrat ci-dessous depuis l'étape 5.

### Suppression complète d'un referee ranking (étape 5)

La callable v2 `deleteRefereeRanking`, dans `functions/src/referee-ranking/delete-referee-ranking.ts`, reçoit `{ tournamentId, tournamentRefereeRankingId, actorCoachAttendeeId }` et renvoie `RankingDeletionResponse` : `{ deletedRankingId, deletedCoachRankingCount }`.

Elle vérifie le même coach authentifié et le module RANKING que la maintenance, ainsi que le tournoi du parent et de tous ses enfants avant la première suppression. Un manager sans rôle de coach ne peut pas utiliser cette action. CLOSED est accepté. Tous les individus, y compris les votes d'entraînement, sont supprimés par lots de 500, puis le parent est supprimé en dernier. Une erreur laisse le parent disponible pour une nouvelle tentative ; les lots déjà supprimés ne sont pas recréés. Le compteur retourné porte sur les enfants supprimés pendant la tentative réussie. La réponse n'est envoyée qu'après la fin de la cascade.

Erreurs : `invalid-argument` pour un identifiant invalide, `unauthenticated` sans identité, `permission-denied` pour un accès refusé, `not-found` pour un parent absent, `failed-precondition` pour un enfant rattaché à un autre tournoi et `internal` si la suppression ne peut pas se terminer. Aucun secret supplémentaire n'est requis.

Compilation : la lecture du compteur historique optionnel `nbGamesToAllocate` dans `tournament-home.ts` utilise maintenant un type local explicite. Cette correction de typage préserve le comportement existant et n'ajoute pas ce champ au modèle partagé.

## Statistics authorization update (2026-09-14)

`GET /refereeAllocationStatistics/compute` requires `Authorization: Bearer <Firebase ID token>` with verified email and indexed manager or platform-admin rights for the allocation tournament. Allocation, fragment, game, and referee inputs must belong to that tournament. Errors return HTTP 401, 403, 400, or 409 as appropriate. The Angular API service adds the current user's token. This also removes the previous logging of headers and the API secret.
