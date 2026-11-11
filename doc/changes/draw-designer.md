# Draw designer

## Objectif

L'objectif de cette évolution est de permettre au gestionnaire d'une competition de définir la structure de la competition pour chaque division, puis d'allouer les matches dans un planning.


## Modelisation

Une Division d'un tournoi regroupe les équipes par catégorie. Chaque division a sa propre structure de compétition. La definition de la structure de la compétition est mémorisée dans l'objet DrawDivision. Pour une division, la structure de compétition est découpée en étape (Step). Pour chaque étape les équipes sont réparties dans des groupes (Group).
A la fin d'une étape, les équipes sont classées pour être allouée dans l'étape suivante selon une stratégie de répartition. Il y a donc une liste d'équipe en entrée et en sortie de chaque étape.

L'administrateur de la competition peut définir plusieurs DrawDivision pour faire des essais ou tentatives. Mais un seul DrawDivision par division devra être sélectionné comme allocation courante. L'attribut Tournament.currentDrawDivisionIds détermine les DrawDivision selectionnés. Il ne doit y avoir un seul DrawDivision par division dans cette liste.

Les match (Game) contiennent les informations determinant leur allocation (dayID, partId, slotId et fieldId).



## Ecran de conception de DrawDivision

Cette page est accessible uniquement aux gestionnaires de la competition.
L'écran est composé de :
- une barre d'action
- La configuration d'une DrawDesigner

### Barre d'action

Premier ligne de l'écran : 
- Un Select pour choisir la division. 
- Un second Select pour choisir le DrawDivision de la division sélectionné dans le premier Select
- Un bouton pour ajouter un nouveau DrawDivision dans la division sélectionné. L'objet DrawDivision est créé avec un nom aléatoire (5 lettre/chiffre en majuscule choisi aleatoirement. Il est rendu persistant immédiatement. S'il n'y a pas d'autres DrawDivision pour cette division alors il est automatiquement activé dans le tournoi. 
- un texte court indiquant le nombre d'équipe dans la division.
- Un bouton pour supprimer le DrawDivision
- Si Tournament.currentDrawDivisionIds contient l'id du DrawDivision sélectionné alors on affiche un texte 'Active' pour indiquer que ce DrawDivision est celui actuellement retenu.
- Si Tournament.currentDrawDivisionIds contient l'id du DrawDivision sélectionné alors on affiche un bouton 'Activate' pour faire de DrawDivision l'unique DrawDivision actif. Cela veut dire supprimer de Tournament.currentDrawDivisionIds les DrawDivision concernant la meme division, puis ajouter l'id du DrawDivision courant dans la liste Tournament.currentDrawDivisionIds.

### Configuration d'un DrawDesigner

Lorsqu'une division et un DrawDivision sont sélectionnés dans la barre d'action, il faut afficher le designer de DrawDivision

Le designer de DrawDivision est un composant Angular permettant de concevoir/editer la structure d'une competition pour UNE division.

Le designer de DrawDivision contient :
- une ligne d'information: 
  - Si un des steps est dans l'état 'RUNNING' ou 'FINISHED' il faut mettre un message en rouge pour avertir que des step sont déjà en cours de jeu et que modifier n'est pas autorisé. 
- un bouton save qui est tout à droite
- un formulaire dense pour editer le nom du DrawDivision  et les listes des emails des gestionnaires de ce draw.
- Un formulaire pour éditer des DrawDivision.pointCalculations
- La liste des équipes de la division. L'utilisateur peut changer l'ordre des équipes. Les équipes triés sont mémorisées dans la première Step.

Le formulaire pour éditer DrawDivision.pointCalculations doit contenir :
- un Select listant les noms des PointCalculation
- un bouton + pour ajouter un nouveau PointCalculation
- un bouton trash pour supprimer le PointCalculation sélectionné
- un mini formulaire permettant d'éditer les attributs du PointCalculation selectionné

Un DrawDivision se décompose en plusieurs Step. Chaque step est affichée dans un Card. La card contient :
* dans la colonne de gauche l'un en dessous des autres : 
  - un champ de saisie du nom de la step
  - un Select pour choisir le drawType parmi les PDrawType existants en base de données et qui ont le nombre d'équipe de la division. 
  - un Select pour choisir le spreadTeamsAlgo parmi les valeurs possible du Type SpreadTeamsAlgo
  - les informations sur le DrawType choisi: nombre de groupe, nombre de match
* dans la colonne de droite un tableau des groupes (Group) définis par le drawType (DrawType.groups). Le tableau contient les colonnes suivantes : # Teams, Draw, # games, Group name et Point calculation name. 
  - L'avant dernière colonne est éditable. Les informations des 3 premiers colonnes ne sont pas modifiable car elles sont tirées du DrawType.groups
  - La dernière colonne est visible uniquement si le group type require PointCalculation
