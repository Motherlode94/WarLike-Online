# WarLike Online

Réseau social WarLike indépendant, hébergé sur Cloudflare et relié aux comptes de WarLike Server. Le site est accessible à [warlike-online.pages.dev](https://warlike-online.pages.dev/).

## Fonctions

- Connexion avec un compte WarLike existant. La session est vérifiée côté serveur à chaque requête ; les comptes pilotes isolés ne permettent plus de se connecter.
- Fil de publications partagées entre les membres connectés, avec texte, images et vidéos.
- Mentions J’aime, commentaires et abonnements.
- Clips vidéo et Périscope pour découvrir des publications récentes. La diffusion vidéo en direct n’est pas encore disponible.
- Suppression d’une publication et de son média par son auteur ou le propriétaire. La modération depuis WarLike Tower reste à raccorder.

Les médias acceptés sont JPEG, PNG, WebP, GIF, MP4 et WebM, avec une limite de 20 Mo par fichier. Ils sont servis aux membres connectés et les requêtes par plage sont prises en charge pour la lecture des vidéos.

## Architecture

L’interface se trouve dans `public/` et le service applicatif Cloudflare Worker dans `worker/`. Le projet Pages utilise le relais `_worker.js` pour transmettre les requêtes au Worker Online.

- `DB` : base D1 `warlike-online`, pour les publications, réactions, commentaires, abonnements et profils Online.
- `BUCKET` : stockage R2 `warlike-online-media` pour les médias.
- `WARLIKE_SERVER` : liaison privée vers le service WarLike Server, qui valide les comptes et les sessions.

Les identifiants saisis sur Online sont transmis à WarLike Server par cette liaison privée ; Online ne stocke pas ces mots de passe. Les comptes temporaires doivent d’abord être personnalisés sur [WarLike Server](https://warlike-server.pages.dev/connexion).

## API

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` : connexion WarLike.
- `GET /api/posts`, `POST /api/posts`, `DELETE /api/posts/:id` : fil et publications.
- `PUT /api/posts/:id/media`, `GET /media/:id` : ajout et lecture d’un média.
- `POST /api/posts/:id/like`, `DELETE /api/posts/:id/like` : réactions.
- `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments` : commentaires.
- `POST /api/users/:id/follow`, `DELETE /api/users/:id/follow` : abonnements.

## Vérification et limites

Le Worker et son adresse Pages ont été déployés. Un parcours isolé avec deux comptes fictifs a couvert la connexion, une publication, sa réception, les réactions, les commentaires, l’envoi et la lecture d’une image, ainsi que les autorisations de suppression et les requêtes par plage. Les parcours avec les comptes de collaborateurs réels restent à vérifier.

Restent à développer ou renforcer : le direct vidéo et son chat, la modération centralisée depuis Tower, les notifications, les profils enrichis, la pagination, la protection anti-abus et les tests de charge. Les liens vers WarLike Mail et Chat ne constituent pas une messagerie Internet ni une intégration de leurs données dans Online.

Pour exécuter les tests locaux d’authentification :

```sh
node --test worker/tests/auth.test.mjs
```

Ne placer aucun mot de passe, jeton ou secret dans le dépôt.
