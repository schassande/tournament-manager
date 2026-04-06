# Pages de l'application

## Vue generale

Le routage Angular est defini dans `frontend/src/app/app.routes.ts`.

Le layout commun contient :

- une barre de menu fixe en haut
- un titre de page
- un menu utilisateur
- un menu contexte tournoi quand un tournoi courant est charge

Certaines pages sont protegees par `AuthGuard` :

- creation de tournoi
- edition de tournoi
- gestion des arbitres
- gestion des coaches d'arbitres
- edition des matchs
- gestion des allocations
- edition d'un fragment d'allocation

## Liste des routes

## `/home`

Composant : `HomeComponent`

Etat actuel :

- page quasi vide
- sert surtout de point d'entree et de redirection implicite

## `/user/login`

Composant : `UserLoginComponent`

Fonction :

- formulaire de connexion email / mot de passe
- option "remember me"
- auto-login base sur les identifiants stockes en local

Comportements notables :

- appelle `UserService.login()`
- redirige vers `/home` en cas de succes
- le lien "Forgotten password" est un placeholder
- le lien de creation de compte pointe vers `/signup`, alors que la route declaree est `/user/create`

## `/user/create`

Composant : `UserCreateComponent`

Fonction :

- creation d'un compte Firebase Auth
- creation du document `Person` correspondant

Champs principaux :

- photo URL
- prenom / nom / short name
- email / mot de passe
- pays
- genre

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
- edition inline du nom, short name, niveau, upgrade, categorie, genre
- liaison d'un player referee a une equipe
- ouverture d'une popup detail d'edition
- suppression

Comportements notables :

- active ou desactive le mode `allowPlayerReferees` du tournoi
- si ce mode est coupe, propose de supprimer les player referees existants

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
- affichage des arbitres et coaches d'arbitres disponibles
- surbrillance de plusieurs arbitres
- edition du nom du fragment
- navigation entre fragments d'un meme tournoi

Comportements notables :

- support clavier avance via `SelectionService`
- raccourcis de navigation dans la grille
- copy / cut / paste des allocations
- suppression clavier d'une affectation

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
