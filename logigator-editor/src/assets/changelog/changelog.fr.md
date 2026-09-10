# Journal des modifications

Toutes les modifications notables de l'éditeur Logigator sont consignées ici. La
version la plus récente est indiquée en premier.

## 2.1.2 — 2026-09-10

### Correctifs

- La rotation d'un téléphone ou d'une tablette ne fait plus planter l'éditeur.
- Réparer les fils pendant une simulation ne fait plus planter l'éditeur. La
  simulation est arrêtée au préalable.
- Un lien de partage vers un composant personnalisé l'ouvre désormais comme vos
  propres composants : nommé dans la barre de titre et prêt à être cloné vers
  vos composants.
- Revenir en arrière avec le bouton du navigateur ne laisse plus les menus, les
  listes déroulantes et les bulles du tutoriel bloqués.
- Les liens dans l'aide et le journal des modifications de l'éditeur mènent
  désormais au bon titre dans toutes les langues.
- Là où deux extrémités de ports se rejoignent, un appui avec l'outil fil
  inverse désormais le port du côté où vous avez appuyé, et non celui d'en face.
- L'éditeur reste utilisable lorsqu'un déplacement ou un collage ne peut pas
  aboutir.

## 2.1.1 — 2026-08-31

### Correctifs

- L'éditeur s'ouvre désormais dans la langue et le thème que vous utilisez sur le
  reste de Logigator, et changer l'un ou l'autre depuis l'éditeur le modifie sur
  tout le site.
- Lors d'une première visite, l'éditeur choisit sa langue parmi toutes les langues
  demandées par votre navigateur, et non plus seulement la première.

## 2.1.0 — 2026-08-06

### Fonctionnalités

- **Mettre à jour toutes les instances** d'un composant personnalisé obsolète en
  une seule étape, depuis le panneau des paramètres. La palette signale les
  composants dont les instances placées ne sont plus à jour.
- **Voir le contenu** des composants personnalisés intégrés à un circuit partagé,
  en lecture seule. Rien n'est ajouté à votre bibliothèque.
- Le collage ne nécessite plus de sélection sur téléphone et tablette, et les
  éléments collés arrivent sous le curseur au lieu de l'endroit d'où ils ont été
  copiés.
- Le panneau Ports est désormais en tête de la barre latérale pendant l'édition
  d'un composant personnalisé.

### Correctifs

- Cliquer sur un interrupteur ou un bouton pendant que la simulation démarrait
  encore faisait planter la simulation.
- Ouvrir un autre projet pendant qu'une simulation tournait faisait planter la
  simulation.
- Cliquer à l'intérieur d'un collage flottant mais entre ses composants annulait le
  collage au lieu de le saisir.
- Les infobulles et les popovers près du bord de l'écran pointaient leur flèche à
  côté de l'élément auquel ils sont rattachés.

## 2.0.0 — 2026-08-04

Logigator a été **entièrement reconstruit** — un moteur de rendu amélioré, un
pipeline de rendu bien plus efficace, une interface moderne
et une vague de nouvelles fonctionnalités. Tout ce sur quoi vous comptiez est
toujours là, désormais plus rapide, plus robuste et plus simple à utiliser, avec
en prime de grandes nouveautés.

### ✨ Points forts

- **⚡ Des fondations reconstruites.** Le pipeline de rendu, le moteur de simulation
  et le système de collision ont tous été reconstruits de zéro : un rendu graphique
  accéléré par GPU garde les grands circuits fluides, un nouveau cœur de
  simulation pilote la logique, et un système de collision plus robuste rend
  l'édition bien plus stable et moins sujette aux bugs.
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
- **♾️ Un plan de travail infini dans toutes les directions.** Construisez depuis
  l'origine dans le sens que vous voulez — à gauche, à droite, vers le haut, vers
  le bas. L'ancien éditeur n'avait que des coordonnées positives, si bien que
  l'origine formait un mur infranchissable au-delà duquel rien ne pouvait être
  placé ; désormais le plan grandit simplement avec votre circuit.
- **🧩 Des projets autonomes.** Chaque projet intègre désormais une copie figée des
  composants personnalisés qu'il utilise, de sorte qu'il s'ouvre, s'affiche et se
  simule toujours — même hors ligne ou si le composant d'origine a disparu. Mettez
  à jour les composants placés vers la dernière version quand vous le décidez, au
  lieu de voir toutes les copies changer d'un coup.
- **🗺️ Minicarte.** Un aperçu en direct de tout votre circuit vous permet de vous
  repérer d'un coup d'œil dans les grandes conceptions.

### Sous le capot

- Rendu mis à niveau vers **PixiJS 8**, enveloppé dans un pipeline de rendu bien
  plus efficace — la scène est découpée en groupes de rendu GPU et élaguée via le
  quad tree — pour que le déplacement, le zoom et l'édition restent fluides sur
  les grands circuits.
- **Moteur de simulation reconstruit** — un nouveau cœur WebAssembly, compilé
  depuis Rust, remplace l'ancien moteur de simulation
  ([`@logigator/sim`](https://www.npmjs.com/package/@logigator/sim)).
- **Système de collision réécrit** — les vérifications spatiales s'exécutent
  désormais sur un quad tree à taille de chunk variable, rendant le placement et la
  collision lors du glisser plus stables et bien moins sujets aux bugs.
- **Espace de coordonnées non borné** — ce même quad tree porte le plan de travail
  infini : sa racine double vers l'élément que vous placez et s'étend dans
  l'espace négatif tout aussi volontiers que dans le positif, si bien que le plan
  n'a ni coin d'origine ni étendue fixe. L'ancien éditeur conservait les éléments
  dans un tableau de chunks indexé positivement et refusait aussi bien les chunks
  que les placements aux coordonnées négatives.

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
