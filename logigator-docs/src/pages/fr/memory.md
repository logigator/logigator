# Mémoire

Une bascule mémorise un bit. La ROM et la RAM stockent des mots de plusieurs bits, chacun à une adresse numérotée. Les cinq se trouvent dans la catégorie Mémoire de la palette.

Une bascule ne change son bit que lorsque son entrée CLK monte de 0 à 1 ; Q porte le bit et !Q son inverse. Chaque bascule démarre avec Q à 0 et !Q à 1. Entre deux fronts montants, les changements sur les autres entrées sont sans effet. Une bulle d'inversion sur CLK fait réagir une bascule au front descendant, quand CLK passe de 1 à 0 (voir [Inverser un port](docs:components-and-options#negating-a-port)). Une [horloge](docs:clock-and-timing#clock) est la source habituelle de CLK.

Une ROM contient ce que vous y mettez pendant l'édition, et le circuit ne peut que le lire. Une RAM démarre vide et c'est le circuit qui y écrit. Pendant une simulation, un clic sur une ROM ou une RAM ouvre une vue de son contenu (voir [Inspection et surveillances](docs:inspection)).

## Bascule D {#d-flip-flop}

![Une bascule D avec des interrupteurs sur D et CLK et des LED sur Q et !Q. Q prend la valeur de D quand CLK monte et la garde quand D change pendant que CLK est à 0.](./images/component-d-flip-flop.webp)

La bascule D mémorise le bit présent sur D à chaque front montant de CLK.

| Port | Sens   | Rôle                                  |
| ---- | ------ | ------------------------------------- |
| D    | entrée | Le bit à mémoriser.                   |
| CLK  | entrée | Mémorise D quand elle monte de 0 à 1. |
| Q    | sortie | Le bit mémorisé.                      |
| !Q   | sortie | L'inverse de Q.                       |

Elle n'a pas d'autre option que Direction.

| D   | Q après le front montant |
| --- | ------------------------ |
| 0   | 0                        |
| 1   | 1                        |

## Bascule JK {#jk-flip-flop}

![Une bascule JK avec des interrupteurs sur J, CLK et K et des LED sur Q et !Q. Sur des fronts montants successifs de CLK, elle est mise à 1 avec J activé, remise à 0 avec K activé, puis inversée deux fois avec J et K tous deux activés.](./images/component-jk-flip-flop.webp)

La bascule JK met son bit à 1, le remet à 0 ou l'inverse à chaque front montant de CLK.

| Port | Sens   | Rôle                                       |
| ---- | ------ | ------------------------------------------ |
| J    | entrée | Met le bit à 1.                            |
| CLK  | entrée | Applique J et K quand elle monte de 0 à 1. |
| K    | entrée | Remet le bit à 0.                          |
| Q    | sortie | Le bit mémorisé.                           |
| !Q   | sortie | L'inverse de Q.                            |

Elle n'a pas d'autre option que Direction.

| J   | K   | Q après le front montant |
| --- | --- | ------------------------ |
| 0   | 0   | Inchangé                 |
| 1   | 0   | 1                        |
| 0   | 1   | 0                        |
| 1   | 1   | Inversé                  |

Avec J et K tous deux à 1, Q change à chaque front montant ; il bat donc à la moitié de la fréquence du signal sur CLK.

## Bascule SR {#sr-flip-flop}

![Une bascule SR avec des interrupteurs sur S, CLK et R et des LED sur Q et !Q. Un front montant avec S activé met Q à 1, et un front montant avec R activé le remet à 0.](./images/component-sr-flip-flop.webp)

La bascule SR met son bit à 1 ou le remet à 0 à chaque front montant de CLK.

| Port | Sens   | Rôle                                       |
| ---- | ------ | ------------------------------------------ |
| S    | entrée | Met le bit à 1.                            |
| CLK  | entrée | Applique S et R quand elle monte de 0 à 1. |
| R    | entrée | Remet le bit à 0.                          |
| Q    | sortie | Le bit mémorisé.                           |
| !Q   | sortie | L'inverse de Q.                            |

Elle n'a pas d'autre option que Direction.

| S   | R   | Q après le front montant | !Q après le front montant |
| --- | --- | ------------------------ | ------------------------- |
| 0   | 0   | Inchangé                 | Inchangé                  |
| 1   | 0   | 1                        | 0                         |
| 0   | 1   | 0                        | 1                         |
| 1   | 1   | 1, conflit               | 0, conflit                |

