# Addierer und Selektoren

Addierer addieren einzelne Bits und liefern ein Summenbit und einen Übertrag. Selektoren leiten Signale nach einer Binärzahl: Ein Multiplexer wählt einen von mehreren Eingängen, ein Demultiplexer schickt einen Eingang an einen von mehreren Ausgängen, ein Dekodierer macht aus einer Zahl einen einzelnen Ausgang auf 1, und ein Enkodierer macht aus dem höchsten Eingang auf 1 wieder eine Zahl. Alle sechs stehen in der Kategorie Addierer und Selektoren der Palette.

## Halbaddierer

![Ein Halbaddierer mit Schaltern an A und B und LEDs an S und C, der die vier Eingangsbelegungen durchläuft. Sind beide an, ist S aus und C leuchtet.](./images/component-half-adder.webp)

Der Halbaddierer addiert zwei Bits.

| Anschluss | Richtung | Bedeutung         |
| --------- | -------- | ----------------- |
| A         | ein      | Das erste Bit.    |
| B         | ein      | Das zweite Bit.   |
| S         | aus      | Das Summenbit.    |
| C         | aus      | Das Übertragsbit. |

Außer Richtung hat er keine Optionen.

| A   | B   | S   | C   |
| --- | --- | --- | --- |
| 0   | 0   | 0   | 0   |
| 0   | 1   | 1   | 0   |
| 1   | 0   | 1   | 0   |
| 1   | 1   | 0   | 1   |

## Volladdierer

![Ein Volladdierer mit Schaltern an A, B und Cin und LEDs an S und C, der keine, eine, zwei (C leuchtet) und drei Einsen (S und C leuchten) addiert.](./images/component-full-adder.webp)

Der Volladdierer addiert zwei Bits und einen Übertrag.

| Anschluss | Richtung | Bedeutung                                        |
| --------- | -------- | ------------------------------------------------ |
| A         | ein      | Das erste Bit.                                   |
| B         | ein      | Das zweite Bit.                                  |
| Cin       | ein      | Der Übertragseingang, vom nächstniedrigeren Bit. |
| S         | aus      | Das Summenbit.                                   |
| C         | aus      | Das Übertragsbit, für das nächsthöhere Bit.      |

Außer Richtung hat er keine Optionen.

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

Um Zahlen aus mehreren Bits zu addieren, nimm einen Addierer pro Bit und verbinde C jedes Addierers mit Cin des Addierers für das nächsthöhere Bit. Für das niedrigste Bit genügt ein Halbaddierer, da es keinen Übertragseingang hat.

## Multiplexer

![Ein Multiplexer mit Schaltern an S0 und den Dateneingängen 0 und 1, Eingang 0 an, und einer LED am Ausgang. Die LED leuchtet, solange S0 aus ist, und geht aus, wenn S0 Eingang 1 wählt.](./images/component-multiplexer.webp)

Der Multiplexer gibt den Dateneingang, den die Auswahlleitungen wählen, an seinen Ausgang weiter. Bei n Auswahlleitungen gibt es 2ⁿ Dateneingänge.

| Anschluss  | Richtung | Bedeutung                                        |
| ---------- | -------- | ------------------------------------------------ |
| S0, S1, …  | ein      | Die Auswahlleitungen, S0 ist das niedrigste Bit. |
| 0, 1, 2, … | ein      | Die Dateneingänge.                               |
| Ausgang    | aus      | Der Wert des gewählten Dateneingangs.            |

Der Ausgang hat keine Beschriftung.

| Option           | Werte   | Standard |
| ---------------- | ------- | -------- |
| Auswahlleitungen | 1 bis 6 | 1        |

Mit 2 Auswahlleitungen:

| S1  | S0  | Ausgang   |
| --- | --- | --------- |
| 0   | 0   | Eingang 0 |
| 0   | 1   | Eingang 1 |
| 1   | 0   | Eingang 2 |
| 1   | 1   | Eingang 3 |

## Demultiplexer

![Ein Demultiplexer mit Schaltern an S0 und I, I an, und LEDs an den Ausgängen 0 und 1. Die leuchtende LED wechselt von Ausgang 0 zu Ausgang 1, wenn S0 eingeschaltet wird.](./images/component-demultiplexer.webp)

Der Demultiplexer gibt Eingang I an den Ausgang weiter, den die Auswahlleitungen wählen. Jeder andere Ausgang ist 0. Bei n Auswahlleitungen gibt es 2ⁿ Ausgänge.

