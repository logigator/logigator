# Journal des modifications

Toutes les modifications notables de l'éditeur Logigator sont consignées ici. La
version la plus récente est indiquée en premier.

## 2.0.0 — 2026-07-13

Logigator a été **entièrement reconstruit** — un moteur de rendu amélioré et
compatible WebGPU, un pipeline de rendu bien plus efficace, une interface moderne
et une vague de nouvelles fonctionnalités. Tout ce sur quoi vous comptiez est
toujours là, désormais plus rapide, plus robuste et plus simple à utiliser, avec
en prime de grandes nouveautés.

### ✨ Points forts

- **📱 Conçu pour les téléphones et tablettes.** L'éditeur est désormais
  entièrement responsive et adapté au tactile, avec déplacement et zoom
  multi-touch — construisez des circuits n'importe où, pas seulement à un bureau.
- **⛔ Entrées et sorties inversées.** Inversez un signal directement au niveau du
  port d'un composant — sans porte NON séparée à placer et à câbler — pour des
  circuits plus propres et plus compacts.
- **💾 Enregistrez localement, directement dans votre navigateur.** Conservez vos
  projets et composants personnalisés sur votre propre appareil — sans compte — et
  reprenez-les à tout moment. Quand vous êtes prêt, téléversez-les vers le cloud en
  un clic et Logigator emporte avec eux chaque composant personnalisé dont ils
  dépendent.
- **🧩 Des projets autonomes.** Chaque projet intègre désormais une copie figée des
  composants personnalisés qu'il utilise, de sorte qu'il s'ouvre, s'affiche et se
  simule toujours — même hors ligne ou si le composant d'origine a disparu. Mettez
  à jour les composants placés vers la dernière version quand vous le décidez, au
  lieu de voir toutes les copies changer d'un coup.
- **🗺️ Minicarte.** Un aperçu en direct de tout votre circuit vous permet de vous
  repérer d'un coup d'œil dans les grandes conceptions.
- **⚡ Des fondations reconstruites.** Le pipeline de rendu, le moteur de simulation
  et le système de collision ont tous été reconstruits de zéro : un rendu graphique
  accéléré par WebGPU garde les grands circuits fluides, un nouveau cœur de
  simulation pilote la logique, et un système de collision plus robuste rend
  l'édition bien plus stable et moins sujette aux bugs.

### Sous le capot

- Rendu mis à niveau vers **PixiJS 8**, privilégiant désormais **WebGPU** (avec
  repli sur WebGL, puis Canvas), enveloppé dans un pipeline de rendu bien plus
  efficace — la scène est découpée en groupes de rendu GPU et élaguée via le quad
  tree — pour que le déplacement, le zoom et l'édition restent fluides sur les
  grands circuits.
- **Moteur de simulation reconstruit** — un nouveau cœur WebAssembly, compilé
  depuis Rust, remplace l'ancien moteur de simulation
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Système de collision réécrit** — les vérifications spatiales s'exécutent
  désormais sur un quad tree à taille de chunk variable, rendant le placement et la
  collision lors du glisser plus stables et bien moins sujets aux bugs.

### Éditeur et plan de travail

- Interface rafraîchie et cohérente à travers les menus, boîtes de dialogue,
  panneaux et notifications, avec un plan de travail latéral repensé.
- **Les thèmes clair et sombre basculent instantanément** — sans rechargement de
  page, là où l'ancien éditeur n'appliquait le changement qu'après un rechargement.
- **Faites pivoter des sélections entières** — composants et fils ensemble — par
  pas de 90°, dans le sens horaire ou antihoraire ; un placement en collision reste
  flottant jusqu'à ce que vous le déposiez à un endroit valide.
- **Déplacez les sélections avec les touches fléchées**, d'une unité de grille par
  appui.
- **Un retour clair sur les collisions** — les composants et fils deviennent rouges
  lorsqu'un placement, un glisser ou une rotation chevaucherait quelque chose, de
  sorte que les positions invalides sautent aux yeux.
- **La grille marque les points de connexion** : les points de la grille se
  situent désormais exactement là où les fils, les extrémités de port et les
  jonctions aboutissent, de sorte que les fils passent par les points au lieu de
  passer entre eux.
- Un **jeu d'outils plus simple et unifié** : le tracé des fils et la
  connexion/séparation des jonctions fusionnés en un seul outil fil (faites glisser
  pour tracer, touchez pour basculer une jonction ou l'inversion d'un port), la
  sélection « coupante » aux ciseaux intégrée à l'outil de sélection, et le
  déplacement promu au rang d'outil à part entière.

### Fichiers, composants et partage

- **Stockage local dans le navigateur** (IndexedDB) pour les projets et composants
  personnalisés, avec un téléversement en un clic qui promeut un document — et
  chaque composant personnalisé dont il dépend, les enfants d'abord — vers le cloud.
- Un **format de fichier natif et versionné** doté d'une chaîne de migration qui met
  à niveau les anciens fichiers au chargement (seule la version la plus récente est
  jamais écrite), plus un conteneur compressé **`.lgix`** avec un cadrage par octets
  magiques.
- **Intégration des composants personnalisés reconstruite.** Chaque projet et
  composant personnalisé intègre désormais une copie figée de chaque composant
  personnalisé qu'il utilise — dépendances imbriquées comprises — de sorte qu'un
  circuit s'ouvre, s'affiche et se simule toujours, même lorsque le composant
  d'origine est manquant ou que vous êtes hors ligne. Un composant manquant devient
  modifiable uniquement et peut être restauré dans votre bibliothèque en une étape ;
  le circuit n'est jamais cassé.
- **Des mises à jour de composants selon vos conditions.** Lorsqu'une version plus
  récente d'un composant personnalisé est disponible, l'éditeur la signale et vous
  laisse mettre à jour les instances placées vers la dernière — remplaçant l'ancien
  modèle où modifier un composant changeait toutes les copies d'un coup.
- **Gérez projets et composants dans l'éditeur** — renommez et supprimez vos projets
  et composants personnalisés enregistrés directement depuis la boîte de dialogue
  d'ouverture et la bibliothèque, au lieu de passer par le centre de compte sur le
  site web.
- **Attribution des forks** — la filiation d'un fork est enregistrée dans le fichier
  exporté et ré-résolue au téléversement, afin que les créateurs d'origine restent
  crédités.

### Prise en main et aide

- Un **tutoriel pratique** qui vous fait placer et câbler de vrais composants ; les
  étapes avancent automatiquement en observant l'état du projet en direct, se
  déroulent sur un plan de travail temporaire pour que votre travail reste intact,
  et s'adaptent au bureau comme au tactile.
- Des **conseils au bon moment** qui se déclenchent la première fois que vous
  atteignez une situation pertinente (câblage, simulation, collage, et plus encore),
  chacun renvoyant vers la documentation.
- Une **documentation intégrée restructurée** — une référence organisée en sections,
  accessible par liens profonds, avec des renvois croisés, affichée sous forme de
  boîte de dialogue sur bureau et en plein écran sur écran compact.
- Un **rapport de bug intégré à l'éditeur** qui capture automatiquement les détails
  de l'environnement et les journaux récents de l'éditeur.
- Cette page **Nouveautés**, accessible à tout moment depuis **Aide → Nouveautés**,
  avec un court résumé qui s'ouvre automatiquement la première fois que vous chargez
  une nouvelle version.
