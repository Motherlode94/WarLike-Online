# WarLike Transcribe — v2

Service indépendant de conversion audio → texte, installé sous `tools/transcribe/` dans le dépôt WarLike Online.

**Site Worker :** https://warlike-transcribe.warlikeofficiel.workers.dev/

## Fonctionnalités livrées

- Import MP3, WAV, OGG, WEBM, M4A/MP4 et enregistrement micro (navigateur compatible).
- Décodage et rééchantillonnage **locaux** via Web Audio : PCM WAV mono à 16 kHz, segments de **25 secondes** (environ 800 Ko chacun).
- Transcription réelle segment par segment via Workers AI `@cf/openai/whisper-large-v3-turbo`. Jusqu'à **30 segments = 12 min 30 s** pour une tâche ; dépend du quota disponible.
- Réassemblage progressif du texte, bouton d'annulation et conservation du résultat partiel si l'opération est interrompue.
- Choix de la langue ou autodétection ; correction du résultat dans l'éditeur.
- Sous-titres VTT/SRT si et seulement si Whisper renvoie des horodatages. Les horodatages de chaque segment sont décalés de sa position dans l'audio source ; pas d'horodatages fictifs.
- Export TXT, VTT, SRT et fichier projet JSON (métadonnées, texte et sous-titres), compatible avec un futur import WarLike Monteur.
- Lecture audio avec accès direct à la seconde choisie.
- Quota D1 atomique : maximum 30 requêtes par heure et par IP ; audio de chaque requête limité à 8 Mo.
- Audio/transcription non conservés dans le stockage du service ; le traitement est effectué dans Cloudflare Workers AI.

## Architecture et déploiement

- `worker.js` fournit `POST /api/transcribe?lang=fr` et `GET /api/health`.
- `index.html` et `app.js` fournissent l'interface.
- Le Worker Cloudflare déployé rassemble ces fichiers et sert le JS via `/app.js`. Il utilise les bindings `AI` et `DB`.
- Base D1 `warlike-transcribe-ratelimits`, contenant la table `limits` ; juridiction UE.
- Toute modification des fichiers du dépôt doit être suivie d'un **nouveau déploiement du Worker** : il n'y a pas de synchronisation GitHub automatique.

## Limitations et sécurité

La transcription automatique peut se tromper sur des termes techniques, les chevauchements de voix ou le bruit. Les vrais horodatages VTT dépendent de la réponse du modèle, et la séparation automatique des intervenants n'est pas encore implémentée. Les enregistrements volumineux doivent pouvoir être décodés par le navigateur : l'utilisation de la mémoire augmente avec la durée de l'audio, particulièrement sur mobile. Le quota de 30 segments par heure s'applique à l'ensemble des personnes partageant la même IP. Le traitement consomme des ressources Workers AI et peut occasionner des coûts au compte Cloudflare.

Les adresses IP ne sont pas stockées en clair : seuls des identifiants dérivés du hachage IP+heure sont sauvegardés dans D1. Prévoir une purge périodique des anciens compteurs. L'upload n'est accepté que depuis l'origine du site dans les navigateurs et après vérification des signatures de fichiers, mais un contrôle d'origine ne remplace pas l'authentification pour une offre publique à grande échelle.

## Validation

Cloudflare confirme le déploiement et l'activation du sous-domaine. Les bindings AI et D1 sont présents et le trafic est affecté à 100 % au dernier déploiement. La réponse HTTP externe du site et un essai d'inférence avec un échantillon vocal ne sont **pas confirmés** par l'environnement d'exécution.

### Parcours de validation manuelle

1. Ouvrir le site, sélectionner un court fichier MP3 ou WAV contenant une phrase intelligible.
2. Cliquer sur « Transcrire l'audio » et contrôler que le texte correspond à la voix.
3. Modifier le texte et télécharger le fichier TXT.
4. Tester un audio supérieur à 25 secondes pour vérifier l'assemblage des segments.
5. Vérifier l'export VTT/SRT seulement si des horodatages sont fournis.
6. Enregistrer un mémo micro avec autorisation utilisateur, tester le bouton « Annuler » et le quota.
