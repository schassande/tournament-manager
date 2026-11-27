# Gestion des scores

Lorsque le draw est géré dans l'application (Module 'DRAW_DESIGNER' activé), alors l'application doit permettre de gérer les scores des matches et de faire avancer la competition de chaque division via la page 'manage-score'.

Cette page est accessible seuelement pour le gestionnaire de score (AttendeeRole == ResultManager) ou par les gestionnaires du tournoi.

Cette page contient 3 tableaux : 
- le tableau des matches
- Le tableau des statistiques par division et par Step
- Le tableau des statistiques par division et par jour

## Le tableau des matches

Ce tableau affiche les matches (DrawGame et le Game associé) de la compétition. 

Au dessus du tableau se trouve une barre de filtre permettant de limiter les matchs visibles dans le tableau. 
La barre de filtre permet de filtrer par :
- Un jour: Un Select PrimeNG entre les jours de la competition
- Une division: un Select PrimeNG entre les divisions qui ont des matches planifiés
- un terrain: un Select PrimeNG entre les terrains qui ont des matches planifiés
- Les matches non finis. Case coché "Unfinished only"

Le tableau contient les colonnes suivantes :
- Day
- Timeslot
- Field
- Division
- What (Game.what)
- Team A : le nom de l'équipe home
- Score A : le score de l'équipe home
- Score B : le score de l'équipe away
- Team B : le nom de l'équipe away
- Finished

La colonne Finished contient un icone de cadena avec 2 états:
- un icone de cadena ouvert lorsque le score du match n'est pas fini (DrawGame.status !== 'FINISHED').
- un icone de cadena fermé lorsque le score du match est fini (DrawGame.status === 'FINISHED')
Un click sur l'icone de cadenas (ouvert ou fermé) inverse le statut. 

Pour un match non fini, les cases correspondant à 'Score A' et à 'Score B' sont éditables. Il s'agit d'un nombre compris en 0 et 99. Le input primeng sera limité à cette taille de nombre (2 digits). Pour un match fini, les cases correspondant à 'Score A' et à 'Score B' ne sont pas éditables, mais du simple texte.

### Lien entre filtre et le tableau
- La colonne Day doit être masquée si le filtre par jour est activé.
- La colonne Division doit être masquée si le filtre par division est activé.
- La colonne Field doit être masquée si le filtre par Field est activé.

### Règles de gestion : 
- Dans une step, si tous les matches (Game) de la step ne sont pas finis alors le statut de la step est PLANIFIED.
- Dans une step, si tous les matches (Game) de la step sont finis alors le statut de la step est FINISHED.
- Dans une step, si au moins un match (Game) est fini et au moins un match n'est pas fini alors le statut de la step est RUNNING.
- Par défaut le score est 0-0.
- Lorsque l'utilisateur change le score d'une des 2 équipes ou le statut d'un match (DrawGame), il faut appeler la fonction backend setGameScore du fichier draw-manager.ts en passant le score des 2 équipes et le noueau statut.

### Exigences d'implementation

- Ce tableau sera un composant dédié. 
- Le filtrage est réalisé coté frontend car une competition va contenir au maximum environ 500 match. Cette quantité est donc gérable coté front end.
- Afin d'être efficace, le chargement des matches doit être réaliser en une seul requete : tous les Game de la competition (tournamentId). Ce chargement est fait au niveau de la page qui passe les données à ce composant
- L'implementation des logiques métier de mise à jour des scores, du verrouillage et de leur conséquences sur les données (statut de step, calcul des points), s'effectue coté backend dans une fonction car l'utilisateur qui modifie un score n'a pas forcément le droit de modifier les données des steps.
- Utilisation de PrimeNG


## Le tableau des statistiques par division et par Step

Ce tableau contient 1 ligne par division et 1 colonne par Step.
Le contenu d'une cellule est le nom de la Step et en dessous % de match finis dans la step. 
Comme le nombre de step n'est pas identique pour chaque division, il se peut que certaines case soient vides en fin de ligne.
Si une division n'a pas de DivisionDraw actif alors la ligne est affichée mais les cases correspondant au step sont fusionnés en une seule. Elle contient un message indiquant qu'il n'y a pas de DivisionDraw pour cette division.

### Exigences d'implementation

- Ce tableau sera un composant dédié. 
- Afin d'être efficace, le chargement des matches doit être réaliser en une seul requete : tous les Game de la competition (tournamentId). Ce chargement est fait au niveau de la page qui passe les données à ce composant. Ces données sont les mêmes que pour les autres tableaux. Il faut donc charger 1 seule fois les données pour les passes aux 3 tableaux
- Le calcul des statistiques est fait par le composant à la volée à partir des données brutes des Game/DrawGame.

## Le tableau des statistiques par division et par jour

Ce tableau contient 1 ligne par division et 1 colonne par jour.
Le contenu d'une cellule est le  % de match finis du jour. 
Certaines divisions pourrait ne pas joueur certains jours. Dans ce cas, la case contient un message indiquant "no game".
Si une division n'a pas de DivisionDraw actif alors la ligne est affichée mais les cases correspondant au step sont fusionnés en une seule. Elle contient un message indiquant qu'il n'y a pas de DivisionDraw pour cette division.


### Exigences d'implementation

- Ce tableau sera un composant dédié. 
- Afin d'être efficace, le chargement des matches doit être réaliser en une seul requete : tous les Game de la competition (tournamentId). Ce chargement est fait au niveau de la page qui passe les données à ce composant. Ces données sont les mêmes que pour les autres tableaux. Il faut donc charger 1 seule fois les données pour les passes aux 3 tableaux
- Le calcul des statistiques est fait par le composant à la volée à partir des données brutes des Game/DrawGame.
