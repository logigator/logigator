# Fils et connexions

Les fils transportent les signaux entre les ports. Ils suivent la grille à l'horizontale et à la verticale, et un signal se propage dans chaque fil qui lui est relié.

## Tracer des fils

Choisissez l'outil fil (`W`) et faites glisser. Un glisser en diagonale trace un L : la direction dans laquelle vous partez en premier devient la première branche. Pour changer d'avis, revenez au point de départ et repartez dans l'autre direction.

Un fil peut partir d'un port, d'une jonction ou de n'importe quel point d'un autre fil, et il se connecte partout où il se termine sur un port. Pendant le glisser, une branche qui traverserait un composant devient rouge. Relâcher avec une branche rouge ne place rien.

Un fil tracé par-dessus un fil existant fusionne avec lui, et deux fils qui se rejoignent bout à bout dans le même alignement n'en font plus qu'un.

## Où les fils se connectent

Un fil qui se termine sur un autre fil s'y connecte, et un fil qui passe sur la pointe d'un port se connecte à ce port. Deux fils qui ne font que se croiser, sans que l'un se termine là, restent séparés. Vous pouvez ainsi faire passer des fils les uns sur les autres sans les relier.

Un point de connexion apparaît partout où trois extrémités de fil et pointes de port ou plus se rejoignent. Un simple croisement n'a pas de point.

![Deux croisements : celui de gauche séparé, celui de droite connecté.](./images/wire-junction.webp)

Pour connecter un croisement, appuyez dessus avec l'outil fil. Un point apparaît et les quatre branches sont reliées. Appuyez de nouveau sur le point pour les séparer. Au survol d'un croisement, vous voyez l'effet qu'aurait un appui. Un point où un fil se termine sur un autre ne se retire pas ainsi ; supprimez ou déplacez plutôt le fil.

## Tunnels

Un tunnel est relié à tous les autres tunnels du même plan de travail qui portent la même étiquette, comme si un fil les joignait. Utilisez-les pour faire passer une horloge ou un bus à travers un grand circuit. Chaque nouveau tunnel commence avec l'étiquette 0, donc deux nouveaux tunnels sont reliés jusqu'à ce que vous changiez l'un d'eux. Les étiquettes distinguent majuscules et minuscules et font 10 caractères au plus.

Les tunnels ne se relient qu'à l'intérieur d'un même circuit. Un tunnel dans un composant personnalisé ne se relie jamais à un tunnel extérieur.

![Un interrupteur qui allume une LED à travers deux tunnels de même étiquette.](./images/tunnel.webp)

## Réparer les fils

Édition → Réparer les fils recherche sur le plan de travail les défauts de fils, comme des morceaux qui se chevauchent, qui font se comporter les connexions de façon inattendue, et les corrige. Quand un circuit chargé présente de tels défauts, l'éditeur propose la réparation avec un bouton « Réparer les fils ». Vérifiez ensuite que le circuit fait toujours ce qu'il doit. Une réparation pendant une simulation arrête d'abord la simulation.

## Voir aussi

- [Plan de travail et outils](docs:board-and-tools) : sélectionner, couper et effacer des fils
- [Composants et options](docs:components-and-options) : inverser un port
- [Simulation](docs:simulation) : voir les fils alimentés s'allumer
