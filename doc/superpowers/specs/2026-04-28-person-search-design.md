# Design - Champ de recherche Person

## Contexte

`Person.search` est un champ denormalise du document Firestore `person`.
Il facilite la recherche textuelle sur les informations d'identite d'une personne.

Le besoin decrit dans `doc/WIP.md` est le suivant :

- ajouter le champ `search` au modele `Person` ;
- recalculer automatiquement ce champ a chaque creation et modification ;
- construire sa valeur par concatenation de `firstName`, `lastName`, `shortName` et `email`, avec un espace comme separateur.

Le projet utilise aujourd'hui une architecture hybride :

- la creation de `Person` passe par la callable function `createPerson` ;
- les modifications de `Person` existantes passent par le service frontend `PersonService` et une ecriture Firestore directe.

## Decision

Le recalcul de `Person.search` est garanti par les flux applicatifs existants.
Il n'est pas garanti par un trigger Firestore global.

Ce choix conserve l'architecture actuelle, limite le cout d'implementation, et evite d'ajouter une fonction backend reactive uniquement pour ce champ.
La limite acceptee est qu'une modification directe dans Firestore, hors services applicatifs du projet, peut laisser `search` obsolete.

## Architecture

Le champ `Person.search` reste porte par le modele partage.
La fonction `buildPersonSearch` dans `persistent-data-model/src/referee.ts` est la source unique de verite pour construire la valeur du champ.

La creation d'une personne passe par `functions/src/person/create-person.ts`.
La function valide les champs attendus, normalise l'email, verifie l'unicite de l'email non vide, calcule `search`, puis ecrit le document `person/{id}` dans la meme transaction que l'index `email_personid`.

La modification d'une personne existante passe par `frontend/src/service/person.service.ts`.
Avant toute sauvegarde, `PersonService.save()` prepare l'objet avec une valeur `search` recalculee, puis delegue l'ecriture a `AbstractPersistentDataService.save()`.

## Composants

`persistent-data-model/src/referee.ts`

- expose le type `Person` ;
- expose `buildPersonSearch` ;
- definit la regle de concatenation partagee entre frontend et backend.

`functions/src/person/create-person.ts`

- cree les nouvelles personnes cote backend ;
- applique la normalisation d'email ;
- calcule `search` avant l'ecriture Firestore.

`frontend/src/service/person.service.ts`

- encapsule les sauvegardes frontend de `Person` ;
- recalcule `search` avant une creation ou modification issue du service ;
- conserve le flux direct Firestore pour les personnes existantes.

`doc/datamodel.md` et `doc/functions.md`

- documentent le champ denormalise ;
- documentent la responsabilite de `createPerson` a la creation ;
- documentent la limite de garantie applicative si necessaire.

## Flux de donnees

Creation :

1. Le frontend transmet une `Person` a `createPerson`.
2. La function valide le payload.
3. L'email est normalise avec `trim()`.
4. Si l'email est non vide, `email_personid/{email}` est lu dans la transaction.
5. Si l'email existe deja, la creation echoue avec `already-exists`.
6. Le document `Person` final est construit avec son identifiant, son `lastChange`, son email normalise et son champ `search`.
7. Le document `person/{id}` est ecrit.
8. Si l'email est non vide, l'index `email_personid/{email}` est ecrit avec `{ personId }`.

Modification :

1. Le frontend appelle `PersonService.save(person)`.
2. Le service cree une copie preparee de la personne.
3. `search` est recalcule via `buildPersonSearch`.
4. L'objet prepare est sauvegarde par le service Firestore generique.

Recherche :

1. `PersonService.search()` applique les filtres Firestore disponibles, notamment region et pays.
2. Si un mot-cle est fourni, le resultat est filtre cote frontend.
3. Le filtre utilise `person.search` comme champ principal et conserve aussi les verifications directes sur `shortName`, `firstName`, `lastName` et `email` pour rester compatible avec les donnees existantes.

## Gestion des erreurs

La creation serveur conserve les erreurs actuelles :

- `invalid-argument` si le payload ou un champ requis est invalide ;
- `already-exists` si un email non vide est deja present dans `email_personid`.

Le calcul de `search` ne doit pas introduire de nouvelle erreur fonctionnelle.
Les champs requis sont valides avant l'appel a `buildPersonSearch`.

`buildPersonSearch` reste tolerant aux chaines vides ou contenant seulement des espaces.
Chaque valeur est trimmee, les valeurs vides sont ignorees, puis les valeurs restantes sont jointes par un seul espace.

Pour les modifications frontend, les erreurs restent celles de l'ecriture Firestore existante.
Le recalcul de `search` se fait localement avant `setDoc`.

## Tests

Les tests doivent cibler en priorite la regle partagee `buildPersonSearch`.
Les cas utiles sont :

- les quatre champs remplis ;
- des espaces autour des valeurs ;
- un champ vide ;
- un email vide.

Si l'environnement de test frontend le permet simplement, ajouter une verification que `PersonService.save()` recalcule `search` avant sauvegarde.

Si l'environnement de test functions le permet simplement, ajouter une verification que `createPerson` cree un document avec l'email normalise et le champ `search` attendu.

## Documentation

`doc/datamodel.md` doit rester la reference du contrat persistant :

- existence de `Person.search` ;
- nature denormalisee du champ ;
- champs sources : `firstName`, `lastName`, `shortName`, `email` ;
- separateur : espace simple ;
- recalcul par les flux applicatifs de creation et modification.

`doc/functions.md` doit rester la reference du comportement backend :

- `createPerson` initialise `search` a la creation ;
- la function maintient aussi l'index email ;
- les modifications de personnes existantes restent hors backend dans l'architecture actuelle.

`doc/WIP.md` peut etre marque comme traite ou vide une fois le changement implemente et documente.

## Hors perimetre

Ce design ne prevoit pas :

- de trigger Firestore sur `person/{id}` ;
- de backfill automatique des personnes existantes ;
- de migration de toutes les modifications `Person` vers une function backend ;
- de changement du mode de recherche vers un index plein texte externe.
