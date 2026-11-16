# Persistance Online + Transcribe (branche de développement)

## WarLike Online
- Migration `worker/migrations/0003_saved_posts.sql` : signets privés liés à l'utilisateur authentifié. Routes `GET /api/bookmarks`, `POST/DELETE /api/posts/:id/bookmark`.
- Interface « Enregistrés ». Le contenu des posts, les commentaires et les médias continuent d'utiliser la base `warlike-online` et R2 existants.
- Déployer la migration sur la base **Online uniquement** après tests : `cd worker && npx wrangler d1 migrations apply warlike-online --remote`.
- Tester suppression des publications avec signets, changement de compte, révocation, media R2, quota et pagination.

## WarLike Transcribe
- Migration `tools/transcribe/migrations/0001_projects.sql` sur une **nouvelle base D1 dédiée** (ne pas utiliser la base des quotas de transcription ni celle d'Online).
- Worker `tools/transcribe/runtime/worker.js` : routes de connexion WarLike Server privées + API propriétaire de projets. Données transcrites stockées dans D1 uniquement à la demande. Suppression et mises à jour protégées par `owner_member_id` et `revision`.
- `TRANSCRIBE_DB` = binding D1 dédié ; `TRANSCRIBE_BUCKET` = bucket R2 privé pour les **fichiers audio opt-in** ; `WARLIKE_SERVER` = service binding vers `warlike-server-runtime`. Conserver `AI`, `DB` (quotas), `ASSETS` existants.
- Le formulaire « Mes projets privés » est inséré via HTMLRewriter et le client servi sous `/projects.js`. Le bouton « Sauvegarder le texte » n'envoie **jamais** automatiquement l'audio ; le téléversement audio doit être déclenché séparément.
- Les routes `/api/auth/login`, `logout`, `me` délèguent au Server, conservent seulement le cookie HttpOnly/Secure/SameSite du domaine Transcribe, et relisent chaque session sur le Server. Aucune session personnelle n'est mise en localStorage.
- Limites initiales : 100 projets listés, transcription 250 000 caractères, audio opt-in 20 Mo, conflits de versions 409. Contrôler la durée de conservation, RGPD, chiffrement côté fournisseur, quotas de stockage et récupération de compte avant exploitation commerciale.
- **Important** : la présente branche ne crée pas automatiquement D1/R2, les bindings ni le déploiement. Il faut créer/identifier les ressources chez Cloudflare, exécuter les migrations en staging et vérifier la liaison privée avant de publier.

## Critères de validation
1. CI : `node --test worker/tests/auth.test.mjs tools/transcribe/tests/projects.test.mjs`.
2. Deux comptes WarLike réels : un utilisateur ne peut pas lire les projets ou signets privés de l'autre.
3. Connexion révoquée : accès refusé immédiatement ; une origine externe ne peut pas écrire.
4. Déclencher une transcription sans sauvegarde ; constater qu'aucun texte/audio n'est enregistré par Transcribe.
5. Sauver texte → actualiser → ouvrir ; ajouter audio séparément → retrouver audio sur deuxième appareil ; supprimer → vérifier D1 et R2.
6. Déployer séparément Worker Transcribe et Worker Online ; `main` ne doit pas être fusionnée tant que les contrôles ne passent pas.
