# TODO list du projet Tournament Maager

## Priorité 1
- Documenter les interfaces en détail
- Utiliser l'email comme id d'une personne/attendee
- Attribut search dans les person
- Revue des firebase rule
- Authentification google
- Déploiement prod/dev

## Priorité 2
- Configuration général du tournoi en onglet
  - Passage à PrimeNG de la config general
- Gestionnaire d'un tournoi
  - In tournament edit : Manager of the tournament => create attendee
- Referees : bug teams sauvegarde ou chargement de teams
- Gérer la disponibilité des Arbitres
  - Passage à PrimeNG
- Gérer la disponibilité des RefereeCoach
  - Passage à PrimeNG
- Ajouter la configuration de l'allocation
  - Back 2 back autorisé
  - Avec ou sans coach
  - Coach sur 2 terrains
  - Nombre d'arbitre max par terrain : 1, 2, 3, 4

## Priorité 3
- Allocation : 
  - Composant graphique pour l'édition d'une case d'un referee avec une popup pour proposer des arbitres disponibles 
    - Bug Sauvegarde des allocations
  - Panel gauche avec la liste des arbitres classés / triés
  - Page des allocations à améliorer
    - Présentation pour les tournois 1 day et une autre présentation pour les tournois multi days
    - si une seule allocation, ne pas afficher le select/current
- Planning arbitres
- Planning coach
- Upgrade
- Ranking
- Scorecard
- Games: import FIT

==> diffusion / communication / POC


## Priorité 4
- Tournament home
  - Suggestion de la prochaine étape
  - chart des arbitres: pyramide par niveau homme/femme
  - ratio nombre de Full time referee par équipe (gauge avec zone rouge des 2 cotés: rouge/jaune/vert/jaune/rouge)
  - Utilisation de Player referee
  - Divisions / nombre d'équipe
  - Match alloué / restant à allouer
- Mon Planning
- Referees: Import csv
- Referees: export csv
- Games: import csv
- Field map
- Connexion referentiel Arbitre Touch France
- Wizard creation de tournoi
- Allocation auto : https://docs.timefold.ai/timefold-solver/latest/optimization-algorithms/local-search
- Candidature Arbitre
- Candidature Referee Coach
- API
  - API Key pour un user
  - Swagger
- Creation de game
- Games: export csv