* dans le coin en haut à droite le statut de la step.

Lors d'un changement de DrawType, il faut mettre à jour les Step.groups. Il ne faut pas creer les Step.groups.games (DrawGame)

Lors de la sauvegarde il faut créer/supprimer les Step.groups.games (DrawGame) lorsque le DrawType d'une step a changé. Le statut du DrawGame est par défaut 'DRAWN'
Les Game ne sont pas créés à ce moment là. Ils seront créés lors de l'allocation des match dans un planning.

## Ecran de plannification des matches

L'objectif de cette page est d'allouer les matches sur le planning de la competition
Le planning est défini par les days, les slot et les terrains, de l'objet Tournanment.

### Organisation de la page

L'organisation de la page est la suivante :
- Sur une premiere ligne de barre d'outils
- en dessous
  - A gauche un panneau de selection
  - à droite, un tableau affiche le planning. 

### La barre d'outils
Elle est sur une seule ligne. Elle contient:
- Un Select pour choisir le jour
- un Select pour Highlight certains matchs. 
- un pourcentage de match alloué.

#### Highlight de match

La fonctionnalité de Highlight permet de mettre en lumière avec un fond jaune certains matches, tandis que les autres matches sont en fond gris clair.
Le Select du Hightlight contient différents niveaux de selection variés:
- Division: Il y a une entée pour chaque division du tournoi. Le nom de l'entrée contient le nom court de la Division. Exemple: 'MO'. Tous les matches de la division sont mis en évidence.
- Step: Il y a une entée pour chaque Step pour chaque division. Le nom contient la division et la step,  Exemple: 'MO-Pool' Tous les matchs de cette Step sont mis en évidences.
- Group: Il y a une entée pour chaque groupe de chaque step de chaque division. Le nom contient la division, la step et le nom du groupe, exemple 'MO-Pool-A'. Tous les matches de ce groupe sont mis en évidence.
- Equipe: Il y a une entrée pour chaque équipe de chaque division. Le nom de l'entrée contient le nom de la division et le nom de l'équipe, Exemple: 'MO-France'. Tous les matchs de cette équipe sont mis en évidence.

### Le planning

Le planning est tableau à double entrée.
Il y a :
- Une ligne pour chaque slot de la journée selectionnée
- Une colonne pour chaque terrain utilisable pour le jour sélectionné

Une case du planning :
- affiche les informations du match: 
  - 1ère ligne: Division.shortName, Step.name et un icon croix rouge tout à droite pour désallouer le match
  - 2ieme ligne: Round, what
  - 3ieme ligne: homeTeam - awayTeam. Si les 2 équipes ne sont pas connues alors la ligne n'est pas affichée. Si une des 2 équipes n'est pas connue alors elle est remplacée par '?'.
- est colorisée avec la couleur de la catégorie
- est vide sur fond blanc, lorsque la case n'a pas de match, 

Le tableau est scrollé horizontalement et verticalement pour toujours voir  la 1ère ligne des noms des terrains et la 1ère colonne des horaires des slots.

### Panneau de selection
Le panneau de selection permet de visualiser des DrawGame restant à allouer. Il contient :
- en haut des filtres liés : Division, Step de la division séléctionné, Group du Step sélectionné
- Puis la liste filtrée des DrawGame non encore alloués. Chaque element de la liste est affiché sous forme de bloc:
  - 1ère ligne: Division.shortName, Step.name
  - 2ieme ligne: Round, what
  - 3ieme ligne: homeTeam - awayTeam. Si les 2 équipes ne sont pas connues alors la ligne n'est pas affichée. Si une des 2 équipes n'est pas connue alors elle est remplacée par '?'.
Les blocs de match à allouer on la meme largeur que les colonnes des cases de match dans le planning. Utiliser une variable.

### Allocation / Desallocation

Pour allouer un DrawGame, l'utilisateur peut Drag N Drop un DrawGame du panneau de gauche vers une case slot/terrain. L'allocation provoque :
- La creation de l'objet Game avec (dayId, PartId, SlotId, fieldId) 
- L'affectation du gameId dans le DrawGame.
- Le changement de statut du DrawGame à 'PLANIFIED'

Si l'utilisateur Drag N drop un match déjà alloué (présent dans une case) vers une autre case :
- Si dans la nouvelle case, il y a un match alors les matches sont inversés.
- Si la nouvelle case est vide, alors le match est déplacé

