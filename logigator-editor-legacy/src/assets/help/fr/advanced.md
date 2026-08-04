# Portes avancées

## Demi additionneur

<div class="rows">

| A   | B   | Somme | Retenue |
| --- | --- | ----- | ------- |
| 0   | 0   | 0     | 0       |
| 1   | 0   | 1     | 0       |
| 0   | 1   | 1     | 0       |
| 1   | 1   | 0     | 1       |

<div class="margin-left">

Ajoute deux chiffres binaires simples. `Somme` est la somme de chiffres unique de l'addition. `Retenue` représente le débordement.

</div>
</div>

## Additionneur complet

<div class="rows">

| A   | B   | Cin | Somme | Retenue |
| --- | --- | --- | ----- | ------- |
| 0   | 0   | 0   | 0     | 0       |
| 0   | 0   | 1   | 1     | 0       |
| 0   | 1   | 0   | 1     | 0       |
| 0   | 1   | 1   | 0     | 1       |
| 1   | 0   | 0   | 1     | 0       |
| 1   | 0   | 1   | 0     | 1       |
| 1   | 1   | 0   | 0     | 1       |
| 1   | 1   | 1   | 1     | 1       |

<div class="margin-left">

Ajoute trois chiffres binaires simples.

</div>
</div>

## ROM

<div class="rows">

![Édition des données de ROM](assets/help/rom-edit.jpg)

<div class="margin-left">

`Mémoire morte` - Les données peuvent être écrites en hexadécimal.
Peut être utilisé pour le code de programme, par exemple.

</div>
</div>

## Bascule D

<div class="rows">

| D   | Q   | Q Inverse |
| --- | --- | --------- |
| 1   | 1   | 0         |
| 0   | 0   | 1         |

<div class="margin-left">

Bascule de `Données` ou de `Délai` - Maintient un état. Lorsque (CLK) est mis à l'état haut, (Q) est défini sur (D). (Q Inverse) est toujours l'inverse de (Q).

</div>
</div>

## Bascule JK

<div class="rows">

| J   | K   | Q                | Q Inverse        |
| --- | --- | ---------------- | ---------------- |
| 1   | 1   | Bascule          | Bascule          |
| 1   | 0   | 1                | 0                |
| 0   | 1   | 0                | 1                |
| 0   | 0   | Aucun changement | Aucun changement |

<div class="margin-left">

Maintient un état. (J) représente `fixer`, (K) représente `réinitialiser`. Dès que (CLK) est mis à l'état haut, (Q) passe à l'état haut si (J) est à l'état haut et passe à l'état bas si (K) est à l'état haut. (Q) ne change pas lorsque (J) et (K) sont tous deux bas, bascule lorsque les deux sont à l'état haut.

</div>
</div>

## Bascule SR

<div class="rows">

| S   | R   | Q                | Q Inverse        |
| --- | --- | ---------------- | ---------------- |
| 0   | 0   | Aucun changement | Aucun changement |
| 1   | 0   | 1                | 0                |
| 0   | 1   | 0                | 1                |
| 1   | 1   | Invalide         | Invalide         |

<div class="margin-left">

Maintient un état. (S) représente `fixer`, (R) représente `réinitialiser`. Dès que (CLK) est mis à l'état haut, (Q) passe à l'état haut si (S) est à l'état haut et passe à l'état bas si (R) est à l'état haut. (Q) ne change pas lorsque (J) et (K) sont les mêmes.

</div>
</div>

## Générateur de nombres aléatoires

Ce composant générera un nombre aléatoire sur le front montant de son entrée CLK.

## RAM

Mémoire vive. Applique une entrée sur le front montant de CLK.<br>
Définissez WE sur haut pour écrire à l'adresse actuelle et sur bas pour lire à l'adresse actuelle.

## Décodificateur

<div class="rows">

| I1  | I2  | 0   | 1   | 2   | 3   |
| --- | --- | --- | --- | --- | --- |
| 0   | 0   | 1   | 0   | 0   | 0   |
| 0   | 1   | 0   | 1   | 0   | 0   |
| 1   | 0   | 0   | 0   | 1   | 0   |
| 1   | 1   | 0   | 0   | 0   | 1   |

<div class="margin-left">

Décodificateur 1-sur-n</br>
Convertit les informations binaires des entrées codées en n en 2^n sorties uniques. Seule une sortie est définie sur HAUT à la fois.

</div>
</div>

## Codeur

<div class="rows">

| I0  | I1  | I2  | I3  | 1   | 2   |
| --- | --- | --- | --- | --- | --- |
| 0   | 0   | 0   | 0   | 0   | 0   |
| 1   | 0   | 0   | 0   | 0   | 0   |
| X   | 1   | 0   | 0   | 0   | 1   |
| X   | X   | 1   | 0   | 1   | 0   |
| X   | X   | X   | 1   | 1   | 1   |

<div class="margin-left">

Codeur 2^n-vers-n</br>
Encode en binaire 2^n entrées en n sorties. Seule l'une des entrées doit être à l'état HAUT à la fois. Sinon, le MSB sera considéré comme HAUT et toutes les autres entrées seront traitées comme ne s'en souciant pas.

</div>
</div>

## Multiplexeur

<div class="rows">

| S0  | S1  | Sortie     |
| --- | --- | ---------- |
| 0   | 0   | valeur à 0 |
| 0   | 1   | valeur à 1 |
| 1   | 0   | valeur à 2 |
| 1   | 1   | valeur à 3 |

<div class="margin-left">

Sélectionne une entrée par une adresse donnée et écrit la valeur de l'entrée sélectionnée sur sa sortie.

</div>
</div>

## Démultiplexeur

<div class="rows">

| I   | S0  | S1  | 0   | 1   | 2   | 3   |
| --- | --- | --- | --- | --- | --- | --- |
| X   | 0   | 0   | I   | 0   | 0   | 0   |
| X   | 0   | 1   | 0   | I   | 0   | 0   |
| X   | 1   | 0   | 0   | 0   | I   | 0   |
| X   | 1   | 1   | 0   | 0   | 0   | I   |

<div class="margin-left">

Prend une entrée de données et n entrées d'adresse. La valeur de l'entrée de données est écrite sur la sortie donnée par les entrées d'adresse.

</div>
</div>
