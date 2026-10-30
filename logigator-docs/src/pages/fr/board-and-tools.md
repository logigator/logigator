# Plan de travail et outils

Le plan de travail est la grille sur laquelle vous construisez. Composants et fils s'y alignent, et la barre d'état en bas affiche la position sur la grille sous le curseur.

## Se déplacer {#moving-around}

La molette de la souris et un balayage à deux doigts sur le pavé tactile déplacent le plan ; maintenez `Shift` pour faire défiler la molette de côté. Pour zoomer à l'endroit du pointeur, maintenez `Ctrl` (`⌘` sur Mac) en faisant défiler, ou pincez le pavé tactile. Les boutons de zoom de la barre d'outils et Affichage → Zoom avant, Zoom arrière et Zoom 100 % zooment par paliers fixes.

Vous pouvez aussi déplacer la vue en faisant glisser avec le bouton central de la souris, ou avec le bouton gauche en maintenant `Space`. Cela fonctionne avec tous les outils. Quand l'outil Déplacement est actif, un glisser avec le bouton gauche déplace la vue même sans `Space`.

La minicarte, dans le coin inférieur droit, montre tout le circuit avec un cadre autour de la partie visible. Cliquez ou faites glisser dedans pour y amener la vue. « Masquer la minicarte » la replie, et l'éditeur s'en souvient.

## Outils {#tools}

Un seul outil est actif à la fois. Chacun a un raccourci d'une touche et un bouton dans la barre d'outils, où Sélectionner et Déplacement en partagent un : la flèche à côté choisit l'autre. L'éditeur démarre avec Sélectionner.

| Outil        | Touche | Ce que fait un glisser                                                        |
| ------------ | ------ | ----------------------------------------------------------------------------- |
| Sélectionner | `S`    | Trace un cadre de sélection, ou déplace la sélection si vous commencez dedans |
| Déplacement  | `P`    | Déplace la vue, et rien d'autre                                               |
| Outil fil    | `W`    | Trace un fil (voir [Fils et connexions](docs:wires-and-connections))          |
| Gomme        | `E`    | Supprime tout ce qu'elle traverse                                             |
| Texte        | `T`    | Place une étiquette de texte (un clic suffit)                                 |

Un clic sans glisser sélectionne l'élément sous le pointeur avec Sélectionner et l'outil fil. L'outil fil vérifie d'abord si vous avez touché un port ou un croisement de fils, car un appui dessus inverse ou connecte à la place.

![Les boutons d'outils dans la barre d'outils.](./images/tool-buttons.webp)

## Placer des composants {#placing-components}

Cliquez sur un composant dans la palette et un aperçu suit le curseur. Un clic sur le plan de travail le pose. L'aperçu reste ensuite attaché au curseur, ce qui permet d'en poser plusieurs à la suite. `R` et `Shift+R` tournent l'aperçu avant de le poser, et le composant suivant garde cette orientation.

Rien n'est placé là où l'aperçu chevauche un autre composant. `Escape` ou le choix d'un autre outil arrête le placement.

## Sélectionner et déplacer {#selecting-and-moving}

Avec Sélectionner, tracez un cadre sur les éléments voulus. Chaque composant et chaque fil touché par le cadre est sélectionné. Maintenez `Ctrl` (`⌘` sur Mac) pour modifier la sélection au lieu de la remplacer : un clic ajoute ou retire un élément, et un cadre ajoute ce qu'il couvre. Cela fonctionne aussi avec l'outil fil.

Faites glisser la sélection pour la déplacer. `R` la tourne dans le sens horaire, `Shift+R` dans le sens antihoraire, et les flèches la déplacent d'un pas de grille. Si la sélection atterrit sur autre chose, elle reste soulevée et suit vos mouvements suivants jusqu'à trouver une place libre.

`Escape` agit par étapes. Chaque appui fait la première de ces actions qui s'applique :

1. Annule un glisser en cours.
2. Vide la sélection.
3. Passe à Sélectionner.

## Couper les fils au bord de la sélection {#cutting-wires-at-the-selection-edge}

Normalement, un cadre de sélection prend des fils entiers. En mode découpe, il coupe chaque fil qui traverse son bord et ne sélectionne que les morceaux à l'intérieur, ce qui permet d'extraire une section du milieu d'un bus.

Tant que Sélectionner est actif, un bouton « Couper les fils » flotte en haut du plan de travail et active ou désactive ce mode. Au clavier, vous pouvez aussi maintenir `Alt` en relâchant le cadre pour couper une seule fois.

![Le bouton « Couper les fils » au-dessus d'un fil coupé au bord de la sélection.](./images/scissor-select.webp)

## Copier, coller et supprimer {#copy-paste-and-delete}

Copier (`Ctrl+C`), Couper (`Ctrl+X`), Coller (`Ctrl+V`) et Supprimer (`Delete`) se trouvent dans la barre d'outils et le menu Édition. Les éléments collés apparaissent comme un aperçu sous le curseur, ou au milieu de la vue si le pointeur n'est pas sur le plan de travail. Faites glisser l'aperçu vers une place libre et relâchez pour le poser. `Escape` ou un clic en dehors de l'aperçu annule.

Annuler (`Ctrl+Z`) et Rétablir (`Ctrl+Shift+Z`) valent pour chaque modification.

## Effacer {#erasing}

Avec la gomme, cliquez sur un élément pour le supprimer ou faites glisser sur plusieurs. Si vous appuyez sur `Escape` avant de relâcher, tout ce que ce glisser a effacé revient.

## Voir aussi {#see-also}

- [Fils et connexions](docs:wires-and-connections) : tracer des fils et connecter des croisements
- [Composants et options](docs:components-and-options) : les pièces que vous placez
- [Téléphones et tablettes](docs:phones-and-tablets) : les mêmes outils en disposition tactile
- [Raccourcis clavier](docs:shortcuts) : modifier les touches utilisées ici
