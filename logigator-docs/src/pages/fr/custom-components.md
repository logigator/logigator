# Composants personnalisés

Un composant personnalisé transforme un circuit en une seule pièce avec son propre symbole et des ports nommés. Construisez un compteur une fois, et chaque copie sur le plan de travail est un bloc au lieu d'une douzaine de portes.

![Un circuit de portes et le composant personnalisé qui en est tiré, fonctionnant côte à côte.](./images/custom-component-showcase.webp)

## Créer un composant

Fichier → Nouveau composant (`Alt+N`), ou le bouton « Nouveau composant » de la barre d'outils, ouvre une fenêtre :

- Nom, 20 caractères au plus, est le nom affiché dans la palette.
- Symbole, 5 caractères au plus, est dessiné sur le bloc.
- Description est facultative.
- Stockage détermine où le composant est conservé. Local le garde dans ce navigateur. Cloud le garde dans votre compte, nécessite d'être connecté et demande aussi qui peut l'ouvrir, Tout le monde étant présélectionné (voir [Cloud et partage](docs:cloud)).

« Créer » ouvre le composant dans un nouvel onglet avec un plan de travail vide. Enregistrer (`Ctrl+S`) dans cet onglet enregistre le composant.

## Ports

Tant que l'onglet d'un composant est actif, un panneau Ports se trouve au-dessus de la palette. Placez-en des fiches Entrée et Sortie et reliez-les au circuit. Chaque fiche devient un port du composant terminé.

Le panneau liste les fiches. Tapez dans une ligne pour nommer le port, en 5 caractères au plus ; ce nom s'affiche à côté du port sur le bloc. Faites glisser les lignes pour changer l'ordre des ports ; la position des fiches sur le plan de travail ne compte pas.

![L'onglet d'un composant avec ses fiches Entrée et Sortie.](./images/custom-component-tab.webp)

## Placer et mettre à jour

Les composants enregistrés apparaissent dans la palette sous Composants utilisateur, le dernier modifié en premier. Placez-les comme n'importe quelle autre pièce. Chaque copie sur le plan de travail est un bloc avec le symbole et un port par fiche.

Une copie placée garde le circuit que le composant avait au moment du placement. Modifier le composant ensuite ne change aucune copie tant que vous ne la mettez pas à jour. La carte de paramètres d'une copie périmée propose « Mettre à jour vers la dernière version » pour cette copie et « Mettre à jour toutes les instances » pour toutes les copies périmées du circuit ouvert, avec leur nombre entre parenthèses. Les deux peuvent être annulés. La tuile de la palette porte une flèche tant que des copies sont périmées.

Pour changer le circuit, choisissez « Modifier le circuit » dans la carte de paramètres d'une copie placée ou de la tuile de la palette. « Modifier les détails » change le nom, le symbole et la description.

## Imbrication

Les composants peuvent en contenir d'autres. Un composant ne peut jamais se contenir lui-même, ni directement ni via un autre ; pendant que vous en modifiez un, la palette masque donc tous les composants qui créeraient une telle boucle.

Quand vous enregistrez, partagez ou exportez un circuit, les composants qu'il utilise sont inclus, pour qu'il s'ouvre complet partout.

## Supprimer

« Supprimer » dans la carte de paramètres retire le composant de votre bibliothèque. Les copies déjà placées restent dans leurs circuits et affichent l'étiquette Intégré. « Restaurer et modifier » sur une telle copie la ramène dans votre bibliothèque locale. Supprimer un composant cloud rend aussi son lien de partage inutilisable.

## Voir aussi

- [Composants et options](docs:components-and-options) : les pièces intégrées
- [Inspection et surveillances](docs:inspection) : regarder dans une copie en fonctionnement
- [Cloud et partage](docs:cloud) : téléverser et partager des composants
- [Enregistrement et fichiers](docs:saving-and-files) : comment les composants voyagent dans les fichiers
