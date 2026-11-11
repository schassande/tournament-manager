# My Planning

## Objectif

L'objectif de cette fonctionnalité est d'afficher le planning d'un participant à une compétition.

## Fonctionnement

Dans la page planning il y a actuellement le planning d'arbitrage, de porteur d'eau et de coach d'arbitre. Il faut ajouter un onglet nommé "Me". 
Cet onglet va afficher le planning de l'utilisateur connecté courrant pour cette compétition et le jour sélectionné.
S'il n'y a pas d'utilisateur connecté alors cet onglet ne s'affiche pas.

Les différents roles du participant vont permettre de savoir ou il faut chercher les différentes activités de l'utilisateur :
- Un arbitre peut être alloué sur des matches en tant qu'arbitre ou en tant que porteur d'eau.
- Un referee coach peut être alloué sur des matches en tant que referee Coach.
- Un arbitre joueur peut être alloué sur des matches en tant qu'arbitre. Il est aussi membre d'une équipe. donc il joue pendant les matches de son équipe.

## Exigences d'implementation

La liste des participattions à des activités doit être calculée coté backend par une fonction. Cette fonction consulte le role de l'attendee et va consulter les collections persistantes correspondantes pour trouver les activités. La fonction renvoie la liste d'activité de la personne pour le jour. Il faut définir le modèle de données représentant une activité. Ce modèle doit permettre de modéliser les activités suivantes :
- Arbitrer un match
- Coacher les arbitres d'un match
- Etre porteur d'eau des arbitres sur un match
- Jouer un match
- Coach une équipe de joueur sur un match

Toutes ces activités concernent un match (Lieu, terrain, horaire/slot, what, équipes...). Potentiellement l'application évoluera pour supporter d'autres activités qui ne sont pas liées à un match: Réunions, Cérémonie. Dans la modélisation d'une activité il faut être un peu générique pour intégrer la notion de lieu/localisation, horaires (début/fin), objet

TODO : décrire le modèle de données exporté par la fonction.


La page affiche la liste chronologique des activités du jour indiqué dans la page planning.


Cette évolution ne doit pas modifier les données persistantes.
