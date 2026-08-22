# Split join PartDay

## Objectif

Dans la page de configuration general d'un tournoi, dans la partie days, il faut pouvoir gérer les timeslots entre les PartDay.

## Fonctionnement

Dans la page tournament-edit, onglet Days, il faut ajouter différentes actions possibles 

- Découper un PartDay en 2
- Fusionner 2 PartDay consécutifs d'un Day
- Déplacer la frontière entre 2 parts vers le haut ou vers le bas

Toutes les opérations doivent se réaliser sans changer les id des timeslots. Les autres objets métiers de l'application réfèrent à l'id du timeslot.

## Integration graphique

Dans un part il y a des icones en haut à droite. Il faut ajouter 2 icones :
- un icone pour couper le part en 2. Le click sur cet icone fait apparaitre une popup modal permettant de choisir dans un Select le timeslot après lequel il faut couper le part. Le Select propose tous les horaires des timeslot du Part, sauf le dernier.
- un icone pour fusionner le part courant avec le précédent. Le premier part de la journée n'a pas cet icone
- un icone fleche du haut. Il sert à déplacer le dernier timeslot du part précédent, au début du part courant. L'icone n'apparait que si part précédent a au moins 2 timeslot
- un icone fleche du bas. Il sert à déplacer le premier timeslot du part courant en derniere positiondu part précédent. L'icone n'apparait que si part courant a au moins 2 timeslot
