# Advanced Gates

## Half Adder

<div class="rows">

| A   | B   | Sum | Carry |
| --- | --- | --- | ----- |
| 0   | 0   | 0   | 0     |
| 1   | 0   | 1   | 0     |
| 0   | 1   | 1   | 0     |
| 1   | 1   | 0   | 1     |

<div class="margin-left">

Adds two single binary digits. `Sum` is the single digit sum of the addition. `Carry` represents the overflow.
</div>
</div>

## Full Adder

<div class="rows">

| A   | B   | Cin | Sum | Carry |
| --- | --- | --- | --- | ----- |
| 0   | 0   | 0   | 0   | 0     |
| 0   | 0   | 1   | 1   | 0     |
| 0   | 1   | 0   | 1   | 0     |
| 0   | 1   | 1   | 0   | 1     |
| 1   | 0   | 0   | 1   | 0     |
| 1   | 0   | 1   | 0   | 1     |
| 1   | 1   | 0   | 0   | 1     |
| 1   | 1   | 1   | 1   | 1     |

<div class="margin-left">

Adds three single binary digits.
</div>
</div>

## ROM

<div class="rows">

![Rom Data Edit](../../assets/help/rom-edit.jpg)

<div class="margin-left">

`Read only Memory` - Data can be written in hexadecimal.
Can be used for program code, for example.
</div>
</div>

## D Flip-Flop

<div class="rows">

| D   | Q   | Q Inverse |
| --- | --- | --------- |
| 1   | 1   | 0         |
| 0   | 0   | 1         |

<div class="margin-left">

`Data` or `Delay` Flip-Flop - Holds a state. When (CLK) is set high, (Q) gets set to (D). (Q Inverse) always is the inverse of (Q).

</div>
</div>

## JK Flip-Flop

<div class="rows">

| J    | K    | Q         | Q Inverse |
| ---- | ---- | --------- | --------- |
| 1    | 1    | Toggle    | Toggle    |
| 1    | 0    | 1         | 0         |
| 0    | 1    | 0         | 1         |
| 0    | 0    | No change | No change |

<div class="margin-left">

Holds a state. (J) represents `set`, (K) represents `reset`. As soon as (CLK) is set high, (Q) sets high if (J) is set high and sets low if (K) is set high. (Q) does not change when both (J) and (K) are low, toggles when both are set high.
</div>
</div>

## SR Flip-Flop

<div class="rows">

| S    | R    | Q         | Q Inverse |
| ---- | ---- | --------- | --------- |
| 0    | 0    | No change | No change |
| 1    | 0    | 1         | 0         |
| 0    | 1    | 0         | 1         |
| 1    | 1    | Invalid   | Invalid   |

<div class="margin-left">

Holds a state. (S) represents `set`, (R) represents `reset`. As soon as (CLK) is set high, (Q) sets high if (S) is set high and sets low if (R) is set high. (Q) does not change when (J) and (K) are the same.
</div>
</div>

## Random Number Generator

This component will generate a random number on rising edge of its CLK input.

## RAM

Random Access Memory. Applies input on rising edge of CLK.<br>
Set WE to high to write to current address and to low to read from current address.

## Decoder

<div class="rows">
	
| I1 | I2 | 0 | 1 | 2 | 3 |
| -- | -- | - | - | - | - |
| 0  | 0  | 1 | 0 | 0 | 0 |
| 0  | 1  | 0 | 1 | 0 | 0 |
| 1  | 0  | 0 | 0 | 1 | 0 |
| 1  | 1  | 0 | 0 | 0 | 1 |

<div class="margin-left">

1-of-n Decoder</br>
It converts binary information from the n coded inputs to 2^n unique outputs. Only one output is set to HIGH at every given time.
</div>
</div>

## Ecoder

<div class="rows">
	
| I0 | I1 | I2 | I3 | 1 | 2 |
| -- | -- | -- | -- | - | - |
| 0  | 0  | 0  | 0  | 0 | 0 |
| 1  | 0  | 0  | 0  | 0 | 0 |
| X  | 1  | 0  | 0  | 0 | 1 |
| X  | X  | 1  | 0  | 1 | 0 |
| X  | X  | X  | 1  | 1 | 1 |

<div class="margin-left">

2^n-to-n Endcoder</br>
It binary encodes 2^n inputs to n outputs. Only one of the inpuputs should be HIGH at a time. Otherwise the MSB will be consindered as HIGH and all other inputus are treated as Don`t cares.
</div>
</div>
