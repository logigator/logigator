# Benutzerdefinierte Komponenten

Eine benutzerdefinierte Komponente macht aus einer Schaltung ein einzelnes Bauteil mit eigenem Symbol und benannten Anschlüssen. Baue einen Zähler einmal, und jede Kopie davon ist auf der Arbeitsfläche ein Kasten statt eines Dutzends Gatter.

![Eine Gatterschaltung und die daraus gebaute Komponente, nebeneinander in Betrieb.](./images/custom-component-showcase.webp)

## Eine Komponente erstellen

1. Wähle Datei → Neue Komponente (`Alt+N`) oder die Schaltfläche „Neue Komponente“ in der Werkzeugleiste. Ein Dialog öffnet sich.
2. Fülle den Dialog aus:
   - Name, bis 20 Zeichen, ist der Name in der Palette.
   - Symbol, bis 5 Zeichen, steht auf dem Kasten.
   - Beschreibung ist optional.
   - Speicherort legt fest, wo die Komponente liegt. Lokal hält sie in diesem Browser. Cloud hält sie in deinem Account, setzt eine Anmeldung voraus und fragt zusätzlich, wer sie öffnen kann, mit Alle als Vorauswahl (siehe [Cloud und Teilen](docs:cloud#teilen)).
3. Klicke auf „Erstellen“. Die Komponente öffnet sich in einem neuen Tab mit leerer Arbeitsfläche.
4. Baue ihre Schaltung und gib ihr [Anschlüsse](#anschlüsse).
5. Speichere (`Ctrl+S`) in diesem Tab, um die Komponente zu speichern.

## Anschlüsse

Solange der Tab einer Komponente aktiv ist, steht über der Palette ein Anschlüsse-Bereich. Setze daraus Eingangs- und Ausgangsstecker und verbinde sie mit der Schaltung. Jeder Stecker wird ein Anschluss der fertigen Komponente.

Der Bereich listet die Stecker. Tippe in eine Zeile, um den Anschluss zu benennen, mit bis zu 5 Zeichen; der Name steht neben dem Anschluss auf dem Kasten. Ziehe die Zeilen, um die Reihenfolge der Anschlüsse zu ändern; wo die Stecker auf der Arbeitsfläche liegen, spielt keine Rolle.

![Der Tab einer Komponente mit ihren Eingangs- und Ausgangssteckern.](./images/custom-component-tab.webp)

## Platzieren und aktualisieren

Gespeicherte Komponenten erscheinen in der Palette unter Benutzerdefiniert, die zuletzt bearbeitete zuerst. Du platzierst sie wie jedes andere Bauteil. Jede Kopie auf der Arbeitsfläche ist ein Kasten mit dem Symbol und einem Anschluss pro Stecker.

Eine platzierte Kopie behält die Schaltung, die die Komponente beim Platzieren hatte. Spätere Änderungen an der Komponente betreffen keine Kopie, bis du sie aktualisierst. Die Kachel in der Palette trägt einen Pfeil, solange Kopien veraltet sind.

Die Einstellungskarte einer platzierten Kopie oder der Palettenkachel hat diese Aktionen:

| Aktion                            | Was sie tut                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Auf neueste Version aktualisieren | Aktualisiert diese Kopie. Nur bei einer veralteten Kopie.                                                         |
| Alle Instanzen aktualisieren      | Aktualisiert jede veraltete Kopie in der offenen Schaltung. Die Anzahl steht in Klammern.                         |
| Schaltung bearbeiten              | Öffnet die Schaltung der Komponente, um sie zu ändern.                                                            |
| Details bearbeiten                | Ändert Name, Symbol und Beschreibung. Platzierte Kopien behalten die alten Details, bis du sie aktualisierst.     |
| In die Cloud hochladen            | Verschiebt eine lokale Komponente in deinen Account. Siehe [Cloud und Teilen](docs:cloud#in-die-cloud-hochladen). |
| Teilen                            | Öffnet den Teilen-Dialog einer Cloud-Komponente. Siehe [Cloud und Teilen](docs:cloud#teilen).                     |
| Löschen                           | Entfernt die Komponente aus deiner Bibliothek. Siehe [Löschen](#löschen).                                         |
| Wiederherstellen & bearbeiten     | Nur bei einer Kopie, deren Komponente gelöscht wurde. Holt sie in deine lokale Bibliothek zurück.                 |

Beide Aktualisierungen lassen sich rückgängig machen.

## Verschachteln

Komponenten können andere Komponenten enthalten. Eine Komponente kann sich nie selbst enthalten, weder direkt noch über eine andere, daher blendet die Palette beim Bearbeiten jede Komponente aus, die eine solche Schleife erzeugen würde.

Wenn du eine Schaltung speicherst, teilst oder exportierst, gehören die verwendeten Komponenten dazu, sodass sie überall vollständig öffnet.

## Löschen

„Löschen“ in der Einstellungskarte entfernt die Komponente aus deiner Bibliothek. Bereits platzierte Kopien bleiben in ihren Schaltungen und zeigen das Kennzeichen Eingebettet. „Wiederherstellen & bearbeiten“ auf einer solchen Kopie holt sie in deine lokale Bibliothek zurück. Löschst du eine Cloud-Komponente, funktioniert auch ihr Freigabelink nicht mehr.

## Siehe auch

- [Komponenten und Optionen](docs:components-and-options): die eingebauten Bauteile
- [Inspektion und Beobachtungen](docs:inspection): in eine laufende Kopie hineinsehen
- [Cloud und Teilen](docs:cloud): Komponenten hochladen und teilen
- [Speichern und Dateien](docs:saving-and-files): wie Komponenten in Dateien mitreisen
