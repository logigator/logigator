# Simulation

Start simulation, at the right end of the toolbar, powers the circuit: powered wires light up, LEDs and displays show their state, and switches and buttons respond to clicks. `Enter` does the same.

![A clock driving an LED in a running simulation.](./images/simulation-showcase.webp)

## Entering and leaving

The simulation always runs the main project. If a custom component's tab is open, the editor switches back to Main project first.

While it runs, the board is locked. You can pan and zoom, operate inputs and [inspect](docs:inspection) ROMs, RAMs and custom components, but not place, move, wire or delete anything. Exit simulation, `Enter` or `Escape` returns to editing with the Pan tool.

With the Auto-start simulation setting on (the default), the circuit starts running as soon as you enter. With it off, the simulation waits paused at tick 0 so you can step from the start.

## Run controls

While a simulation is active, the toolbar is replaced by four buttons, the speed button and a readout.

| Button | What it does                                                                                 |
| ------ | -------------------------------------------------------------------------------------------- |
| Run    | Starts or resumes the simulation.                                                            |
| Pause  | Stops at the current tick and keeps the state.                                               |
| Step   | Advances one tick. Only available while paused.                                              |
| Stop   | Resets the circuit to tick 0, turns every switch off and pauses. You stay in the simulation. |

The readout shows the ticks since the start and, while running, the speed actually reached.

![The run controls and the speed button.](./images/simulation-controls.webp)

## Speed

The speed button shows the current setting. Clicking it opens a panel with three modes, which you can switch while the circuit runs:

- Every frame, the default, advances one tick per screen refresh, so the speed follows your display's refresh rate.
- Fixed speed ticks at a rate you set, 1 kHz to begin with. The slider goes from 1 Hz to 10 MHz. In the box next to it you can type any rate from 0.1 Hz up, such as `20`, `2.5k` or `1M`. A red box means the input is not a rate, and the last valid one stays in effect. If the circuit is too large to keep up, a warning sign appears next to the readout.
- As fast as possible runs without a limit. The screen then shows only some of the ticks.

![The speed panel with Fixed speed set to 10 Hz.](./images/simulation-speed.webp)

Under the modes, Clocks at this speed lists the frequency each clock delay in the circuit produces. A clock is on for one tick and off for Delay ticks, so one cycle takes Delay + 1 ticks: at 10 Hz, a clock with delay 1 runs at 5 Hz and one with delay 4 at 2 Hz. With Fixed speed the list is there right away. In the other two modes the rate has to be measured first, so the list appears about a second after the circuit starts running.

## Operating inputs

- A Switch toggles with each click and stays where you left it.
- A Button is on for as long as you hold it down. It passes on what is held now, so when you click far ahead of a slow or paused simulation it skips older presses, but your last click always arrives.
- A Pulse button sends a pulse of one tick per click, however long you hold it. It is the one that never skips a click, however far ahead of the simulation you are.
- A Gamepad opens its controller, described in the next section.
- A Keyboard opens a window to type into, described after the gamepad.

Dragging from anywhere else on the board pans it.

## Playing a gamepad

Clicking a Gamepad opens a window with a controller drawn in it. A button held there sets its output to 1 until you let go, and lights up on the board too. Like a Button, the gamepad passes on what is held now and can skip older presses when you are far ahead of a slow or paused simulation, while buttons pressed together arrive on the same tick.

