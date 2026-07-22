# Plan de travail et outils

Le plan de travail est la grille sur laquelle vous construisez votre circuit. Cette page explique comment vous y déplacer et comment fonctionne chaque outil d'édition.

![Le plan de travail avec un petit circuit dessus, la barre d'outils au-dessus montrant les cinq outils — déplacement, fil, sélection, gomme et texte — avec l'outil actif mis en évidence.](images/board-and-tools/board-and-tools.png)

## Se déplacer sur le plan de travail

- **Zoom** — faites défiler la molette de la souris sur le plan de travail, ou pincez sur un appareil tactile. Vous pouvez aussi utiliser les boutons de zoom de la barre d'outils, **Affichage → Zoom avant / Zoom arrière**, ou **Affichage → Zoom 100 %** pour revenir à la taille réelle.
- **Déplacement** — choisissez l'outil **Déplacement** (la main) et faites glisser. Vous pouvez aussi vous déplacer depuis _n'importe quel_ outil en faisant glisser avec le **bouton droit de la souris**, si bien que vous n'avez que rarement besoin de changer d'outil juste pour repositionner la vue.
- **Tactile** — faites glisser avec deux doigts pour vous déplacer et pincez pour zoomer à tout moment ; un glisser à un doigt ne déplace la vue que lorsque l'outil Déplacement est actif.

La **barre d'état** en bas affiche toujours un bref rappel de ce que fait l'outil actif, ainsi que la position de votre curseur sur la grille.

## Les outils de la barre d'outils

Le groupe de droite de la barre d'outils contient les cinq outils de dessin. Un seul est actif à la fois ; chacun a également un raccourci à une touche.

| Outil           | Raccourci | Ce qu'il fait                                                                                                                                                                     |
| --------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Déplacement** | `P`       | Faites glisser pour déplacer le plan de travail ; faites défiler ou pincez pour zoomer.                                                                                           |
| **Fil**         | `W`       | Faites glisser pour tracer des fils ; touchez un port pour l'inverser, ou touchez un croisement pour connecter ou séparer. Voir [Fils et connexions](docs:wires-and-connections). |
| **Sélection**   | `S`       | Faites glisser un cadre pour sélectionner des éléments ; faites glisser la sélection pour la déplacer.                                                                            |
| **Gomme**       | `E`       | Cliquez ou faites glisser sur les éléments pour les supprimer.                                                                                                                    |
| **Texte**       | `T`       | Placez une étiquette de texte sur le plan de travail.                                                                                                                             |

![Gros plan sur les cinq boutons d'outils de la barre d'outils, chacun étiqueté avec son nom et son raccourci clavier.](images/board-and-tools/tool-buttons.png)

## Placer des composants

Pour ajouter un composant, choisissez-le dans la [palette de composants](docs:components-and-options) à gauche. Un fantôme du composant suit alors votre curseur sur le plan de travail — amenez-le où vous voulez, puis appuyez et relâchez pour le déposer. Le placement reste armé, de sorte que vous pouvez déposer plusieurs fois le même composant à la suite. Appuyez sur `Escape`, ou choisissez un autre outil, pour arrêter le placement.

Un composant ne peut pas être déposé par-dessus un autre élément ; le fantôme montre où il va atterrir.

## Sélectionner, déplacer et faire pivoter

Avec l'outil **Sélection**, faites glisser un cadre par-dessus les éléments souhaités. Tout ce que le cadre touche — composants et fils — devient sélectionné. Pour déplacer une sélection, faites glisser depuis l'intérieur de celle-ci vers un nouvel emplacement.

Une fois quelque chose sélectionné, vous pouvez :

- **Le faire pivoter** — appuyez sur `R` pour le sens horaire, `Shift+R` pour le sens antihoraire, ou utilisez les boutons de rotation de la barre d'outils.
- **Le déplacer** d'un pas de grille à la fois avec les **touches fléchées**.

Comme pour le placement, un déplacement ou une rotation ne se valide que lorsque les éléments atterrissent à un emplacement libre.

## Couper les fils au bord de la sélection

L'outil de sélection possède un mode **ciseaux** qui rogne les fils exactement au bord de votre cadre de sélection, au lieu de saisir des fils entiers. C'est pratique pour découper un fil au milieu d'un bus.

Une petite pastille flotte au-dessus du plan de travail tant que l'outil de sélection est actif — cliquez dessus pour activer le mode ciseaux. Sur bureau, vous pouvez aussi simplement **maintenir `Alt`** pendant que vous faites glisser le cadre de sélection pour couper le temps de ce seul glisser ; la pastille s'allume pour indiquer que le mode est engagé. Tout ce que le cadre contient entièrement reste sélectionné, et les fils qui traversent le bord du cadre y sont coupés.

![L'outil de sélection actif avec la pastille de bascule des ciseaux flottant au-dessus du plan de travail, et un cadre de sélection coupant deux fils à son bord.](images/board-and-tools/scissor-select.png)

## Copier, couper, coller et supprimer

L'édition standard agit sur la sélection en cours :

- **Copier** (`Ctrl+C`) et **Couper** (`Ctrl+X`) placent la sélection dans le presse-papiers ; couper la retire aussi.
- **Coller** (`Ctrl+V`) ramène les éléments copiés, légèrement décalés par rapport aux originaux. Ils arrivent sous forme de fantôme que vous positionnez — faites-les glisser vers un emplacement libre et relâchez pour les déposer, ou appuyez sur `Escape` pour annuler.
- **Supprimer** (`Delete`) retire la sélection.

Ces commandes se trouvent aussi dans la barre d'outils et dans le menu **Édition**. Chaque modification peut être annulée avec **Annuler** (`Ctrl+Z`) et rétablie avec **Rétablir** (`Ctrl+Shift+Z`).

## Effacer

L'outil **Gomme** (la gomme) est le moyen le plus rapide de retirer des éléments : cliquez sur un élément pour le supprimer, ou faites glisser sur plusieurs pour tous les balayer. Appuyez sur `Escape` en cours de glisser pour annuler et restaurer ce que vous avez effacé.

## La minicarte

La minicarte dans le coin inférieur droit montre tout votre circuit d'un coup, avec un cadre marquant la partie que vous visualisez actuellement — utile pour vous repérer sur un grand plan de travail. Réduisez-la avec son bouton de bascule quand vous avez besoin de place.

## Voir aussi

- [Fils et connexions](docs:wires-and-connections) — tracer des fils, jonctions et basculer les connexions
- [Composants et options](docs:components-and-options) — les pièces que vous placez et configurez
- [Raccourcis clavier](docs:shortcuts) — modifier n'importe lequel des raccourcis utilisés ici
