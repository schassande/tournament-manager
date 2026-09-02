# TODO list du projet Tournament Maager

- Tournament home
  - Suggestion de la prochaine étape
  - chart des arbitres: pyramide par niveau homme/femme
  - ratio nombre de Full time referee par équipe (gauge avec zone rouge des 2 cotés: rouge/jaune/vert/jaune/rouge)
  - Utilisation de Player referee
  - Divisions / nombre d'équipe
  - Match alloué / restant à allouer
- Ranking
- Water carrier
  - pour impression
  - pour remplissage en ligne
    - authentification ? necessite que chaque arbitre ait un compte donc son email affecté dans la liste des arbitres
    - traçabilité des actions
    - compatibilité avec le planning d'un arbitre
    - statistiques
- Scorecard papier
  - Responsables d'une équipe (email)
  - Les responsables d'équipe peuvent entrer les noms des joueurs et leur numéro
    - Page de bilan du remplissage
  - Impression des scorecards pour les matches (du jour, d'un match) avec les équipes, joueurs et arbitres

- Allocation auto : 
  - IA gen
  - ou Optimiseur: https://docs.timefold.ai/timefold-solver/latest/optimization-algorithms/local-search
  - Avec les coach
  - Avec les water carrier
- Gestion des matches : creation du draw, resultats, classement

==> diffusion / communication / POC

- Ranking method Europe
- Numéro de version et date d'une allocation pour savoir quand elle a été modifié.
- Field map
- Mon Planning
- Candidature Arbitre
- Candidature Referee Coach
- Referees: Import csv
- Referees: export csv
- Games: import csv
- API
  - API Key pour un user
  - Swagger
- Games: export csv
- Online Scorecard 

## Ideas

- Connexion referentiel Arbitre Touch France

## DONE
- 2026/08/09: durcissement des règles firestore
- Authentification google
- Configuration général du tournoi en onglet
- 2026/08/12: Tournamanent manager (no restrictions supported yet)
- 2026/08/15: FIT Data import + Export Excel
- 2026/08/16: Gérer la disponibilité des Arbitres et des coach arbitre
- 2026/08/17: Configuration de l'allocation
- 2026/08/18: Referee Upgrade
- 2026/08/18: Allocation
  - Cacher automatiquement les terrains ou il n'y a pas de match dans la journée
  - Quand multi jour et pas alloc créer pour les autres jours, il faut pouvoir creer en cliquant + confirmation
  - Bug Sauvegarde des allocations
  - Mise en page de l'allocation
- 2026/08/20: Allocation
  - Composant graphique pour l'édition d'une case d'un referee avec une popup pour proposer des arbitres disponibles
- 2026/08/21: Page des allocations à améliorer
  - Icone de retour : Allocation => Allocations
  - Mode simple
- 2026/08/22: Day/PartDay: split/join Part, move limit
- 2026/08/23: Allocation : rendre visible/publier
- 2026/08/25: Delete d'un tournament doit effacer toutes les données liées à un tournoi : Game, GameAttendee, Allocation, statistics, upgrade vote ...
- 2026/08/25: Attendee contient les informations personnes. Il y aura un Person uniquement pour les utilisateurs enregistrés. 
- 2026/08/26: Allocation : 
  - Ajouter la vérification des contraintes pour les arbitres: dispo, nombre de match conséqutifs
  - Ajouter la vérification des contraintes pour les coach: dispo, nombre de match conséqutifs
  - Centralisation des problemes 
  - Affichage des erreurs de manière localisée
- 2026/08/26: statistiques d'allocation
- 2026/08/27: Planning arbitres et coaches
- 2026/08/31: Wizard de creation de tournoi
- 2026/08/31: nom des parts lors de l'import FIT
- 2026/08/31: Page home
- 2026/08/31: Ajout du tableau de la liste des allocations dans le drawer des statistiques d'allocation
- 2026/09/02: Passage en Drawer du menu de l'appliation + S'adapte en fonction du role de l'utilisateur connecté
- 2026/09/02: (Des)Activation de fonctionnalités : ranking, scorecard, upgrade, Gestion des matches


## Bugs non reproduis
- Referees : bug teams sauvegarde ou chargement de teams