| Anschluss  | Richtung | Bedeutung                                        |
| ---------- | -------- | ------------------------------------------------ |
| S0, S1, …  | ein      | Die Auswahlleitungen, S0 ist das niedrigste Bit. |
| I          | ein      | Der Dateneingang.                                |
| 0, 1, 2, … | aus      | Die Ausgänge.                                    |

| Option           | Werte   | Standard |
| ---------------- | ------- | -------- |
| Auswahlleitungen | 1 bis 6 | 1        |

Mit 2 Auswahlleitungen:

| S1  | S0  | Ausgang mit I |
| --- | --- | ------------- |
| 0   | 0   | 0             |
| 0   | 1   | 1             |
| 1   | 0   | 2             |
| 1   | 1   | 3             |

Die Auswahlleitungen kommen zuerst, wie beim Multiplexer. Ein Demultiplexer aus einer älteren Schaltung behält I als ersten Eingang, vor den Auswahlleitungen, und funktioniert sonst genauso. Die Beschriftung am Bauteil zeigt die Reihenfolge.

## Dekodierer

![Ein Dekodierer mit Schaltern an seinen Eingängen 1 und 2 und LEDs an seinen vier Ausgängen, der von 0 bis 3 zählt, sodass die leuchtende LED von Ausgang 0 bis Ausgang 3 wandert.](./images/component-decoder.webp)

Der Dekodierer setzt den einen Ausgang auf 1, dessen Nummer dem Binärwert an seinen Eingängen entspricht. Jeder andere Ausgang ist 0. Bei n Eingängen gibt es 2ⁿ Ausgänge.

| Anschluss  | Richtung | Bedeutung                                             |
| ---------- | -------- | ----------------------------------------------------- |
| 1, 2, 4, … | ein      | Die Bits der Zahl, jedes mit seinem Wert beschriftet. |
| 0, 1, 2, … | aus      | Ein Ausgang pro Zahl.                                 |

| Option   | Werte   | Standard |
| -------- | ------- | -------- |
| Eingänge | 1 bis 6 | 2        |

Mit 2 Eingängen:

| 2   | 1   | Ausgang auf 1 |
| --- | --- | ------------- |
| 0   | 0   | 0             |
| 0   | 1   | 1             |
| 1   | 0   | 2             |
| 1   | 1   | 3             |

## Enkodierer

![Ein Enkodierer mit der Option Ausgänge auf 2, Schaltern an seinen vier Eingängen und LEDs an den Ausgängen 1, 2 und V. Ist kein Eingang an, ist V aus. Eingang 0 allein lässt nur V leuchten, und die Eingänge 2 und dann 3 ergeben 2 und dann 3, den höchsten Eingang, der an ist.](./images/component-encoder.webp)

Der Enkodierer gibt die Nummer des höchsten Eingangs aus, der 1 ist. V ist 1, solange irgendein Eingang 1 ist, sodass sich Eingang 0 von keinem Eingang unterscheiden lässt. Bei n Ausgängen, V nicht mitgezählt, gibt es 2ⁿ Eingänge.

| Anschluss  | Richtung | Bedeutung                                             |
| ---------- | -------- | ----------------------------------------------------- |
| 0, 1, 2, … | ein      | Ein Eingang pro Zahl.                                 |
| 1, 2, 4, … | aus      | Die Bits der Zahl, jedes mit seinem Wert beschriftet. |
| V          | aus      | 1, solange irgendein Eingang 1 ist.                   |

| Option   | Werte   | Standard |
| -------- | ------- | -------- |
| Ausgänge | 1 bis 6 | 1        |

Mit 2 Ausgängen, wobei x heißt, dass der Eingang 0 oder 1 sein kann:

| 3   | 2   | 1   | 0   | Ausgang 2 | Ausgang 1 | V   |
| --- | --- | --- | --- | --------- | --------- | --- |
| 0   | 0   | 0   | 0   | 0         | 0         | 0   |
| 0   | 0   | 0   | 1   | 0         | 0         | 1   |
| 0   | 0   | 1   | x   | 0         | 1         | 1   |
| 0   | 1   | x   | x   | 1         | 0         | 1   |
| 1   | x   | x   | x   | 1         | 1         | 1   |

Ein Enkodierer aus einer älteren Schaltung hat kein V.

## Siehe auch

- [Komponenten und Optionen](docs:components-and-options): die Palette und die Einstellungskarte
- [Logikgatter](docs:logic-gates): NICHT, UND, ODER und XOR
- [Speicher](docs:memory): Wörter an einer Adresse lesen
- [Ausgaben](docs:outputs): eine Binärzahl auf einem Segment Display zeigen
