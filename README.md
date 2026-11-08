# WarLike Online — backend Cloudflare

> **Connexion WarLike :** cette version utilise la session WarLike Server vérifiée côté serveur à chaque requête. Les identifiants sont transmis par le client Online au service WarLike Server via une liaison Cloudflare privée, sans stockage dans Online. Les sessions et comptes pilotes locaux ne permettent plus de se connecter. L'ancien mécanisme d'assertion reste conservé dans le code, désactivé tant qu'il n'est pas intégré.

Réseau social WarLike indépendant de Base44, avec frontend dans `public/` et backend Cloudflare Worker dans `worker/`.

## Fonctionnalités implémentées dans le code

- Connexion et déconnexion avec le compte WarLike et un cookie de session HttpOnly.
- Mots de passe hachés PBKDF2 et sessions persistantes (hachage des jetons en D1).
- Publications, lecture du fil, commentaires, mentions J'aime et abonnements en D1.
- Photos et vidéos autorisées (PNG, JPEG, WebP, GIF, MP4, WebM) stockées dans R2, limite de 20 Mo ; vérification de signature simple.
- Flux de clips et interface Périscope ; **aucune diffusion live réelle à ce stade**.

Les comptes pilotes restent dans la base, mais leur connexion est désactivée. Les profils associés au compte central utilisent le mapping existant `online_identities`.

## Déployer sur Cloudflare

La base D1 `warlike-online`, le bucket R2 `warlike-online-media` et la liaison de service vers WarLike Server sont configurés. Les bindings sont `DB`, `BUCKET` et `WARLIKE_SERVER`.

Depuis le dossier `worker/` :

1. Vérifier l'identifiant D1 dans `wrangler.toml`.
2. Vérifier le nom du bucket R2.
3. Appliquer la migration : `npx wrangler d1 migrations apply warlike-online --remote`.
4. Publier le Worker : `npx wrangler deploy`.

Le Worker sert le site depuis `public/` et l'API depuis le même domaine, avec les endpoints `/api/*` et `/media/*`. La version statique à la racine (`index.html`) reste une première démonstration locale ; **la version multiutilisateur doit être publiée via le Worker**.

### Routes

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` : compte WarLike central.
- `GET /api/posts`, `POST /api/posts`, `PUT /api/posts/:id/media`
- `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like`
- `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- `POST /api/users/:id/follow`, `DELETE /api/users/:id/follow`
- `GET /media/:id` pour les utilisateurs connectés

### Avant toute ouverture publique

Vérifier les parcours de connexion et de publication avec deux comptes réels, compléter la récupération de comptes et la limitation anti-abus, améliorer la modération Tower, le contrôle des uploads, les mécanismes de suppression, la pagination et les tests de charge / sécurité. Les comptes pilotes isolés ne sont plus utilisables pour se connecter. Ne pas utiliser une base D1 ou un bucket R2 de WarLike Server sans migration explicitement compatible.

État : **Worker Online et adresse Cloudflare Pages déployés ; D1, R2 et liaison WarLike Server configurés. Un parcours synthétique à deux comptes a été validé dans un environnement isolé. Les comptes et échanges de collaborateurs réels restent à valider.**


## Vérification Cloudflare du 8 novembre 2026

- Worker `warlike-online` envoyé à Cloudflare (déploiement API confirmé).
- D1 `warlike-online` : migrations `0001` et `0002` appliquées, 8 tables principales d'Online vérifiées.
- Clés étrangères : contrôles D1 exécutés sans violation sur `online_posts`, `online_comments` et `online_identities`.
- Bucket `warlike-online-media` et binding `BUCKET` confirmés.
- Domaine attendu : `https://warlike-online.warlikeofficiel.workers.dev`.
- **Limite :** aucune réponse HTTP du site distant n'a pu être vérifiée depuis cet environnement. Exécuter `node tests/smoke.mjs https://warlike-online.warlikeofficiel.workers.dev` pour une validation HTTP en lecture seule. Parcours inscription/publication et tests d'upload R2 à réaliser sur un compte de test dédié.

## Raccordement de l'identité existante

`POST /api/auth/warlike` accepte un objet `{"assertion":"<payload-base64url>.<signature-base64url>"}` lorsqu'un secret `WARLIKE_SSO_SECRET` est configuré **sur le Worker Online** et du côté de l'émetteur WarLike Server.

Le payload JSON UTF-8 signé par HMAC-SHA256 doit contenir :
- `iss: "warlike-server"`, `aud: "warlike-online"`
- `sub` : identifiant stable du membre validé par Server, jamais une valeur arbitraire du navigateur.
- `iat` et `exp` : temps Unix en secondes avec une durée de validité maximale de 120 secondes.
- `nonce` : chaîne aléatoire de 16 caractères minimum, unique par assertion.
- `name` (facultatif) : nom affiché.

Signature : HMAC-SHA256 sur le texte encodé `payload-base64url`, encodée ensuite en base64url sans padding. Une assertion consommée est refusée grâce à `online_assertion_nonces`.

**Il reste à créer côté WarLike Server une route authentifiée qui génère l'assertion uniquement après vérification effective de la session/du rôle du membre**, à stocker le secret commun dans les secrets Cloudflare de chaque service, puis à fournir la redirection de connexion côté Online. Aucun mot de passe WarLike Server ne doit être transmis au navigateur Online. Ne pas employer une simple identité non signée.

Ce protocole d'assertion est conservé mais désactivé : la connexion commune actuelle repose sur la liaison privée à WarLike Server.

## Découverte et modération

Le Périscope propose une publication parmi les créations récentes. Le direct vidéo reste à développer. L'auteur ou le propriétaire peut supprimer une publication ; son média et les interactions associées sont retirés. Les vidéos acceptent les requêtes par plage pour améliorer la lecture. La modération depuis Tower reste à raccorder.
