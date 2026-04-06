# tournament-manager

Touch Rugby tournament manager.

## Documentation

- [Documentation technique](c:/data/perso/dev/tournament-manager/sources/doc/dev.md)
- [Fonctionnalites](c:/data/perso/dev/tournament-manager/sources/doc/features.md)
- [Pages de l'application](c:/data/perso/dev/tournament-manager/sources/doc/pages.md)
- [Modele de donnees](c:/data/perso/dev/tournament-manager/sources/doc/datamodel.md)
- [Backend Firebase Functions](c:/data/perso/dev/tournament-manager/sources/doc/functions.md)

## Notes metier

Referee = Attendee [+ Person]

- Sans `Person`, il s'agit d'un player referee.
- Avec `Person`, il peut s'agir d'un arbitre temps plein sans compte applicatif ou d'un arbitre rattache a un compte.

## Premier deploiement

Definir le secret `APP_API_KEY` :

```powershell
firebase functions:secrets:set APP_API_KEY
```
