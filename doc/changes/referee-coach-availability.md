# Referee Coach availability

## Objectif

L'objectif de la nouvelle fonctionnalité est de recueillir la disponibilité d'un referee coach.
Pour l'instant il ne faut pas l'utiliser pour l'allocation. Ce sera dans une étape ultérieure.

## Fonctionnement

Le fonctionnement doit être très similaire à ce qui a été fait pour la disponibilité des arbitres (lire ./referee-availability.md): 
- C'est dans la popup tournament-Referee-coach-edit qui faut implémenter la fonctionnalité de manière similaire à ce qui a été fait dans tournament-referee-edit
- Tout le reste est similaire : mise en forme dans onglet, réutilisation du widget, stockage dans l'objet Attendee au moment de la fermeture de la popup ...

