# Portes d'E/S

## Bouton

<div class="rows">

![Bouton](assets/help/button.jpg)

<div class="margin-left">

Peut être cliqué pour émettre un signal d'impulsion. Dure un tic de simulation.

</div>
</div>

## Interrupteur

<div class="rows">

![Interrupteur](assets/help/switch.jpg)

<div class="margin-left">

Peut être allumé et éteint pendant la simulation.

</div>
</div>

## LED

<div class="rows">

![LED](assets/help/led.jpg)

<div class="margin-left">

S'allume ou s'éteint en fonction de l'entrée appliquée.

</div>
</div>

## Affichage à segments

<div class="rows">

![Affichage à segments](assets/help/segment-display.jpg)

<div class="margin-left">

Affichage à sept segments avec une entrée binaire, qui affiche l'entrée en tant que nombre décimal, hexadécimal ou octal.

</div>
</div>

## Matrice LED

<div class="rows">

![Matrice LED](assets/help/led-matrix.PNG)

<div class="margin-left">

Affiche jusqu'à 256 LED individuelles. Il est possible de choisir entre les tailles suivantes : 4x4, 8x8 et 16x16.

- **Entrées d'adresse**<br>
  Avec les entrées d'adresse, les lignes individuelles de la matrice peuvent être contrôlées. Lors de l'utilisation d'une matrice 16x16, chaque ligne est divisée en deux adresses (les 8 premières LED, les 8 dernières LED).

- **Entrées de données**<br>
  La matrice dispose de 4 à 8 entrées de données (D0-D7). D0 est la première LED de la ligne et D7 est la dernière LED de la ligne. Une matrice 16x16 a également seulement 8 entrées de données. Pour cette raison, chaque ligne est composée de deux adresses.

- **Horloge**<br>
Lorsque CLK est à l'état HAUT, les données sont écrites dans la matrice.
</div>
</div>
