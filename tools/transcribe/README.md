# WarLike Transcribe

Application indépendante de transcription audio vers texte, code source dans ce dépôt sous `tools/transcribe/`.

**Worker Cloudflare :** https://warlike-transcribe.warlikeofficiel.workers.dev/

## Fonctions
- Fichiers MP3, WAV, OGG, WEBM et M4A/MP4 : 8 Mo maximum par fichier
- Enregistrement depuis le microphone, quand le navigateur le permet et après autorisation
- Transcription multilingue via Cloudflare Workers AI / `@cf/openai/whisper-large-v3-turbo`
- Texte modifiable, copie et téléchargement TXT
- Export VTT et conversion SRT uniquement si le modèle renvoie des horodatages
- Quota atomique D1 : maximum 5 transcriptions par heure par connexion IP
- Aucun stockage persistant des fichiers audio ni des transcriptions dans WarLike Transcribe

## Architecture
- `worker.js` : API `POST /api/transcribe?lang=fr` ; vérification de l'origine, du format, de la taille et du quota
- `index.html` : interface responsive, upload, préécoute, micro, transcription et exports
- `GET /api/health` : disponibilité API (ne teste pas directement l'inférence du modèle)
- Base D1 dédiée : `warlike-transcribe-ratelimits`, binding `DB`
- Binding `AI` pour Workers AI ; aucune clé API exposée dans le navigateur

Le Worker actuellement publié contient l'HTML embarqué dans la réponse du code déployé ; pour maintenir le service, republier le contenu de `worker.js` avec l'interface `index.html`, ou passer au binding de ressources statiques du Worker. Les fichiers de ce dossier sont la source versionnée, pas un déploiement GitHub automatique.

**Limites :** la transcription de fichiers longs nécessite un pipeline de découpage ; le moteur peut mal reconnaître certains accents, langues ou enregistrements. Le système n'ajoute pas de faux horodatages si les segments ne sont pas disponibles. Le compteur D1 conserve un identifiant dérivé d'une adresse IP et de l'heure, sans conserver l'adresse brute, et nécessite une purge périodique des anciennes heures. Les données sont transmises à Cloudflare Workers AI pour l'inférence : demander l'autorisation des personnes enregistrées.

## Vérifications
- Code Worker et script navigateur : syntaxe JS contrôlée.
- Cloudflare API : déploiement confirmé et sous-domaine `workers.dev` activé.
- **Transcription réelle / test HTTP du domaine : à confirmer**. La résolution DNS du domaine depuis l'environnement d'exécution n'était pas disponible au moment du déploiement.

## Projet GitHub séparé
Ce dossier reste dans `WarLike-Online` tant qu'un dépôt indépendant `WarLike-Transcribe` n'est pas créé ; cela ne lie pas l'authentification de l'application à WarLike Online.