Pour désallouer un match, l'utilisateur peut :
- Drag N Drop le match en dehors du planning
- Cliquer sur la croix dans la case
Lorsque un Game est désalloué alors 
- les informations d'allocation (dayId, PartId, SlotId, fieldId) sont vidées de l'objet Game mais le game n'est pas supprimé.
- Le statut du DrawGame est remis à 'DRAWN'
- il revient alors automatiquement dans le panneau de gauche. 

Les actions d'allocation ou desallocation sont effectués en direct. 

Regle du doublon: Il y a une contrainte forte à respect pour l'allocation des matches. Une équipe ne peut jouer en meme temps sur le meme slot sur 2 terrains différents. Donc lors de l'opération de Drag N Drop il faut empecher l'allocation. Lors du Drop il faut faire la vérification si l'opération viole la règle alors elle n'est pas réalisée/annulée.

### URL

La page concerne un tournoi dont l'id est dans l'url de la page "/draw-designer/<tournamendId>".

### Performance et Chargement

Un tournoi dure au maximum 5 jours environ. Un tournoi peut avoir environ 100 match par jour. Donc Il y aurait environ 500 match par jour. Il y aura au maximum environ 20 division. Ces volumétries sont gérables coté client dans le navigateur. Donc la stratégie est de chargé toutes les données de tous les matches pour avoir une interface réactive pour l'utilisateur.

Les éléments à charger : 
- Il faut charger le tournoi par son Id pour connaitre les divisions, days, slots et terrains.
- Les DivisionDraw sont chargés en une seule requete pour optimiser le chargement. Il suffit de rechercher tous les DivisionDraw par le tournamentId. Cela donnera acces aux Step, Group et DrawGame.
- Les Game sont chargés en une seule requete pour optimiser le chargement. Il suffit de rechercher tous les Game par le tournamentId.

### Controle et gestion d'erreur au chargement

Au chargement de la page il faut faire des vérification et des corrections sur les données si nécessaire. 
- Les matches alloués sur un terrain ou un slot qui a disparu sont désalloués.
- Les matches violant la règle du doublon sont désalloués. On garde seulement le 1er match sur le slot.
- Les Game qui ne sont dans aucun DrawGame sont supprimés
- Vider le gameId des DrawGame qui ont un gameId ne correspondant à aucun match.

Un message générique avertit l'utilisateur que le planning a été modifié si besoin.

## Ecran de visualisation du draw

Cette écran permet à tout utilisateur de l'application de consulter les structures de competition pour chaque division. La page est donc accessible lecture à tous, meme un utilisateur non connecté.
L'url est donc "/draw/<tournamentId>".

La page contient :
- une barre d'action
- La visualisation d'une Step d'une DrawDivision

### La barre d'action
Elle est sur une seule ligne. Elle contient
- Un select de division
- un Select de step du DrawDivision actif de la division sélectionné. Il dépend donc du premier Select.
Par défaut:
- La première selection est selectionné. Ainsi il y a toujours une valeure.
- La premiere Step du DrawDivision actif de la division sélectionné est sélectionné. ainsi il y a toujours une valeur.

Si une division n'a pas de DrawDivision actif alors le seconde Select n'est pas visible.

### La visualisation d'une Step d'un DrawDivision

La visualisation d'une Step affiche :
- Le nom de la step
- la visualisation des groupes de la step.

La visusalisation d'un groupe dépend du GroupType. Il faut un composant Angular par GroupType car l'affichage est spécifique. 
Si le groupeType est CUPxxxx alors il faut représenter un arbre de competition de type coupe en fonction du niveau.
Si le groupType est POOL ou WINS alors il faut représenter un tableau de classement des équipes 
Chaque composant specifique utilise un composant commun qui affiche :
- la liste de tous les matches classés par ordre chronologique (Jour, heure, Terrain)
  - Les matches affichent les scores
  - Si l'utilisateur courant est connecté et est un administrateur du tournoi alors les scores sont éditables. Un événement de modification de score est envoyé au composant specifique pour mettre à jour les données specifique et éventuellement les matches suivants
- Classement final. Possibilité de changer le classement (décision tournoi), validation du classement
- Liste des équipes en entrée

## Ecran de score des match en cours

Cette écran doit permettre aux gestionaires du tournoi d'entrer les scores des matches.
Cet écran n'est pas à développer tout de suite.

## Implementation

Cette specification définit plusieurs écrans. Leur implementation doit être réalisé dans cet ordre : 
- Ecran de conception de DrawDivision
- Ecran de plannification des matches
- Ecran de visualisation du draw
L'implementation doit se faire en étapes. 1 etape par écran.
Il faut demander avant de passer à l'étape suivante. Le developpeur testera chaque étape avant de passer à la suivante.
