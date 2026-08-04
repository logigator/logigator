# Leitungen & Verbindungen

Leitungen führen Signale zwischen Komponentenanschlüssen. Diese Seite behandelt, wie du sie zeichnest, wo sie sich verbinden steuerst und Bauteile mit Tunneln drahtlos verbindest.

![Zwischen Komponenten gezeichnete Leitungen mit Verbindungspunkten.](./images/wire-circuit-display.png)

## Leitungen zeichnen

Wähle das Werkzeug **Leitung** aus der Werkzeugleiste (Kürzel `W`) und ziehe dann auf der Arbeitsfläche. Leitungen sind immer gerade und verlaufen waagerecht oder senkrecht entlang des Rasters. Ziehst du diagonal, verläuft die Leitung als **L-Form**: Die Richtung, in die du dich zuerst bewegst, bestimmt den ersten Schenkel, und die Biegung folgt deinem Cursor.

Lass los, um die Leitung zu platzieren. Ein Leitungsendpunkt, der auf einem Komponentenanschluss landet, verbindet sich automatisch mit ihm. Während du ziehst, färbt sich ein Segment, das durch den Körper einer Komponente verlaufen würde, rot und wird nicht platziert — verlege es stattdessen darum herum.

Um einen Verlauf zu verlängern, zeichne einfach eine weitere Leitung, die am Ende einer bestehenden beginnt. Leitungen, die Ende an Ende zusammentreffen, verschmelzen zu einem einzigen verbundenen Pfad.

## Kreuzungen: wann Leitungen sich verbinden

Wo Leitungen zusammentreffen, folgt Logigator einer einfachen Regel, damit du die Kontrolle über deine Schaltung behältst:

- Eine Leitung, die **auf** einer anderen Leitung **endet**, verbindet sich mit ihr. Ein kleiner **Verbindungspunkt** markiert die Verbindung.
- Zwei Leitungen, die sich einfach **kreuzen** — wobei keine von beiden an der Kreuzung endet — laufen übereinander hinweg, **ohne** sich zu verbinden. Es gibt keinen Punkt und kein Signal fließt zwischen ihnen.

So kannst du Leitungen frei übereinander verlegen, ohne versehentliche Verbindungen zu erzeugen.

![Zwei Kreuzungen: eine ohne Punkt, eine mit Verbindungspunkt.](./images/wire-junction.png)

### Eine Kreuzung umschalten

Um zwei Leitungen zu verbinden, die sich lediglich kreuzen, wähle das Werkzeug **Leitung** und tippe auf den Kreuzungspunkt: Ein Verbindungspunkt erscheint und die Leitungen sind nun verbunden. Tippe erneut auf denselben Punkt, um sie wieder zu trennen. Das Bewegen über die Kreuzung mit dem Leitungswerkzeug zeigt eine Vorschau dessen, was ein Tippen bewirkt — den Punkt, den es hinzufügen würde, oder den bestehenden Punkt, den es entfernen würde.

Du wirst außerdem von selbst Verbindungspunkte überall dort erscheinen sehen, wo drei oder mehr Leitungsenden (oder ein Leitungsende und ein Komponentenanschluss) zusammenkommen. Diese Punkte sind nur ein visueller Hinweis darauf, wo Dinge elektrisch verbunden sind; du platzierst oder wählst sie nicht aus.

## Einen Anschluss negieren

Mit dem Werkzeug **Leitung** kannst du auch direkt auf den Anschluss einer Komponente tippen, um das Signal dort zu invertieren — eine kleine **Negationsblase** erscheint auf dem Anschluss. Dies wird ausführlich auf der Seite [Komponenten & Optionen](docs:components-and-options) behandelt.

## Tunnel: drahtlose Verbindungen

Ein **Tunnel** verbindet Punkte auf deiner Arbeitsfläche, ohne dass eine Leitung dazwischen verläuft. Jeder Tunnel mit derselben **Beschriftung** ist elektrisch verbunden, als würde eine Leitung sie verbinden. Das hält belebte Arbeitsflächen aufgeräumt — etwa, um einen Takt oder einen gemeinsamen Bus quer durch die Schaltung zu führen, ohne lange Leitungen zu zeichnen.

So verwendest du Tunnel:

1. Platziere einen **Tunnel** aus der Kategorie **Grundlegend** der Palette und verdrahte ihn mit dem Signal, das du führen möchtest.
2. Platziere einen weiteren Tunnel überall dort, wo dieses Signal wieder auftauchen soll.
3. Wähle jeden Tunnel aus und gib ihnen in der Einstellungskarte **dieselbe Beschriftung**.

Alle Tunnel mit übereinstimmenden Beschriftungen verhalten sich wie ein einziges verbundenes Netz; Tunnel mit unterschiedlichen Beschriftungen bleiben unabhängig.

![Zwei Tunnel mit derselben Beschriftung, ohne Leitung dazwischen.](./images/tunnel.gif)

## Leitungen schneiden und umarrangieren

Das Werkzeug **Auswahl** verschiebt und entfernt Leitungen zusammen mit allem anderen, das du auswählst, und sein Scherenmodus schneidet eine Leitung exakt an der Kante deines Auswahlrahmens ab — praktisch, um eine Leitung aus einem Bündel herauszuschneiden. Das Werkzeug **Radieren** löscht Leitungen, die du anklickst oder über die du ziehst. Beide werden in [Arbeitsfläche & Werkzeuge](docs:board-and-tools) behandelt.

## Siehe auch

- [Komponenten & Optionen](docs:components-and-options) — die Bauteile, die diese Leitungen verbinden, und die Anschlussnegation
- [Simulation](docs:simulation) — die Schaltung laufen lassen und zusehen, wie unter Strom stehende Leitungen aufleuchten
- [Arbeitsfläche & Werkzeuge](docs:board-and-tools) — das Leitungswerkzeug, auswählen, schneiden und radieren
