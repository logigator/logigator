# Speicher

Ein Flip-Flop speichert ein Bit. ROM und RAM speichern Wörter aus mehreren Bits, jedes an einer nummerierten Adresse. Alle fünf stehen in der Kategorie Speicher der Palette.

Ein Flip-Flop ändert sein Bit nur, wenn sein Eingang CLK von 0 auf 1 steigt. Q führt das Bit und !Q sein Gegenteil. Jedes Flip-Flop beginnt mit Q auf 0 und !Q auf 1. Zwischen steigenden Flanken haben Änderungen an den anderen Eingängen keine Wirkung. Ein Negationskreis an CLK lässt ein Flip-Flop stattdessen auf die fallende Flanke reagieren, wenn CLK von 1 auf 0 geht (siehe [Einen Anschluss negieren](docs:components-and-options#negating-a-port)). Die übliche Quelle für CLK ist ein [Taktgeber](docs:clock-and-timing#clock).

Ein ROM hält einen Inhalt, den du beim Bearbeiten festlegst, und die Schaltung kann ihn nur lesen. Ein RAM ist anfangs leer, und die Schaltung schreibt hinein. Während einer Simulation öffnet ein Klick auf ein ROM oder ein RAM eine Ansicht mit seinem Inhalt (siehe [Inspektion und Beobachtungen](docs:inspection)).

## D-Flip-Flop {#d-flip-flop}

![Ein D-Flip-Flop mit Schaltern an D und CLK und LEDs an Q und !Q. Q übernimmt den Wert von D, wenn CLK steigt, und behält ihn, wenn sich D ändert, während CLK 0 ist.](./images/component-d-flip-flop.webp)

Das D-Flip-Flop speichert bei jeder steigenden Flanke von CLK das Bit an D.

| Anschluss | Richtung | Bedeutung                                |
| --------- | -------- | ---------------------------------------- |
| D         | ein      | Das zu speichernde Bit.                  |
| CLK       | ein      | Speichert D, wenn er von 0 auf 1 steigt. |
| Q         | aus      | Das gespeicherte Bit.                    |
| !Q        | aus      | Das Gegenteil von Q.                     |

Außer Richtung hat es keine Optionen.

| D   | Q nach der steigenden Flanke |
| --- | ---------------------------- |
| 0   | 0                            |
| 1   | 1                            |

## JK-Flip-Flop {#jk-flip-flop}

![Ein JK-Flip-Flop mit Schaltern an J, CLK und K und LEDs an Q und !Q. Bei aufeinanderfolgenden steigenden Flanken von CLK wird es mit J an gesetzt, mit K an zurückgesetzt und dann mit J und K an zweimal gekippt.](./images/component-jk-flip-flop.webp)

Das JK-Flip-Flop setzt, löscht oder kippt sein Bit bei jeder steigenden Flanke von CLK.

| Anschluss | Richtung | Bedeutung                                      |
| --------- | -------- | ---------------------------------------------- |
| J         | ein      | Setzt das Bit.                                 |
| CLK       | ein      | Wendet J und K an, wenn er von 0 auf 1 steigt. |
| K         | ein      | Setzt das Bit zurück.                          |
| Q         | aus      | Das gespeicherte Bit.                          |
| !Q        | aus      | Das Gegenteil von Q.                           |

Außer Richtung hat es keine Optionen.

| J   | K   | Q nach der steigenden Flanke |
| --- | --- | ---------------------------- |
| 0   | 0   | Unverändert                  |
| 1   | 0   | 1                            |
| 0   | 1   | 0                            |
| 1   | 1   | Invertiert                   |

Sind J und K beide 1, wechselt Q bei jeder steigenden Flanke und läuft so mit der halben Frequenz des Signals an CLK.

## SR-Flip-Flop {#sr-flip-flop}

![Ein SR-Flip-Flop mit Schaltern an S, CLK und R und LEDs an Q und !Q. Eine steigende Flanke mit S an setzt Q, und eine steigende Flanke mit R an setzt es zurück.](./images/component-sr-flip-flop.webp)

Das SR-Flip-Flop setzt oder löscht sein Bit bei jeder steigenden Flanke von CLK.

| Anschluss | Richtung | Bedeutung                                      |
| --------- | -------- | ---------------------------------------------- |
| S         | ein      | Setzt das Bit.                                 |
| CLK       | ein      | Wendet S und R an, wenn er von 0 auf 1 steigt. |
| R         | ein      | Setzt das Bit zurück.                          |
| Q         | aus      | Das gespeicherte Bit.                          |
| !Q        | aus      | Das Gegenteil von Q.                           |

Außer Richtung hat es keine Optionen.

| S   | R   | Q nach der steigenden Flanke | !Q nach der steigenden Flanke |
| --- | --- | ---------------------------- | ----------------------------- |
| 0   | 0   | Unverändert                  | Unverändert                   |
| 1   | 0   | 1                            | 0                             |
| 0   | 1   | 0                            | 1                             |
| 1   | 1   | 1, Konflikt                  | 0, Konflikt                   |

S und R gleichzeitig auf 1 ist eine Eingangsbelegung, die ein SR-Flip-Flop nicht erlaubt. Die Simulation setzt Q auf 1 und !Q auf 0 und zeichnet beide Ausgangsleitungen orange, bis eine steigende Flanke kommt, bei der nur S oder nur R auf 1 ist. Siehe [Widersprüchliche Signale](docs:simulation#conflicting-signals). Wo beide gleichzeitig 1 sein können, nimm stattdessen ein D- oder JK-Flip-Flop.

## ROM {#rom}

![Ein ROM mit vier Schaltern an seinen Adresseingängen, auf Adresse 3 gestellt, und vier LEDs an seinen Ausgängen, die das gespeicherte Wort 0111 zeigen.](./images/component-rom.webp)

Das ROM gibt das Wort aus, das an der Adresse an seinen A-Eingängen gespeichert ist. Es hat keinen Takt: Die Ausgänge folgen der Adresse. Der Inhalt kann sich nicht ändern, während die Simulation läuft.

| Anschluss | Richtung | Bedeutung                                           |
| --------- | -------- | --------------------------------------------------- |
| A1, A2, … | ein      | Die Adresse, A1 ist das niedrigste Bit.             |
| O1, O2, … | aus      | Das Wort an der Adresse, O1 ist das niedrigste Bit. |

| Option            | Werte                 | Standard |
| ----------------- | --------------------- | -------- |
| Wortbreite        | 1 bis 64              | 4        |
| Adressgröße       | 1 bis 12              | 4        |
| Inhalt bearbeiten | Öffnet den Hex-Editor | Leer     |

Wortbreite legt fest, wie viele Bits ein Wort hat, und damit die Zahl der Ausgänge. Adressgröße legt die Zahl der Adresseingänge fest. Ein ROM mit Adressgröße n hält 2ⁿ Wörter: standardmäßig 16, höchstens 4.096.

### Den Inhalt bearbeiten {#editing-the-contents}

„Inhalt bearbeiten“ in der Einstellungskarte zeigt, wie viele Wörter belegt sind, etwa „3 von 16 Wörtern belegt“, oder „Leer“. Ein Klick darauf öffnet „ROM-Inhalt bearbeiten“, eine Tabelle mit einer Zelle pro Wort. Wörter, die du nicht belegst, sind 0.

- Wörter oder Bytes legt fest, ob eine Zelle ein Wort oder ein Byte des Inhalts ist.
- Hex, Dezimal, Oktal oder Binär wählt das Zahlensystem, in dem Werte angezeigt und eingetippt werden.
- Das Feld „Adresse…“ springt zu einer Adresse, die du hexadezimal eintippst.
- Einfügen in eine Zelle füllt sie und die Zellen danach, einen Wert pro Zelle, sodass du eine Liste von Werten einfügen kannst, getrennt durch Leerzeichen oder Zeilenumbrüche.
- „Kopieren“ legt die ganze Tabelle als Text in die Zwischenablage.
- „Leeren“ setzt nach einer Rückfrage jedes Wort auf 0.
- „Speichern“ übernimmt die Änderungen, „Abbrechen“ verwirft sie.

Der Inhalt wird mit der Schaltung gespeichert. Während einer Simulation hebt die Ansicht des ROM das Wort an der aktuellen Adresse hervor (siehe [ROM-Inhalt](docs:inspection#rom-contents)).

## RAM {#ram}

![Ein RAM mit Adressgröße 2, Schaltern an A0, A1, D0 bis D3, WE und CLK und LEDs an seinen Ausgängen. 0101 wird an Adresse 0 gespeichert, wenn CLK bei eingeschaltetem WE steigt, bleibt an den Ausgängen, nachdem die Datenschalter ausgeschaltet sind, verschwindet, wenn Adresse 1 gewählt wird, und kommt mit Adresse 0 zurück.](./images/component-ram.webp)

Das RAM gibt das Wort aus, das an der Adresse an seinen A-Eingängen gespeichert ist. Bei der steigenden Flanke von CLK speichert es das Wort an seinen D-Eingängen an dieser Adresse, solange WE 1 ist.

| Anschluss | Richtung | Bedeutung                                                                  |
| --------- | -------- | -------------------------------------------------------------------------- |
| A0, A1, … | ein      | Die Adresse, A0 ist das niedrigste Bit.                                    |
| D0, D1, … | ein      | Das zu speichernde Wort, D0 ist das niedrigste Bit.                        |
| WE        | ein      | Schreibfreigabe. Solange er 1 ist, speichert eine steigende Flanke an CLK. |
| CLK       | ein      | Speichert die D-Eingänge, wenn er von 0 auf 1 steigt, solange WE 1 ist.    |
| D0, D1, … | aus      | Das Wort an der Adresse, D0 ist das niedrigste Bit.                        |

Die Dateneingänge und die Ausgänge tragen dieselben Beschriftungen, auf gegenüberliegenden Seiten der Komponente.

| Option      | Werte            | Standard |
| ----------- | ---------------- | -------- |
| Wortbreite  | 1 bis 64         | 4        |
| Adressgröße | 1 bis 16         | 4        |
| Lesen       | Sofort, Bei Takt | Sofort   |

Wortbreite legt fest, wie viele Bits ein Wort hat, und damit die Zahl der Dateneingänge und Ausgänge. Ein RAM mit Adressgröße n hält 2ⁿ Wörter: standardmäßig 16, höchstens 65.536.

Lesen legt fest, wann sich die Ausgänge ändern:

| Lesen    | Die Ausgänge ändern sich                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------- |
| Sofort   | Immer, wenn sich die Adresse ändert oder dort ein neues Wort gespeichert wird.                        |
| Bei Takt | Nur bei der steigenden Flanke von CLK, die das Wort an der Adresse liest oder das gespeicherte zeigt. |

Mit einem Negationskreis an CLK speichert das RAM, und liest bei „Bei Takt“, stattdessen bei der fallenden Flanke (siehe [Einen Anschluss negieren](docs:components-and-options#negating-a-port)).

Beim Start der Simulation ist jedes Wort 0, und „Stopp“ setzt alle wieder auf 0. Der Inhalt wird nicht mit der Schaltung gespeichert; für einen festen Anfangsinhalt nimm ein ROM. Während einer Simulation zeigt die Ansicht des RAM, was die Schaltung gespeichert hat (siehe [RAM-Inhalt](docs:inspection#ram-contents)).

## Siehe auch {#see-also}

- [Komponenten und Optionen](docs:components-and-options): einen Anschluss negieren, etwa CLK
- [Zeitsteuerung](docs:clock-and-timing): Taktsignale für CLK
- [Inspektion und Beobachtungen](docs:inspection): ROM- und RAM-Inhalte während einer Simulation ansehen
- [Addierer und Selektoren](docs:adders-and-selectors): Dekodierer und Multiplexer zum Adressieren
- [Logikgatter](docs:logic-gates): Bits verknüpfen, ohne sie zu speichern
- [Simulation](docs:simulation): eine Schaltung Tick für Tick durchgehen