![A gamepad's controller window with A and right held, beside the gamepad on the board.](./images/gamepad-window.webp)

The window takes the keyboard when it opens, and the line at the bottom reads Keyboard active. After you click the board or another window it reads Click here to use the keyboard, and keys no longer reach the gamepad. The key for each button is shown under it. While the window has the keyboard, a gamepad key comes before a shortcut, so `Enter` presses Start and does not leave the simulation. `Escape` still closes the window, and shortcuts with `Ctrl` or `Alt` still work. The default keys and how to change them are in [Keyboard shortcuts](docs:shortcuts#gamepad-keys).

With the mouse or a finger, a button stays pressed for as long as you hold it, and on a touchscreen each finger holds its own button. The D-pad has eight directions: pressing between two arms holds both, and sliding your thumb moves from one direction to the next without lifting it. Pressing the centre of the D-pad holds no direction.

A game controller connected to your computer can play a gamepad as well. The browser reports a controller only after you press one of its buttons while the editor is open. Do that with a gamepad window open, and the controller is connected to that window and appears in the Controller menu at the bottom. A controller keeps playing its gamepad when another window has the keyboard, so two controllers can play two gamepads at once, each chosen in its own window. Buttons are matched by position, whatever they are labelled: the right face button is A, the bottom one B, the top one X and the left one Y. The D-pad and the left stick both work the D-pad, LB and LT are L, RB and RT are R, Back or Share is Select, and Start is Start. Controllers that the browser doesn't report with the standard layout are listed but can't be chosen.

Closing the window or leaving the simulation lets go of every button. A gamepad inside a custom component is played from a [watch](docs:inspection#watches). In the touch layout, the controller opens in the sheet at the bottom of the screen; the key labels appear there once you press a key on a keyboard, and the Controller menu once a controller is connected.

## Typing on a keyboard

Clicking a Keyboard opens a window with a typing field at the top. While the field has the focus, the keys you press go to the circuit. A key going down puts its ASCII code on D0 to D6 and sends a one-tick pulse on STB. The code stays there while you hold the key, and D goes back to 0 when you let go. The box on the keyboard's body shows the character on D.

![The keyboard window with hello and world typed and d held, beside the keyboard showing d on the board.](./images/keyboard-window.webp)

The field shows the last 64 characters sent, newest on the right, with the held one highlighted. On D, below it, is the code the circuit gets right now: the character, its hex value and its 7 bits. The line under that reads Typing into the circuit · Shift+Tab to leave while the field has the focus. After you click somewhere else it reads Click here to type, and keys no longer reach the keyboard until you click back into the window.

A held key does not repeat, so STB pulses once per press. A circuit that should repeat a held key can run a clock while D is not 0; no key sends 0, so an OR over D0 to D6 is 1 exactly while a key is held. Pressing a second key before letting go of the first puts the second key's code on D with a new pulse on STB. Letting go of that second key sets D to 0, even if the first one is still down.

Printable ASCII characters, from space to `~`, are sent as themselves. These keys send control codes, shown on the board and next to On D by their names:

| Key         | Code   | Shown as |
| ----------- | ------ | -------- |
| `Enter`     | `0x0A` | LF       |
| `Backspace` | `0x08` | BS       |
| `Tab`       | `0x09` | TAB      |
| `Escape`    | `0x1B` | ESC      |
| `Delete`    | `0x7F` | DEL      |

The arrow keys, function keys, `Home`, `End`, `Page Up`, `Page Down` and `Insert` send nothing. A character outside ASCII, such as ä or €, is skipped, and the line at the bottom says so for a few seconds. Characters typed with `AltGr`, such as @ on a German keyboard, are sent. Combinations with `Ctrl`, `Alt` or `⌘` are left to the browser. Which keys go to the circuit instead of the editor is listed in [Keyboard shortcuts](docs:shortcuts#keys-in-a-keyboard-window).

A paste sends the pasted text one character at a time. Type text…, at the bottom of the window, opens a dialog where you can write or paste a longer text, a program for example, and says how many of its characters will be skipped before you send it. Line breaks are sent as LF, and one paste or one Send takes up to 10,000 characters. Each character stays on D for at least three ticks. STB rises one tick after the code arrives and falls at least one tick before D changes again, so a circuit that stores D when STB rises still reads every character, even with one gate more on the way of D than of STB, or the other way round. A tick of 0 follows each character, so a double letter still arrives as two presses. While characters are waiting, the window shows Sending with the number left and a ✕ that drops the rest. You also see it when you type faster than the simulation runs, at a low fixed speed for example. At most 21,845 characters can wait at once, and a paste or a Send that does not fit behind them is not sent at all, not even in part: the window or the dialog asks you to wait for them instead.

While the simulation is paused, keys wait for Step. A key you press and let go is on D after the next step, STB is 1 after the second, the code is still there after the third and is gone after the fourth. The next character follows after the fifth, so a pasted text takes four steps per character.

Closing the window, clicking outside it and switching to another tab let go of the held key. Stop clears the characters in the field. A keyboard inside a custom component is typed into from a [watch](docs:inspection#watches). On a phone or tablet, the window opens in the sheet at the bottom of the screen (see [Phones and tablets](docs:phones-and-tablets#simulation-and-inspection)).

## When the simulation won't start

The editor refuses to start and shows a message naming the component when:

- a custom component contains itself, directly or through another one,
- a custom component has no circuit inside it,
- a custom component's ports no longer match the Input and Output plugs in its circuit.

Fix the named component and start again. If the message says the simulation engine could not start, your browser does not support WebAssembly.

## See also

- [Inspection and watches](docs:inspection): ROM and RAM contents, and watches
- [Components and options](docs:components-and-options): what each input and display does
- [Settings](docs:settings): Auto-start simulation
- [Phones and tablets](docs:phones-and-tablets): the run controls in the touch layout
