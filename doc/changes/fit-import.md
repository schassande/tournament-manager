# FIT games import

## Objectif
Le site web de la FIT (Federation Of International Touch) publie le calendrier des matches de toutes les competiions/tournois. L'objectif de cette évolution est de réaliser l'import des informations d'une competition/Tournoi afin de compléter un tournoi existant. 
Les données sur le site web FIT peuvent changer. Ainsi la fonctionnalité doit permettre de mettre à jour un tournoi existant.
Le fonctionnement est en 2 parties : 
1) Le téléchargement des données
2) La mise à jour de Tournament avec les données.
pour l'instant seule la 1ère étape est à réaliser.

## Le site FIT
Le site de la FIT expose une API public consultable par appel HTTP. Elle est décrite dans les fichiers : fit-api.md et fit-api.openapi.json

## Partie 1 : Le téléchargement des données

Lorsqu'un tournoi est sélectionné, le menu en haut à gauche contient une nouvelle entrée : "Import FIT". Cela fait apparaitre une nouvelle page dédiée à l'import d'une competition FIT.

Cette page se décompose en 2 parties :
- Zone formulaire en haut
- zone données récupérées en dessous

### Zone formulaire
Dans la zone formulaire il faut pouvoir selectionner la competition FIT et la saison via 2 Select (primeng). Les valeurs possibles sont récupérées en appelant directement l'API FIT.
- Le 1er Select est la liste des compétitions 
- Le 2nd Select est la liste des saisons pour la competition selectionné dans le 1er Select

Les 2 valeurs (competition slug et season) doivent être sauvegardé dans l'objet Tournament dans l'attribut optionnel 'fit'. 


### Données récupérées

Une fois la competition et la saison définie, l'utilisateur peut cliquer sur un bouton "Télécharger" pour télécharger les données : toutes les divisions, toutes les équipes, tous les matchs. Les données téléchargées doivent être stockées dans un objet FITData :
```
FITData {
  tournamentId: string;
  importDate: string;
  competitionSlug: string;
  season: string;
  renaming : {
    divisions: { fitName: string, newName: string}[];
    teams: { fitName: string, newName: string}[];
    fields: { fitName: string, newName: number}[];
    capitalizeTeamName: boolean;
  },

  divisions: { name: string; teams: string[]}[];
  days: { date: string; timelsots: string[]}[];
  games: {
    timeslot: string;
    field: string;
    division: string;
    gameType: string;
    resultRequired: boolean;
    teamHome: string;
    teamAway: string;
    status: 'New' | 'Update' | 'Deleted'
    gameId: number;
    changes: string[] 
  }[]
}
```

Plus tard cet objet sera rendu persistant.

### Zone de Données récupérées

Une fois les données téléchargées depuis le site web de la FIT, il faut les afficher  sous la forme d'onglets : 
- Onglet 'Division renaming' : Affichage d'un tableau  à 3 colonnes : FIT name, Automatic name, manual name. La première colonne est le nom de la division récupérée du site web FIT. La seconde colonne est un nom court automatiquement calculé. La dernière colonne est une colonne éditable pour définir le nom de la division choisi par l'utilisateur.
- Onglet 'Team renaming' : Affichage d'un tableau à 4 colonnes : Division, FIT name, Automatic name, manual name. La première colonne est la division (FIT name). La seconde colonne est le nom de l'équipe récupérée du site web FIT. La Troisième colonne est un nom court d'équipe automatiquement calculé. La dernière colonne est une colonne éditable pour définir le nom de l'équipe choisi par l'utilisateur.
- Onglet 'Field renaming' : Affichage d'un tableau  à 2 colonnes : FIT name, manual name. La première colonne est le nom d'un terrain récupérée du site web FIT. La dernière colonne est une colonne éditable pour définir le nom du terrain choisi par l'utilisateur.
- onglet 'Teams' : Affichage d'un tableau avec en entête de colonne le nom de la division (nom renommé) et en dessous la liste des noms renommés des équipes de la division
- onglet 'Timeslots' : Affichage d'un tableau avec en entête de colonne la date du jour et en dessous la liste des créneaux horaires des matches sur la journée (liste de valeur unique au format HH:mm triées chronologiquement)
- un onglet par jour de compétition. Le titre de l'onglet est la date YYYY/MM/DD. Le contenu de l'onglet est la liste des matches affichés dans un tableau avec les colonnes suivantes :
  * timeslot: string;
  * field: string;
  * division: string;
  * gameType: string;
  * resultRequired: boolean;
  * teamHome: string;
  * teamAway: string;
  * status: 'New' | 'Update' | 'Deleted'
  * gameId: number;
  * changes: string[] 


### Transformation de données

Lors de l'import il faut pouvoir transformer des données afin qu'elless soient plus lisible ou plus courtes. Il s'agit essentiellement de renommer certaines valeurs. Ainsi il faut permettre à l'utilisateur de personnaliser cette transformation. Ces renommage doivent être persistés pour pouvoir être réalisées lors de chaque import.
3 types de données peuvent être rénommés : division, team et field.

