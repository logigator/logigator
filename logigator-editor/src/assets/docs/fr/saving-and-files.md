# Enregistrement et fichiers

Où vit votre travail : dans votre navigateur, dans votre compte, ou dans un fichier sur votre appareil. Cette page explique l'enregistrement dans le navigateur, l'export vers un fichier et la génération d'une image de votre circuit.

![L'éditeur avec le nom du projet et sa puce de source mis en évidence en haut, et la barre d'état en bas montrant l'indicateur enregistré / non enregistré.](images/saving-and-files/save-overview.png)

## Enregistrer votre projet

Enregistrez avec **Fichier → Enregistrer** ou `Ctrl+S`. Le bouton se trouve aussi dans la barre d'outils.

Un projet qui n'a jamais été enregistré est un **Brouillon** — la puce à côté du nom du projet l'indique. La première fois que vous enregistrez un Brouillon, Logigator demande deux choses :

- **Nom** — comment appeler le projet.
- **Destination** — **Local** (stocké dans ce navigateur) ou **Cloud** (stocké dans votre compte Logigator, si vous êtes connecté).

Après ce premier enregistrement, **Enregistrer** écrit directement là où le projet réside — plus aucune invite. Voir [Cloud et partage](docs:cloud) pour ce qu'apportent la connexion et la destination Cloud.

### Savoir où un projet est stocké

La puce à côté du nom du projet indique toujours le foyer du projet :

| Puce          | Signification                                                            |
| ------------- | ------------------------------------------------------------------------ |
| **Brouillon** | Jamais encore enregistré — enregistrez-le pour le conserver.             |
| **Local**     | Enregistré uniquement dans ce navigateur.                                |
| **Cloud**     | Enregistré dans votre compte, accessible depuis n'importe quel appareil. |
| **Partagé**   | Ouvert en lecture seule depuis le lien de partage de quelqu'un.          |

### L'indicateur enregistré / non enregistré

La **barre d'état** en bas de l'éditeur affiche **Enregistré** lorsque tout est écrit, et **Modifications non enregistrées** dès que vous faites une modification. Utilisez-la comme vérification rapide avant de fermer l'onglet.

### Une note sur les projets locaux

Les projets locaux vivent uniquement dans le navigateur dans lequel vous les avez enregistrés. Comme le prévient la boîte de dialogue d'enregistrement :

> Les projets locaux ne sont pas conservés d'un appareil à l'autre et peuvent être perdus.

Si un projet compte, enregistrez-le dans le **Cloud** (voir [Cloud et partage](docs:cloud)) ou **exportez-le vers un fichier** pour avoir une copie que vous maîtrisez.

### Ouvrir d'anciens projets

Si vous ouvrez un circuit réalisé avec l'ancien éditeur Logigator, l'enregistrer ici le convertit au nouveau format. Le rouvrir ensuite dans l'ancien éditeur peut supprimer ou mal afficher les composants personnalisés, alors conservez l'original si vous en avez encore besoin.

## Fichiers de circuit (`.lgix`)

Vous pouvez aussi conserver un circuit sous forme de fichier sur votre propre appareil.

- **Exporter** — **Fichier → Exporter vers un fichier** télécharge le projet ouvert sous forme de fichier `.lgix`.
- **Importer** — **Fichier → Ouvrir → À partir d'un fichier**, puis **Choisir un fichier**, recharge un fichier `.lgix` dans l'éditeur sous forme de nouveau projet local.

Un fichier n'est jamais qu'un export ou un import — ce n'est pas un endroit où votre projet « vit » comme le sont les stockages Local et Cloud. Exporter ne change pas l'endroit où votre projet est enregistré.

### Ce que contient un fichier `.lgix`

Un fichier `.lgix` est un instantané compressé et autonome de votre circuit. Il regroupe le plan de travail lui-même **et** une copie figée de chaque [composant personnalisé](docs:custom-components) que le circuit utilise, de sorte qu'il s'ouvre correctement sur n'importe quelle machine, même si cette machine n'a jamais vu ces composants.

Le fichier est compressé mais ni chiffré ni verrouillé — traitez-le comme un paquet pratique, non comme un paquet sécurisé ou infalsifiable. Logigator peut aussi importer les fichiers de circuit `.json` exportés par l'ancien éditeur.

> Les projets en lecture seule ouverts depuis un lien de partage ne peuvent pas être exportés vers un fichier. Clonez d'abord le projet partagé dans votre propre bibliothèque — voir [Cloud et partage](docs:cloud).

![La boîte de dialogue Ouvrir un projet avec ses trois onglets — Projets locaux, Projets cloud et À partir d'un fichier — l'onglet À partir d'un fichier montrant le bouton Choisir un fichier.](images/saving-and-files/open-from-file.png)

## Générer une image

Pour exporter une image de votre circuit, choisissez **Fichier → Générer une image**. La boîte de dialogue vous permet de définir :

- **Format** — **PNG**, **JPEG** ou **WebP**.
- **Résolution** — la taille de sortie ; les très grandes tailles sont automatiquement réduites pour respecter les limites de votre appareil.
- **Arrière-plan** — la couleur du thème actuel et la grille.
- **Qualité** — la qualité de compression (affichée pour JPEG et WebP ; le PNG est sans perte).

La boîte de dialogue prévisualise les dimensions finales en pixels avant l'export.

![La boîte de dialogue Exporter une image montrant le sélecteur de format, la résolution, l'arrière-plan et les contrôles de qualité, avec un aperçu des dimensions de sortie.](images/saving-and-files/generate-image.png)

## Voir aussi

- [Cloud et partage](docs:cloud) — connexion, stockage cloud, téléversement et liens de partage
- [Composants personnalisés](docs:custom-components) — les pièces réutilisables qu'un fichier emporte avec lui
- [Raccourcis clavier](docs:shortcuts) — modifier le raccourci `Ctrl+S` et d'autres
