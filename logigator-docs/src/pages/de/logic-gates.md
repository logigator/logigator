# Logikgatter

Logikgatter arbeiten mit einzelnen Bits. Das NICHT-Gatter invertiert seinen einen Eingang, und UND-, ODER- und XOR-Gatter verknüpfen 2 bis 64 Eingänge zu einem Ausgang. Alle vier stehen in der Kategorie Logikgatter der Palette. Ihre Anschlüsse haben keine Beschriftung; das Symbol auf dem Kasten unterscheidet sie. Die Kategorie enthält außerdem den Tunnel, der unter [Tunnel](docs:wires-and-connections#tunnels) beschrieben ist.

## NICHT-Gatter {#not-gate}

![Ein NICHT-Gatter mit einem Schalter am Eingang und einer LED am Ausgang. Die LED leuchtet, solange der Schalter aus ist, und geht aus, wenn er eingeschaltet wird.](./images/component-not-gate.webp)

Das NICHT-Gatter invertiert seinen Eingang. Auf seinem Kasten steht `!`.

| Anschluss | Richtung | Bedeutung                   |
| --------- | -------- | --------------------------- |
| Eingang   | ein      | Das zu invertierende Bit.   |
| Ausgang   | aus      | Das Gegenteil des Eingangs. |

Außer Richtung hat es keine Optionen.

| Eingang | Ausgang |
| ------- | ------- |
| 0       | 1       |
| 1       | 0       |

Ein Negationskreis invertiert das Signal eines Anschlusses ohne zusätzliche Verzögerung, vor einer anderen Komponente brauchst du also oft kein NICHT-Gatter. Siehe [Einen Anschluss negieren](docs:components-and-options#negating-a-port).

## UND-Gatter {#and-gate}

![Ein UND-Gatter mit zwei Schaltern an den Eingängen und einer LED am Ausgang, das die vier Eingangsbelegungen durchläuft. Die LED leuchtet nur, wenn beide Schalter an sind.](./images/component-and-gate.webp)

Das UND-Gatter gibt 1 aus, wenn alle Eingänge 1 sind. Auf seinem Kasten steht `&`.

| Anschluss | Richtung | Bedeutung                     |
| --------- | -------- | ----------------------------- |
| Eingänge  | ein      | Die zu verknüpfenden Bits.    |
| Ausgang   | aus      | 1, wenn alle Eingänge 1 sind. |

| Option   | Werte    | Standard |
| -------- | -------- | -------- |
| Eingänge | 2 bis 64 | 2        |

| Eingang 1 | Eingang 2 | Ausgang |
| --------- | --------- | ------- |
| 0         | 0         | 0       |
| 0         | 1         | 0       |
| 1         | 0         | 0       |
| 1         | 1         | 1       |

Mit mehr Eingängen ist der Ausgang nur 1, solange alle 1 sind. Eine einzige 0 macht ihn 0.

Mit negiertem Ausgang wird das UND-Gatter zum NAND-Gatter.

## ODER-Gatter {#or-gate}

![Ein ODER-Gatter mit zwei Schaltern an den Eingängen und einer LED am Ausgang, das die vier Eingangsbelegungen durchläuft. Die LED leuchtet, wenn mindestens ein Schalter an ist.](./images/component-or-gate.webp)

Das ODER-Gatter gibt 1 aus, wenn mindestens ein Eingang 1 ist. Auf seinem Kasten steht `≥1`.

| Anschluss | Richtung | Bedeutung                             |
| --------- | -------- | ------------------------------------- |
| Eingänge  | ein      | Die zu verknüpfenden Bits.            |
| Ausgang   | aus      | 1, wenn mindestens ein Eingang 1 ist. |

| Option   | Werte    | Standard |
| -------- | -------- | -------- |
| Eingänge | 2 bis 64 | 2        |

| Eingang 1 | Eingang 2 | Ausgang |
| --------- | --------- | ------- |
| 0         | 0         | 0       |
| 0         | 1         | 1       |
| 1         | 0         | 1       |
| 1         | 1         | 1       |

Mit mehr Eingängen ist der Ausgang nur 0, solange alle 0 sind. Eine einzige 1 macht ihn 1.

Mit negiertem Ausgang wird das ODER-Gatter zum NOR-Gatter. Um mehrere Ausgänge auf einer Leitung zusammenzuführen, leite sie durch ein ODER-Gatter, statt sie direkt zu verbinden (siehe [Widersprüchliche Signale](docs:simulation#conflicting-signals)).

## XOR-Gatter {#xor-gate}

![Ein XOR-Gatter mit zwei Schaltern an den Eingängen und einer LED am Ausgang, das die vier Eingangsbelegungen durchläuft. Die LED leuchtet, wenn genau ein Schalter an ist.](./images/component-xor-gate.webp)

Das XOR-Gatter gibt 1 aus, wenn eine ungerade Anzahl von Eingängen 1 ist. Auf seinem Kasten steht `=1`.

| Anschluss | Richtung | Bedeutung                                         |
| --------- | -------- | ------------------------------------------------- |
| Eingänge  | ein      | Die zu verknüpfenden Bits.                        |
| Ausgang   | aus      | 1, wenn eine ungerade Anzahl von Eingängen 1 ist. |

| Option   | Werte    | Standard |
| -------- | -------- | -------- |
| Eingänge | 2 bis 64 | 2        |

| Eingang 1 | Eingang 2 | Ausgang |
| --------- | --------- | ------- |
| 0         | 0         | 0       |
| 0         | 1         | 1       |
| 1         | 0         | 1       |
| 1         | 1         | 0       |

Mit mehr Eingängen zählt das Gatter die Einsen: Ein oder drei Eingänge auf 1 ergeben 1, zwei oder vier ergeben 0. Es ist also nicht nur bei genau einem Eingang auf 1 gleich 1.

Mit negiertem Ausgang wird das XOR-Gatter zum XNOR-Gatter.

## Siehe auch {#see-also}

- [Komponenten und Optionen](docs:components-and-options): die Palette, die Einstellungskarte und einen Anschluss negieren
- [Speicher](docs:memory): Flip-Flops, ROM und RAM
- [Addierer und Selektoren](docs:adders-and-selectors): Halb- und Volladdierer als eine Komponente
- [Simulation](docs:simulation): eine Schaltung laufen lassen
