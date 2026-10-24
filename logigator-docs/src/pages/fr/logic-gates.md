# Portes logiques

Les portes logiques travaillent sur des bits isolés. La porte NON inverse son unique entrée, et les portes ET, OU et XOR combinent de 2 à 64 entrées en une seule sortie. Les quatre se trouvent dans la catégorie Portes logiques de la palette. Leurs ports n'ont pas d'étiquette ; c'est le symbole sur le bloc qui les distingue. La catégorie contient aussi le tunnel, décrit sous [Tunnels](docs:wires-and-connections#tunnels).

## Porte NON {#not-gate}

![Une porte NON avec un interrupteur sur son entrée et une LED sur sa sortie. La LED est allumée tant que l'interrupteur est éteint et s'éteint quand il est allumé.](./images/component-not-gate.webp)

La porte NON inverse son entrée. Son bloc porte la marque `!`.

| Port   | Sens   | Rôle                   |
| ------ | ------ | ---------------------- |
| Entrée | entrée | Le bit à inverser.     |
| Sortie | sortie | L'inverse de l'entrée. |

Elle n'a pas d'autre option que Direction.

| Entrée | Sortie |
| ------ | ------ |
| 0      | 1      |
| 1      | 0      |

Une bulle d'inversion inverse le signal d'un port sans retard supplémentaire ; une porte NON devant un autre composant est donc souvent inutile. Voir [Inverser un port](docs:components-and-options#negating-a-port).

## Porte ET {#and-gate}

![Une porte ET avec deux interrupteurs sur ses entrées et une LED sur sa sortie, qui passe par les quatre combinaisons d'entrées. La LED ne s'allume que quand les deux interrupteurs sont allumés.](./images/component-and-gate.webp)

La porte ET donne 1 quand toutes les entrées sont à 1. Son bloc porte la marque `&`.

| Port    | Sens   | Rôle                                 |
| ------- | ------ | ------------------------------------ |
| Entrées | entrée | Les bits à combiner.                 |
| Sortie  | sortie | 1 quand toutes les entrées sont à 1. |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Entrées | 2 à 64  | 2          |

| Entrée 1 | Entrée 2 | Sortie |
| -------- | -------- | ------ |
| 0        | 0        | 0      |
| 0        | 1        | 0      |
| 1        | 0        | 0      |
| 1        | 1        | 1      |

Avec plus d'entrées, la sortie n'est à 1 que tant qu'elles sont toutes à 1. Un seul 0 la met à 0.

Inverser la sortie fait de la porte ET une porte NON-ET (NAND).

## Porte OU {#or-gate}

![Une porte OU avec deux interrupteurs sur ses entrées et une LED sur sa sortie, qui passe par les quatre combinaisons d'entrées. La LED s'allume quand au moins un interrupteur est allumé.](./images/component-or-gate.webp)

La porte OU donne 1 quand au moins une entrée est à 1. Son bloc porte la marque `≥1`.

| Port    | Sens   | Rôle                                 |
| ------- | ------ | ------------------------------------ |
| Entrées | entrée | Les bits à combiner.                 |
| Sortie  | sortie | 1 quand au moins une entrée est à 1. |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Entrées | 2 à 64  | 2          |

| Entrée 1 | Entrée 2 | Sortie |
| -------- | -------- | ------ |
| 0        | 0        | 0      |
| 0        | 1        | 1      |
| 1        | 0        | 1      |
| 1        | 1        | 1      |

Avec plus d'entrées, la sortie n'est à 0 que tant qu'elles sont toutes à 0. Un seul 1 la met à 1.

Inverser la sortie fait de la porte OU une porte NON-OU (NOR). Pour combiner plusieurs sorties sur un même fil, faites-les passer par une porte OU au lieu de les relier directement (voir [Signaux en conflit](docs:simulation#conflicting-signals)).

## Porte XOR {#xor-gate}

![Une porte XOR avec deux interrupteurs sur ses entrées et une LED sur sa sortie, qui passe par les quatre combinaisons d'entrées. La LED s'allume quand exactement un interrupteur est allumé.](./images/component-xor-gate.webp)

La porte XOR donne 1 quand un nombre impair d'entrées est à 1. Son bloc porte la marque `=1`.

| Port    | Sens   | Rôle                                        |
| ------- | ------ | ------------------------------------------- |
| Entrées | entrée | Les bits à combiner.                        |
| Sortie  | sortie | 1 quand un nombre impair d'entrées est à 1. |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Entrées | 2 à 64  | 2          |

| Entrée 1 | Entrée 2 | Sortie |
| -------- | -------- | ------ |
| 0        | 0        | 0      |
| 0        | 1        | 1      |
| 1        | 0        | 1      |
| 1        | 1        | 0      |

Avec plus d'entrées, la porte compte les 1 : une ou trois entrées à 1 donnent 1, deux ou quatre donnent 0. Elle ne donne pas 1 uniquement quand une seule entrée est à 1.

Inverser la sortie fait de la porte XOR une porte XNOR.

## Voir aussi {#see-also}

- [Composants et options](docs:components-and-options) : la palette, la carte de paramètres et l'inversion d'un port
- [Mémoire](docs:memory) : bascules, ROM et RAM
- [Additionneurs et sélecteurs](docs:adders-and-selectors) : demi-additionneurs et additionneurs complets réunis en un seul composant
- [Simulation](docs:simulation) : faire fonctionner un circuit
