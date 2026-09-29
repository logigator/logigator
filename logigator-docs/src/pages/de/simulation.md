# Simulation

Sobald deine Schaltung gebaut ist, lass sie laufen, um die Signale fließen zu sehen. In der Simulation versorgst du die Schaltung mit Strom, betätigst ihre Eingänge und siehst die Ergebnisse live auf der Arbeitsfläche aufleuchten.

![Eine laufende Simulation mit den Ausführungssteuerungen in der Werkzeugleiste.](./images/simulation-showcase.webp)

## Eine Simulation starten und verlassen

Drücke die Schaltfläche **Simulation starten** ganz rechts in der Werkzeugleiste, um deine Schaltung mit Strom zu versorgen. Du kannst auch `Enter` drücken.

Während eine Simulation läuft, ist die Arbeitsfläche **für die Bearbeitung gesperrt** — du kannst nichts platzieren, verschieben, verdrahten oder löschen. Du kannst weiterhin frei schwenken und zoomen, und du kannst die Eingänge der Schaltung anklicken (siehe [Mit einer laufenden Schaltung interagieren](#mit-einer-laufenden-schaltung-interagieren)).

Um zur Bearbeitung zurückzukehren, drücke **Simulation verlassen** (wo die Start-Schaltfläche war), oder drücke erneut `Enter` oder `Escape`.

Ob die Simulation **laufend** oder **pausiert** beginnt, hängt von der Einstellung **Simulation automatisch starten** ab. Wenn sie an ist, beginnt die Schaltung in dem Moment zu laufen, in dem du sie betrittst; wenn sie aus ist, wird sie pausiert betreten, sodass du sie selbst starten kannst. Siehe [Einstellungen & Darstellung](docs:settings).

## Die Ausführungssteuerungen

Wenn eine Simulation aktiv ist, tauscht die Werkzeugleiste ihre Zeichenwerkzeuge gegen die Ausführungssteuerungen.

| Steuerung         | Was sie tut                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Start**         | Startet (oder setzt fort) die Simulation.                                                                                                           |
| **Pause**         | Friert die Simulation an Ort und Stelle ein und behält ihren aktuellen Zustand, sodass du fortsetzen oder steppen kannst.                           |
| **Einzelschritt** | Rückt die Schaltung um einen einzelnen Tick vor. Verfügbar, solange pausiert — praktisch, um ein Signal Schritt für Schritt zu verfolgen.           |
| **Stopp**         | Setzt die Schaltung zurück an den Anfang und löscht jede aufleuchtende Leitung. Die Simulation bleibt aktiv und pausiert, bereit, erneut zu laufen. |

**Stopp** und **Simulation verlassen** sind verschieden: **Stopp** spult die laufende Schaltung an den Anfang zurück, behält dich aber in der Simulation, während **Simulation verlassen** die Simulation ganz verlässt und dich zur Bearbeitung zurückbringt.

![Die Ausführungssteuerungen und die Geschwindigkeitseinstellungen in der Werkzeugleiste.](./images/simulation-controls.webp)

## Simulationsgeschwindigkeit

Neben den Ausführungssteuerungen liegt die **Geschwindigkeitsschaltfläche**. Sie nennt die aktuelle Einstellung — **Jedes Bild**, eine Rate wie `10 Hz` oder **Maximal** — und öffnet per Klick das Geschwindigkeitsfeld:

![Das Geschwindigkeitsfeld, geöffnet über die Geschwindigkeitsschaltfläche, mit gewählter fester Geschwindigkeit.](./images/simulation-speed.webp)

Das Feld bietet drei Wege, die Simulation zu takten. Die hervorgehobene Option ist aktiv; klicke eine andere an, um zu wechseln, auch während die Schaltung läuft:

- **Jedes Bild** — die Schaltung rückt einen Tick pro Bildaufbau vor, sodass jede Änderung gezeichnet wird und die Geschwindigkeit der Bildwiederholrate deines Displays folgt. Dies ist der Standard.
- **Feste Geschwindigkeit** — die Schaltung tickt mit einer von dir gewählten Rate. Ziehe den Schieberegler, um eine zwischen `1 Hz` und `10 MHz` zu wählen, oder tippe sie in das Feld daneben: `20`, `2,5k` und `1M` funktionieren alle. Getippt geht es auch unter den Schieberegler, bis hinab zu `0,1 Hz` — ein Tick alle zehn Sekunden. Sobald du eines von beiden änderst, ist **Feste Geschwindigkeit** gewählt. Wird das Feld rot, ist das Getippte keine Rate, und die Simulation läuft mit der letzten gültigen weiter.
- **So schnell wie möglich** — keine Begrenzung: die Schaltung läuft so schnell, wie dein Computer es zulässt, und der Bildschirm zeigt nur einen Teil der Ticks.

Unter den drei Optionen listet **Taktgeber bei dieser Geschwindigkeit** die Frequenz auf, mit der jeder **Taktgeber** deiner Schaltung läuft. Die **Verzögerung** eines Taktgebers gibt an, wie viele Ticks er wartet, bevor er umschaltet, ein voller Zyklus dauert also doppelt so lange: bei `10 Hz` läuft ein Taktgeber mit Verzögerung `1` mit `5 Hz`. Um einen Taktgeber zu verlangsamen, senke die Geschwindigkeit oder erhöhe seine Verzögerung. Bei fester Geschwindigkeit steht die Liste sofort da; bei den anderen beiden erscheint sie, sobald die Schaltung einen Moment gelaufen ist, denn ihre Geschwindigkeit ist erst durch Messen bekannt.

Neben der Geschwindigkeitsschaltfläche zeigt eine Anzeige während des Laufs die **gemessene Geschwindigkeit**, die die Simulation tatsächlich erreicht, zusammen mit den insgesamt seit dem Start verstrichenen **Ticks**. Ist eine feste Geschwindigkeit mehr, als die Schaltung schafft, wird die Anzeige mit einem Warnzeichen markiert.

## Mit einer laufenden Schaltung interagieren

Nur die Eingänge der Schaltung reagieren auf Klicks, solange sie läuft:

- **Schalter** — ein rastender Eingang. Klicke ihn, um seinen Ausgang an- oder auszuschalten; er bleibt, wo du ihn gelassen hast.
- **Taster** — ein Momenteingang. Sein Ausgang ist an, solange du ihn gedrückt hältst, und geht aus, sobald du loslässt.
- **Impulstaster** — klicke ihn, um einen einzelnen, einen Tick langen Puls an seinem Ausgang auszusenden.

Während sich Signale ausbreiten, **leuchten** unter Strom stehende Leitungen und Anschlüsse auf, und Ausgangskomponenten zeigen ihren Zustand — LEDs glühen, Segment Displays und LED-Matrizen zeigen ihre Muster. Ziehe irgendwo auf der Arbeitsfläche zum Schwenken — außer auf einem Taster, der dabei einfach gedrückt bleibt; das Klicken auf leeren Raum bewirkt nichts.

Um in eine laufende Schaltung hineinzuschauen — den Inhalt eines Speichers zu lesen oder die innere Schaltung einer benutzerdefinierten Komponente live zu beobachten — siehe [Inspektion & Beobachtungen](docs:inspection).

## Wenn eine Simulation nicht startet

Einige Probleme hindern eine Schaltung ganz daran, zu simulieren. Sind welche vorhanden, zeigt **Simulation starten** eine Fehlermeldung und bleibt im Bearbeitungsmodus, sodass du sie beheben kannst. Die häufigsten:

- **Eine nicht unterstützte Komponente** — eine Komponente, die der Simulator nicht ausführen kann. Entferne oder ersetze sie.
- **Eine benutzerdefinierte Komponente, die sich selbst platziert** — eine [benutzerdefinierte Komponente](docs:custom-components), deren innere Schaltung sich selbst enthält, direkt oder über eine andere benutzerdefinierte Komponente, was sich nie auflösen kann. Brich die Schleife auf.
- **Eine benutzerdefinierte Komponente ohne Schaltung** — eine benutzerdefinierte Komponente, die nichts zum Simulieren in sich hat. Gib ihr eine innere Schaltung oder entferne sie.
- **Eine Anschluss-Diskrepanz** — eine benutzerdefinierte Komponente, deren deklarierte Ein-/Ausgangsanschlüsse nicht mit den Eingangs- und Ausgangssteckern übereinstimmen, die tatsächlich in ihrer Schaltung stecken. Bringe die Stecker mit den Anschlüssen in Einklang.

Jede Meldung nennt die betroffene Komponente, damit du sie finden kannst.

## Siehe auch

- [Inspektion & Beobachtungen](docs:inspection) — Speicher lesen und innere Schaltungen live beobachten
- [Komponenten & Optionen](docs:components-and-options) — Schalter, Taster, LEDs und andere Bausteine
- [Benutzerdefinierte Komponenten](docs:custom-components) — eine Schaltung in ein wiederverwendbares Bauteil verpacken
- [Einstellungen & Darstellung](docs:settings) — die Option „Simulation automatisch starten“
- [Tastaturbefehle](docs:shortcuts) — jede Belegung und wie man sie ändert
