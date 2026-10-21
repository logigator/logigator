# Journal des modifications

Toutes les modifications notables de Logigator sont consignées ici. La version
la plus récente est indiquée en premier.

## [Unreleased]

**Tout le site a été reconstruit** pour aller avec l'éditeur, et la
documentation se trouve désormais directement sur le site. Dans l'éditeur, les
fils signalent les signaux contradictoires dès qu'ils apparaissent, et une
manette, un clavier et un terminal permettent à vos circuits de recevoir des
entrées et d'afficher du texte pendant la simulation.

### ✨ Ajouté

- **🌐 Un logigator.com reconstruit.** Une nouvelle page d'accueil et des pages
  repensées partout, la documentation et le journal des modifications
  directement sur le site, et tous les exemples refaits, dont cinq nouveaux, pour
  que chaque composant intégré apparaisse dans au moins l'un d'eux.
- **🟠 La mise en évidence des conflits.** Pendant la simulation, un fil dont les
  sorties se contredisent devient désormais orange, pour qu'un court-circuit se
  voie dès qu'il se produit. Le fil compte toujours comme 1 tant qu'au moins une
  sortie y envoie 1. Elle est activée par défaut, un conseil l'explique
  la première fois, et le réglage « Mettre en évidence les conflits » la
  désactive.
- **🎮 Manette, clavier et terminal.** Jouez avec un circuit sur une manette à
  l'écran, avec vos propres touches ou une vraie manette, même à deux. Tapez-y
  en direct ou collez un texte entier, et regardez-le écrire sur un terminal
  pendant la simulation.
- **🔗 Des pages pour les liens partagés.** Un lien partagé ouvre une page qui
  montre le circuit, son auteur et ses étoiles, prête à l'ouvrir dans l'éditeur
  ou à en garder votre propre copie. Collé dans une discussion, il s'affiche
  comme une carte avec votre circuit, et vous pouvez l'intégrer dans d'autres
  pages.
- **🔒 Des projets et composants privés.** En plus de « Toute personne avec le
  lien » et « Tout le monde », « Vous uniquement » garde un document pour vous.
  Son lien reste le même quel que soit votre choix, pour que vous puissiez le
  repartager plus tard.
- **Plus à découvrir dans la communauté.** Parcourez par tendance, désormais le
  tri par défaut, cherchez dès la saisie, et trouvez sur le profil d'un membre
  une présentation, un site web et des liens, ainsi que les étoiles récoltées
  par ses créations. Un projet ou un composant publié sans contenu reste hors
  des listes.
- **Des descriptions mises en forme.** Gras, listes, liens et plus encore dans
  les descriptions et les profils, modifiés directement sur place. Les
  descriptions des composants intégrés dans l'éditeur en profitent aussi.
- **Une vue en direct de la RAM.** Touchez une RAM pendant la simulation pour
  suivre son contenu dans une vue hexadécimale qui suit l'adresse lue.
- **De l'aide là où vous en avez besoin.** Fenêtres et dialogues ont un bouton
  d'aide qui ouvre la bonne section, chaque réglage s'explique à côté de son
  interrupteur, et la documentation réécrite décrit chaque composant et a une
  page pour les téléphones et tablettes.
- **Un bouton qui reste allumé tant que vous le maintenez.** Le bouton qui envoie
  une seule impulsion s'appelle désormais bouton à impulsion.
- **L'export d'images en WebP sans perte**, là où votre navigateur le prend en
  charge. Le WebP n'est proposé que là où votre navigateur sait l'écrire.
- « S'inscrire » à côté de « Se connecter » dans le menu du compte de
  l'éditeur.
- Un avertissement quand votre navigateur est plus ancien que ceux avec lesquels
  l'éditeur est testé.

### 🔄 Modifié

- **Des composants plus proches des vrais.** Une nouvelle horloge produit un
  signal carré, à 1 aussi longtemps qu'à 0, si bien qu'un cycle dure deux fois
  son retard. Une nouvelle RAM affiche le mot adressé immédiatement.
  L'impulsion et la lecture sur l'horloge restent disponibles en option. Un
  nouveau démultiplexeur prend d'abord ses lignes de sélection, et un nouvel
  encodeur indique si une entrée est active. Les circuits enregistrés
  auparavant fonctionnent comme avant.
