# Leitungen und Verbindungen

Leitungen tragen Signale zwischen Anschlüssen. Sie verlaufen waagerecht und senkrecht entlang des Rasters, und ein Signal breitet sich über jede Leitung aus, die damit verbunden ist.

## Leitungen zeichnen

Wähle das Leitungswerkzeug (`W`) und ziehe. Ein schräges Ziehen zeichnet ein L: Die Richtung, in die du dich zuerst bewegst, wird der erste Schenkel. Willst du es anders, kehre zum Startpunkt zurück und zieh in die andere Richtung los.

Eine Leitung kann an einem Anschluss, an einer Verzweigung oder irgendwo auf einer anderen Leitung beginnen, und sie verbindet sich überall, wo sie auf einem Anschluss endet. Während du ziehst, wird ein Schenkel rot, der durch eine Komponente laufen würde. Lässt du mit einem roten Schenkel los, wird nichts gesetzt.

Eine über eine bestehende gezeichnete Leitung verschmilzt mit ihr, und zwei Leitungen, die sich in einer Linie Ende an Ende treffen, werden eine.

## Wo sich Leitungen verbinden

Eine Leitung, die auf einer anderen endet, verbindet sich mit ihr, und eine Leitung, die über die Spitze eines Anschlusses läuft, verbindet sich mit diesem Anschluss. Zwei Leitungen, die sich nur kreuzen, ohne dass eine dort endet, bleiben getrennt. So kannst du Leitungen übereinander führen, ohne sie zu verbinden.

Ein Verbindungspunkt erscheint überall, wo drei oder mehr Leitungsenden und Anschlussspitzen zusammentreffen. Eine einfache Kreuzung hat keinen Punkt.

![Zwei Kreuzungen: links getrennt, rechts verbunden.](./images/wire-junction.webp)

Um eine Kreuzung zu verbinden, tippe sie mit dem Leitungswerkzeug an. Ein Punkt erscheint, und die vier Schenkel sind verbunden. Tippe erneut auf den Punkt, um sie zu trennen. Fährst du über eine Kreuzung, siehst du, was ein Tippen bewirken würde. Einen Punkt, an dem eine Leitung auf einer anderen endet, entfernst du so nicht; lösche oder verschiebe dafür die Leitung.

## Tunnel

Ein Tunnel ist mit jedem anderen Tunnel auf derselben Arbeitsfläche verbunden, der dieselbe Beschriftung trägt, als liefe eine Leitung zwischen ihnen. So führst du einen Takt oder einen Bus quer über eine große Schaltung. Jeder neue Tunnel beginnt mit der Beschriftung 0, zwei neue Tunnel sind also verbunden, bis du einen davon änderst. Beschriftungen unterscheiden Groß- und Kleinschreibung und sind bis zu 10 Zeichen lang.

Tunnel verbinden sich nur innerhalb einer Schaltung. Ein Tunnel in einer benutzerdefinierten Komponente verbindet sich nie mit einem außerhalb.

![Ein Schalter, der über zwei gleich beschriftete Tunnel eine LED einschaltet.](./images/tunnel.webp)

## Leitungen reparieren

Bearbeiten → Leitungen reparieren sucht auf der Arbeitsfläche nach Leitungsfehlern, etwa überlappenden Stücken, durch die sich Verbindungen unerwartet verhalten, und behebt sie. Hat eine geladene Schaltung solche Fehler, bietet der Editor die Reparatur mit der Schaltfläche „Leitungen reparieren“ an. Prüfe danach, ob die Schaltung noch tut, was sie soll. Eine Reparatur während einer Simulation beendet die Simulation zuerst.

## Siehe auch

- [Arbeitsfläche und Werkzeuge](docs:board-and-tools): Leitungen auswählen, schneiden und radieren
- [Komponenten und Optionen](docs:components-and-options): einen Anschluss negieren
- [Simulation](docs:simulation): Leitungen unter Strom aufleuchten sehen
