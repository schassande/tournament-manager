# Objectif : Gerer les porteurs d'eau sur les matches

## Fonctionnalités 

Dans la page Planning, il faut ajouter un onglet 'Water Carrier' qui va supporter les fonctionnalités à implémenter

### Fonctionnalité auto allocation sur papier

La fonctionnalité doit permettre aux tournament manager d'imprimer un planning des matches avec de la place pour renseigner les porteurs d'eau. Elle est activée seulement lorsque le module `PRINTED_WATER_CARRIER` est activé. 
La fonctionnalité se résume graphique à l'affichage d'un bouton dans l'onglet 'Water Carrier', permettant de lancer le téléchargement du planning en PDF.
Pour chaque case de match il faut :
- les information du match
- Les Arbitres affectés
- un espace equivalent à 4 lignes permettant après impression d'écrire 2 ou 3 noms de personnes 

Le pdf est pour la période selectionnée dans la page Planning.
Le téléchargement n'est disponible si et seulement si les allocations d'arbitres de la période est visible.


### Fonctionnalité auto allocation en ligne

La seconde fonctionnlité est de permettre aux arbitres de s'auto allouer sur un planning en ligne. Elle est activée seulement lorsque le module `ONLINE_WATER_CARRIER` est activé.
Le planning est visible et l'auto allocation possible uniquement si les allocations d'arbitres de la période est visible.

Les principes : 
- L'auto allocation des water carrier s'effectue sur la page Planning, onglet water carrier. 
- Tout le monde peut lire cette page.
- L'onglet affiche le planning des matches (avec les arbitres mais sans les coach). 
- Pour chaque match il y a une case pour les water carrier. 
- Le click dans la case du match, ajoute/Enleve l'utilisateur courant comme Water carrier dans le match.
- Le planning highlight, les cases ou l'arbitre est affecté en tant qu'arbitre ou en tant que water carrier.
- Le planning affiché est pour la période selectionnée dans la page Planning.

La fonctionnalité d'auto allocation n'est accessible que pour les arbitres ayant un compte utilisateur. cad que l'attendee contient l'email et le person.id. L'utilisateur courant doit avoir un attendee avec le role Referee pour être autorisé à modifier son allocation de water carrier.
Les arbitres sans compte (pas de Person) ne peuvent accéder à la fonctionnalité.

L'allocation d'un arbitre en tant que water carrier d'un match s'effectue grace à l'objet 
`GameAttendeeAllocation`. Il faut compléter le type `AttendeeRole` pour ajouter `WaterCarrier` dans les valeurs possibles.

Pour l'instant on ne va pas limiter le nombre de Water carrier sur un match.
