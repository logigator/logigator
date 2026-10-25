# Entrées

Les entrées sont les composants que vous utilisez pendant une simulation : interrupteurs, boutons, une manette et un clavier. Chacune pilote ses sorties d'après ce que vous cliquez, appuyez ou tapez, et le reste du circuit réagit.

## Interrupteur {#switch}

![Un interrupteur relié à une LED, éteint puis allumé, la LED s'allumant avec lui.](./images/component-switch.webp)

Un interrupteur bascule entre 0 et 1 à chaque clic pendant une simulation et reste dans la position où vous le laissez. « Arrêter » l'éteint de nouveau.

| Port   | Sens   | Rôle                                 |
| ------ | ------ | ------------------------------------ |
| Sortie | sortie | 1 tant que l'interrupteur est allumé |

Il n'a pas d'autre option que Direction.

## Bouton {#button}

![Un bouton relié à une LED, relâché puis maintenu enfoncé, la LED allumée tant qu'il est enfoncé.](./images/component-button.webp)

Un bouton donne 1 tant que vous le maintenez enfoncé.

| Port   | Sens   | Rôle                             |
| ------ | ------ | -------------------------------- |
| Sortie | sortie | 1 tant que le bouton est enfoncé |

Il n'a pas d'autre option que Direction.

Un bouton transmet ce qui est enfoncé maintenant. Si vous cliquez bien plus vite qu'une simulation lente ou en pause n'avance, il saute les appuis les plus anciens, mais votre dernier clic arrive toujours.

## Bouton à impulsion {#pulse-button}

![Un bouton à impulsion relié à une LED, montré à raison d'un tick par image : au repos, l'impulsion d'un tick avec la LED allumée, puis de nouveau au repos.](./images/component-pulse-button.webp)

Un bouton à impulsion envoie une impulsion d'un tick par clic, quelle que soit la durée de l'appui.

| Port   | Sens   | Rôle                       |
| ------ | ------ | -------------------------- |
| Sortie | sortie | 1 pendant un tick par clic |

Il n'a pas d'autre option que Direction.

Un bouton à impulsion ne saute jamais de clic, quelle que soit votre avance sur la simulation. Chaque clic arrive comme une impulsion distincte.

## Manette {#gamepad}

![Une manette avec les boutons par défaut et une LED sur chacune de ses huit sorties, Droite et A enfoncés si bien que ces deux LED sont allumées.](./images/component-gamepad.webp)

Une manette a une sortie par bouton, à 1 tant que le bouton est enfoncé. La croix directionnelle est toujours présente ; les autres boutons s'activent par groupes. Pendant une simulation, un clic ouvre une fenêtre avec une manette pour jouer.

| Port | Sens   | Rôle                         |
| ---- | ------ | ---------------------------- |
| UP   | sortie | Croix directionnelle, haut   |
| DN   | sortie | Croix directionnelle, bas    |
| LT   | sortie | Croix directionnelle, gauche |
| RT   | sortie | Croix directionnelle, droite |
| A    | sortie | Bouton d'action A            |
| B    | sortie | Bouton d'action B            |
| X    | sortie | Bouton d'action X            |
| Y    | sortie | Bouton d'action Y            |
| L    | sortie | Bouton de tranche gauche     |
| R    | sortie | Bouton de tranche droit      |
| SL   | sortie | Select                       |
| ST   | sortie | Start                        |

Les ports viennent dans cet ordre, sans les boutons désactivés.

| Option             | Valeurs                                   | Par défaut |
| ------------------ | ----------------------------------------- | ---------- |
| Boutons d'action   | 0, A, A B, A B X Y                        | A B        |
| Boutons de tranche | 0, L R                                    | 0          |
| Boutons de menu    | 0, ST, SL ST                              | SL ST      |
| Noms des boutons   | un nom de 8 caractères au plus par bouton | aucun      |

Les valeurs par défaut donnent huit sorties ; avec tous les groupes, il y en a douze.

![La fenêtre d'une manette avec A et Droite enfoncés, à côté de la manette sur le plan de travail.](./images/gamepad-window.webp)

Un bouton maintenu enfoncé dans la fenêtre met sa sortie à 1 jusqu'à ce que vous le relâchiez, et s'allume aussi sur le plan de travail. Des boutons enfoncés ensemble arrivent au même tick. Comme un bouton, la manette transmet ce qui est enfoncé maintenant ; elle peut donc sauter les appuis les plus anciens quand vous avez une grande avance sur une simulation lente ou en pause.

Fermer la fenêtre ou quitter la simulation relâche tous les boutons.

### Clavier, souris et écran tactile {#keyboard-mouse-and-touch}

La fenêtre prend le clavier à son ouverture, et la ligne du bas indique « Clavier actif ». Après un clic sur le plan de travail ou dans une autre fenêtre, elle indique « Cliquez ici pour utiliser le clavier », et les touches n'atteignent plus la manette. La touche de chaque bouton est affichée sous celui-ci.

Tant que la fenêtre a le clavier :

- les touches de la manette passent avant les raccourcis : `Enter` appuie sur Start au lieu de quitter la simulation,
- `Escape` ferme toujours la fenêtre,
- les raccourcis avec `Ctrl` ou `Alt` fonctionnent toujours.

Les touches par défaut et la façon de les modifier sont décrites dans [Raccourcis clavier](docs:shortcuts#gamepad-keys).

À la souris ou au doigt, un bouton reste enfoncé tant que vous appuyez dessus. Sur un écran tactile, chaque doigt tient son propre bouton. La croix directionnelle a huit directions : appuyer entre deux branches enfonce les deux, et faire glisser le pouce passe d'une direction à la suivante sans le lever. Le centre de la croix n'enfonce aucune direction.

### Manettes physiques {#game-controllers}

Une manette physique branchée à votre ordinateur peut aussi jouer. Le navigateur ne signale une manette qu'après l'appui sur l'un de ses boutons pendant que l'éditeur est ouvert. Faites-le avec une fenêtre de manette ouverte : la manette physique est reliée à cette fenêtre et apparaît dans le menu Manette en bas.

Une manette physique continue de jouer quand une autre fenêtre a le clavier. Deux manettes physiques peuvent jouer sur deux manettes à la fois, chacune choisie dans sa propre fenêtre.

Les boutons sont associés par position, quelle que soit leur inscription :

| Sur la manette physique              | Sur la manette       |
| ------------------------------------ | -------------------- |
| Bouton d'action de droite            | A                    |
| Bouton d'action du bas               | B                    |
| Bouton d'action du haut              | X                    |
| Bouton d'action de gauche            | Y                    |
| Croix directionnelle ou stick gauche | Croix directionnelle |
| LB ou LT                             | L                    |
| RB ou RT                             | R                    |
| Back ou Share                        | Select               |
| Start                                | Start                |

Les manettes que le navigateur ne signale pas avec la disposition standard figurent dans la liste mais ne peuvent pas être choisies.

### Noms des boutons {#button-names}

« Noms des boutons », dans la carte de paramètres, ouvre une image de la manette avec un champ à chaque bouton. Un nom de 8 caractères au plus remplace le libellé du port de ce bouton sur le plan de travail et s'affiche à côté du bouton dans la fenêtre de la manette. Un champ vide garde le libellé par défaut. Les caractères que le plan de travail ne peut pas dessiner sont omis du libellé du port, et la fenêtre le signale.

Les noms des boutons que vous désactivez sont conservés et reviennent quand vous les réactivez.

### Manettes dans les surveillances et la disposition tactile {#gamepads-in-watches-and-the-touch-layout}

Une manette placée dans un composant personnalisé se joue depuis une [surveillance](docs:inspection#watches). Le titre de sa fenêtre montre le chemin, par exemple Outer › Inner › Manette.

En disposition tactile, la manette s'ouvre dans le panneau en bas de l'écran. Les touches s'y affichent dès que vous appuyez sur une touche d'un clavier, et le menu Manette dès qu'une manette physique est connectée.

## Clavier {#keyboard}

![Un clavier relié à un terminal, D0 à D7 sur D0 à D7 et STB sur CLK, après la saisie de Hello, world! Le terminal affiche le texte et le clavier la dernière touche, !.](./images/component-keyboard.webp)

Un clavier place sur ses sorties le code de chaque touche sur laquelle vous appuyez. Pendant une simulation, un clic ouvre une fenêtre de saisie. La case de son boîtier affiche le caractère présent sur D et s'allume tant que KD est à 1.

| Port    | Sens   | Rôle                                                                                       |
| ------- | ------ | ------------------------------------------------------------------------------------------ |
| D0 à D7 | sortie | Le code Latin-1 sur 8 bits de la dernière touche enfoncée, D0 étant le bit de poids faible |
| STB     | sortie | Une impulsion d'un tick à chaque appui                                                     |
| KD      | sortie | 1 tant qu'une touche est maintenue                                                         |

Il n'a pas d'autre option que Direction.

### La fenêtre du clavier {#the-keyboard-window}

![La fenêtre d'un clavier avec hello et world tapés et d maintenu, à côté du clavier qui affiche d sur le plan de travail.](./images/keyboard-window.webp)

La fenêtre a un champ de saisie en haut. Tant que ce champ a le focus, les touches sur lesquelles vous appuyez vont au circuit.

- Le champ montre les 64 derniers caractères envoyés, le plus récent à droite, et met en évidence celui qui est sur D tant qu'une touche est maintenue.
- En dessous, « Sur D » donne le code que le circuit reçoit à cet instant : le caractère, sa valeur hexadécimale et ses 8 bits.
- La ligne suivante indique « Vous tapez dans le circuit · Maj+Tab pour sortir » tant que le champ a le focus. Après un clic ailleurs, elle indique « Cliquez ici pour taper », et les touches n'atteignent plus le clavier jusqu'à ce que vous cliquiez de nouveau dans la fenêtre.

Les touches qui vont au circuit plutôt qu'à l'éditeur sont décrites dans [Raccourcis clavier](docs:shortcuts#keys-in-a-keyboard-window).

### Effet d'un appui sur une touche {#what-a-key-press-does}

Une touche enfoncée met son code sur D0 à D7, envoie une impulsion d'un tick sur STB et met KD à 1. Une touche enfoncée puis relâchée, comme chaque caractère d'un texte collé, prend quatre ticks :

| Tick | D0 à D7 | STB | KD  |
| ---- | ------- | --- | --- |
| 1    | le code | 0   | 1   |
| 2    | le code | 1   | 1   |
| 3    | le code | 0   | 1   |
| 4    | le code | 0   | 0   |

STB monte un tick après l'arrivée du code et redescend un tick avant que KD ne repasse à 0. Un circuit qui mémorise D quand STB monte lit donc chaque caractère, même avec une porte de plus sur le chemin de D que sur celui de STB, ou l'inverse.

Une touche maintenue garde KD à 1 après le tick 3 jusqu'à ce que vous la relâchiez. D garde le code après le retour de KD à 0, jusqu'à ce que la touche suivante le remplace.

- Une touche maintenue ne se répète pas : STB envoie une impulsion par appui.
- Appuyer sur une deuxième touche avant de relâcher la première met le code de la deuxième sur D, avec une nouvelle impulsion sur STB. KD reste à 1 jusqu'à ce que vous ayez relâché les deux.
- Un circuit qui doit répéter une touche maintenue peut faire tourner une horloge tant que KD est à 1.
- Un circuit qui compte les appuis peut compter les impulsions sur KD.

Fermer la fenêtre, cliquer en dehors ou passer à un autre onglet relâche toutes les touches maintenues. « Arrêter » efface les caractères du champ.

### Codes de caractères {#character-codes}

Le code est le Latin-1 : l'ASCII plus les lettres accentuées et les symboles des langues d'Europe occidentale. Les caractères imprimables, de l'espace à `~` et de `0xA0` à ÿ, sont envoyés tels quels : é arrive donc comme `0xE9`. L'espace insécable (`0xA0`) et le trait d'union conditionnel (`0xAD`) sont affichés NBS et SHY, car ils ne se voient pas.

Ces touches envoient des codes de contrôle, affichés par leur nom sur le plan de travail et à côté de « Sur D » :

| Touche      | Code   | Affiché |
| ----------- | ------ | ------- |
| `Enter`     | `0x0A` | LF      |
| `Backspace` | `0x08` | BS      |
| `Tab`       | `0x09` | TAB     |
| `Escape`    | `0x1B` | ESC     |
| `Delete`    | `0x7F` | DEL     |
| `→`         | `0x1C` | RT      |
| `←`         | `0x1D` | LT      |
| `↑`         | `0x1E` | UP      |
| `↓`         | `0x1F` | DN      |
| `Home`      | `0x0B` | HOM     |

Un [terminal](docs:outputs#terminal) comprend tous ces codes sauf ESC : relié à un clavier, il affiche donc ce que vous tapez.

Certaines touches et certains caractères n'envoient rien ou envoient autre chose :

| Touche ou caractère                                          | Envoi                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| Touches de fonction, `End`, `Page Up`, `Page Down`, `Insert` | rien                                                           |
| Flèches et `Home` quand `Shift` est maintenue                | rien                                                           |
| Guillemets typographiques                                    | `'` et `"`                                                     |
| Tirets longs                                                 | `-`                                                            |
| …                                                            | trois points                                                   |
| Autres caractères hors Latin-1, comme € ou un emoji          | ignorés ; la ligne du bas le signale pendant quelques secondes |
| Caractères tapés avec `AltGr`, comme @ sur un clavier AZERTY | le caractère                                                   |
| Combinaisons avec `Ctrl`, `Alt` ou `⌘`                       | rien, elles restent au navigateur                              |

### Collage de texte {#pasting-text}

Un collage envoie le texte collé caractère par caractère. « Saisir du texte… », en bas de la fenêtre, ouvre une boîte de dialogue où vous pouvez écrire ou coller un texte plus long, un programme par exemple. Elle indique avant l'envoi combien de caractères seront ignorés.

Dans un texte collé ou envoyé :

- les sauts de ligne sont envoyés comme LF et les tabulations comme TAB,
- les autres caractères de contrôle sont omis,
- les caractères hors Latin-1 sont ignorés, comme à la frappe.

Chaque caractère arrive comme une touche enfoncée puis relâchée, en quatre ticks comme le montre [Effet d'un appui sur une touche](#what-a-key-press-does), et le suivant arrive au cinquième. KD est à 0 pendant un tick après chaque caractère, si bien qu'une lettre double arrive comme deux impulsions sur KD.

Tant que des caractères attendent, la fenêtre affiche « Envoi : » suivi du nombre restant, et un ✕ qui abandonne le reste. Un caractère dont l'impulsion sur STB a déjà commencé arrive quand même, et KD repasse à 0. « Envoi : » apparaît aussi quand vous tapez plus vite que la simulation n'avance, à une vitesse fixe basse par exemple.

Les limites :

- Un collage ou un envoi depuis la boîte de dialogue prend jusqu'à 10 000 caractères.
- Au plus 21 845 caractères peuvent attendre à la fois.
- Un collage ou un envoi qui ne tient pas derrière les caractères qui attendent déjà n'est pas envoyé du tout, pas même en partie. La fenêtre ou la boîte de dialogue vous demande plutôt de les attendre.

### Avance pas à pas en pause {#stepping-while-paused}

En pause, les touches attendent « Pas à pas ». Chaque pas correspond à un tick du tableau de [Effet d'un appui sur une touche](#what-a-key-press-does) :

| Après le pas | Ce que reçoit le circuit           |
| ------------ | ---------------------------------- |
| 1            | Le caractère sur D, KD à 1         |
| 2            | STB à 1                            |
| 3            | STB à 0                            |
| 4            | KD à 0, le caractère restant sur D |
| 5            | Le caractère suivant sur D, KD à 1 |

Un texte collé demande donc quatre pas par caractère.

### Claviers dans les surveillances et la disposition tactile {#keyboards-in-watches-and-the-touch-layout}

Pour un clavier placé dans un composant personnalisé, tapez depuis une [surveillance](docs:inspection#watches). Le titre de sa fenêtre montre le chemin, comme pour une manette.

Sur un téléphone ou une tablette, la fenêtre s'ouvre dans le panneau en bas de l'écran (voir [Téléphones et tablettes](docs:phones-and-tablets#simulation-and-inspection)).

## Voir aussi {#see-also}

- [Simulation](docs:simulation) : lancer, mettre en pause et faire avancer pas à pas un circuit
- [Sorties](docs:outputs) : LED, affichages et terminal
- [Raccourcis clavier](docs:shortcuts) : les touches de la manette et celles de la fenêtre d'un clavier
- [Inspection et surveillances](docs:inspection) : utiliser des entrées à l'intérieur d'un composant personnalisé
