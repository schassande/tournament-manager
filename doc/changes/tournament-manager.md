# Gestionnaire d'un tournoi

## Objectif
Permettre de configurer les gestionnaires du tournoi

## Fonctionnement
La page tournament-edit doit contenir un nouvel onglet: "Managers"

Dans onglet il y a un input text (primeng) pour saisir une adresse email, un bouton pour ajouter l'email saisi et une liste de manager.

Avant toute recherche ou sauvegarde, l'adresse email doit être normalisée en minuscules.

3 cas de figure pour l'ajout d'un nouveau manager : 
- L'email correspond à aucune personne existante : on enregistre l'email dans l'attribut Tournament.managerEmails. Il ne doit pas y avoir de doublon dans ce tableau
- L'email correspond à une personne (Person) mais qui n'est pas encore un participant du tournoi (pas Attendee). Il faut créer l'attendee pour le tournoi avec seul le role de TournamentManager et sans restriction. Dans Tournament, il faut enregistrer l'email dans `managerEmails` et l'attendeeId dans `managerAttendeeIds`
- L'email correspond à une personne (Person) qui est déjà un participant du tournoi (Attendee existant pour ce tournoi). Alors dans l'attendee, il faut ajouter le role de TournamentManager (sans restriction). Il faut enregistrer l'email dans `managerEmails` et ajouter l'attendeeId dans `managerAttendeeIds`

Il ne doit y avoir aucun doublon. Si l'email correspond déjà à un manager, l'opération ne doit pas créer de nouvelle entrée ni modifier inutilement les données.

La cohérence entre les données de l'attendee et du tournoi doit être maintenue : un attendee dont `isTournamentManager` vaut `true` doit avoir son identifiant dans `Tournament.managerAttendeeIds`, et tout identifiant présent dans `Tournament.managerAttendeeIds` doit correspondre à un attendee dont `isTournamentManager` vaut `true`. Toute incohérence détectée doit être corrigée.

`Tournament.managerEmails` doit contenir tous les managers : les managers identifiés uniquement par leur email et les managers associés à une `Person`/un `Attendee`. Cette liste ne doit contenir aucun doublon et reste la source d'autorisation des règles Firestore existantes. Les règles Firestore ne sont pas modifiées.

La cohérence entre `isTournamentManager`, `Tournament.managerAttendeeIds` et `Tournament.managerEmails` est vérifiée et corrigée au chargement de l'onglet "Managers". Pour chaque attendee manager associé à une Person, l'email normalisé de la Person doit être présent dans `managerEmails`. Les identifiants d'attendee invalides et les doublons sont supprimés des listes.

Lors de ce chargement, `managerEmails` constitue la source de vérité pour constituer la liste des managers. Pour chaque email :
- si aucune `Person` ne correspond, le manager reste un manager email-only ;
- si une `Person` correspond et qu'aucun `Attendee` n'existe encore pour ce tournoi, un `Attendee` est créé automatiquement, avec pour seul rôle `TournamentManager`, `isTournamentManager` à `true`, les autres indicateurs de rôle à `false` et sans `roleRestrictions` ;
- si un `Attendee` existe, il est réparé si nécessaire afin de porter le rôle `TournamentManager` et `isTournamentManager` à `true`.

Tout attendee créé ou réparé est sauvegardé, et son identifiant est ajouté à `Tournament.managerAttendeeIds`.

La liste des managers affichée dans l'onglet est donc un cumul des managers dont il y a seulement l'email et les managers qui sont des attendeee. Chaque élement de la liste affiche a minima l'email (soit issu de la liste managersEmails soit issu de attendee => Person.email). Lorsqu'il s'agit d'une attendee, il faut afficher en plus de l'email: le prenom et le nom.

Chaque element de la liste contient tout à droite un icone fa-trash pour supprimer le manager. 2 cas de figures :
- Il s'agit d'un manager juste email. Alors on supprime l'email de la liste Tournament.managerEmails
- Il s'agit d'un attendee. Alors on desactive le role TournamentManager dans l'attendee, il faut supprimer l'attendeeId dans Tournament.managerAttendeeIds et supprimer son email de Tournament.managerEmails. Mais l'attendee n'est pas supprimé.

Lors de cette suppression, seul l'indicateur `isTournamentManager` est désactivé dans l'attendee. Les autres rôles de l'attendee sont conservés. Les `roleRestrictions` ne sont pas traitées pour cette fonctionnalité, car elles ne sont pas utilisées pour l'instant.

La création d'un nouvel attendee manager doit initialiser `isTournamentManager` à `true`, les indicateurs des autres rôles à `false`, avec le seul rôle `TournamentManager` et sans `roleRestrictions`.