#### Renommage de la division

Le nom de la division fourni par le site web de la FIT est relativement long.
Voici un algorythme pour calaculer automatiquement un nom court

```
/** 
 * Converts a game division from FIT web site to a short name 
 * Ouput name is composed by:
 * First letter is one of these:
 * - M: Men, 
 * - W: Women,
 * - X: Mixed,
 * - B: Boy
 * - G: Girl
 * The next 2 letters are the age
 * - O: Open
 * - XX: age number of the division
 */
function toCategory(txt) {
  let division = '';
  if (txt.indexOf('Women') >= 0) {
    division += 'W';
  } else if (txt.indexOf('Men') >= 0) {
    division += 'M';
  } else if (txt.indexOf('Mixed') >= 0) {
    division += 'X';
  } else if (txt.indexOf('Boy') >= 0) {
    division += 'B';
  } else if (txt.indexOf('Girl') >= 0) {
    division += 'G';
  } else {
    division += '?';
  }

  if (txt.indexOf(' Open') >= 0) {
    division += 'O';
  } else {
    const age = Number.parseInt(txt.slice(-2), 10)
    division += age ? age : '?';
  }
  return division;
}
```
#### Renommage du nom d'équipe

Le calcul du nom de l'équipe est un peu complexe car il faut gérer différents cas de competition. Parfois il s'agit de nom de pays et parfois de nom de club. Le site web fourni differents noms et il faut choisir/prioriser. Voici un algorythme qui détermine le nom de l'équipe en fonction de l'objet team récupéré du site web et à partir du paramètre 'capitalize'. 

```
function getTeamName(capitalize: boolean): string {
  let teamName;
  if (!team.club && team.title) {
    teamName = team.title;
  } else if (team.club.abbreviation) {
    teamName = team.club.abbreviation;
    if (team.club.slug) {
      const nbs = team.club.slug.match(/\d+/g);
      if (nbs) {
        teamName = teamName + nbs.join("");
      }
    }
  } else if (team.club.slug) {
    teamName = team.club.slug;
  } else if (team.club.short_title) {
    teamName = team.club.short_title;
  } else if (team.club.title) {
    teamName = team.club.title;
  }
  if (capitalize) {
    teamName = teamName.toUpperCase();
  } else {
    teamName = teamName.charAt(0).toUpperCase() + teamName.substring(1).toLowerCase()
  }
  return teamName;
}
```


### Modele de données : objet Tournament

Voici une définition du nouvel attribut 'fit' dans Tournament avec tous ce qui sera nécessaire :
```
fit?: { 
  competitionSlug: string;
  season: string;
  renaming : {
    divisions: Renaming[];
    teams: Renaming[];
    fields: Renaming[];
    capitalizeTeamName: boolean;
  };
  lastImportDate: string; // date + time ISO
}

interface Renaming {
  fitName: string, 
  appName: string
}
```
Modifies le modele pour ajouter ce nouvel attribut.

### Règles déduites de l'import Google Sheet

Les règles suivantes reprennent le comportement de l'import historique décrit dans `fit-import-gsheet.md`. Elles s'appliquent à la phase de téléchargement et de préparation des données ; elles ne déclenchent pas encore la création ou la modification des objets `Game` du tournoi.

#### Chargement des données FIT

Le chargement suit les étapes suivantes :

1. Charger la collection des compétitions et utiliser le `slug` comme valeur technique du premier Select.
2. Charger le détail de la compétition sélectionnée et utiliser le `slug` des saisons comme valeur technique du second Select.
3. Charger la saison sélectionnée pour obtenir la liste des divisions.
4. Charger chaque division à partir de son `slug`.
5. Pour chaque division, parcourir tous les stages et concaténer leurs matchs.
6. Résoudre `home_team` et `away_team` avec les équipes de la division, indexées par leur identifiant FIT.

Les URLs et les slugs retournés par l'API doivent être utilisés ; aucune liste de compétition, saison ou division ne doit être codée en dur. Les erreurs HTTP, les réponses JSON invalides et les références d'équipe inconnues doivent être signalées à l'utilisateur et ne doivent pas être interprétées comme des listes vides.

#### Matchs exclus et données incomplètes

Les matchs dont `is_bye === true` sont exclus de `FITData.games`. Les matchs dont `is_washout === true` restent importables et leur état doit être conservé pour permettre un traitement ultérieur.

Un match sans équipe, terrain, date ou heure reste dans les données récupérées si son identifiant FIT est disponible. La valeur absente est représentée par une valeur vide ou `undefined` selon le type, et le match doit être signalé comme incomplet dans l'interface. Un match sans date est affiché dans un groupe « Non affecté » plutôt que dans un onglet de jour.

#### Transformation des matchs

Pour chaque match :

