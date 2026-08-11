# Authentification avec Google

Date: 2026-08-10 par Sébastien Chassande-Barrioz

## Objectif

Permettre à un utilisateur de se connecter à Tournament Manager avec son compte Google, depuis la page `/user/login`, en complément de la connexion par email et mot de passe.

## Périmètre

La fonctionnalité concerne uniquement l’application frontend Angular et son intégration avec Firebase Authentication. Aucun endpoint Firebase Functions supplémentaire n’est nécessaire.

## Parcours utilisateur

1. L’utilisateur ouvre la page `/user/login`.
2. Il clique sur le bouton de connexion Google, identifiable par le logo Google.
3. L’application ouvre le flux Firebase Authentication avec `GoogleAuthProvider` et privilégie `signInWithPopup`.
4. Après authentification réussie, l’application recherche la `Person` correspondant à l’adresse email fournie par Google.
5. Si une `Person` existe, l’utilisateur est connecté et redirigé vers `/home`.
6. Si aucune `Person` n’existe, l’application crée automatiquement une nouvelle `Person`, puis connecte l’utilisateur et le redirige vers `/home`.

## Création automatique de la personne

La personne créée utilise les informations disponibles dans le profil Google :

- `email` : adresse email Google ;
- `userAuthId` : UID Firebase de l’utilisateur ;
- `firstName` : prénom fourni par Google ;
- `lastName` : nom fourni par Google ;
- `shortName` : valeur dérivée du prénom et du nom selon la convention existante ;
- `photoUrl` : URL de photo fournie par Google, si disponible.

Les champs que Google ne fournit pas et qui sont obligatoires dans le modèle métier reçoivent les valeurs par défaut suivantes : `regionId = Europe` et `countryId = FRA`. Le champ `gender` reste vide. Ces valeurs pourront être corrigées ultérieurement depuis les écrans de gestion des personnes. La création réutilise le service et le flux de création de personne existants.

La création doit être idempotente : une nouvelle tentative de connexion avec la même adresse email ne doit pas créer de doublon.

## Gestion des erreurs

En cas d’annulation de la popup, de popup bloquée, d’échec réseau ou d’erreur Firebase/Google, l’application affiche un message indiquant l’échec de la connexion Google.

Le message ne doit pas exposer de donnée sensible ni de détail technique inutile à l’utilisateur. L’état de chargement doit être réinitialisé après succès ou échec, et le bouton doit être désactivé pendant le traitement.

## Règles de persistance

L’option « Remember me » ne s’applique pas à la connexion Google. La connexion Google ne doit donc pas enregistrer d’identifiants email/mot de passe dans le stockage local.

## Contraintes techniques

- Ajouter une méthode dédiée dans `frontend/src/service/user.service.ts`.
- Utiliser Firebase Authentication et `GoogleAuthProvider`.
- Privilégier `signInWithPopup`.
- Mettre à jour `currentCredential` et `currentUser$` comme pour les autres modes de connexion.
- Conserver la redirection existante vers `/home` après connexion réussie.
- Respecter les conventions visuelles et d’accessibilité de la page de connexion : navigation clavier, libellé explicite et état désactivé du bouton.

## Configuration Firebase

Dans le projet Firebase cible :

- activer Google dans les fournisseurs de connexion de Firebase Authentication ;
- vérifier les domaines autorisés pour les environnements de développement et de production ;
- vérifier que la configuration Firebase utilisée par les environnements Angular correspond au projet cible.

Cette configuration doit être réalisée et vérifiée avant la recette du parcours Google.

## Critères d’acceptation

- Un bouton Google visible et accessible est présent sur `/user/login`.
- Un clic sur ce bouton ouvre une popup Google Firebase.
- Une authentification réussie avec une `Person` existante connecte l’utilisateur et redirige vers `/home`.
- Une authentification réussie avec une adresse inconnue crée une seule `Person`, connecte l’utilisateur et redirige vers `/home`.
- Une annulation ou une erreur affiche un message d’échec et réactive le bouton.
- Aucun mot de passe Google ni identifiant email/mot de passe n’est enregistré localement.
- La connexion email/mot de passe et les parcours existants continuent de fonctionner.
- La documentation de la page de connexion est mise à jour avec le nouveau parcours.
