# Benutzerdefinierte Komponenten

Eine benutzerdefinierte Komponente macht aus einer Schaltung ein einzelnes Bauteil mit eigenem Symbol und benannten Anschlüssen. Baue einen Zähler einmal, und jede Kopie davon ist auf der Arbeitsfläche ein Kasten statt eines Dutzends Gatter.

![Eine Gatterschaltung und die daraus gebaute Komponente, nebeneinander in Betrieb.](./images/custom-component-showcase.webp)

## Eine Komponente erstellen

Datei → Neue Komponente (`Alt+N`) oder die Schaltfläche „Neue Komponente“ in der Werkzeugleiste öffnet einen Dialog:

- Name, bis 20 Zeichen, ist der Name in der Palette.
- Symbol, bis 5 Zeichen, steht auf dem Kasten.
- Beschreibung ist optional.
- Speicherort legt fest, wo die Komponente liegt. Lokal hält sie in diesem Browser. Cloud hält sie in deinem Account, setzt eine Anmeldung voraus und fragt zusätzlich, wer sie öffnen kann, mit Alle als Vorauswahl (siehe [Cloud und Teilen](docs:cloud)).

„Erstellen“ öffnet die Komponente in einem neuen Tab mit leerer Arbeitsfläche. Speichern (`Ctrl+S`) in diesem Tab speichert die Komponente.

## Anschlüsse

Solange der Tab einer Komponente aktiv ist, steht über der Palette ein Anschlüsse-Bereich. Setze daraus Eingangs- und Ausgangsstecker und verbinde sie mit der Schaltung. Jeder Stecker wird ein Anschluss der fertigen Komponente.

Der Bereich listet die Stecker. Tippe in eine Zeile, um den Anschluss zu benennen, mit bis zu 5 Zeichen; der Name steht neben dem Anschluss auf dem Kasten. Ziehe die Zeilen, um die Reihenfolge der Anschlüsse zu ändern; wo die Stecker auf der Arbeitsfläche liegen, spielt keine Rolle.

![Der Tab einer Komponente mit ihren Eingangs- und Ausgangssteckern.](./images/custom-component-tab.webp)

## Platzieren und aktualisieren

Gespeicherte Komponenten erscheinen in der Palette unter Benutzerdefiniert, die zuletzt bearbeitete zuerst. Du platzierst sie wie jedes andere Bauteil. Jede Kopie auf der Arbeitsfläche ist ein Kasten mit dem Symbol und einem Anschluss pro Stecker.

Eine platzierte Kopie behält die Schaltung, die die Komponente beim Platzieren hatte. Spätere Änderungen an der Komponente betreffen keine Kopie, bis du sie aktualisierst. Die Einstellungskarte einer veralteten Kopie bietet „Auf neueste Version aktualisieren“ für diese Kopie und „Alle Instanzen aktualisieren“ für jede veraltete Kopie in der offenen Schaltung, mit der Anzahl in Klammern. Beides lässt sich rückgängig machen. Die Kachel in der Palette trägt einen Pfeil, solange Kopien veraltet sind.

Um die Schaltung zu ändern, wähle „Schaltung bearbeiten“ in der Einstellungskarte einer platzierten Kopie oder der Palettenkachel. „Details bearbeiten“ ändert Name, Symbol und Beschreibung.

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
