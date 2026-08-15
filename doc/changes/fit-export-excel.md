# FIT games Excel Export

## Objectif

L'objectif est d'exporter dans un fichier Excel les données FIT transformées.

## Fonctionnement
La page fit-import, dans la zone d'affichage des résultats, propose un nouveau bouton `Export Excel` pour exporter les données FIT.

Le bouton est visible uniquement lorsqu'un `FITData` est affiché et est désactivé pendant un chargement ou une sauvegarde.
L'export porte sur le snapshot FIT actuellement affiché, y compris les renommages modifiés mais non sauvegardés.

Les onglets `Day N` sont numérotés selon l'ordre chronologique des dates : la première date devient `Day 1`, la deuxième `Day 2`, etc. L'onglet `Unassigned` est ajouté ensuite.

Le fichier est nommé selon la convention suivante :

```
<nom-de-la-competition>-<date-import>.xlsx
```

Le nom affiché de la compétition est utilisé. La date d'import est au format `YYYY-MM-DD_HHmmss`. Les caractères incompatibles avec un nom de fichier Windows sont remplacés par `_`.

L'Excel est fabriqué côté frontend avec la librairie `xlsx` (SheetJS), puis téléchargé directement dans le navigateur. Aucun appel backend n'est nécessaire.

## Contenu de l'Excel

- Un onglet `Divisions` : une colonne par division, pour toutes les divisions présentes dans `FITData`, y compris celles sans équipe ou sans match. La première ligne contient le nom de la division. Les lignes suivantes contiennent les noms des équipes ; les cellules sans valeur sont vides.
- Un onglet `Timeslots` : une colonne par jour, dans l'ordre chronologique. La première ligne contient la date du jour. Les lignes suivantes contiennent les timeslots du jour, sans alignement ni regroupement entre les colonnes.
- Un onglet par jour (`Day 1`, `Day 2`, ...) reprenant le tableau affiché pour la date correspondante.
- Un onglet `Unassigned` reprenant le tableau affiché pour les matchs sans date.

Les onglets journaliers et `Unassigned` contiennent les colonnes suivantes, dans cet ordre : `Time`, `Field`, `Division`, `Type`, `Home`, `Away`, `Status`, `FIT id`, `Changes`.

Les valeurs sont exportées comme suit :

- les dates sont du texte au format `YYYY-MM-DD` et les heures du texte au format `HH:mm` ;
- une valeur absente est exportée dans une cellule vide ;
- `Status`, `FIT id` et `Changes` sont exportés comme affichés dans l'interface ;
- `Changes` contient les changements concaténés avec `, ` ;
- les renommages visibles sont appliqués avant la génération du fichier.

## Mise en forme Excel

La première ligne de chaque tableau est en gras, comporte un filtre automatique et est figée afin de rester visible pendant le défilement.
Les largeurs de colonnes sont ajustées au contenu, avec une largeur maximale raisonnable. Aucune autre mise en forme métier n'est requise.

