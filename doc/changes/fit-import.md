# FIT games import

## Objectif

Le site web de la FIT (Federation Of International Touch) publie le calendrier des matches de toutes les competiions/tournois. L'objectif de cette évolution est de réaliser l'import des informations d'une competition/Tournoi afin de compléter un tournoi existant.
Les données sur le site web FIT peuvent changer. Ainsi la fonctionnalité doit permettre de mettre à jour un tournoi existant.
Le fonctionnement est en 2 parties :

1. Le téléchargement des données
2. La mise à jour de Tournament avec les données.
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

Lorsqu'au moins un `FITData` est disponible, le bouton `Download` est libellé `Refresh`. Un select supplémentaire permet de choisir un snapshot FITData précédent pour l'affichage ; la sélection ne déclenche pas de nouvel appel au site FIT.

### Données récupérées

Une fois la competition et la saison définie, l'utilisateur peut cliquer sur un bouton "Télécharger" pour télécharger les données : toutes les divisions, toutes les équipes, tous les matchs. Les données téléchargées doivent être stockées dans un objet FITData :

```
FITData {
  id: string;
  lastChange: number;
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

Chaque téléchargement réussi persiste cet objet dans la collection Firestore `fit-data`. La page recharge, pour le tournoi courant, le document dont `importDate` est le plus récent.

### Zone de Données récupérées

Une fois les données téléchargées depuis le site web de la FIT, il faut les afficher sous la forme d'onglets :

- Onglet 'Division and team renaming' : affichage d'un TreeTable à 3 colonnes : FIT name, Automatic name, manual name. Chaque division est une ligne parent repliable ; ses équipes sont affichées comme lignes enfants. La première colonne contient le nom FIT et le toggler d'ouverture. La seconde colonne contiet le nom automatique. La troisième colonne est éditable pour les divisions comme pour les équipes.
- Onglet 'Field renaming' : affichage d'un tableau à 2 colonnes : FIT name, manual name. La première colonne est toujours le nom original du terrain récupéré du site FIT. La dernière colonne est une colonne éditable contenant le nom choisi par l'utilisateur, précédemment sauvegardé lorsqu'il existe.
  Les terrains sont triés par ordre alphabétique sur leur nom FIT.
- onglet 'Teams' : Affichage d'un tableau avec en entête de colonne le nom de la division (nom renommé) et en dessous la liste des noms renommés des équipes de la division
- onglet 'Timeslots' : affichage d'un tableau avec une colonne par jour et une ligne par position dans la liste des créneaux du jour. Chaque colonne affiche sa propre liste de créneaux, sans alignement ni regroupement entre des valeurs identiques de jours différents ; une cellule est vide lorsque la colonne n'a plus de créneau à cette position. Les créneaux sont des valeurs uniques au format HH:mm triées chronologiquement dans chaque colonne.
- un onglet par jour de compétition. Le titre de l'onglet est la date YYYY/MM/DD. Le contenu de l'onglet est la liste des matches affichés dans un tableau avec les colonnes suivantes :
  Le nombre de matchs présents est affiché au-dessus de chaque tableau, y compris pour le groupe `Unassigned`.
  - timeslot: string;
  - field: string;
  - division: string;
  - gameType: string;
  - resultRequired: boolean;
  - teamHome: string;
  - teamAway: string;
  - status: 'New' | 'Update' | 'Deleted'
  - gameId: number;
  - changes: string[]

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

La date et l'heure doivent être calculées dans le fuseau cible sélectionné par l'utilisateur. `datetime` est utilisé lorsqu'il est disponible ; à défaut, `date` et `time` sont utilisés. Le fuseau du terrain FIT ne remplace pas le fuseau cible sans conversion explicite. Le fuseau cible est un identifiant IANA proposé par `Intl.supportedValuesOf('timeZone')`, complété par `UTC` si nécessaire, afin de proposer les fuseaux disponibles sur la planète. Les valeurs fixes de type `UTC+01:00` restent également acceptées pour les tournois existants.

`gameType` est calculé à partir de `round` : un round commençant par `Round` ou par un nombre est de type `Pool`, sinon la valeur de `round` est conservée. `resultRequired` vaut `false` pour un match de type `Pool` et `true` pour les autres types. Cette règle devra être confirmée si la phase de mise à jour des matchs introduit une règle métier différente.

#### Renommage et persistance

Le nom manuel est prioritaire sur le nom automatique. En l'absence de nom manuel, le nom automatique est utilisé dans `FITData` et dans les onglets d'affichage.

Les renommages d'équipe doivent être identifiés par le couple `(divisionSlug, teamSlug)`, et non uniquement par le texte affiché. Les renommages de division et de terrain sont identifiés par leur nom FIT exact. Cette règle évite les collisions entre deux équipes portant le même nom dans des divisions différentes.

Lorsqu'un nouveau téléchargement fait apparaître une valeur FIT inconnue, une nouvelle ligne de renommage est ajoutée avec un nom manuel vide. Les renommages existants sont conservés, même si la valeur FIT n'est pas présente dans le téléchargement courant. Deux boutons `Save`, placés en haut et en bas de l'onglet `Renaming`, sauvegardent la configuration dans `Tournament.fit.renaming` et recalculent immédiatement les noms de division, d'équipe et de terrain dans les matchs affichés. Elle est également sauvegardée lors d'un téléchargement réussi et utilisée pour reconstruire les inputs lors du chargement du dernier `FITData`.

Les champs `newName` et `appName` désignent la même notion ; le modèle persistant utilise `appName`. Dans `FITData`, il est recommandé d'utiliser également `appName` pour éviter deux vocabulaires pour une même donnée. Le nom manuel d'un terrain est une chaîne et non un nombre.

#### Équipes et créneaux

L'onglet `Teams` est construit à partir des équipes effectivement référencées par les matchs, regroupées par division renommée. Chaque équipe n'est affichée qu'une seule fois dans sa division et les noms sont triés alphabétiquement.

L'onglet `Timeslots` contient, pour chaque date, les valeurs uniques de `timeslot`, triées chronologiquement. Les valeurs vides sont exclues de cet onglet. Les matchs sans date ou sans heure sont conservés dans la liste des matchs mais ne contribuent pas aux créneaux d'une journée.

Dans chaque onglet de journée, les matchs sont triés par `timeslot` croissant (`HH:mm`), puis par `field`, puis par `gameId` pour stabiliser l'ordre des matchs ayant la même heure et le même terrain.

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

Avant le téléchargement, les onglets de données ne sont pas affichés. Pendant le téléchargement, les Selects et le bouton sont désactivés et un indicateur de progression est affiché. Pendant le chargement des saisons, le Select des saisons est désactivé, y compris lorsque la liste est vide. En cas d'échec, les données précédemment affichées et les renommages non sauvegardés sont conservés.

Le téléchargement sauvegarde la compétition, la saison, le fuseau cible, les renommages et `lastImportDate` uniquement lorsque toutes les requêtes nécessaires ont abouti. Une compétition, une saison ou un fuseau cible modifié exige un nouveau téléchargement avant que les données affichées soient considérées comme valides.

La page doit afficher explicitement les matchs exclus, les matchs incomplets et les erreurs de résolution d'équipe. Les champs éditables doivent être accessibles au clavier et disposer d'un libellé identifiable.

#### Limites de la première phase

Cette phase ne crée, ne supprime et ne modifie aucun `Game`, `Day`, `Timeslot`, `Field`, `Division` ou `Team` du tournoi. Elle prépare et affiche uniquement `FITData` et persiste la configuration FIT et les renommages. La mise à jour effective du tournoi fera l'objet de la partie 2 et devra préciser sa propre stratégie de fusion.

## Implémentation de la partie 1

La page est accessible depuis le menu du tournoi à l'adresse `/tournament/:tournamentId/fit-import`. Les appels vers le site FIT ne sont pas effectués directement par le navigateur : ils passent par l'API HTTP Firebase existante afin d'éviter la limitation CORS de `internationaltouch.org`. Le navigateur appelle donc uniquement le backend de l'application, qui relaie les requêtes FIT côté serveur. Le frontend appelle directement l'URL publique de la fonction `api`, configurée par `functionsApiUrl` dans les environnements Angular ; aucun proxy de développement n'est utilisé.

### Nouvelles fonctions backend prévues

Les fonctions seront regroupées dans `functions/src/fit-import.ts` et exposées sous le router HTTP `fitImportRouter`, monté dans `functions/src/index.ts` sur `/fitImport`.

- `fetchFitJson<T>(url: string): Promise<T>` : réalise une requête GET FIT avec `Accept: application/json`, vérifie le statut HTTP, parse le JSON et transforme les erreurs réseau, HTTP ou JSON invalide en erreur explicite. Cette fonction n'interprète jamais une erreur comme une collection vide.
- `fitImportCompetitions(req, res)` : handler `GET /api/fitImport/competitions`, relaie la collection FIT des compétitions et retourne les références `title`, `slug` et `url`.
- `fitImportSeasons(req, res)` : handler `GET /api/fitImport/competitions/:competitionSlug/seasons`, valide le slug, charge le détail FIT de la compétition et retourne ses saisons.
- `loadFitDivision(division, competitionSlug, seasonSlug)` : charge une division depuis l'URL FIT retournée par l'API, puis charge les stages qui ne sont fournis que sous forme de référence URL.
- `downloadFitData(req, res)` : handler `GET /api/fitImport/download?competitionSlug=...&season=...`, valide les paramètres, charge la saison, toutes les divisions, tous leurs stages et concatène les données FIT nécessaires au frontend. Il résout les références d'équipe à partir des équipes de chaque division et retourne une réponse JSON structurée ; il exclut les matchs `is_bye` et conserve `is_washout`.
- `fitImportRouter` : router Express qui monte les trois handlers précédents et applique les réponses d'erreur JSON homogènes (`400` pour une requête invalide, `502` pour une erreur de l'API FIT, `500` pour une erreur interne).

Le backend ne persiste pas `FITData` et ne modifie pas `Tournament`. Il ne fait pas les renommages dépendant de l'utilisateur ni la comparaison avec le téléchargement précédent : ces traitements restent côté frontend. Les paramètres sont validés côté backend et les slugs sont encodés avant d'être utilisés dans une URL FIT. Aucun secret n'est nécessaire pour cette API publique.

### Contrat backend/frontend

Les snapshots `FITData` sont persistés dans la collection Firestore `fit-data`. Chaque document contient un `tournamentId` et un `importDate`; au chargement de la page, le document le plus récent du tournoi est restauré. Les propriétés optionnelles absentes (`date` et slugs FIT) sont omises du document au lieu d'être écrites avec la valeur `undefined`, valeur refusée par Firestore. `Tournament.fit` conserve la configuration FIT et les renommages associés. L'index composite `tournamentId ASC` / `importDate DESC` de `firestore.indexes.json` est requis pour cette recherche.

Le service Angular `FitImportService` appellera les routes applicatives suivantes :

```text
GET /api/fitImport/competitions
GET /api/fitImport/competitions/{competitionSlug}/seasons
GET /api/fitImport/download?competitionSlug={slug}&season={season}
```

La réponse de `download` contient les divisions, les équipes, les stages et les matchs FIT bruts nécessaires à la construction de `FITData`. Les erreurs contiennent au minimum `{ "error": "..." }` sans exposer de secret ni de détail interne. Le CORS reste configuré sur l'API Firebase existante, pas sur le site FIT.

La page affiche les tableaux de renommage, équipes, créneaux et matchs. Chaque téléchargement réussi sauvegarde un snapshot complet `FITData` dans la collection Firestore `fit-data`, avec `tournamentId` et `importDate`. Au chargement de la page, le snapshot le plus récent du tournoi est restauré. `Tournament.fit` conserve la configuration courante et les renommages. Les erreurs de requête conservent les données affichées précédemment. La zone d'import propose une action `Import all days` qui construit un aperçu global et importe tous les jours en une seule confirmation. Les matchs FIT sont dédoublonnés par `gameId` lors de la construction du plan d'import.

La zone d'information affiche également la date et l'heure du dernier téléchargement réussi, à partir de `Tournament.fit.lastImportDate`, au format `YYYY-MM-DD HH:mm:ss`.

La comparaison entre téléchargements est informative : les matchs sont comparés par identifiant FIT, puis marqués `New`, `Update`, `Equal` ou `Deleted`. Les matchs bye sont exclus ; les matchs washout et les matchs incomplets sont conservés et signalés dans l'interface. La première phase ne modifie pas les objets métier du tournoi.

## Partie 2 : La mise à jour de Tournament avec les données.

La mise à jour est composée de deux imports distincts à partir du snapshot `FITData` sélectionné :

- un import global de la structure (`Division`, `Team`, `Timeslot` et `Field`) ;
- un import indépendant des matches, déclenché jour par jour.

La structure importée doit refléter les données FIT. Les identifiants internes sont toutefois réutilisés lorsque la correspondance par nom permet de le faire sans ambiguïté. Les propriétés qui ne sont pas gérées par FIT, notamment les joueurs, les réglages de terrain et les informations de planning locales, sont conservées lorsque l'objet est réutilisé. Les scores ne sont jamais écrasés par l'import des jours.

### Stratégie retenue

La fusion est réalisée côté frontend à partir d'une copie du tournoi. Chaque opération se déroule en quatre étapes :

1. valider et normaliser le snapshot FIT ;
2. construire un index des objets FIT et un index des objets existants du tournoi ;
3. calculer un plan de fusion sans modifier le tournoi affiché ;
4. présenter le bilan à l'utilisateur puis appliquer le plan en une seule sauvegarde explicite.

Le choix d'une fusion par clé stable, plutôt que par position dans les tableaux ou par nom renommé, est nécessaire car FIT peut réordonner ses données et les noms peuvent être modifiés manuellement. Toute ambiguïté de correspondance est bloquante et doit être signalée avant l'écriture.

### Correspondance des objets

Les identifiants FIT sont conservés sur les objets importés lorsque le modèle le permet. Les règles de correspondance sont les suivantes :

- `Game` : `fitGameId === games.gameId`. C'est la clé principale et elle ne doit jamais être remplacée par `uuid` ;
- `Division` : `fitSlug` lorsqu'il est disponible ; à défaut, nom final issu de `FITData` ;
- `Team` : couple `(fitDivisionSlug, fitSlug)` lorsqu'il est disponible ; à défaut, couple `(division, nom final de l'équipe)` ;
- `Field` : nom final issu de `FITData` ;
- `Day` : date civile `YYYY-MM-DD`, interprétée dans le fuseau cible du tournoi ; son identifiant interne est le numéro chronologique du jour, sous forme de chaîne (`"1"`, `"2"`, ...), en commençant à `"1"` ;
- `PartDay` : partie de journée appartenant à un `Day` ; son identifiant est son numéro d'ordre dans la journée, sous forme de chaîne (`"1"`, `"2"`, ...), en commençant à `"1"` ;
- `Timeslot` : couple `(date, heure HH:mm)`. Le créneau FIT est recherché dans la partie de journée correspondante, sans réutiliser un créneau d'un autre jour.

Pour l'import de structure, la correspondance prioritaire est la clé FIT persistée. Lorsqu'elle n'est pas disponible, la correspondance porte sur le nom final exact dans son périmètre : une division par son nom, une équipe par `(division, nom)` et un terrain par son nom. Lorsqu'une seule correspondance existe, l'identifiant interne du tournoi est conservé. Si plusieurs objets correspondent au même nom, aucune conservation automatique d'identifiant n'est effectuée et l'utilisateur doit résoudre l'ambiguïté.

### Extension du modèle persistant

Le modèle persistant ajoute les propriétés optionnelles suivantes :

- `Division.fitSlug?: string` : slug FIT de la division ;
- `Team.fitDivisionSlug?: string` : slug FIT de la division contenant l'équipe ;
- `Team.fitSlug?: string` : slug FIT de l'équipe.

Ces propriétés servent uniquement à fiabiliser les imports successifs. Elles ne remplacent pas les identifiants internes et ne modifient pas les noms affichés. Elles sont renseignées lors de l'import de structure et conservées lors des imports de jours.

### Import global de la structure

Le bouton `Import structure` importe en une seule opération toutes les divisions, équipes, timeslots et fields du snapshot sélectionné. Pour ces quatre types, le résultat fonctionnel est celui de FITData après transformation et renommage configurés ; les objets absents du snapshot courant sont donc supprimés de la structure du tournoi après confirmation. Les objets purement locaux non identifiés comme issus de FIT sont conservés ou signalés dans le bilan. Si un objet absent est encore référencé par une donnée locale incompatible avec sa suppression, l'import est bloqué et le conflit est affiché.

Pour chaque objet FIT :

- l'objet correspondant est mis à jour en conservant son identifiant interne et ses propriétés locales ;
- l'objet absent du tournoi est créé avec un nouvel identifiant interne et les valeurs FIT transformées ;
- une division est rapprochée de `BasicDivisions` en priorité par son `shortName` automatique (`MO`, `WO`, `X30`, etc.), puis par son nom FIT ou son nom final ; lorsqu'une correspondance existe, son `shortName`, sa couleur de fond et sa couleur de texte sont appliqués ;
- les divisions et équipes sont créées avant les matches afin de pouvoir renseigner les références internes du `Game` ;
- les terrains et créneaux sont créés avec les valeurs issues de FIT ;
- les propriétés de disponibilité, de qualité, de vidéo et d'ordre d'affichage qui ne sont pas décrites par FIT restent locales.

L'import de structure ne crée ni ne supprime de `Game`. Il peut être réalisé avant ou après l'import des jours ; les références internes des matches sont alors recalculées lors de l'import du jour concerné.

### Import indépendant des jours et des matches

Chaque onglet de jour dispose de son propre bouton `Import day`. L'utilisateur choisit le jour à importer ; l'opération ne traite que les matches FIT de cette date et ne modifie pas les matches des autres jours. Un match FIT sans date n'est pas importable par un bouton de jour et reste dans le groupe `Unassigned`.

Dans la page de gestion des matchs, chaque `PartDay` dispose d'un bouton `Delete all games`. Après confirmation, seuls les matchs de ce `PartDay` sont supprimés.

Pour chaque match du jour choisi :

- un match existant est recherché par `fitGameId` ;
- à défaut, une correspondance unique peut être proposée par `(division, gameType, teamHome, teamAway, date, timeslot)` ;
- un match sans correspondance est créé ;
- un match correspondant sans score est mis à jour avec les références de structure et les informations FIT ;
- un match correspondant avec un score significatif est conservé intégralement et n'est pas écrasé, car il est considéré comme déjà joué ; un score est significatif si `score` existe et si `homeTeamScore !== 0` ou `awayTeamScore !== 0` ; un score à `0–0` ne protège donc pas le match ;
- un match FIT `Deleted` est supprimé uniquement s'il n'a pas de score significatif et après confirmation ; un match supprimé avec score significatif est conservé et signalé comme conflit.

Les scores significatifs, événements et informations de tableau (`scheduleInfo`) ne sont jamais remplacés par l'import FIT. Les matches incomplets ou `washout` sont importés avec les références disponibles et signalés dans le bilan.

Les dates et heures sont converties dans `fit.targetTimeZone`, puis stockées dans le format numérique déjà utilisé par le modèle.

### Construction des timeslots

La correspondance d'un créneau FIT avec un `Timeslot` du tournoi ne repose pas uniquement sur l'heure de début. Pour chaque journée, les matches FIT sont regroupés par heure de début. Pour chaque groupe, on calcule une durée nécessaire à partir de l'écart entre son heure de début et l'heure de début du groupe suivant. Pour le dernier groupe de la journée, la durée de référence est le `totalDuration` du `SlotType` par défaut ; si le groupe contient au moins un match avec `resultRequired === true`, la durée de référence est celle du `SlotType` par défaut avec extra-time.

Le `SlotType` choisi est celui dont `totalDuration` est le plus proche sans dépasser la durée nécessaire :

```text
candidats = slotTypes.filter(slot => slot.totalDuration <= dureeNecessaire)
slotType = candidats.maxBy(slot => slot.totalDuration)
```

Si aucun `SlotType` ne convient, le créneau est composé uniquement de `SlotType` prédéfinis dans le modèle : le meilleur `SlotType` admissible est complété par un ou plusieurs `SlotType` de type break déjà définis. Aucun nouveau type de slot n'est créé. La durée résiduelle est conservée explicitement ; elle ne doit pas être absorbée silencieusement par un arrondi. Si l'écart ne peut pas être représenté proprement avec les types existants, l'import est bloqué pour ce jour et l'anomalie est affichée.

Un créneau est marqué comme nécessitant un résultat dès qu'il contient au moins un match dont `resultRequired === true`. Dans ce cas, le `SlotType` retenu doit inclure `extraTimeDuration`. Si le `SlotType` initial n'en contient pas, l'algorithme choisit le meilleur `SlotType` prédéfini admissible avec temps supplémentaire. Il ne crée jamais de durée ou de type d'extra-time dédié. Si aucun type prédéfini avec extra-time ne convient, le créneau est complété avec des `SlotType` de break existants et l'anomalie est signalée. Les matches de type `Pool` seuls n'imposent pas d'extra-time.

Les créneaux existants sont réutilisés lorsque leur date et leur heure de début correspondent. Leur identifiant est conservé, tandis que leur durée, leur `slotType` et leur caractère jouable sont recalculés d'après FIT et les règles ci-dessus. Les créneaux locaux sans correspondance FIT sont conservés mais ne sont pas utilisés pour faire correspondre un match FIT.

Pour une division ou une équipe existante, le nom FIT et le nom affiché sont actualisés, mais les données locales telles que les joueurs, les couleurs, les noms courts explicitement personnalisés et les autres propriétés non issues de FIT sont conservées. Pour un terrain existant, seul le nom issu du mapping FIT est synchronisé ; `video`, `quality` et `orderView` restent inchangés. Pour un jour existant, les propriétés de disponibilité restent locales. Pour un créneau existant, la date, l'heure, la durée, le `slotType` et le caractère jouable sont recalculés selon l'algorithme de construction des timeslots ; les autres propriétés locales sont conservées.

Pour un `Game` existant, la fusion met à jour les références de division, de jour, de partie de journée, de créneau, de terrain et d'équipes, ainsi que `fitGameId`. Les scores et les événements de match ne sont jamais écrasés. Les informations de tableau (`scheduleInfo`) sont conservées sauf si une règle métier dédiée de la partie 2 prévoit explicitement leur recalcul.

### Suppression et éléments locaux

La suppression automatique des matches est limitée au jour explicitement importé : un `Game` portant un `fitGameId` qui n'est plus présent dans les données FIT de ce jour est marqué comme supprimé du périmètre FIT et retiré du tournoi après confirmation, sauf s'il possède un score significatif. Cette suppression ne concerne pas les matches sans `fitGameId`, qui sont considérés comme créés localement.

Les matches FIT dont `status === 'Deleted'` suivent la même règle, même s'ils sont encore présents dans le snapshot. Les matches `New`, `Update` et `Equal` sont respectivement créés, fusionnés ou laissés inchangés lorsque leur contenu ne diffère pas. Un match incomplet ou `washout` n'est pas supprimé pour cette seule raison : il est importé avec les références disponibles et ajouté au bilan des anomalies.

Les divisions, équipes, terrains, jours et créneaux absents du snapshot FIT sont supprimés par l'import global. L'ensemble des divisions et des jours du tournoi devient donc celui du snapshot importé. Les jours sont triés chronologiquement puis renumérotés à partir de `"1"`; les parties de chaque jour sont renumérotées à partir de `"1"` dans leur ordre existant. Les références `Game.dayId` et `Game.partDayId` sont ajustées dans le même plan. Si un match référence un jour ou une partie supprimée et ne peut pas être réaffecté, l'import est bloqué. Les objets purement locaux qui ne sont pas représentés par ces collections FIT sont conservés.

### Validation, aperçu et application

L'aperçu est obligatoire avant chaque import. Il est calculé à partir d'une copie du tournoi et du snapshot FIT sélectionné ; son affichage et sa consultation ne modifient aucune donnée persistée.

#### En-tête de l'aperçu

L'aperçu indique explicitement :

- le type d'opération : `Import structure` ou `Import day` ;
- pour un import de jour, la date concernée et le nombre de matches FIT examinés ;
- l'identifiant et la date du snapshot FIT utilisé ;
- le nombre total d'objets qui seront créés, mis à jour, supprimés, conservés ou ignorés ;
- le nombre d'erreurs bloquantes et d'avertissements.

Pour l'import de structure, le résumé est ventilé par type (`Division`, `Team`, `Timeslot`, `Field`). Pour l'import d'un jour, il est ventilé par matches et références de structure résolues ; une référence absente est une erreur bloquante et doit être traitée par l'import global de structure.

#### Détail des changements

L'utilisateur peut développer chaque groupe du résumé. Chaque ligne de détail contient au minimum :

- le type et la clé de l'objet ;
- son identifiant interne actuel, s'il existe ;
- son identifiant FIT ou sa clé de correspondance ;
- l'action prévue : `Create`, `Update`, `Delete`, `Keep`, `Skip` ou `Conflict` ;
- les propriétés modifiées avec leur valeur actuelle et leur valeur FIT résultante ;
- la raison de la décision lorsque l'objet est conservé, ignoré ou en conflit.

Les détails sont présentés ainsi :

- pour une division, une équipe ou un terrain : nom actuel, nom FIT, nom final et indication de réutilisation ou de création de l'ID ;
- pour un timeslot : date, heure de début, durée calculée, `SlotType` sélectionné, nombre et durée des breaks ajoutés, et indication `extra time required` lorsque le créneau contient au moins un match avec `resultRequired` ;
- pour un match : `gameId`, division, équipes, date, heure, terrain, type de match, état FIT et liste des propriétés modifiées ;
- pour un match possédant déjà un score : aucune modification de ses données de match n'est proposée, avec le motif `score protected` ;
- pour une suppression : présence ou absence d'un score, justification de l'absence dans le snapshot du jour et conséquences prévues.

Les valeurs inchangées ne sont pas listées dans les propriétés modifiées. Une vue « changements uniquement » est proposée par défaut, avec la possibilité d'afficher également les éléments conservés.

#### Erreurs et avertissements

Avant toute sauvegarde, le plan de fusion doit vérifier :

- l'unicité des clés FIT et l'absence de correspondance multiple ;
- la présence des divisions et équipes nécessaires aux matches ;
- la validité des dates, heures, fuseaux et références internes ;
- l'absence de collision entre deux noms affichés dans une même division ou deux terrains portant le même nom final ;
- la compatibilité des suppressions avec les données locales et les droits de l'utilisateur.

Une erreur bloquante interdit la confirmation et doit être affichée dans un groupe dédié. Sont notamment bloquants : une clé FIT dupliquée, une correspondance multiple, une équipe ou une division obligatoire introuvable, une référence interne impossible à construire, une durée de timeslot non représentable et toute collision empêchant de renseigner correctement un `Game`.

Un avertissement n'interdit pas la confirmation, mais doit être visible dans le résumé et dans le détail concerné. Sont notamment des avertissements : match incomplet, match `washout`, match FIT supprimé mais conservé parce qu'il possède un score significatif, élément local devenu inutilisé, création d'un identifiant interne ou complétion avec un `SlotType` de break.

#### Actions et confirmation

L'aperçu propose les actions suivantes :

- `Cancel` : ferme l'aperçu sans modification ;
- `Back` : revient aux données importées ou au choix du jour ;
- `Confirm import` : applique l'intégralité du plan lorsque aucune erreur bloquante n'est présente ;
- `Import anyway` n'est pas proposé pour contourner une erreur bloquante.

Le bouton de confirmation indique le périmètre et le nombre d'objets concernés, par exemple `Confirm import of day 2026/08/14 (12 changes)`. Pour les suppressions de matches sans score, une confirmation explicite est requise et le nombre de suppressions est rappelé dans le libellé.

Après confirmation, le plan validé est appliqué en une seule opération logique. Le tournoi affiché est remplacé uniquement après réussite de l'écriture. Aucun bilan de fusion n'est sauvegardé ; le snapshot FIT reste toutefois disponible dans `fit-data` pour permettre une nouvelle tentative.

En cas d'erreur de validation ou d'écriture, le tournoi reste inchangé. Une nouvelle importation FIT peut être préparée sans perdre les renommages ni le snapshot précédent.

### Limites de cette stratégie

Cette stratégie synchronise le calendrier et la structure nécessaires aux matches. Elle ne déduit pas les joueurs, les scores, les événements, les poules ou les informations d'arbitrage depuis FIT. Ces données restent gérées par l'application jusqu'à la définition d'une règle métier spécifique.

## Implémentation de la partie 2

La fusion est implémentée dans le service frontend `FitMergeService`. Le service construit d'abord un `FitMergePlan` sur une copie du tournoi ; aucun objet persistant n'est modifié pendant la préparation de l'aperçu.

La page FIT expose les actions suivantes :

- `Import structure` : prépare et applique l'import global des divisions, équipes, terrains, jours et créneaux à partir du snapshot sélectionné ;
- `Import this day` : prépare et applique l'import des matches du jour affiché. Les matches sont recherchés par `fitGameId`, puis par la clé de secours `(division, type, équipe domicile, équipe extérieure, jour, créneau)` ;
- `Confirm ...` : applique le plan uniquement si aucune erreur bloquante n'est présente.

Les divisions et équipes persistées conservent leurs clés FIT dans `fitSlug` et `fitDivisionSlug`. Les matches restent persistés dans la collection `game` via `GameService`, tandis que la structure est sauvegardée dans le document `Tournament`. L'import d'un jour exige que les divisions, équipes, terrains et créneaux correspondants aient déjà été importés par `Import structure`. Aucun bilan d'aperçu n'est persisté.
