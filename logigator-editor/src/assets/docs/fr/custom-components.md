# Composants personnalisés

Un composant personnalisé empaquette tout un circuit dans une seule pièce réutilisable dotée de son propre symbole et de ports nommés. Construisez un compteur ou une UAL une fois, puis déposez-le dans de plus grands circuits comme un bloc bien rangé.

![Un composant personnalisé à côté du circuit de portes qu’il remplace.](./images/custom-component-showcase.gif)

## Créer un composant

Choisissez **Fichier → Nouveau composant** pour ouvrir la boîte de dialogue de nouveau composant. Renseignez :

- **Nom** — comment le composant est appelé dans votre bibliothèque et votre palette.
- **Symbole** — une courte étiquette dessinée sur la boîte du composant.
- **Description** — une note facultative sur ce qu'il fait.
- **Stockage** — où il réside : **Cloud** (votre compte Logigator, accessible depuis n'importe quel appareil) ou **Local** (ce navigateur seulement). Le stockage cloud nécessite que vous soyez connecté ; les composants locaux ne sont pas synchronisés entre appareils et peuvent être perdus.

Choisir **Créer** ouvre le nouveau composant dans son propre onglet, avec un plan de travail vide prêt pour que vous construisiez son circuit.

## Définir les entrées et les sorties

À l'intérieur de l'éditeur d'un composant, la palette gagne une catégorie **Ports** contenant deux fiches :

- **Entrée** — définit un port d'entrée sur le composant terminé.
- **Sortie** — définit un port de sortie.

Placez une fiche Entrée ou Sortie pour chaque port souhaité, puis câblez-la dans votre circuit comme n'importe quel autre composant. Sélectionnez une fiche et définissez son **Étiquette** dans la carte de paramètres — cette étiquette nomme le port et est affichée sur la boîte du composant lorsqu'il est placé. L'ordre des fiches fixe l'ordre des ports.

Un panneau **Ports** dédié liste les entrées et sorties que vous avez définies jusqu'à présent, afin que vous gardiez le fil à mesure que le composant prend forme.

![Un onglet d’éditeur de composant avec des fiches Entrée et Sortie.](./images/custom-component-tab.png)

## Placer vos composants

Les composants personnalisés enregistrés apparaissent dans la palette sous **Composants utilisateur**. Placez-en un exactement comme une pièce intégrée : cliquez dessus et déposez-le sur le plan de travail. Il apparaît sous forme d'une seule boîte portant votre symbole, avec un port pour chaque fiche Entrée et Sortie que vous avez définie.

Un composant placé est une copie autonome du circuit tel qu'il était lorsque vous l'avez placé, de sorte que vos circuits continuent de fonctionner même si vous modifiez ou retirez l'original par la suite.

## Modifier un composant et mettre à jour les instances

Pour changer le circuit d'un composant personnalisé, ouvrez-le dans son propre onglet : choisissez **Modifier le circuit** depuis sa carte de paramètres pendant qu'une instance est sélectionnée, ou ouvrez-le depuis votre bibliothèque. Pour changer son nom, son symbole ou sa description à la place, choisissez **Modifier les détails**. Modifier le composant ne change **pas** automatiquement les pièces déjà placées — chaque instance placée reste telle qu'elle était.

Lorsqu'une instance placée est en retard par rapport à la dernière version de son composant, sa carte de paramètres propose **Mettre à jour vers la dernière version**. La choisir remplace cette instance par la version actuelle, en conservant sa position et sa direction. La mise à jour se fait par instance et peut être annulée, de sorte que vous décidez exactement quelles copies avancent.

## Imbrication et dépendances

Un composant personnalisé peut contenir d'autres composants personnalisés, de sorte que vous pouvez bâtir des petites pièces vers les grandes. Logigator empêche les boucles : un composant ne peut jamais se contenir lui-même, directement ou indirectement, si bien que pendant que vous en modifiez un, les composants qui créeraient une telle boucle sont indisponibles dans la palette.

Lorsque vous enregistrez ou partagez un composant, les pièces qu'il utilise voyagent avec lui, de sorte qu'il s'ouvre toujours complet sur un autre appareil ou dans la bibliothèque de quelqu'un d'autre.

## Partager et regarder à l'intérieur

- Pour déplacer un composant local vers votre compte, ou pour le partager avec un lien, voir [Cloud et partage](docs:cloud). Enregistrer un composant cloud qui utilise des pièces locales publie d'abord ces pièces dans votre bibliothèque cloud.
- Pour jeter un œil à l'intérieur d'une instance en cours d'exécution et observer ses signaux internes, voir [Inspection et surveillances](docs:inspection).
- Pour retirer un composant de votre bibliothèque, utilisez **Supprimer** dans sa carte de paramètres. Les copies déjà placées restent sous forme de pièces intégrées que vous pourrez restaurer plus tard.

## Voir aussi

- [Composants et options](docs:components-and-options) — les pièces intégrées dont vos composants sont faits
- [Fils et connexions](docs:wires-and-connections) — câbler les fiches dans le circuit de votre composant
- [Inspection et surveillances](docs:inspection) — observer une instance en cours d'exécution de l'intérieur
- [Cloud et partage](docs:cloud) — publier et partager vos composants
- [Enregistrement et fichiers](docs:saving-and-files) — comment les circuits et leurs composants sont stockés
