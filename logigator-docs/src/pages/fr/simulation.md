# Simulation

Une fois votre circuit construit, exécutez-le pour regarder les signaux circuler. En simulation, vous alimentez le circuit, actionnez ses entrées et voyez les résultats s'illuminer en direct sur le plan de travail.

![Un circuit en cours de simulation, avec les contrôles d'exécution dans la barre d'outils.](./images/simulation-showcase.webp)

## Démarrer et quitter une simulation

Appuyez sur le bouton **Démarrer la simulation** tout à droite de la barre d'outils pour alimenter votre circuit. Vous pouvez aussi appuyer sur `Enter`.

Pendant qu'une simulation tourne, le plan de travail est **verrouillé pour l'édition** — vous ne pouvez ni placer, ni déplacer, ni câbler, ni supprimer quoi que ce soit. Vous pouvez toujours vous déplacer et zoomer librement, et vous pouvez cliquer sur les entrées du circuit (voir [Interagir avec un circuit en cours d'exécution](#interagir-avec-un-circuit-en-cours-d-exécution)).

Pour revenir à l'édition, appuyez sur **Quitter la simulation** (là où se trouvait le bouton Démarrer), ou appuyez à nouveau sur `Enter` ou sur `Escape`.

Que la simulation démarre en **cours d'exécution** ou en **pause** dépend du réglage **Démarrage automatique de la simulation**. Lorsqu'il est activé, le circuit se met à tourner dès que vous entrez ; lorsqu'il est désactivé, il entre en pause pour que vous le lanciez vous-même. Voir [Paramètres et apparence](docs:settings).

## Les contrôles d'exécution

Lorsqu'une simulation est active, la barre d'outils échange ses outils de dessin contre les contrôles d'exécution.

| Contrôle      | Ce qu'il fait                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Exécuter**  | Démarre (ou reprend) la simulation.                                                                                           |
| **Pause**     | Fige la simulation là où elle est, en conservant son état actuel pour que vous puissiez reprendre ou avancer pas à pas.       |
| **Pas à pas** | Fait avancer le circuit d'un seul tick. Disponible en pause — pratique pour tracer un signal une étape à la fois.             |
| **Arrêter**   | Réinitialise le circuit au début et éteint tous les fils illuminés. La simulation reste active et en pause, prête à repartir. |

**Arrêter** et **Quitter la simulation** sont différents : **Arrêter** ramène le circuit en cours au début mais vous garde en simulation, tandis que **Quitter la simulation** quitte entièrement la simulation et vous ramène à l'édition.

![Les contrôles d'exécution et les réglages de vitesse dans la barre d'outils.](./images/simulation-controls.webp)

## Vitesse de simulation

À côté des contrôles d'exécution se trouve le **bouton de vitesse**. Il indique le réglage actuel — **Chaque image**, une fréquence comme `10 Hz` ou **Vitesse max** — et un clic dessus ouvre le panneau de vitesse :

![Le panneau de vitesse, ouvert depuis le bouton de vitesse, avec Vitesse fixe choisie.](./images/simulation-speed.webp)

Le panneau propose trois façons de cadencer la simulation. L'option mise en évidence est celle utilisée ; cliquez sur une autre pour changer, même pendant que le circuit tourne :

- **Chaque image** — le circuit avance d'un tick par rafraîchissement de l'écran, si bien que chaque changement est dessiné et que la vitesse suit la fréquence de rafraîchissement de votre écran. C'est le réglage par défaut.
- **Vitesse fixe** — le circuit avance au rythme que vous choisissez. Faites glisser le curseur pour en choisir un entre `1 Hz` et `10 MHz`, ou saisissez-le dans la zone à côté du curseur : `20`, `2,5k` et `1M` fonctionnent tous. La saisie descend aussi sous le curseur, jusqu'à `0,1 Hz` — un tick toutes les dix secondes. Modifier l'un ou l'autre sélectionne **Vitesse fixe**. Si la zone devient rouge, ce que vous avez saisi n'est pas une fréquence, et la simulation continue au dernier rythme valide.
- **Aussi vite que possible** — aucune limite : le circuit tourne aussi vite que votre ordinateur le permet, et l'écran n'affiche qu'une partie des ticks.

Sous les trois choix, **Horloges à cette vitesse** indique la fréquence à laquelle tourne chaque **Horloge** de votre circuit. Le **Retard** d'une horloge est le nombre de ticks qu'elle attend avant de basculer, un cycle complet dure donc le double : à `10 Hz`, une horloge de retard `1` tourne à `5 Hz`. Pour ralentir une horloge, baissez la vitesse ou augmentez son retard. Avec une vitesse fixe, la liste s'affiche tout de suite ; avec les deux autres, elle apparaît une fois que le circuit a tourné un instant, car leur vitesse ne se connaît qu'en la mesurant.

À côté du bouton de vitesse, un indicateur montre pendant l'exécution la **vitesse mesurée** que la simulation atteint réellement, ainsi que le nombre total de **ticks** écoulés depuis son démarrage. Quand une vitesse fixe dépasse ce que le circuit peut suivre, l'indicateur est marqué d'un signe d'avertissement.

## Interagir avec un circuit en cours d'exécution

Seules les entrées du circuit répondent aux clics pendant qu'il tourne :

- **Interrupteur** — une entrée à verrouillage. Cliquez dessus pour activer ou désactiver sa sortie ; elle reste là où vous l'avez laissée.
- **Bouton** — une entrée momentanée. Sa sortie est active tant que vous le maintenez enfoncé, et se désactive dès que vous le relâchez.
- **Bouton à impulsion** — cliquez dessus pour émettre une seule impulsion d'un tick sur sa sortie.

À mesure que les signaux se propagent, les fils et ports alimentés **s'illuminent**, et les composants de sortie affichent leur état — les LED brillent, les afficheurs à segments et les matrices de LED montrent leurs motifs. Faites glisser n'importe où sur le plan de travail pour vous déplacer — sauf depuis un bouton, qui reste alors simplement enfoncé ; cliquer dans le vide ne fait rien.

Pour regarder à l'intérieur d'un circuit en cours d'exécution — lire le contenu d'une mémoire ou observer le circuit interne d'un composant personnalisé en direct — voir [Inspection et surveillances](docs:inspection).

## Quand une simulation ne démarre pas

Certains problèmes empêchent totalement un circuit de se simuler. S'il y en a, **Démarrer la simulation** affiche un message d'erreur et reste en mode édition pour que vous puissiez les corriger. Les plus courants :

- **Un composant non pris en charge** — un composant que le simulateur ne peut pas exécuter. Retirez-le ou remplacez-le.
- **Un composant personnalisé qui se place lui-même** — un [composant personnalisé](docs:custom-components) dont le circuit interne se contient lui-même, directement ou via un autre composant personnalisé, ce qui ne peut jamais se résoudre. Cassez la boucle.
- **Un composant personnalisé sans circuit** — un composant personnalisé qui n'a rien à l'intérieur à simuler. Donnez-lui un circuit interne, ou retirez-le.
- **Une incohérence de ports** — un composant personnalisé dont les ports d'entrée/sortie déclarés ne correspondent pas aux fiches d'entrée et de sortie réellement présentes dans son circuit. Alignez les fiches avec les ports.

Chaque message nomme le composant concerné pour que vous puissiez le trouver.

## Voir aussi

- [Inspection et surveillances](docs:inspection) — lire la mémoire et observer les circuits internes en direct
- [Composants et options](docs:components-and-options) — interrupteurs, boutons, LED et autres blocs de construction
- [Composants personnalisés](docs:custom-components) — empaqueter un circuit dans une pièce réutilisable
- [Paramètres et apparence](docs:settings) — l'option Démarrage automatique de la simulation
- [Raccourcis clavier](docs:shortcuts) — tous les raccourcis et comment les modifier
