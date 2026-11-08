# WarLike Online

Application sociale indépendante : fil de publications, photos et vidéos, commentaires, mentions J'aime, profil modifiable et espace WarLike Périscope.

## État
La première version fonctionne **localement dans le navigateur**. Les métadonnées sont enregistrées dans localStorage et les médias dans IndexedDB. Les comptes, médias et interactions **ne sont pas partagés entre appareils ou utilisateurs**. Le streaming Périscope n'est pas encore fonctionnel.

## Hébergement
Déployable sur Cloudflare Pages à partir de ce dépôt : framework **None**, commande de build vide, répertoire de sortie **/**, fichier d'entrée `index.html`.

## Étapes suivantes
- WarLike Keys : authentification et sessions
- WarLike Server : API, stockage R2 des médias et base D1 des publications et relations
- WarLike Tower : modération, signalements, contrôle d'accès
- WarLike LIVE : streaming en direct, chat temps réel et replay
- Tests fonctionnels et sécurité avant une mise en production multiutilisateur

Aucune dépendance à Base44 n'est nécessaire pour cette version.
