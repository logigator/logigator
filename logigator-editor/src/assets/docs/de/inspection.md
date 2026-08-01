# Inspektion & Beobachtungen

Manche Komponenten lassen dich in sie hineinschauen, während deine Schaltung läuft. Du kannst den Inhalt eines Speichers an der Adresse lesen, die er gerade liest, oder eine live-interaktive Ansicht der inneren Schaltung einer benutzerdefinierten Komponente öffnen.

![Ein Beobachtungsfenster über einer laufenden Schaltung.](../images/inspection-showcase.png)

Die Inspektion ist nur verfügbar, **während eine [Simulation](docs:simulation) läuft**. Betritt zuerst die Simulation, tippe dann auf eine Komponente, die die Inspektion unterstützt, um ihre Ansicht zu öffnen. Erneutes Tippen holt dieselbe Ansicht wieder nach vorn, und das Verlassen der Simulation schließt alles.

Auf dem Desktop öffnen sich diese Ansichten als schwebende Fenster, die du herumziehen und über der Arbeitsfläche stapeln kannst. Auf Smartphones und schmalen Bildschirmen erscheinen sie stattdessen als ein Panel, das von unten hochgleitet, und Beobachtungen übernehmen den ganzen Bildschirm — die laufende Schaltung bleibt dahinter sichtbar und interaktiv.

## Speicherinhalt inspizieren

Tippe auf ein **ROM**, während die Simulation läuft, um einen schreibgeschützten Betrachter seiner gespeicherten Daten zu öffnen. Das Wort, das die Schaltung **gerade adressiert**, ist hervorgehoben und aktualisiert sich live, während sich die Adresse ändert, sodass du genau verfolgen kannst, was der Speicher in die Schaltung zurückspeist.

![Das Speicher-Inspektionsfenster mit hervorgehobenem adressiertem Wort.](../images/rom-inspection.gif)

Der Betrachter dient nur dem Lesen — du kannst den Inhalt hier nicht ändern. Seine Steuerungen lassen dich wählen, wie die Daten angezeigt werden:

- **Wörter / Bytes** — jeden gespeicherten Wert ganz zeigen oder in einzelne Bytes aufteilen.
- **Hex / Dezimal / Oktal / Binär** — die Zahlenbasis, in der jeder Wert angezeigt wird.
- **Zu Adresse springen** — direkt zu einer bestimmten Adresse springen.
- **Folgen** — das gerade adressierte Wort im Blick behalten, während sich die Adresse bewegt.

Eine **Adresse**- und **Wert**-Anzeige zeigt die Adresse des hervorgehobenen Worts und seinen Inhalt.

## Die innere Schaltung einer benutzerdefinierten Komponente beobachten

Tippe auf eine platzierte [benutzerdefinierte Komponente](docs:custom-components), während die Simulation läuft, um eine **Beobachtung** zu öffnen — eine Live-Ansicht der Schaltung in ihr. Die inneren Leitungen und Anschlüsse leuchten genau so auf, wie die laufende Schaltung sie treibt, sodass du sehen kannst, was eine Ebene tiefer geschieht, ohne die Komponente auszupacken.

![Ein Beobachtungsfenster mit Brotkrümel-Spur in eine verschachtelte Komponente.](../images/inspection-window-multilayer.png)

Eine Beobachtung ist interaktiv:

- **Treibe ihre Eingänge** — klicke einen **Schalter** oder **Taster** innerhalb der beobachteten Schaltung an, um ihn zu betätigen, genau wie auf der Hauptarbeitsfläche. Er treibt die echte laufende Simulation, sodass sich die Wirkung auf den Rest deiner Schaltung ausbreitet.
- **Steige in verschachtelte Komponenten hinein** — tippe auf eine benutzerdefinierte Komponente innerhalb der Beobachtung, um in _ihre_ innere Schaltung abzusteigen. Eine **Brotkrümel**-Spur oben zeigt, wie tief du bist; klicke einen früheren Schritt an, um wieder herauszuspringen.
- **Schwenken und Zoomen** — ziehe, um dich in der inneren Ansicht zu bewegen, und scrolle oder spreize zum Zoomen, genau wie auf der Arbeitsfläche.

Wenn eine Komponente nicht beobachtet werden kann, siehst du eine kurze Meldung: Sie hat vielleicht **keine innere Schaltung** zum Inspizieren, oder ihre innere Schaltung stimmt womöglich nicht mehr mit der laufenden Simulation überein — in diesem Fall **starte die Simulation neu** und versuche es erneut.

> **Kompakte Bildschirme:** Beobachtungen öffnen sich als Vollbildansicht mit einer Zurück-Schaltfläche anstelle der Schließen-Schaltfläche des Fensters; die Brotkrümel lassen dich weiterhin durch verschachtelte Ebenen zurückschreiten.

## Siehe auch

- [Simulation](docs:simulation) — deine Schaltung laufen lassen und mit ihr interagieren
- [Benutzerdefinierte Komponenten](docs:custom-components) — wiederverwendbare Komponenten bauen und verwenden
- [Komponenten & Optionen](docs:components-and-options) — Speicher, Schalter, Taster und andere Bausteine
