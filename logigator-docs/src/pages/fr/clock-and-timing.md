# Temporisation

Ces composants travaillent avec le temps, compté en ticks de simulation. Une horloge allume et éteint sa sortie d'elle-même, un retard transmet un signal un tick plus tard, et un générateur de nombres aléatoires place de nouveaux bits aléatoires sur ses sorties quand il reçoit un front d'horloge.

## Horloge

![Une horloge avec un interrupteur éteint sur STP et une LED sur sa sortie, montrée à raison d'un tick par image. Avec Retard à 1, la LED s'allume et s'éteint à chaque tick.](./images/component-clock.webp)

Une horloge fait passer sa sortie de 0 à 1 et inversement, en boucle, à un rythme fixé par son option Retard. Utilisez-la pour piloter des compteurs et tout ce qui avance par étapes.

| Port | Sens   | Rôle                                              |
| ---- | ------ | ------------------------------------------------- |
| STP  | entrée | Stop : maintient l'horloge à 0 tant qu'il est à 1 |
| CLK  | sortie | Le signal d'horloge                               |

| Option       | Valeurs           | Par défaut |
| ------------ | ----------------- | ---------- |
| Forme d'onde | Carré, Impulsion  | Carré      |
| Retard       | 1 à 4 294 967 295 | 1          |

Chaque cycle commence avec la sortie à 0 pendant Retard ticks. La suite dépend de la forme d'onde :

| Forme d'onde | Sortie à 0 pendant | Puis sortie à 1 pendant | Un cycle dure    |
| ------------ | ------------------ | ----------------------- | ---------------- |
| Carré        | Retard ticks       | Retard ticks            | 2 × Retard ticks |
| Impulsion    | Retard ticks       | 1 tick                  | Retard + 1 ticks |

Dès que STP repasse à 0, l'horloge recommence un cycle depuis le début.

La vitesse de l'horloge en secondes dépend de la vitesse de simulation : divisez le nombre de ticks par seconde par le nombre de ticks par cycle. À une vitesse fixe de 10 Hz :

| Forme d'onde | Retard | Un cycle dure | Fréquence |
| ------------ | ------ | ------------- | --------- |
| Carré        | 1      | 2 ticks       | 5 Hz      |
| Carré        | 5      | 10 ticks      | 1 Hz      |
| Impulsion    | 4      | 5 ticks       | 2 Hz      |

Le panneau de vitesse liste ces fréquences pour chaque horloge du circuit sous « Horloges à cette vitesse ». Voir [Vitesse](docs:simulation#vitesse).

## Retard

![Un interrupteur qui pilote une LED directement et une seconde LED à travers un retard, montré à raison d'un tick par image. La LED derrière le retard s'allume et s'éteint un tick après l'autre.](./images/component-delay.webp)

Un retard transmet son entrée telle quelle, un tick plus tard. Comme tout autre composant, il met un tick à transmettre un changement, et ce tick est tout ce qu'il ajoute. Une chaîne de retards retient un signal d'un tick chacun, par exemple pour donner la même longueur à deux chemins d'un circuit.

| Port   | Sens   | Rôle                              |
| ------ | ------ | --------------------------------- |
| Entrée | entrée | Le signal à transmettre           |
| Sortie | sortie | Le même signal, un tick plus tard |

Il n'a pas d'autre option que Direction.

## Générateur de nombres aléatoires

![Un générateur de nombres aléatoires avec Sorties réglé sur 4, un bouton à impulsion sur CLK et un affichage à segments sur ses sorties, qui montre un nouveau nombre après chaque impulsion.](./images/component-random-number-generator.webp)

Un générateur de nombres aléatoires place une nouvelle valeur aléatoire sur ses sorties à chaque front montant de CLK. Entre deux fronts, les sorties gardent leur valeur.

| Port       | Sens   | Rôle                                             |
| ---------- | ------ | ------------------------------------------------ |
| CLK        | entrée | Chaque front montant produit une nouvelle valeur |
| 0, 1, 2, … | sortie | Les bits aléatoires, un par sortie               |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Sorties | 1 à 64  | 1          |

Avec une [bulle d'inversion](docs:components-and-options#inverser-un-port) sur CLK, il produit une nouvelle valeur au front descendant.

## Voir aussi

- [Simulation](docs:simulation) : les ticks, les commandes et la vitesse de simulation
- [Entrées](docs:inputs) : des interrupteurs et des boutons pour piloter STP ou CLK à la main
- [Sorties](docs:outputs) : des LED et des affichages pour montrer un signal
- [Composants et options](docs:components-and-options) : la palette et la carte de paramètres
