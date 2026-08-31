# Pages de l'application

## Vue generale

Le routage Angular est defini dans `frontend/src/app/app.routes.ts`.

Le layout commun contient :

- une barre de menu fixe en haut
- un titre de page
- un menu utilisateur
- un menu contexte tournoi quand un tournoi courant est charge

Le menu contexte tournoi regroupe les pages d'arbitrage dans le sous-menu `Referee` : `Referees`, `Coaches`, `Allocations` et `Upgrades` (ce dernier est visible uniquement pour un referee coach).

Certaines pages sont protegees par `AuthGuard` :

- creation de tournoi
- edition de tournoi
- gestion des arbitres
- gestion des coaches d'arbitres
- edition des matchs
- gestion des allocations
- edition d'un fragment d'allocation
- gestion des upgrades d'arbitres

## `/tournament/:tournamentId/referee-upgrade`

Composant : `TournamentRefereeUpgradeComponent`

Cette page est accessible aux referee coaches du tournoi depuis l'entree de menu `Referee upgrade`. Elle fournit les onglets `Coach vote`, `Panel Vote`, `Upgraded`, `To See` et `To talk`. Les votes coach sont visibles par les referee coaches ; le vote panel est modifiable par les membres du panel, c'est-a-dire tous les attendees `isRefereeCoach` du tournoi.

Lorsque aucun arbitre ne cherche un upgrade, les onglets sont masques et la page affiche `No referee is currently seeking an upgrade.`.

Au chargement, la page utilise la liste courante des attendees arbitres dont la demande d'upgrade est active. Les votes coach et panel conserves pour un arbitre qui ne demande plus d'upgrade sont ignores dans tous les onglets, y compris les suivis `To See` et `To talk`, sans suppression des documents Firestore.

## Liste des routes

## `/home`

Composant : `HomeComponent`

Etat actuel :

- affiche le logo de l'application centre horizontalement, avec une hauteur de 300 px
- describes the main tournament, game, field, referee, coach and assignment management features
- invites the user to log in via a link to `/user/login`
- lists public tournaments whose start date falls in the previous, current or next calendar month, with links to their tournament home pages
- displays one tournament per row, with the date first, followed by the name, country and city; missing values are displayed as empty
- retrieves only the matching date range from Firestore instead of loading the full tournament collection
- sert de point d'entree et de redirection implicite

## `/user/login`

Composant : `UserLoginComponent`

Fonction :

- formulaire de connexion email / mot de passe
- connexion avec Google via une popup Firebase
- option "remember me" pour la connexion email / mot de passe
- auto-login base sur la session Firebase persistée dans le navigateur

Comportements notables :

- appelle `UserService.login()`
- appelle `UserService.loginWithGoogle()` pour la connexion Google
- lance également la restauration de session au démarrage de l’application via `provideAppInitializer()`
- attend la restauration asynchrone de la session Firebase avant de charger la fiche `Person`
- ne stocke plus de mot de passe dans le stockage local ; les anciens identifiants locaux sont supprimés lors de la reconnexion
- redirige vers `/home` en cas de succes
- affiche un spinner et desactive le bouton Login pendant la connexion email / mot de passe afin d'eviter les appels multiples
- crée automatiquement une fiche `Person` si l’adresse Google n’existe pas encore
- affiche un message générique en cas d’échec de la connexion Google
- le lien "Forgotten password" est un placeholder
- le lien de creation de compte pointe vers `/signup`, alors que la route declaree est `/user/create`

## `/user/create`

Composant : `UserCreateComponent`

Fonction :

- creation d'un compte Firebase Auth
- creation du document `Person` correspondant via la callable function `createPerson`

Champs principaux :

- photo URL
- prenom / nom / short name
- email / mot de passe
- pays
- genre

Comportements notables :

- le compte Auth est cree cote client
- la fiche `Person` est ensuite creee cote serveur dans une transaction Firestore
- l'email est verifie comme unique avant creation de la personne
- en cas d'email deja attribue dans `person`, la creation de la fiche est refusee et le compte Auth nouvellement cree est supprime pour eviter un compte orphelin

## `/tournament`

Composant : `TournamentListComponent`

Fonction :

- liste des tournois
- filtres par nom, region, pays, duree et periode
- selection d'un tournoi courant
- creation, edition et suppression d'un tournoi