- `gameId` est l'identifiant numérique FIT `match.id` ; `uuid` ne doit pas être utilisé à sa place.
- `field` provient de `match.play_at.title` lorsque `play_at` est présent.
- `division` est le nom FIT de la division qui contient le match, puis son nom renommé pour l'affichage.
- `teamHome` et `teamAway` sont les noms renommés des équipes résolues depuis `home_team` et `away_team`.
- `timeslot` est au format `HH:mm`.
- `date` est au format `YYYY-MM-DD` dans le modèle interne et est affichée au format `YYYY/MM/DD` dans le titre de l'onglet.

La date et l'heure doivent être calculées dans le fuseau du tournoi. `datetime` est utilisé lorsqu'il est disponible ; à défaut, `date` et `time` sont utilisés. Le fuseau du terrain FIT ne remplace pas le fuseau du tournoi sans conversion explicite.

`gameType` est calculé à partir de `round` : un round commençant par `Round` ou par un nombre est de type `Pool`, sinon la valeur de `round` est conservée. `resultRequired` vaut `false` pour un match de type `Pool` et `true` pour les autres types. Cette règle devra être confirmée si la phase de mise à jour des matchs introduit une règle métier différente.

#### Renommage et persistance

Le nom manuel est prioritaire sur le nom automatique. En l'absence de nom manuel, le nom automatique est utilisé dans `FITData` et dans les onglets d'affichage.

Les renommages d'équipe doivent être identifiés par le couple `(divisionSlug, teamSlug)`, et non uniquement par le texte affiché. Les renommages de division et de terrain sont identifiés par leur nom FIT exact. Cette règle évite les collisions entre deux équipes portant le même nom dans des divisions différentes.

Lorsqu'un nouveau téléchargement fait apparaître une valeur FIT inconnue, une nouvelle ligne de renommage est ajoutée avec un nom manuel vide. Les renommages existants sont conservés, même si la valeur FIT n'est pas présente dans le téléchargement courant. La configuration est sauvegardée dans `Tournament.fit.renaming` avec le tournoi.

Les champs `newName` et `appName` désignent la même notion ; le modèle persistant utilise `appName`. Dans `FITData`, il est recommandé d'utiliser également `appName` pour éviter deux vocabulaires pour une même donnée. Le nom manuel d'un terrain est une chaîne et non un nombre.

#### Équipes et créneaux

L'onglet `Teams` est construit à partir des équipes effectivement référencées par les matchs, regroupées par division renommée. Chaque équipe n'est affichée qu'une seule fois dans sa division et les noms sont triés alphabétiquement.

L'onglet `Timeslots` contient, pour chaque date, les valeurs uniques de `timeslot`, triées chronologiquement. Les valeurs vides sont exclues de cet onglet. Les matchs sans date ou sans heure sont conservés dans la liste des matchs mais ne contribuent pas aux créneaux d'une journée.

#### Comparaison entre téléchargements

La comparaison est informative dans cette première phase et ne modifie pas encore `Tournament`.

1. Rechercher le match existant par `gameId`/`fitGameId`.
2. Si aucun match n'est trouvé, rechercher par la clé de secours `(division, gameType, teamHome, teamAway)`.
3. Un match sans correspondance est `New`.
4. Un match correspondant dont au moins une propriété affichée diffère est `Update`.
5. Un match correspondant sans différence est `Equal`.
6. Un match précédemment connu mais absent du nouveau téléchargement est `Deleted`, uniquement si un jeu de données FIT précédent est conservé.

La liste `changes` contient les noms des propriétés modifiées et leurs anciennes/nouvelles valeurs lorsque cela est utile. La position dans la liste n'est pas un critère de comparaison. Les scores ne sont pas comparés dans cette phase, car leur import dans `Tournament` est reporté.

#### Etats de l'interface et validation

Avant le téléchargement, les onglets de données ne sont pas affichés. Pendant le téléchargement, les Selects et le bouton sont désactivés et un indicateur de progression est affiché. En cas d'échec, les données précédemment affichées et les renommages non sauvegardés sont conservés.

Le téléchargement sauvegarde la compétition, la saison, les renommages et `lastImportDate` uniquement lorsque toutes les requêtes nécessaires ont abouti. Une compétition ou une saison modifiée exige un nouveau téléchargement avant que les données affichées soient considérées comme valides.

La page doit afficher explicitement les matchs exclus, les matchs incomplets et les erreurs de résolution d'équipe. Les champs éditables doivent être accessibles au clavier et disposer d'un libellé identifiable.

#### Limites de la première phase

Cette phase ne crée, ne supprime et ne modifie aucun `Game`, `Day`, `Timeslot`, `Field`, `Division` ou `Team` du tournoi. Elle prépare et affiche uniquement `FITData` et persiste la configuration FIT et les renommages. La mise à jour effective du tournoi fera l'objet de la partie 2 et devra préciser sa propre stratégie de fusion.



## Partie 2 : La mise à jour de Tournament avec les données.

Cette partie sera réalisée ultérieuemement.