- **⚡ Les grands circuits s'ouvrent plus vite et défilent sans à-coups.** Les
  parties du plan que vous ne voyez pas ne sont plus préparées d'avance : les
  grands circuits apparaissent plus tôt et suivent votre écran quand vous les
  déplacez, même en zoom arrière.
- **Les grands circuits s'enregistrent plus vite et prennent bien moins de
  place**, dans le cloud comme dans votre navigateur.
- **Un seul réglage de vitesse.** Un même bouton choisit « Chaque image », une
  vitesse fixe jusqu'à 10 MHz ou « Aussi vite que possible », et indique la
  fréquence de chaque horloge du plan.
- **Un zoom fluide.** La molette de la souris et le pavé tactile zooment en
  douceur sous le pointeur, et le bouton du milieu de la souris déplace le plan
  aussi bien que le bouton droit.
- **Une palette groupée par fonction** : portes logiques, entrées, sorties,
  additionneurs et sélecteurs, mémoire et temporisation. Les catégories que vous
  repliez le restent.
- Un composant en cours de placement est centré sous le pointeur.
- L'interrupteur des conseils se trouve avec les autres réglages de l'éditeur,
  et le désactiver met fin à un tutoriel en cours.
- Un compte dont l'adresse e-mail n'est pas confirmée dans les 90 jours est
  supprimé.
- **Des Nouveautés plus lisibles.** Dans la fenêtre Nouveautés de l'éditeur,
  chaque version commence désormais par son numéro et une date écrite en toutes
  lettres dans votre langue.

### 🗑️ Supprimé

- Les liens vers l'ancien éditeur dans le menu Aide et la fenêtre de rapport de
  bug. L'ancien éditeur prend sa retraite avec cette version.
- La page de téléchargement de l'ancienne application de bureau.

### 🐛 Corrigé

- Une entrée inversée sur une LED ou un affichage à segments inverse désormais
  ce qu'ils affichent, et les entrées, sorties et tunnels n'acceptent plus une
  inversion qui restait sans effet.
- Annuler ou rétablir l'inversion d'un port s'affiche immédiatement.
- Un texte se sélectionne d'un clic sur ses caractères, et les exports d'image
  l'incluent en entier.
- Une entrée ou une sortie nouvellement placée ou collée devient le dernier
  port de son type au lieu du premier.
- Le premier retour arrière après l'ouverture de l'éditeur le quitte au lieu de
  rester sur la même page.
- Copier, coller ou simuler un très grand circuit n'échoue plus.
- « Modifier le contenu » fonctionne sur une ROM en cours de placement, et ce
  que vous saisissez est placé avec elle.
- Les composants et les projets téléversés depuis votre navigateur reçoivent un
  aperçu au lieu d'une image par défaut.
- Un conseil qui apparaît pendant qu'un autre est affiché attend son tour au
  lieu d'être sauté.
- Une matrice de LED à l'intérieur d'un composant personnalisé s'allume désormais
  dans sa surveillance.

### 🔒 Sécurité

- Changer d'adresse e-mail demande votre mot de passe, et un nouveau mot de
  passe vous déconnecte de vos autres appareils.
- Demander la réinitialisation du mot de passe ne révèle plus si une adresse a
  un compte.

## [2.2.0] - 2026-09-17

### ✨ Ajouté

- **Sélections que vous pouvez compléter.** Maintenez Ctrl — ⌘ sur un Mac — et
  un clic ajoute à la sélection le composant ou le fil sous le pointeur, ou l'en
  retire, tandis qu'un cadre de sélection ajoute ce qu'il couvre à ce que vous
  aviez déjà. La touche est réassignable dans les raccourcis, à côté de « Couper
  les fils au bord de la sélection ».
- **Sélection dans l'Outil fil.** Un appui qui n'atteint ni un port ni une
  jonction sélectionne désormais le plus petit élément sous le pointeur, pour le
  supprimer, le copier ou le déplacer sans changer d'outil.
- **Sélections déplaçables avec l'outil Déplacement.** Faire glisser la
  sélection actuelle la déplace au lieu de déplacer le plan de travail ; partout
  ailleurs, l'appui déplace la vue comme avant. Le nouveau réglage « Faire
  glisser la sélection en mode Déplacement » le désactive.

### 🐛 Corrigé

- Un double clic avec l'Outil fil annule l'appui qu'il répète : un double clic
  sur un port trace le fil que vous visiez et ne laisse aucune bulle d'inversion
  isolée.
