# Arbeitsfläche & Werkzeuge

Die Arbeitsfläche ist das Raster, auf dem du deine Schaltung baust. Diese Seite behandelt, wie du dich darauf bewegst und wie jedes Bearbeitungswerkzeug funktioniert.

![Der Editor mit Komponentenpalette, Arbeitsfläche und Werkzeugleiste.](../images/board-overview.png)

## Sich auf der Arbeitsfläche bewegen

- **Zoomen** — scrolle mit dem Mausrad über der Arbeitsfläche oder spreize die Finger auf einem Touch-Gerät. Du kannst auch die Zoom-Schaltflächen in der Werkzeugleiste, **Ansicht → Einzoomen / Auszoomen** oder **Ansicht → Zoom 100%** verwenden, um auf die tatsächliche Größe zurückzusetzen.
- **Schwenken** — wähle das Werkzeug **Schwenken** (die Hand) und ziehe. Du kannst auch aus _jedem_ Werkzeug heraus schwenken, indem du mit der **rechten Maustaste** ziehst, sodass du selten das Werkzeug wechseln musst, nur um die Ansicht zu verschieben.
- **Touch** — ziehe jederzeit mit zwei Fingern zum Schwenken und spreize sie zum Zoomen; ein Ziehen mit einem Finger schwenkt nur, solange das Werkzeug Schwenken aktiv ist.

Die **Statusleiste** am unteren Rand zeigt stets eine kurze Erinnerung daran, was das aktive Werkzeug tut, sowie die Position deines Cursors auf dem Raster.

## Die Werkzeuge der Werkzeugleiste

Die rechte Gruppe der Werkzeugleiste enthält die fünf Zeichenwerkzeuge. Nur eines ist jeweils aktiv; jedes hat außerdem ein Einzeltasten-Kürzel.

| Werkzeug      | Kürzel | Was es tut                                                                                                                                                                                        |
| ------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schwenken** | `P`    | Ziehen, um die Arbeitsfläche zu bewegen; scrollen oder spreizen zum Zoomen.                                                                                                                       |
| **Leitung**   | `W`    | Ziehen, um Leitungen zu zeichnen; auf einen Anschluss tippen zum Negieren oder auf eine Kreuzung tippen zum Verbinden oder Trennen. Siehe [Leitungen & Verbindungen](docs:wires-and-connections). |
| **Auswahl**   | `S`    | Einen Rahmen ziehen, um Elemente auszuwählen; die Auswahl ziehen, um sie zu verschieben.                                                                                                          |
| **Radieren**  | `E`    | Auf Elemente klicken oder darüberziehen, um sie zu löschen.                                                                                                                                       |
| **Text**      | `T`    | Eine Textbeschriftung auf der Arbeitsfläche platzieren.                                                                                                                                           |

![Die fünf Werkzeug-Schaltflächen in der Werkzeugleiste.](../images/tool-buttons.png)

## Komponenten platzieren

Um eine Komponente hinzuzufügen, wähle sie aus der [Komponentenpalette](docs:components-and-options) links. Eine Vorschau der Komponente folgt dann deinem Cursor auf der Arbeitsfläche — bewege sie an die gewünschte Stelle, dann drücke und lass los, um sie abzulegen. Das Platzieren bleibt scharfgeschaltet, sodass du mehrere derselben Komponente nacheinander ablegen kannst. Drücke `Escape` oder wähle ein anderes Werkzeug, um das Platzieren zu beenden.

Eine Komponente kann nicht auf einem anderen Element abgelegt werden; die Vorschau zeigt, wo sie landen wird.

## Auswählen, Verschieben und Drehen

Ziehe mit dem Werkzeug **Auswahl** einen Rahmen (ein Auswahlrechteck) über die gewünschten Elemente. Alles, was der Rahmen berührt — Komponenten und Leitungen — wird ausgewählt. Um eine Auswahl zu verschieben, ziehe von innerhalb an eine neue Stelle.

Sobald etwas ausgewählt ist, kannst du:

- Es **drehen** — drücke `R` für im Uhrzeigersinn, `Shift+R` für gegen den Uhrzeigersinn, oder nutze die Dreh-Schaltflächen in der Werkzeugleiste.
- Es mit den **Pfeiltasten** um jeweils eine Rastereinheit **verschieben**.

Wie beim Platzieren wird ein Verschieben oder Drehen erst übernommen, wenn die Elemente auf einer freien Stelle landen.

## Leitungen an der Auswahlkante schneiden

Das Auswahlwerkzeug hat einen **Scheren**-Modus, der Leitungen exakt an der Kante deines Auswahlrahmens abschneidet, statt ganze Leitungen zu greifen. Das ist praktisch, um eine Leitung aus der Mitte eines Busses herauszuschneiden.

Ein kleines Pill schwebt über der Arbeitsfläche, solange das Auswahlwerkzeug aktiv ist — klicke es an, um den Scherenmodus zu aktivieren. Auf dem Desktop kannst du auch einfach `Alt` **gedrückt halten**, während du den Auswahlrahmen ziehst, um für dieses eine Ziehen zu schneiden; das Pill leuchtet auf, um zu zeigen, dass der Modus aktiv ist. Alles, was der Rahmen vollständig enthält, bleibt ausgewählt, und Leitungen, die die Rahmenkante kreuzen, werden dort geschnitten.

![Das schwebende Scheren-Umschalt-Pill über der Arbeitsfläche.](../images/scissor-select.png)

## Kopieren, Ausschneiden, Einfügen und Löschen

Das Standard-Bearbeiten wirkt auf die aktuelle Auswahl:

- **Kopieren** (`Ctrl+C`) und **Ausschneiden** (`Ctrl+X`) legen die Auswahl in die Zwischenablage; Ausschneiden entfernt sie zudem.
- **Einfügen** (`Ctrl+V`) bringt die kopierten Elemente zurück, leicht versetzt gegenüber den Originalen. Sie erscheinen als Vorschau, die du positionierst — ziehe sie an eine freie Stelle und lass los, um sie abzulegen, oder drücke `Escape` zum Abbrechen.
- **Löschen** (`Delete`) entfernt die Auswahl.

Diese Befehle finden sich auch in der Werkzeugleiste und im Menü **Bearbeiten**. Jede Bearbeitung lässt sich mit **Rückgängig** (`Ctrl+Z`) rückgängig machen und mit **Wiederholen** (`Ctrl+Shift+Z`) wiederholen.

## Radieren

Das Werkzeug **Radieren** (der Radiergummi) ist der schnellste Weg, Dinge zu entfernen: Klicke ein Element an, um es zu löschen, oder ziehe über mehrere, um sie alle wegzuwischen. Drücke `Escape` mitten im Ziehen, um abzubrechen und das Radierte wiederherzustellen.

## Die Minimap

Die Minimap in der unteren rechten Ecke zeigt deine gesamte Schaltung auf einmal, mit einem Rahmen, der den Teil markiert, den du gerade betrachtest — nützlich, um sich auf einer großen Arbeitsfläche zurechtzufinden. Klappe sie mit ihrem Umschalter ein, wenn du den Platz brauchst.

## Siehe auch

- [Leitungen & Verbindungen](docs:wires-and-connections) — Leitungen zeichnen, Kreuzungen und Verbindungen umschalten
- [Komponenten & Optionen](docs:components-and-options) — die Bauteile, die du platzierst und konfigurierst
- [Tastaturbefehle](docs:shortcuts) — ändere jede der hier verwendeten Belegungen
