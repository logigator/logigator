# Portes de base

## Porte NON

<div class="rows">

| Entrée | Sortie |
| ------ | ------ |
| 0      | 1      |
| 1      | 0      |

<div class="margin-left">
La sortie est haute si l'entrée est basse.
</div>
</div>

## Porte ET

<div class="rows">

| A   | B   | Sortie |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 0      |
| 1   | 0   | 0      |
| 1   | 1   | 1      |

<div class="margin-left">
La sortie est haute si toutes les entrées sont hautes.
</div>
</div>

## Porte OU

<div class="rows">

| A   | B   | Sortie |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

<div class="margin-left">
La sortie est haute si au moins une entrée est haute.
</div>
</div>

## Porte OU exclusif (XOR)

<div class="rows">

| A   | B   | Sortie |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 0      |

<div class="margin-left">
La sortie est haute si un nombre impair d'entrées est haute.
</div>
</div>

## Délai

La sortie est égale à l'entrée, mais retardée d'un pas de simulation.

## Horloge

Envoie périodiquement une impulsion d'une durée d'un pas de simulation. Le délai entre les impulsions peut être configuré.<br>
Si l'entrée STP est haute, aucune impulsion d'horloge n'est produite.

## Tunnel

Fonctionne comme un fil, mais sans fil. Chaque tunnel est connecté à tous les autres avec le même identifiant.
