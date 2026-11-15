# Thème du Worker WarLike

Le module `worker.js` applique le thème commun au HTML par HTMLRewriter, sans modifier les réponses API, cookies ni politique CSP. Les couleurs sont embarquées localement dans `theme.js` ; `theme.css` permet la prévisualisation et la réutilisation.

Le Worker de production a été mis à jour explicitement. Une mise à jour du site Pages seule ne publie pas ce Worker.

Le module de base est le code réellement déployé avant cette modification, conservé sans changement ; son empreinte est dans `baseline.sha256`. Pour modifier le comportement de l’application, synchroniser la source et ce module avant de republier.
