# Fonctionnalites de l'application

## Objectif

Tournament Manager aide une equipe d'organisation a preparer un tournoi, structurer les matchs, gerer les officiels et construire les allocations d'arbitrage.

Vu cote utilisateur, l'application couvre 5 besoins :

1. acceder a l'application avec un compte
2. creer et parametrer un tournoi
3. construire le programme des matchs
4. gerer les arbitres et les coaches d'arbitres
5. produire et comparer des allocations d'arbitrage

## Se connecter et retrouver son contexte

L'utilisateur peut :

- se connecter avec un email et un mot de passe
- creer un compte
- etre reconnecte automatiquement lors d'un retour sur l'application
- retrouver le tournoi courant precedemment selectionne

L'application conserve localement :

- le dernier utilisateur connecte
- le tournoi courant
- certains filtres de recherche

Limites actuelles :

- le mot de passe oublie n'est pas encore implemente
- la page "Mon compte" n'est pas encore disponible

## Creer et configurer un tournoi

L'utilisateur peut creer un tournoi puis en definir les principaux parametres :

- nom et description
- pays et region
- dates du tournoi
- terrains
- jours
- parties de journee
- slots horaires
- divisions
- equipes

Lors de la creation, l'application peut pre-remplir un tournoi avec une structure par defaut pour accelerer le demarrage :

- terrains initiaux
- premiere journee
- quelques slots
- divisions et equipes de demonstration

## Organiser la structure sportive

### Terrains

Pour chaque terrain, l'utilisateur peut definir :

- son nom
- son ordre d'affichage
- sa qualite
- la presence ou non d'une captation video

### Jours, parties et slots

Le calendrier du tournoi peut etre decoupe en :

- jours
- parties de journee
- slots de jeu ou de pause

L'utilisateur peut aussi limiter les terrains disponibles sur une partie de journee.

### Divisions et equipes

Chaque tournoi peut contenir plusieurs divisions avec :

- un nom
- un nom court
- une couleur d'affichage
- une liste d'equipes

## Construire le programme des matchs

L'utilisateur peut planifier les matchs du tournoi dans une grille organisee par jour et par partie de journee.

Il peut :

- afficher les matchs d'un jour
- ajouter un match
- supprimer un match
- choisir le slot
- choisir le terrain
- choisir la division
- choisir l'equipe A et l'equipe B
- modifier le libelle du match

L'application propose aussi quelques aides pratiques :

- reutilisation intelligente du dernier slot ou terrain lors de l'ajout d'un match
- tri automatique par horaire puis par terrain

## Gerer les arbitres et les coaches d'arbitres

## Arbitres

L'utilisateur peut :

- afficher tous les arbitres du tournoi
- ajouter un arbitre temps plein
- modifier rapidement son identite
- renseigner son niveau, sa categorie et son upgrade
- supprimer un arbitre
- ouvrir une popup d'edition plus detaillee

## Player referees

Le tournoi peut fonctionner avec des player referees. Dans ce cas, l'utilisateur peut :

- activer ou desactiver ce mode au niveau du tournoi
- ajouter manuellement un player referee
- creer un player referee pour chaque equipe
- rattacher un player referee a une equipe

Si le mode est coupe alors que des player referees existent deja, l'application demande confirmation avant suppression.

## Coaches d'arbitres

L'utilisateur peut aussi gerer les coaches d'arbitres :

- ajouter un coach
- modifier son identite
- modifier son niveau et son upgrade
- personnaliser ses couleurs d'affichage
- supprimer un coach
- ouvrir une popup d'edition detaillee

## Saisie rapide

Pour accelerer la preparation, l'application sait deja :

- coller plusieurs lignes de donnees pour completer des arbitres
- generer automatiquement un short name dans certains cas

Fonctionnalites encore attendues :

- import CSV
- export CSV
- outillage equivalent plus complet pour les coaches d'arbitres

## Construire des allocations d'arbitrage

## Plusieurs scenarios d'allocation

L'utilisateur n'est pas limite a une seule version. Il peut :

- creer plusieurs allocations tournoi
- renommer une allocation
- dupliquer une allocation
- supprimer une allocation
- choisir l'allocation courante

Cela permet de comparer plusieurs hypotheses avant de retenir la bonne.

## Fragments d'allocation

Chaque allocation peut etre composee de fragments reutilisables :

- sur une journee complete
- sur une partie de journee

L'utilisateur peut :

- creer un fragment
- le selectionner dans une allocation tournoi
- le dupliquer
- le supprimer
- le rendre visible ou non

## Editer finement une allocation

Dans l'editeur detaille, l'utilisateur voit une grille par slot et par terrain avec les matchs du fragment selectionne.

Il peut :

- affecter des arbitres a un match
- affecter des coaches d'arbitres a un match
- se deplacer entre les fragments du tournoi
- renommer le fragment
- mettre en surbrillance certains arbitres

## Productivite dans la grille

L'editeur d'allocation fournit deja des outils de productivite :

- navigation clavier
- selection de cellule
- copier
- couper
- coller
- suppression clavier d'une affectation

## Calculer des statistiques d'allocation

L'application calcule des statistiques sur les allocations d'arbitrage afin d'aider a l'analyse et a l'equilibrage.

Ces statistiques couvrent notamment :

- le nombre de matchs arbitres
- les matchs sur terrains de faible qualite
- les matchs filmes
- la plage horaire couverte
- les coachings recus
- les co-arbitres frequents
- les equipes rencontrees
- le detail des matchs arbitres

Les calculs existent :

- au niveau d'un fragment d'allocation
- au niveau d'une allocation tournoi complete

## S'appuyer sur les referentiels

L'application embarque un referentiel geographique de regions et de pays, utilise pour :

- les fiches personnes
- le parametrage des tournois
- le systeme de badges arbitres selon le pays

## Ce qui est deja pret pour la suite

Le code montre deja plusieurs extensions possibles :

- enrichissement de la page d'accueil d'un tournoi
- gestion plus complete des managers de tournoi
- import/export des arbitres
- aide a la recommandation d'affectation
- exploitation future des objets de planning et de draw

## Resume

Pour un utilisateur final, l'application permet deja de mener le cycle principal d'un tournoi :

1. creer le tournoi
2. le structurer
3. planifier les matchs
4. gerer les officiels
5. construire et analyser les allocations d'arbitrage
