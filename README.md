# WarLike Online

Réseau social indépendant, déployable sur Cloudflare Pages et utilisant les comptes WarLike Server. Les utilisateurs connectés peuvent publier du texte, une image ou une courte vidéo (10 Mo maximum), consulter le fil, réagir et commenter. WarScope choisit une publication du fil pour la découverte. Le propriétaire ou l'auteur peut retirer une publication.

## État et limites

- Les publications sont réservées aux utilisateurs connectés. Les médias ne sont pas publics : ils passent par une route authentifiée.
- La découverte porte sur les 50 publications les plus récentes, sans système de recommandation ni abonnements.
- Les formats acceptés sont JPEG, PNG, WebP, MP4 et WebM. Il n'y a pas d'encodage vidéo, de direct, de stories ni d'appels.
- Le retrait est logique : l'enregistrement et le média restent dans le stockage pour l'administration ; une politique de suppression définitive reste à développer.
- La modération centralisée depuis Tower, la protection anti-abus distribuée, les notifications et les profils enrichis restent à développer.
- Les messages Mail et Chat restent indépendants. Un test réel avec deux comptes est encore requis.

## Déploiement

Cloudflare Pages doit compiler `functions/`, avec les liaisons `ONLINE_DB` (D1), `MEDIA` (R2) et `WARLIKE_SERVER` (service vers `warlike-server-runtime`). Appliquer `migrations/0001_online.sql` à une base dédiée. Ne pas mettre de mots de passe, jetons ou clés dans le dépôt.

Vérification locale : `node --test tests/online.test.mjs`. La connexion utilise l'identifiant WarLike ; les comptes temporaires doivent d'abord être personnalisés dans WarLike Server.
