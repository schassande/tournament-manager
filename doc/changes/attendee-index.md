Je veux que tu mettes en place un index tournoi/email => attendee.id
On construit une chaine de caractère "<tournamentId>:<email>" c'est la clé de la collection. l'element de la collection est une string attendee.id.

Ainsi on peut faire un controle dans les règles firestore pour proteger les ranking.
Cet index servira pour d'autres parties de l'application.

La mise à jour de ce nouvel index doit se faire lorsqu'un nouvel Attendee est créé avec un email.
