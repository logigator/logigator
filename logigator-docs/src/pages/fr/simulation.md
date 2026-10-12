# Simulation

« Démarrer la simulation », à l'extrémité droite de la barre d'outils, met le circuit sous tension : les fils alimentés s'allument, les LED et les affichages montrent leur état, et interrupteurs et boutons répondent aux clics. `Enter` fait de même.

![Une horloge qui pilote une LED dans une simulation en cours.](./images/simulation-showcase.webp)

## Entrer et sortir

La simulation exécute toujours le projet principal. Si l'onglet d'un composant personnalisé est ouvert, l'éditeur revient d'abord au projet principal.

Pendant qu'elle tourne, le plan de travail est verrouillé. Vous pouvez déplacer la vue et zoomer, utiliser les entrées et [inspecter](docs:inspection) les ROM et les composants personnalisés, mais pas placer, déplacer, câbler ou supprimer quoi que ce soit. « Quitter la simulation », `Enter` ou `Escape` ramène à l'édition avec l'outil Déplacement.

Avec « Démarrage automatique de la simulation » activé (par défaut), le circuit démarre dès que vous entrez. Désactivé, la simulation attend en pause au tick 0 pour que vous avanciez pas à pas depuis le début.

## Commandes

Pendant une simulation, la barre d'outils est remplacée par quatre boutons, le bouton de vitesse et un compteur.

| Bouton    | Effet                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| Exécuter  | Démarre ou reprend la simulation.                                                                          |
| Pause     | S'arrête au tick actuel et conserve l'état.                                                                |
| Pas à pas | Avance d'un tick. Disponible seulement en pause.                                                           |
| Arrêter   | Remet le circuit au tick 0, éteint tous les interrupteurs et met en pause. Vous restez dans la simulation. |

Le compteur affiche les ticks depuis le départ et, pendant l'exécution, la vitesse réellement atteinte.

![Les commandes de simulation et le bouton de vitesse.](./images/simulation-controls.webp)

## Vitesse

Le bouton de vitesse affiche le réglage actuel. Un clic ouvre un panneau avec trois modes, entre lesquels vous pouvez passer pendant l'exécution :

- Chaque image, par défaut, avance d'un tick par rafraîchissement de l'écran ; la vitesse suit donc la fréquence de votre écran.
- Vitesse fixe avance au rythme que vous choisissez, 1 kHz au départ. Le curseur va de 1 Hz à 10 MHz. Dans le champ à côté, vous pouvez taper n'importe quel rythme à partir de 0,1 Hz, par exemple `20`, `2,5k` ou `1M`. Un champ rouge signifie que la saisie n'est pas un rythme, et le dernier valide reste appliqué. Si le circuit n'arrive pas à suivre, un signe d'avertissement apparaît à côté du compteur.
- Aussi vite que possible tourne sans limite. L'écran n'affiche alors qu'une partie des ticks.

![Le panneau de vitesse avec une vitesse fixe de 10 Hz.](./images/simulation-speed.webp)

Sous les modes, « Horloges à cette vitesse » liste la fréquence que donne chaque retard d'horloge du circuit. Une horloge est active pendant un tick puis inactive pendant Retard ticks, donc un cycle dure Retard + 1 ticks : à 10 Hz, une horloge de retard 1 tourne à 5 Hz et une de retard 4 à 2 Hz. En vitesse fixe, la liste est là tout de suite. Dans les deux autres modes, le rythme doit d'abord être mesuré, et la liste apparaît environ une seconde après le démarrage du circuit.

## Utiliser les entrées

- Un interrupteur bascule à chaque clic et reste dans la position où vous le laissez.
- Un bouton est actif tant que vous le maintenez enfoncé.
- Un bouton à impulsion envoie une impulsion d'un tick par clic, quelle que soit la durée de l'appui.
- Une manette ouvre sa fenêtre de jeu, décrite dans la section suivante.

Un glisser n'importe où ailleurs sur le plan de travail déplace la vue.

## Jouer avec une manette

Un clic sur une manette ouvre une fenêtre où la manette est dessinée, avec l'étiquette du composant pour titre. Un bouton maintenu enfoncé dans cette fenêtre met sa sortie à 1 jusqu'à ce que vous le relâchiez, et s'allume aussi sur le plan de travail.

![La fenêtre d'une manette avec A et Droite enfoncés, à côté de la manette sur le plan de travail.](./images/gamepad-window.webp)

La fenêtre prend le clavier à son ouverture, et la ligne du bas indique « Clavier actif ». Après un clic sur le plan de travail ou dans une autre fenêtre, elle indique « Cliquez ici pour utiliser le clavier », et les touches n'atteignent plus la manette. La touche de chaque bouton est affichée sous celui-ci. Tant que la fenêtre a le clavier, les touches de la manette passent avant les raccourcis : `Enter` appuie sur Start au lieu de quitter la simulation. `Escape` ferme toujours la fenêtre, et les raccourcis avec `Ctrl` ou `Alt` fonctionnent toujours. Les touches par défaut et la façon de les modifier sont décrites dans [Raccourcis clavier](docs:shortcuts#touches-de-la-manette).

À la souris ou au doigt, un bouton reste enfoncé tant que vous appuyez dessus, et sur un écran tactile chaque doigt tient son propre bouton. La croix directionnelle a huit directions : appuyer entre deux branches enfonce les deux, et faire glisser le pouce passe d'une direction à la suivante sans le lever. Le centre de la croix n'enfonce aucune direction.

Une manette physique branchée à votre ordinateur peut aussi jouer. Le navigateur ne signale une manette qu'après l'appui sur l'un de ses boutons pendant que l'éditeur est ouvert. Faites-le avec une fenêtre de manette ouverte : la manette physique est reliée à cette fenêtre et apparaît dans le menu Manette en bas. Une manette physique continue de jouer quand une autre fenêtre a le clavier ; deux manettes physiques peuvent donc jouer sur deux manettes à la fois, chacune choisie dans sa propre fenêtre. Les boutons sont associés par position, quelle que soit leur inscription : le bouton d'action de droite est A, celui du bas B, celui du haut X et celui de gauche Y. La croix et le stick gauche commandent tous deux la croix, LB et LT sont L, RB et RT sont R, Back ou Share est Select, et Start est Start. Les manettes que le navigateur ne signale pas avec la disposition standard figurent dans la liste mais ne peuvent pas être choisies.

Fermer la fenêtre ou quitter la simulation relâche tous les boutons. Une manette placée dans un composant personnalisé se joue depuis une [surveillance](docs:inspection#surveillances). En disposition tactile, la manette s'ouvre dans le panneau en bas de l'écran ; les touches s'y affichent dès que vous appuyez sur une touche d'un clavier, et le menu Manette dès qu'une manette physique est connectée.

## Quand la simulation ne démarre pas

L'éditeur refuse de démarrer et affiche un message nommant le composant quand :

- un composant personnalisé se contient lui-même, directement ou via un autre,
- un composant personnalisé ne contient aucun circuit,
- les ports d'un composant personnalisé ne correspondent plus aux fiches Entrée et Sortie de son circuit.

Corrigez le composant nommé et relancez. Si le message indique que le moteur de simulation n'a pas pu démarrer, votre navigateur ne prend pas en charge WebAssembly.

## Voir aussi

- [Inspection et surveillances](docs:inspection) : contenu des ROM et surveillances
- [Composants et options](docs:components-and-options) : ce que fait chaque entrée et affichage
- [Paramètres](docs:settings) : le démarrage automatique de la simulation
- [Téléphones et tablettes](docs:phones-and-tablets) : les commandes en disposition tactile
