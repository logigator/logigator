# Fils et connexions

Les fils transportent les signaux entre les ports des composants. Cette page explique comment les tracer, contrôler où ils se connectent, et relier des pièces sans fil grâce aux tunnels.

![Des fils tracés entre des composants, avec des points de connexion.](./images/wire-circuit-display.png)

## Tracer des fils

Choisissez l'outil **Fil** dans la barre d'outils (raccourci `W`), puis faites glisser sur le plan de travail. Les fils sont toujours droits, horizontaux ou verticaux le long de la grille. Faites glisser en diagonale et le fil se route en **L** : la direction dans laquelle vous vous déplacez d'abord fixe le premier segment, et le coude suit votre curseur.

Relâchez pour placer le fil. Une extrémité de fil qui atterrit sur un port de composant s'y connecte automatiquement. Pendant que vous faites glisser, un segment qui traverserait le corps d'un composant devient rouge et ne sera pas placé — contournez-le à la place.

Pour prolonger un tracé, tracez simplement un autre fil en partant de l'extrémité d'un fil existant. Les fils qui se rejoignent bout à bout fusionnent en un seul chemin connecté.

## Jonctions : quand les fils se connectent

Là où les fils se rencontrent, Logigator suit une règle simple pour que vous gardiez le contrôle de votre circuit :

- Un fil qui **se termine sur** un autre fil s'y connecte. Un petit **point de connexion** marque la jonction.
- Deux fils qui se **croisent** simplement — sans que l'un se termine au croisement — passent l'un sur l'autre **sans** se connecter. Il n'y a pas de point, et aucun signal ne circule entre eux.

Cela vous permet de router librement des fils les uns par-dessus les autres sans créer de connexions accidentelles.

![Deux croisements : l’un sans point, l’autre relié par un point de connexion.](./images/wire-junction.png)

### Basculer un croisement

Pour connecter deux fils qui ne font que se croiser, choisissez l'outil **Fil** et touchez le point de croisement : un point de connexion apparaît et les fils sont désormais reliés. Touchez à nouveau le même point pour les séparer. Survoler le croisement avec l'outil Fil prévisualise ce qu'un appui fera — le point qu'il ajouterait, ou le point existant qu'il retirerait.

Vous verrez aussi des points de connexion apparaître d'eux-mêmes partout où trois extrémités de fil ou plus (ou une extrémité de fil et un port de composant) se rejoignent. Ces points ne sont qu'un repère visuel montrant où les éléments sont électriquement connectés ; vous ne les placez ni ne les sélectionnez.

## Inverser un port

Avec l'outil **Fil**, vous pouvez aussi toucher directement le port d'un composant pour inverser le signal à cet endroit — une petite **bulle d'inversion** apparaît sur le port. Cela est traité en détail sur la page [Composants et options](docs:components-and-options).

## Tunnels : connexions sans fil

Un **Tunnel** connecte des points de votre plan de travail sans qu'un fil ne coure entre eux. Chaque tunnel portant la même **étiquette** est électriquement relié, comme si un fil les reliait. Cela garde les plans de travail chargés bien ordonnés — par exemple, pour router une horloge ou un bus partagé à travers le circuit sans tracer de longs fils.

Pour utiliser les tunnels :

1. Placez un **Tunnel** depuis la catégorie **Basique** de la palette et câblez-le au signal que vous voulez transporter.
2. Placez un autre Tunnel là où vous voulez que ce signal réapparaisse.
3. Sélectionnez chaque Tunnel et donnez-leur la **même Étiquette** dans la carte de paramètres.

Tous les tunnels avec des étiquettes correspondantes se comportent comme un seul réseau connecté ; les tunnels avec des étiquettes différentes restent indépendants.

![Deux tunnels portant la même étiquette, sans fil entre eux.](./images/tunnel.gif)

## Couper et réagencer les fils

L'outil **Sélection** déplace et retire les fils avec tout ce que vous sélectionnez d'autre, et son mode ciseaux rogne un fil exactement au bord de votre cadre de sélection — pratique pour découper un fil d'un faisceau. L'outil **Gomme** supprime les fils sur lesquels vous cliquez ou faites glisser. Les deux sont traités dans [Plan de travail et outils](docs:board-and-tools).

## Voir aussi

- [Composants et options](docs:components-and-options) — les pièces que ces fils connectent, et l'inversion de port
- [Simulation](docs:simulation) — exécuter le circuit et regarder les fils alimentés s'illuminer
- [Plan de travail et outils](docs:board-and-tools) — l'outil Fil, sélectionner, couper et effacer