S et R tous deux à 1 est une combinaison d'entrées qu'une bascule SR n'admet pas. La simulation met Q à 1 et !Q à 0 et dessine les deux fils de sortie en orange jusqu'à un front montant où seul S ou seul R est à 1. Voir [Signaux en conflit](docs:simulation#conflicting-signals). Là où les deux peuvent être à 1 en même temps, utilisez plutôt une bascule D ou JK.

## ROM {#rom}

![Une ROM avec quatre interrupteurs sur ses entrées d'adresse réglés sur l'adresse 3 et quatre LED sur ses sorties qui montrent le mot stocké 0111.](./images/component-rom.webp)

La ROM donne le mot stocké à l'adresse présente sur ses entrées A. Elle n'a pas d'horloge : les sorties suivent l'adresse. Le contenu ne peut pas changer pendant la simulation.

| Port      | Sens   | Rôle                                                     |
| --------- | ------ | -------------------------------------------------------- |
| A1, A2, … | entrée | L'adresse, A1 étant le bit de poids faible.              |
| O1, O2, … | sortie | Le mot à cette adresse, O1 étant le bit de poids faible. |

| Option              | Valeurs                     | Par défaut |
| ------------------- | --------------------------- | ---------- |
| Taille de mot       | 1 à 64                      | 4          |
| Taille d'adresse    | 1 à 11                      | 4          |
| Modifier le contenu | Ouvre l'éditeur hexadécimal | Vide       |

Taille de mot fixe le nombre de bits par mot, et donc le nombre de sorties. Taille d'adresse fixe le nombre d'entrées d'adresse. Une ROM contient 2ⁿ mots pour une taille d'adresse de n : 16 mots par défaut, 2 048 au plus.

### Modification du contenu {#editing-the-contents}

« Modifier le contenu », dans la carte de paramètres, indique combien de mots sont remplis, par exemple « 3 sur 16 mots remplis », ou « Vide ». Un clic ouvre « Modifier le contenu de la ROM », un tableau avec une cellule par mot. Les mots que vous ne remplissez pas valent 0.

- Mots ou Octets choisit si une cellule est un mot ou un octet du contenu.
- Hex, Décimal, Octal ou Binaire choisit la base dans laquelle les valeurs sont affichées et saisies.
- Le champ « Adresse… » mène à une adresse que vous tapez en hexadécimal.
- Coller dans une cellule la remplit, ainsi que les cellules suivantes, une valeur chacune : vous pouvez donc coller une liste de valeurs séparées par des espaces ou des sauts de ligne.
- « Copier » place tout le tableau dans le presse-papiers sous forme de texte.
- « Effacer » remet chaque mot à 0, après confirmation.
- « Enregistrer » garde les modifications et « Annuler » les abandonne.

Le contenu est enregistré avec le circuit. Pendant une simulation, la vue de la ROM met en surbrillance le mot à l'adresse actuelle (voir [Contenu d'une ROM](docs:inspection#rom-contents)).

## RAM {#ram}

![Une RAM avec Taille d'adresse à 2, des interrupteurs sur A0, A1, D0 à D3, WE et CLK, et des LED sur ses sorties. 0101 est stocké à l'adresse 0 quand CLK monte avec WE activé, reste sur les sorties une fois les interrupteurs de données remis à 0, disparaît quand l'adresse 1 est choisie et revient avec l'adresse 0.](./images/component-ram.webp)

La RAM donne le mot stocké à l'adresse présente sur ses entrées A. Sur le front montant de CLK, elle stocke à cette adresse le mot présent sur ses entrées D tant que WE est à 1.

| Port      | Sens   | Rôle                                                                            |
| --------- | ------ | ------------------------------------------------------------------------------- |
| A0, A1, … | entrée | L'adresse, A0 étant le bit de poids faible.                                     |
| D0, D1, … | entrée | Le mot à stocker, D0 étant le bit de poids faible.                              |
| WE        | entrée | Autorisation d'écriture. Tant qu'elle est à 1, un front montant sur CLK stocke. |
| CLK       | entrée | Stocke les entrées D quand elle monte de 0 à 1 tant que WE est à 1.             |
| D0, D1, … | sortie | Le mot à cette adresse, D0 étant le bit de poids faible.                        |

Les entrées de données et les sorties portent les mêmes étiquettes, sur des côtés opposés du composant.

| Option           | Valeurs                | Par défaut |
| ---------------- | ---------------------- | ---------- |
| Taille de mot    | 1 à 64                 | 4          |
| Taille d'adresse | 1 à 16                 | 4          |
| Lecture          | Immédiate, Sur horloge | Immédiate  |

Taille de mot fixe le nombre de bits par mot, et donc le nombre d'entrées de données et de sorties. Une RAM contient 2ⁿ mots pour une taille d'adresse de n : 16 mots par défaut, 65 536 au plus.

Lecture détermine quand les sorties changent :

| Lecture     | Les sorties changent                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Immédiate   | Chaque fois que l'adresse change ou qu'un nouveau mot y est stocké.                                     |
| Sur horloge | Seulement au front montant de CLK, qui lit le mot à l'adresse ou montre celui qu'elle vient de stocker. |

Avec une bulle d'inversion sur CLK, la RAM stocke, et lit avec Sur horloge, au front descendant (voir [Inverser un port](docs:components-and-options#negating-a-port)).

Chaque mot vaut 0 au démarrage de la simulation, et « Arrêter » les remet tous à 0. Le contenu n'est pas enregistré avec le circuit ; pour démarrer avec un contenu fixe, utilisez une ROM. Pendant une simulation, la vue de la RAM montre ce que le circuit a stocké (voir [Contenu d'une RAM](docs:inspection#ram-contents)).

## Voir aussi {#see-also}

- [Composants et options](docs:components-and-options) : inverser un port, comme CLK
- [Temporisation](docs:clock-and-timing) : des signaux d'horloge pour CLK
- [Inspection et surveillances](docs:inspection) : voir le contenu des ROM et des RAM pendant une simulation
- [Additionneurs et sélecteurs](docs:adders-and-selectors) : décodeurs et multiplexeurs pour l'adressage
- [Portes logiques](docs:logic-gates) : combiner des bits sans les mémoriser
- [Simulation](docs:simulation) : avancer dans un circuit tick par tick
