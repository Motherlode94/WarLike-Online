# WarLike Online — backend Cloudflare

Réseau social WarLike indépendant de Base44, avec frontend dans `public/` et backend Cloudflare Worker dans `worker/`.

## Fonctionnalités implémentées dans le code

- Création de comptes pilotes, connexion et déconnexion par cookie de session HttpOnly.
- Mots de passe hachés PBKDF2 et sessions persistantes (hachage des jetons en D1).
- Publications, lecture du fil, commentaires, mentions J'aime et abonnements en D1.
- Photos et vidéos autorisées (PNG, JPEG, WebP, GIF, MP4, WebM) stockées dans R2, limite de 20 Mo ; vérification de signature simple.
- Flux de clips et interface Périscope ; **aucune diffusion live réelle à ce stade**.

**Important :** l'authentification pilote est isolée. Elle ne représente pas encore l'identité commune WarLike Keys / WarLike Server (qui utilise déjà une connexion signée spécifique). Ne pas confondre ces comptes de test avec des comptes WarLike existants.

## Déployer sur Cloudflare

Il faut d'abord créer une base D1 `warlike-online` et un bucket R2 `warlike-online-media`, ou choisir explicitement d'autres ressources. Les bindings sont `DB` et `BUCKET`.

Depuis le dossier `worker/` :

1. Remplacer `REPLACE_WITH_D1_DATABASE_ID` dans `wrangler.toml` par l'identifiant D1 réel.
2. Vérifier le nom du bucket R2.
3. Appliquer la migration : `npx wrangler d1 migrations apply warlike-online --remote`.
4. Publier le Worker : `npx wrangler deploy`.

Le Worker sert le site depuis `public/` et l'API depuis le même domaine, avec les endpoints `/api/*` et `/media/*`. La version statique à la racine (`index.html`) reste une première démonstration locale ; **la version multiutilisateur doit être publiée via le Worker**.

### Routes

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/posts`, `POST /api/posts`, `PUT /api/posts/:id/media`
- `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like`
- `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- `POST /api/users/:id/follow`, `DELETE /api/users/:id/follow`
- `GET /media/:id` pour les utilisateurs connectés

### Avant toute ouverture publique

Intégrer l'identité centrale WarLike Keys en utilisant une vérification de session fiable côté serveur, ajouter une récupération de comptes et une limitation anti-bruteforce, améliorer la modération Tower, le contrôle des uploads, les mécanismes de suppression, la pagination et les tests de charge / sécurité. Les mots de passe pilotes ne sont pas fédérés. Ne pas utiliser une base D1 ou un bucket R2 de WarLike Server sans migration explicitement compatible.

État : **code enregistré dans GitHub ; configuration Cloudflare, migrations, déploiement et tests réels non confirmés.**


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

Ce protocole est préparé dans le code, **mais la connexion commune n'est pas encore opérationnelle**.