- Un clic dans l'espace vide à l'intérieur de votre sélection ne l'efface plus.
- Les menus longs et leurs sous-menus défilent au lieu de dépasser sous le bas de
  la fenêtre sur un petit écran.
- Sur les plateformes Apple avec des navigateurs basés sur Chromium, ⌘ est
  reconnu là où Ctrl était affiché auparavant.

## [2.1.3] - 2026-09-16

### 🐛 Corrigé

- Une simulation n'échoue plus au démarrage lorsque le réglage numérique d'un
  composant contient une décimale, comme un retard d'horloge de 1,9, ou dépasse
  ce que la simulation accepte. Un circuit enregistré ainsi se charge avec la
  valeur arrondie et plafonnée, et s'enregistre ensuite sous forme de nombre
  entier.
- Placer un composant personnalisé conserve désormais la direction et les options
  définies dans le panneau des paramètres, au lieu de toujours le déposer dans la
  même orientation et de les ignorer.
- Un composant que vous êtes sur le point de placer peut être tourné avant d'être
  déposé : appuyez sur R ou Shift+R, ou utilisez les boutons de rotation de la
  barre d'outils. Un placement que vous faites déjà glisser tourne aussi, et le
  prochain composant de ce type démarre dans la direction dans laquelle vous avez
  tourné celui-ci.

## [2.1.2] - 2026-09-10

### 🐛 Corrigé

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

## [2.1.1] - 2026-08-31

### 🐛 Corrigé

- L'éditeur s'ouvre désormais dans la langue et le thème que vous utilisez sur le
  reste de Logigator, et changer l'un ou l'autre depuis l'éditeur le modifie sur
  tout le site.
- Lors d'une première visite, l'éditeur choisit sa langue parmi toutes les langues
  demandées par votre navigateur, et non plus seulement la première.

## [2.1.0] - 2026-08-06

### ✨ Ajouté

- **Mise à jour en une étape des composants obsolètes.** Mettez à jour toutes
  les instances placées d'un composant personnalisé obsolète en une seule fois,
  depuis le panneau des paramètres. La palette signale les composants dont les
  instances placées ne sont plus à jour.
- **Aperçu de l'intérieur des composants partagés.** Ouvrez les composants
  personnalisés intégrés à un circuit partagé, en lecture seule. Rien n'est
  ajouté à votre bibliothèque.

### 🔄 Modifié

- Le collage ne nécessite plus de sélection sur téléphone et tablette, et les
  éléments collés arrivent sous le curseur au lieu de l'endroit d'où ils ont été
  copiés.
- Le panneau Ports est désormais en tête de la barre latérale pendant l'édition
  d'un composant personnalisé.

### 🐛 Corrigé

- Cliquer sur un interrupteur ou un bouton pendant que la simulation démarrait
  encore faisait planter la simulation.
- Ouvrir un autre projet pendant qu'une simulation tournait faisait planter la
  simulation.
- Cliquer à l'intérieur d'un collage flottant mais entre ses composants annulait le
  collage au lieu de le saisir.
- Les infobulles et les popovers près du bord de l'écran pointaient leur flèche à
  côté de l'élément auquel ils sont rattachés.

## [2.0.0] - 2026-08-04

Logigator a été **entièrement reconstruit** — un moteur de rendu amélioré, un
pipeline de rendu bien plus efficace, une interface moderne
et une vague de nouvelles fonctionnalités. Tout ce sur quoi vous comptiez est
toujours là, désormais plus rapide, plus robuste et plus simple à utiliser, avec
en prime de grandes nouveautés.

### ✨ Ajouté

- **📱 Prise en charge complète des téléphones et tablettes.** L'éditeur est
  désormais entièrement responsive et adapté au tactile, avec déplacement et
  zoom multi-touch — construisez des circuits n'importe où, pas seulement à un
  bureau.
- **⛔ Entrées et sorties inversées.** Inversez un signal directement au niveau du
  port d'un composant — sans porte NON séparée à placer et à câbler — pour des
  circuits plus propres et plus compacts.
- **💾 Enregistrement local sans compte.** Conservez vos projets et composants
  personnalisés sur votre propre appareil et reprenez-les à tout moment. Quand
  vous êtes prêt, téléversez-les vers le cloud en un clic et Logigator emporte
  avec eux chaque composant personnalisé dont ils dépendent.
