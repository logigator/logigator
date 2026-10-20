# Simulation

« Démarrer la simulation », à l'extrémité droite de la barre d'outils, met le circuit sous tension : les fils alimentés s'allument, les LED et les affichages montrent leur état, et interrupteurs et boutons répondent aux clics. `Enter` fait de même.

![Une horloge qui pilote une LED dans une simulation en cours.](./images/simulation-showcase.webp)

## Entrer et sortir {#entering-and-leaving}

La simulation exécute toujours le projet principal. Si l'onglet d'un composant personnalisé est ouvert, l'éditeur revient d'abord au projet principal.

Pendant qu'elle tourne, le plan de travail est verrouillé. Vous pouvez déplacer la vue et zoomer, utiliser les entrées et [inspecter](docs:inspection) les ROM, les RAM, les terminaux et les composants personnalisés, mais pas placer, déplacer, câbler ou supprimer quoi que ce soit. « Quitter la simulation », `Enter` ou `Escape` ramène à l'édition avec l'outil Déplacement.

Avec « Démarrage automatique de la simulation » activé (par défaut), le circuit démarre dès que vous entrez. Désactivé, la simulation attend en pause au tick 0 pour que vous avanciez pas à pas depuis le début.

## Commandes {#run-controls}

Pendant une simulation, la barre d'outils est remplacée par quatre boutons, le bouton de vitesse et un compteur.

| Bouton    | Effet                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Exécuter  | Démarre ou reprend la simulation.                                                                          |
| Pause     | S'arrête au tick actuel et conserve l'état.                                                                |
| Pas à pas | Avance d'un tick. Disponible seulement en pause.                                                           |
| Arrêter   | Remet le circuit au tick 0, éteint tous les interrupteurs et met en pause. Vous restez dans la simulation. |

Le compteur affiche les ticks depuis le départ et, pendant l'exécution, la vitesse réellement atteinte.

![Les commandes de simulation et le bouton de vitesse.](./images/simulation-controls.webp)

## Vitesse {#speed}

Le bouton de vitesse affiche le réglage actuel. Un clic ouvre un panneau avec trois modes, entre lesquels vous pouvez passer pendant l'exécution.

| Mode                    | Effet                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chaque image            | Par défaut. Avance d'un tick par rafraîchissement de l'écran ; la vitesse suit donc la fréquence de votre écran.                                  |
| Vitesse fixe            | Avance au rythme que vous choisissez, 1 kHz au départ. Si le circuit n'arrive pas à suivre, un signe d'avertissement apparaît à côté du compteur. |
| Aussi vite que possible | Tourne sans limite. L'écran n'affiche alors qu'une partie des ticks.                                                                              |

En vitesse fixe, le curseur va de 1 Hz à 10 MHz. Dans le champ à côté, vous pouvez taper n'importe quel rythme à partir de 0,1 Hz, par exemple `20`, `2,5k` ou `1M`. Un champ rouge signifie que la saisie n'est pas un rythme, et le dernier valide reste appliqué.

![Le panneau de vitesse avec une vitesse fixe de 10 Hz.](./images/simulation-speed.webp)

Sous les modes, « Horloges à cette vitesse » liste la fréquence de chaque sorte d'horloge du circuit, par forme d'onde et retard, par exemple « Carré, retard 5 ». Le nombre de ticks que dure un cycle d'horloge est décrit sous [Horloge](docs:clock-and-timing#clock). En vitesse fixe, la liste est là tout de suite. Dans les deux autres modes, le rythme doit d'abord être mesuré, et la liste apparaît environ une seconde après le démarrage du circuit.

## Utiliser les entrées {#operating-inputs}

| Composant          | Utilisation                                                                                      | Détails                                        |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Interrupteur       | Cliquez dessus. Il bascule à chaque clic et reste dans la position où vous le laissez.           | [Interrupteur](docs:inputs#switch)             |
| Bouton             | Maintenez-le enfoncé. Il est actif tant que vous le maintenez.                                   | [Bouton](docs:inputs#button)                   |
| Bouton à impulsion | Cliquez dessus. Chaque clic envoie une impulsion d'un tick, quelle que soit la durée de l'appui. | [Bouton à impulsion](docs:inputs#pulse-button) |
| Manette            | Cliquez dessus pour ouvrir sa fenêtre, puis appuyez sur les boutons qui s'y trouvent.            | [Manette](docs:inputs#gamepad)                 |
| Clavier            | Cliquez dessus pour ouvrir une fenêtre, puis tapez dedans.                                       | [Clavier](docs:inputs#keyboard)                |

Un glisser n'importe où ailleurs sur le plan de travail déplace la vue.

## Signaux en conflit {#conflicting-signals}

Un fil dessiné en orange signale un conflit. L'orange est une indication sur votre circuit et ne change pas le fonctionnement de la simulation.

### Causes {#causes}

- Deux sorties ou plus pilotent le même fil, et à ce moment l'une est à 1 et une autre à 0. Des sorties qui donnent la même valeur ne sont pas marquées, si bien que l'orange peut apparaître et disparaître quand les valeurs changent. Sur du matériel réel, ce serait un court-circuit.
- Une bascule SR a reçu un front d'horloge avec S et R tous deux à 1. Q passe à 1 et !Q à 0, et les deux restent en orange jusqu'à un front d'horloge où seul S ou seul R est à 1. Sur du matériel réel, c'est une combinaison d'entrées qu'une bascule SR n'admet pas.

### Effet sur la simulation {#effect-on-the-simulation}

La simulation continue sans changement : un fil relié à plusieurs sorties est à 1 dès que l'une d'elles est à 1.

Un conflit à l'intérieur d'un composant personnalisé n'apparaît pas sur le plan de travail. Cliquez sur le composant pour ouvrir une [surveillance](docs:inspection#watches), où ses fils le montrent.

Désactiver le paramètre « Mettre en évidence les conflits », activé par défaut, supprime ce marquage en orange. Voir [Paramètres](docs:settings#editor-settings).

### Corrections {#fixes}

| Cause                        | Correction                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Plusieurs sorties sur un fil | Ne reliez qu'une seule sortie à chaque fil. Pour combiner plusieurs sources, faites-les passer par une [porte OU](docs:logic-gates#or-gate). Pour en choisir une, utilisez un [multiplexeur](docs:adders-and-selectors#multiplexer). |
| S et R tous deux à 1         | Ne mettez pas S et R à 1 en même temps, ou utilisez plutôt une [bascule D ou JK](docs:memory#d-flip-flop).                                                                                                                           |

## Quand la simulation ne démarre pas {#when-the-simulation-won-t-start}

L'éditeur refuse de démarrer et affiche un message nommant le composant quand :

- un composant personnalisé se contient lui-même, directement ou via un autre,
- un composant personnalisé ne contient aucun circuit,
- les ports d'un composant personnalisé ne correspondent plus aux fiches Entrée et Sortie de son circuit.

Corrigez le composant nommé et relancez. Si le message indique que le moteur de simulation n'a pas pu démarrer, votre navigateur ne prend pas en charge WebAssembly.

## Voir aussi {#see-also}

- [Inspection et surveillances](docs:inspection) : contenu des ROM et des RAM, sortie des terminaux, et surveillances
- [Entrées](docs:inputs) : interrupteurs, boutons, la manette et le clavier
- [Sorties](docs:outputs) : LED, affichages et terminal
- [Paramètres](docs:settings) : le démarrage automatique de la simulation et la mise en évidence des conflits
- [Téléphones et tablettes](docs:phones-and-tablets) : les commandes en disposition tactile
