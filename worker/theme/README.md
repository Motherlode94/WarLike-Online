# Thème du Worker WarLike

Le module `worker.js` applique le thème commun au HTML par HTMLRewriter, sans modifier les réponses API, cookies ni politique CSP. Les couleurs sont embarquées localement dans `theme.js` ; `theme.css` permet la prévisualisation et la réutilisation.

Le Worker de production a été mis à jour explicitement. Une mise à jour du site Pages seule ne publie pas ce Worker.

Le module de base est importé depuis `../src/index.js`. Les assets sont conservés ; les routes HTML passent par le Worker pour recevoir le thème.
