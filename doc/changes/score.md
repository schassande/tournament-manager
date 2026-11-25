# Gestion des scores

Lorsque le draw est géré dans l'application (Module 'DRAW_DESIGNER' activé), alors l'application doit permettre de gérer les scores des matches et de faire avancer la competition de chaque division via la page 'manage-score'.

Cette page est accessible seuelement pour le gestionnaire de score (AttendeeRole == ResultManager) ou par les gestionnaires du tournoi.

Cette page contient 3 tableaux : 
- le tableau des matches
- Le tableau des statistiques par division et par Step
- Le tableau des statistiques par division et par jour

## Le tableau des matches

Ce tableau affiche les matches (Game) de la compétition. 

Au dessus du tableau se trouve une barre de filtre permettant de limiter les matchs visibles dans le tableau. 
La barre de filtre permet de filtrer par :
- Un jour: Un Select PrimeNG entre les jours de la competition
- Une division: un Select PrimeNG entre les divisions qui ont des matches planifiés
- un terrain: un Select PrimeNG entre les terrains qui ont des matches planifiés
- Les matches non verrouillés. Case coché "Unlocked only"

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
- Lock

La colonne Lock contient un icone de cadena avec 2 états:
- un icone de cadena ouvert lorsque le score du match n'est pas verrouillé (Game.score.locked == false).
- un icone de cadena fermé lorsque le score du match est verrouillé (Game.score.locked == true)
Un click sur l'icone de cadenas (ouvert ou fermé) inverse le statut. 

Pour un match non verrouillé, les cases correspondant à 'Score A' et à 'Score B' sont éditables. Il s'agit d'un nombre compris en 0 et 99. Le input primeng sera limité à cette taille de nombre (2 digits). Pour un match verrouillé, les cases correspondant à 'Score A' et à 'Score B' ne sont pas, mais du simple texte.

### Lien entre filtre et le tableau
- La colonne Day doit être masquée si le filtre par jour est activé.
- La colonne Division doit être masquée si le filtre par division est activé.
- La colonne Field doit être masquée si le filtre par Field est activé.

### Règles de gestion : 
- Dans une step, si tous les matches (Game) de la step ne sont pas verrouillés alors le statut de la step est PLANIFIED.
- Dans une step, si tous les matches (Game) de la step sont verrouillés alors le statut de la step est FINISHED.
- Dans une step, si au moins un match (Game) est verrouillé et au moins un match n'est pas verrouillé alors le statut de la step est RUNNING.
- Lorsque l'utilisateur change le verouillage d'un match (Game), il faut mettre à jour :
  - le classement du groupe, les matches suivants qui dépendent du résultat de ce match. Les actions à réaliser dépendent totalement du type de Group.
  - le statut de la step si necessaire.

### Exigences d'implementation

- Le filtrage est réalisé coté frontend car une competition va contenir au maximum environ 500 match. Cette quantité est donc gérable coté front end.
- Afin d'être efficace, le chargement des matches doit être réaliser en une seul requete : tous les Game de la competition (tournamentId). 
- Chaque tableau fait l'objet d'un composant dédié
- L'implementation des logiques métier de mise à jour des scores, du verrouillage et de leur conséquences sur les données (statut de step, calcul des points), s'effectue dans un service et non dans les composants graphiques.
- Utilisation de PrimeNG
