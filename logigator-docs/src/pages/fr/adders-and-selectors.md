# Additionneurs et sélecteurs

Les additionneurs additionnent des bits isolés et produisent un bit de somme et une retenue. Les sélecteurs aiguillent des signaux d'après un nombre binaire : un multiplexeur choisit une entrée parmi plusieurs, un démultiplexeur envoie une entrée vers une sortie parmi plusieurs, un décodeur transforme un nombre en une seule sortie à 1, et un encodeur retransforme l'entrée à 1 la plus haute en nombre. Les six se trouvent dans la catégorie Additionneurs et sélecteurs de la palette.

## Demi-additionneur

![Un demi-additionneur avec des interrupteurs sur A et B et des LED sur S et C, qui passe par les quatre combinaisons d'entrées. Avec les deux activés, S est éteinte et C allumée.](./images/component-half-adder.webp)

Le demi-additionneur additionne deux bits.

| Port | Sens   | Rôle               |
| ---- | ------ | ------------------ |
| A    | entrée | Le premier bit.    |
| B    | entrée | Le deuxième bit.   |
| S    | sortie | Le bit de somme.   |
| C    | sortie | Le bit de retenue. |

Il n'a pas d'autre option que Direction.

| A   | B   | S   | C   |
| --- | --- | --- | --- |
| 0   | 0   | 0   | 0   |
| 0   | 1   | 1   | 0   |
| 1   | 0   | 1   | 0   |
| 1   | 1   | 0   | 1   |

## Additionneur complet

![Un additionneur complet avec des interrupteurs sur A, B et Cin et des LED sur S et C, qui additionne zéro, un, deux (C allumée) et trois uns (S et C allumées).](./images/component-full-adder.webp)

L'additionneur complet additionne deux bits et une retenue entrante.

| Port | Sens   | Rôle                                                  |
| ---- | ------ | ----------------------------------------------------- |
| A    | entrée | Le premier bit.                                       |
| B    | entrée | Le deuxième bit.                                      |
| Cin  | entrée | La retenue entrante, venant du bit de rang inférieur. |
| S    | sortie | Le bit de somme.                                      |
| C    | sortie | Le bit de retenue, pour le bit de rang supérieur.     |

Il n'a pas d'autre option que Direction.

| A   | B   | Cin | S   | C   |
| --- | --- | --- | --- | --- |
| 0   | 0   | 0   | 0   | 0   |
| 0   | 0   | 1   | 1   | 0   |
| 0   | 1   | 0   | 1   | 0   |
| 0   | 1   | 1   | 0   | 1   |
| 1   | 0   | 0   | 1   | 0   |
| 1   | 0   | 1   | 0   | 1   |
| 1   | 1   | 0   | 0   | 1   |
| 1   | 1   | 1   | 1   | 1   |

Pour additionner des nombres de plusieurs bits, utilisez un additionneur par bit et reliez la sortie C de chacun à l'entrée Cin de l'additionneur du bit de rang supérieur. Le bit de poids faible peut utiliser un demi-additionneur, puisqu'il n'a pas de retenue entrante.

## Multiplexeur

![Un multiplexeur avec des interrupteurs sur S0 et sur les entrées de données 0 et 1, l'entrée 0 activée, et une LED sur sa sortie. La LED est allumée tant que S0 est éteint et s'éteint quand S0 choisit l'entrée 1.](./images/component-multiplexer.webp)

Le multiplexeur transmet à sa sortie l'entrée de données choisie par les lignes de sélection. Avec n lignes de sélection, il y a 2ⁿ entrées de données.

| Port       | Sens   | Rôle                                                      |
| ---------- | ------ | --------------------------------------------------------- |
| S0, S1, …  | entrée | Les lignes de sélection, S0 étant le bit de poids faible. |
| 0, 1, 2, … | entrée | Les entrées de données.                                   |
| Sortie     | sortie | La valeur de l'entrée de données choisie.                 |

La sortie n'a pas d'étiquette.

| Option              | Valeurs | Par défaut |
| ------------------- | ------- | ---------- |
| Lignes de sélection | 1 à 6   | 1          |

Avec 2 lignes de sélection :

| S1  | S0  | Sortie   |
| --- | --- | -------- |
| 0   | 0   | Entrée 0 |
| 0   | 1   | Entrée 1 |
| 1   | 0   | Entrée 2 |
| 1   | 1   | Entrée 3 |

## Démultiplexeur

![Un démultiplexeur avec des interrupteurs sur S0 et I, I activé, et des LED sur les sorties 0 et 1. La LED allumée passe de la sortie 0 à la sortie 1 quand S0 est activé.](./images/component-demultiplexer.webp)

Le démultiplexeur transmet l'entrée I à la sortie choisie par les lignes de sélection. Toutes les autres sorties sont à 0. Avec n lignes de sélection, il y a 2ⁿ sorties.

| Port       | Sens   | Rôle                                                      |
| ---------- | ------ | --------------------------------------------------------- |
| S0, S1, …  | entrée | Les lignes de sélection, S0 étant le bit de poids faible. |
| I          | entrée | L'entrée de données.                                      |
| 0, 1, 2, … | sortie | Les sorties.                                              |

| Option              | Valeurs | Par défaut |
| ------------------- | ------- | ---------- |
| Lignes de sélection | 1 à 6   | 1          |

Avec 2 lignes de sélection :

| S1  | S0  | Sortie qui porte I |
| --- | --- | ------------------ |
| 0   | 0   | 0                  |
| 0   | 1   | 1                  |
| 1   | 0   | 2                  |
| 1   | 1   | 3                  |

Les lignes de sélection viennent en premier, comme sur le multiplexeur. Un démultiplexeur d'un circuit plus ancien garde I en premier, avant les lignes de sélection, et fonctionne pour le reste de la même façon. Les étiquettes du composant montrent l'ordre.

## Décodeur

![Un décodeur avec des interrupteurs sur ses entrées 1 et 2 et des LED sur ses quatre sorties, qui compte de 0 à 3 si bien que la LED allumée avance de la sortie 0 à la sortie 3.](./images/component-decoder.webp)

Le décodeur met à 1 la seule sortie dont le numéro correspond à la valeur binaire présente sur ses entrées. Toutes les autres sorties sont à 0. Avec n entrées, il y a 2ⁿ sorties.

| Port       | Sens   | Rôle                                                |
| ---------- | ------ | --------------------------------------------------- |
| 1, 2, 4, … | entrée | Les bits du nombre, chacun étiqueté avec sa valeur. |
| 0, 1, 2, … | sortie | Une sortie par nombre.                              |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Entrées | 1 à 6   | 2          |

Avec 2 entrées :

| 2   | 1   | Sortie à 1 |
| --- | --- | ---------- |
| 0   | 0   | 0          |
| 0   | 1   | 1          |
| 1   | 0   | 2          |
| 1   | 1   | 3          |

## Encodeur

![Un encodeur avec Sorties réglé sur 2, des interrupteurs sur ses quatre entrées et des LED sur les sorties 1, 2 et V. Sans entrée activée, V est éteinte. L'entrée 0 seule n'allume que V, et les entrées 2 puis 3 donnent 2 puis 3, l'entrée activée la plus haute.](./images/component-encoder.webp)

L'encodeur donne le numéro de l'entrée la plus haute qui est à 1. V est à 1 tant qu'une entrée l'est, ce qui distingue l'entrée 0 de l'absence d'entrée. Avec n sorties, sans compter V, il y a 2ⁿ entrées.

| Port       | Sens   | Rôle                                                |
| ---------- | ------ | --------------------------------------------------- |
| 0, 1, 2, … | entrée | Une entrée par nombre.                              |
| 1, 2, 4, … | sortie | Les bits du nombre, chacun étiqueté avec sa valeur. |
| V          | sortie | 1 tant qu'une entrée est à 1.                       |

| Option  | Valeurs | Par défaut |
| ------- | ------- | ---------- |
| Sorties | 1 à 6   | 1          |

Avec 2 sorties, où x signifie que l'entrée peut être à 0 ou à 1 :

| 3   | 2   | 1   | 0   | Sortie 2 | Sortie 1 | V   |
| --- | --- | --- | --- | -------- | -------- | --- |
| 0   | 0   | 0   | 0   | 0        | 0        | 0   |
| 0   | 0   | 0   | 1   | 0        | 0        | 1   |
| 0   | 0   | 1   | x   | 0        | 1        | 1   |
| 0   | 1   | x   | x   | 1        | 0        | 1   |
| 1   | x   | x   | x   | 1        | 1        | 1   |

Un encodeur d'un circuit plus ancien n'a pas de V.

## Voir aussi

- [Composants et options](docs:components-and-options) : la palette et la carte de paramètres
- [Portes logiques](docs:logic-gates) : NON, ET, OU et XOR
- [Mémoire](docs:memory) : lire des mots à une adresse
- [Sorties](docs:outputs) : afficher un nombre binaire sur un affichage à segments