Comportements notables :

- charge tous les tournois depuis Firestore
- enrichit l'affichage avec les labels region/pays
- sauvegarde les filtres dans `localStorage`
- clique sur une ligne : ouvre la home du tournoi
- un tournoi nouvellement cree ou modifie devient automatiquement le tournoi courant apres une sauvegarde reussie
- la suppression d'un tournoi supprime aussi, par requete `tournamentId`, ses attendees, matchs, affectations, allocations d'arbitrage, statistiques, votes d'upgrade et snapshots `fit-data`
- une barre de progression modale reste affichee jusqu'a la fin de la suppression

## `/tournament/create`

Composant : `TournamentEditComponent`

Protection :

- `AuthGuard`

Fonction :

- creation d'un nouveau tournoi
- initialise un tournoi par defaut avec terrains, jours, slots et divisions de test

Sections de la page :

- informations generales
- terrains
- jours / parties de journee / slots
- divisions et equipes

## `/tournament/:tournamentId/home`

Composant : `TournamentHomeComponent`

Fonction :

- charge le tournoi depuis l'URL
- le memorise comme tournoi courant dans `TournamentService`
- affiche actuellement seulement le nom du tournoi

Etat actuel :

- page de synthese encore tres minimale

## `/tournament/:tournamentId/edit`

Composant : `TournamentEditComponent`

Protection :

- `AuthGuard`

Fonction :

- edition de la configuration d'un tournoi existant

Comportements notables :

- sauvegarde quasi immediate sur Firestore
- validations minimales avant sauvegarde
- mise a jour de `countryId` et `regionId` a partir du pays choisi
- les sections d'edition sont organisees en onglets PrimeNG
- l'onglet actif est conserve dans le parametre d'URL `tab` (`general`, `fields`, `days` ou `divisions`)

## `/tournament/:tournamentId/referee`

Composant : `TournamentRefereeComponent`

Protection :

- `AuthGuard`

Fonction :

- gestion des arbitres du tournoi
- distinction entre arbitres temps plein et player referees

Fonctionnalites principales :

- ajout d'un arbitre temps plein
- ajout d'un player referee
- ajout d'un player referee pour chaque equipe
- edition inline du nom, short name, niveau, upgrade, categorie, genre (select Male/Female)
- liaison d'un player referee a une equipe
- ouverture d'une popup detail d'edition
- edition des disponibilites par jour, `PartDay` et timeslot dans l'onglet `Unavailability`
- suppression individuelle
- suppression de tous les arbitres après confirmation
- capture du collage clavier au niveau du tableau lorsqu'aucun editeur de cellule n'est ouvert (traitement metier a implementer)
- le tableau utilise son propre defilement vertical ; sa ligne de titre reste visible pendant le defilement, sans ajouter un second defilement vertical a la page

Comportements notables :

- active ou desactive le mode `allowPlayerReferees` du tournoi
- si ce mode est coupe, propose de supprimer les player referees existants
- les modifications de disponibilite sont sauvegardees a la fermeture de la popup

## `/tournament/:tournamentId/coach`

Composant : `TournamentRefereeCoachComponent`

Protection :

- `AuthGuard`

Fonction :

- gestion des coaches d'arbitres du tournoi

Fonctionnalites principales :

- ajout
- edition inline de l'identite et du niveau
- gestion des couleurs d'affichage
- popup detail d'edition
- suppression

## `/tournament/:tournamentId/game`

Composant : `TournamentGamesComponent`

Protection :

- `AuthGuard`

Fonction :

- edition du programme des matchs jour par jour

Fonctionnalites principales :

- choix du jour
- affichage par partie de journee
- table des matchs par slot et terrain
- edition inline du slot, terrain, division, libelle, equipe A, equipe B
- ajout et suppression d'un match

Comportements notables :

- l'ajout essaye de reutiliser intelligemment le dernier slot / terrain disponible
- l'ordre d'affichage suit le debut du slot puis l'ordre du terrain

## `/tournament/:tournamentId/allocation`

Composant : `TournamentRefereesAllocationsComponent`

Protection :

- `AuthGuard`

Fonction :

- administration des scenarios d'allocation d'arbitres du tournoi

Fonctionnalites principales :

