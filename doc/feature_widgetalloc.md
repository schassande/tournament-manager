# WIP 

## Objectif
Nous allons refaire une nouvelle version du composant GameRefereeAllocatorComponent. il faut donc s'inspirer de la logique métier du composant actuel. en revanche nous allons utiliser d'autres composants graphiques plus simples et plus léger pour améliorer l'expérience utilisateur.
Ce composant permet d'afficher et d'éditer les participants de type RefereeCoach et Referee d'un Game.

## Description générale
Le composant va être composé de 5 cases verticales de même largeur :
- une ligne match : La division, le nom des 2 équipes ou le type de match
- une ligne des RefereeCoach
- 3 lignes arbitre

La largeur des cases est un paramètre du composant.


## Case sélectionnée

Le composant est abonné à SelectionService de manière à connaitre quel est l'élément sélectionné sur la page. 
Seules les lignes du RefereeCoach et des arbitres peuvent être sélectionner.
Lorsqu'une case est sélectionnée alors la bordure est plus épaisse et de la couleur bleu. L'épaisseur et la couleur seront définis dans un style CSS du composant.

## Colorisation / Highlight
TODO

## Ligne des RefereeCoach

La ligne coach contient les badges de RefereeCoach. 1 badge contient le shortName du coach. Le badge est de la couleur associé au RefereeCoachInfo.
L'affichage de la ligne coach est optionnel/paramétrable.
Une popup d'allocation des referee coach affectés sur ce game est affichée lorsque :
- L'utilisateur clique sur la ligne
- Lorsque la case des refereeCoach est sélectionné et que l'utilisateur appuie sur la touche Enter ou la touche Espace


### Popup d'allocation des RefereeCoach

Cette Popup affiche les éléments suivants :
<timeslot>: <field>
<Division>: Team A vs Team B
un tableau de 5 colonnes :
- Badge
- Name: Prénom et nom du Referee Coach
- Level: niveau du Refereecoach
- Field: Terrain sur lequel le referee coach est actuellement affecté sur ce timeslot.
- Allocate : une case à cocher indiquant si le coach est alloué sur Game. 
 En plus de la ligne de titre il y a autant de ligne que de RefereeCoach disponible. 

 En bas de la popup il y a 2 boutons 
 - Cancel: n'enregistre pas les modifications 
 - Save : Enregistre les modifications. 

Lors de la sauvegarde pour chaque Refereecoach qui est affecté sur ce Game alors et qui aussi affecté à un autre terrain du meme timeslot du meme jour alors il faut demander une confirmation à l'utilisateur:  
  Le Refereecoach <prenom> <Nom> est alloué à 2 terrains simultanément sur le même créneau horaire. Que souhaitez vous faire ? 
  - Revenir à l'édition (pas de sauvegarde)
  - Conserver les 2 affectations : le refereecoach est affecté sur les 2 matches
  - Supprimer l'ancienne allocation du referee coach

Ce fonctionnement permet à un referee coach de voir une mi-temps sur chaque terrain. en revanche un referee coach ne doit pas être affecté sur plus de 2 terrains.
ainsi il ne faut pas afficher la case à cocher dans la colonne allocate.


## Ligne d'un Referee

Chaque ligne arbitre affiche l'information sur l'artbitre avec un niveau d'information paramétrable.
- Pour le niveau d'information "COACH": <niveau><upgrade><categorie> - Prenom Nom
- Pour le niveau d'information "PUBLIC": Prenom Nom
Le niveau d'information est un paramètre entrant du composant.

Le click sur la ligne provoque l'affichage d'une popup d'allocation d'un arbitre affectés sur ce game.
Une popup d'allocation d'un referee affectés sur ce game est affichée lorsque :
- L'utilisateur clique sur la ligne
- Lorsque la case d'un des arbitres est sélectionné et que l'utilisateur appuie sur la touche Enter ou la touche Espace

### Popup d'allocation d'un arbitre

Cette Popup affiche les éléments suivants :
<timeslot>: <field>
<Division>: Team A vs Team B
un tableau de X colonnes correspondant aux autres arbitres déjà affecté sur ce game:
- Name: Prénom et nom du Referee Coach
- Level: niveau du Referee
- Category: Junior, Open, Senior
- Upgrade : Oui/Non

Un formulaire pour filtrer/trier un tableau d'abitre disponible pour ce slot.

Le formulaire fitre/trie contient les éléments suivants :
- Filtres :
  - level: Le niveau de l'arbitre: (Selection multiple). La liste des valeurs est calculée sur l'ensemble des arbitres disponibles pour ce slot. Le niveau incluera le facteur upgrade.
  - Q : la recherche de mot dans un champ search de l'arbitre
  - Country: Le pays de l'arbitre (Selection multiple)
- Tri : 
  - Niveau croissant
  - Niveau décroissant
  - Number of already allocation game (ascending)

Le tableau affiche les listes des arbitres disponibles filtrés et triés par les critères définis dans le formulaire.
chaque ligne arbitre affiche les informations sur l'arbitre :
- Name: Prénom et nom du Referee Coach
- Level: niveau du Referee
- Category: Junior, Open, Senior
- Upgrade : Oui/Non
- Nombre de match dans le fragment, sur la journée et sur le tournoi
Pour chaque ligne arbitre il y a une sous liste  dépliable des matches auquels l'arbitre est déjà alloué pendant le tournoi. 
Cette sous liste contient les élément suivants
<timeslot>: <field>: <Division>: Team A vs Team B, 
Referee 1, Referee 2... 
Badge des RefereeCoach