- **♾️ Un plan de travail infini dans toutes les directions.** Construisez depuis
  l'origine dans le sens que vous voulez — à gauche, à droite, vers le haut, vers
  le bas. L'ancien éditeur n'avait que des coordonnées positives, si bien que
  l'origine formait un mur infranchissable au-delà duquel rien ne pouvait être
  placé ; désormais le plan grandit simplement avec votre circuit.
- **🧩 Des projets autonomes.** Chaque projet emporte désormais sa propre copie
  des composants personnalisés qu'il utilise, de sorte qu'il s'ouvre, s'affiche
  et se simule toujours — même hors ligne ou si le composant d'origine a
  disparu. Un composant manquant se restaure dans votre bibliothèque en une
  étape.
- **🗺️ Minicarte.** Un aperçu en direct de tout votre circuit vous permet de vous
  repérer d'un coup d'œil dans les grandes conceptions.
- **Rotation de sélections entières** — composants et fils ensemble — par pas de
  90°, dans le sens horaire ou antihoraire ; un placement en collision reste
  flottant jusqu'à ce que vous le déposiez à un endroit valide.
- **Déplacement aux touches fléchées** pour les sélections, d'une unité de
  grille par appui.
- **Un retour clair sur les collisions** — les composants et fils deviennent rouges
  lorsqu'un placement, un glisser ou une rotation chevaucherait quelque chose, de
  sorte que les positions invalides sautent aux yeux.
- **Un nouveau format de fichier, avec des fichiers `.lgix` compressés.** Les
  fichiers des versions précédentes s'ouvrent toujours et sont mis à niveau au
  chargement.
- **Gestion des projets et composants dans l'éditeur** — renommez et supprimez
  vos projets et composants personnalisés enregistrés directement depuis la
  boîte de dialogue d'ouverture et la bibliothèque, au lieu de passer par le
  centre de compte sur le site web.
- **Attribution des forks** — un circuit copié se souvient de son origine, même
  après un téléchargement et un nouveau téléversement, afin que les créateurs
  d'origine restent crédités.
- Un **tutoriel pratique** qui vous fait placer et câbler de vrais composants.
  Il avance dès que vous terminez une étape, se déroule sur son propre plan de
  travail pour que votre travail reste intact, et fonctionne au bureau comme au
  tactile.
- Des **conseils au bon moment** qui se déclenchent la première fois que vous
  atteignez une situation pertinente (câblage, simulation, collage, et plus encore),
  chacun renvoyant vers la documentation.
- Un **rapport de bug intégré à l'éditeur** qui joint automatiquement les
  détails nécessaires pour retrouver un problème : il vous suffit de décrire ce
  qui s'est passé.
- Cette page **Nouveautés**, accessible à tout moment depuis **Aide → Nouveautés**,
  avec un court résumé qui s'ouvre automatiquement la première fois que vous chargez
  une nouvelle version.

### 🔄 Modifié

- **⚡ Des fondations reconstruites.** Le pipeline de rendu, le moteur de simulation
  et le système de collision ont tous été reconstruits de zéro : un rendu graphique
  accéléré par GPU garde les grands circuits fluides, un nouveau cœur de
  simulation pilote la logique, et un système de collision plus robuste rend
  l'édition bien plus stable et moins sujette aux bugs.
- Interface rafraîchie et cohérente à travers les menus, boîtes de dialogue,
  panneaux et notifications, avec un plan de travail latéral repensé.
- **Bascule instantanée entre thème clair et sombre** — sans rechargement de
  page, là où l'ancien éditeur n'appliquait le changement qu'après un
  rechargement.
- **Une grille qui marque les points de connexion** : les points de la grille se
  situent désormais exactement là où les fils, les extrémités de port et les
  jonctions aboutissent, de sorte que les fils passent par les points au lieu de
  passer entre eux.
- Un **jeu d'outils plus simple et unifié** : un seul outil fil trace les fils
  et, d'un appui, relie, sépare ou inverse les connexions ; la sélection exacte
  fait partie de l'outil de sélection ; et le déplacement a son propre outil.
- **Des mises à jour de composants selon vos conditions.** Lorsqu'une version
  plus récente d'un composant personnalisé est disponible, l'éditeur la signale
  et vous laisse mettre à jour les instances placées quand vous le décidez, au
  lieu que toutes les copies changent dès que le composant est modifié.
- Une **documentation intégrée restructurée**, en sections reliées entre elles,
  affichée dans une fenêtre sur ordinateur et en plein écran sur téléphone.