- creation d'une allocation tournoi
- duplication / suppression d'une allocation tournoi
- selection de l'allocation courante
- creation de fragments par jour ou part de journee
- choix du fragment actif dans chaque colonne
- duplication / suppression d'un fragment
- publication / depubication d'un fragment visible
- navigation vers l'editeur detail d'un fragment

Le tableau croise :

- les jours / parties de journee
- les allocations tournoi disponibles
- les fragments selectionnes pour chaque case

## `/tournament/:tournamentId/allocation/:tournamentAllocationId/fragment/:fragmentAllocationId`

Composant : `TournamentRefereesAllocationComponent`

Protection :

- `AuthGuard`

Fonction :

- edition fine d'un fragment d'allocation
- visualisation de la grille jour / slot / terrain
- affectation des arbitres et coachs sur les matchs

Fonctionnalites principales :

- chargement du fragment et de l'allocation tournoi parente
- affichage des matchs sur la grille du jour ou de la partie de journee
- affichage uniquement des colonnes de terrains contenant au moins un match dans la partie affichee
- affichage des arbitres et coaches d'arbitres disponibles
- une icône d'information remplace le résumé chiffré de la grille ; son survol ou sa mise au focus affiche le nombre de matchs, d'arbitres et de coaches d'arbitres
- surbrillance de plusieurs arbitres
- checkbox « Referee coach » pour afficher ou masquer les coaches dans la grille, avec mémorisation de la préférence par utilisateur
- edition du nom du fragment
- navigation entre fragments d'un meme tournoi
- une icône `home`, alignée sur la largeur de la colonne des créneaux et située à gauche du sélecteur de jour, permet de revenir à la liste des allocations du tournoi
- une icône `Reset` située après la checkbox `Referee coach` demande confirmation avant de supprimer toutes les affectations d'arbitres et de coaches du fragment courant ; la grille est rechargée après la fin effective de la suppression

Comportements notables :

- support clavier avance via `SelectionService`
- raccourcis de navigation dans la grille
- copy / cut / paste des allocations
- suppression clavier d'une affectation
- le selecteur de jour permet d'ouvrir l'allocation existante ou de demander la creation d'une allocation manquante
- la confirmation cree une allocation `Full day` et ouvre son edition
- les liens `Full` et `Part` du jour selectionne ne sont affiches que lorsque ce jour comporte plusieurs parties
- lors du basculement de jour, une modale non fermable avec spinner bloque la saisie jusqu'a la fin du chargement
- le champ de nom est masque lorsqu'un seul fragment existe pour la periode affichee et apparait uniquement lorsqu'il existe plusieurs fragments concurrents
- le tableau des allocations se defile horizontalement et verticalement dans son conteneur ; la colonne des slots reste visible pendant le defilement horizontal et la ligne des noms de terrains reste visible pendant le defilement vertical

## `/tournament/:tournamentId/referee-planning`

Composant : `RefereePlanningComponent`

Fonction :

- affichage en lecture seule du planning des arbitres et coaches pour les fragments d'allocation visibles de l'allocation tournoi courante
- selection d'un scope `Day` ou `PartDay`
- onglets `Referees Planning`, `Referees List` et `Coaches` (l'onglet `Coaches` est visible uniquement pour l'attendee connecte dont `isRefereeCoach` vaut `true`)
- filtres de recherche, niveau, categorie, genre, player referee et upgrade dans la liste des arbitres
- export PDF via la boite d'impression du navigateur et export Excel du contenu affiche dans chaque onglet

La page est accessible a tout utilisateur pouvant consulter le tournoi. Les onglets `Referees Planning` et `Referees List` restent visibles par tous ; l'onglet `Coaches` est reserve a l'attendee connecte dont `isRefereeCoach` vaut `true`. Si aucun fragment visible n'est disponible, seul le message d'absence d'allocation est affiche. En cas d'echec de chargement, un message et une action `Retry` sont proposes.

## Pages indirectement presentes dans l'UX

Certaines entrees de menu existent sans page pleinement implemente dans ce depot :

- "My Account" dans le menu utilisateur pointe vers `/user/:id`, route absente
- la home application et la home tournoi sont encore tres peu remplies

## Resume

L'application se structure autour de 4 familles de pages :

1. authentification : login, creation utilisateur
2. administration tournoi : liste, creation, edition, home
3. exploitation competition : matchs
4. arbitrage : arbitres, coaches d'arbitres, allocations globales, allocation detaillee
