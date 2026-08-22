# Disponibilité des arbitres

## Objectif

Permettre de recueillir et de mémoriser la disponibilité d’un arbitre pour un
tournoi, afin qu’elle puisse être utilisée ultérieurement par l’allocation des
arbitres.

Cette évolution concerne uniquement la saisie et la persistance des
disponibilités. Le comportement de l’allocation des arbitres n’est pas modifié
dans cette évolution.

## Édition dans la popup d’un arbitre

Dans la popup d’édition d’un arbitre, l’édition est organisée en deux onglets :

- `General` contient les informations actuellement éditables, hors boutons de
  sauvegarde et d’annulation ;
- `Unavailability` permet d’éditer les indisponibilités.

La popup ne possède ni bouton `Save` ni bouton `Cancel`. Le fonctionnement
existant est conservé : les modifications sont sauvegardées automatiquement à
la fermeture de la popup.

Le widget d’indisponibilité est intégré à l’édition des arbitres dans cette
première version. Il doit être indépendant et réutilisable pour tout `Attendee`,
notamment pour permettre son utilisation future avec les `RefereeCoach`.

## Tableau de disponibilité

Le tableau utilise la configuration `Tournament.days` comme source de vérité.
Les jours et les `PartDay` sont affichés dans l’ordre de cette configuration.

- Une colonne visuelle correspond à un `Day`.
- Le titre de la colonne affiche le jour.
- Les `PartDay` d’un jour sont empilés verticalement dans sa colonne.
- Un en-tête distinct est affiché pour chaque `PartDay`.
- Les slots des différents `PartDay` sont affichés à la suite, sans libellé
  intermédiaire supplémentaire.
- Un `PartDay` sans timeslot est ignoré et ne génère aucune donnée.
- Tous les timeslots sont affichés, y compris ceux dont `playingSlot` vaut
  `false`.
- Chaque slot affiche uniquement son heure de début au format `HH:mm`.

Les lignes sont déterminées par la position du slot dans chaque `PartDay`.
Les slots n’ont donc pas besoin de correspondre entre les jours ou entre les
`PartDay`.

Chaque case est cliquable et inverse l’état de disponibilité du slot. Le
curseur prend la forme d’un pointeur au survol d’une case.

### Couleur des cases

- vert : la personne est disponible sur le slot ;
- rouge : la personne est indisponible sur le slot.

Le texte des cases est blanc.

### En-tête d’un `PartDay`

L’en-tête de chaque `PartDay` est cliquable et résume l’état de ses slots :

- vert : la personne est disponible sur tous les slots ;
- orange : la personne est disponible sur une partie des slots ;
- rouge : la personne est indisponible sur tous les slots.

Lors d’un clic sur l’en-tête du `PartDay` :

- vert : tous les slots du `PartDay` deviennent indisponibles ;
- orange : tous les slots du `PartDay` deviennent disponibles ;
- rouge : tous les slots du `PartDay` deviennent disponibles.

### En-tête d’un `Day`

Le titre du `Day` est également coloré et cliquable. Sa couleur résume l’état
cumulé de tous les `PartDay` du jour :

- vert : tous les slots de tous les `PartDay` sont disponibles ;
- orange : une partie des slots est indisponible ;
- rouge : tous les slots de tous les `PartDay` sont indisponibles.

Lors d’un clic sur le titre du `Day` :

- vert : tous les slots de tous les `PartDay` deviennent indisponibles ;
- orange : tous les slots de tous les `PartDay` deviennent disponibles ;
- rouge : tous les slots de tous les `PartDay` deviennent disponibles.

Les `PartDay` sans timeslot ne participent pas au calcul de la couleur du jour.

## Modèle de données

L’information est stockée dans l’`Attendee` correspondant à l’arbitre. Un
arbitre est considéré comme disponible par défaut ; seules les indisponibilités
sont persistées.

```ts
export type Unavailability = 'TOTAL' | 'PARTIAL';

export interface PartDayUnavailability {
  dayId: string;
  unavailability: Unavailability;
  unavailableSlotIds: string[];
}

interface Attendee {
  // ...
  unavailabilities?: PartDayUnavailability[];
}
```

Un timeslot est identifié par le couple `dayId` et `timeslotId`.

Les règles de représentation sont les suivantes :

- l’absence d’une entrée pour un `Day` signifie que tous ses slots sont
  disponibles ;
- une entrée `TOTAL` signifie que tous les slots du `Day` sont indisponibles
  et `unavailableSlotIds` doit être vide ;
- une entrée `PARTIAL` signifie qu’au moins un slot, mais pas tous les slots,
  est indisponible dans le `Day` ; `unavailableSlotIds` doit donc être non vide et incomplet ;
- une liste vide de `unavailabilities` signifie que l’Attendee est disponible
  partout ;
- le champ `unavailabilities` est optionnel afin de rester compatible avec les
  Attendee existants.

Le widget est responsable de l’édition de `Attendee.unavailabilities` et de la
normalisation de sa représentation.

## Nettoyage et normalisation au chargement

Au chargement du widget, les entrées sont vérifiées contre la configuration du
tournoi :

- les `dayId` inexistants sont supprimés ;
- les `partDayId` inexistants ou appartenant à un autre jour sont supprimés ;
- les `slotId` inexistants dans leur `PartDay` sont supprimés ;
- les `PartDay` sans timeslot sont ignorés ;
- les entrées en doublon sont fusionnées ;
- en cas de conflit, `TOTAL` est prioritaire sur `PARTIAL` ;
- après nettoyage, les entrées sont renormalisées : une indisponibilité
  partielle qui couvre tous les slots restants devient `TOTAL` ;
- une entrée devenue entièrement disponible est supprimée.

Ce nettoyage est effectué uniquement en mémoire lors du chargement. Il n’y a
pas de sauvegarde immédiate. Le résultat nettoyé est persisté uniquement lors
de la fermeture de la popup.

La liste des slots affichés est toujours reconstruite depuis la configuration
actuelle du tournoi, et non depuis les données enregistrées dans l’Attendee.
