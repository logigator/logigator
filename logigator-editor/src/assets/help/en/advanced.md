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

![Rom Data Edit](assets/help/rom-edit.jpg)

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
|----|----|---|---|---|---|
| 0  | 0  | 1 | 0 | 0 | 0 |
| 0  | 1  | 0 | 1 | 0 | 0 |
| 1  | 0  | 0 | 0 | 1 | 0 |
| 1  | 1  | 0 | 0 | 0 | 1 |

<div class="margin-left">

1-of-n Decoder</br>
Converts binary information from n coded inputs to 2^n unique outputs. Only one output is set to HIGH at once.
</div>
</div>

## Encoder

<div class="rows">
	
| I0 | I1 | I2 | I3 | 1 | 2 |
|----|----|----|----|---|---|
| 0  | 0  | 0  | 0  | 0 | 0 |
| 1  | 0  | 0  | 0  | 0 | 0 |
| X  | 1  | 0  | 0  | 0 | 1 |
| X  | X  | 1  | 0  | 1 | 0 |
| X  | X  | X  | 1  | 1 | 1 |

<div class="margin-left">

2^n-to-n Encoder</br>
Binary encodes 2^n inputs to n outputs. Only one of the inputs should be HIGH at once. Otherwise the MSB will be considered as HIGH and all other inputs are treated as don`t cares.
</div>
</div>

## Multiplexer

<div class="rows">

| S0 | S1 | Out        |
|----|----|------------|
| 0  | 0  | value at 0 |
| 0  | 1  | value at 1 |
| 1  | 0  | value at 2 |
| 1  | 1  | value at 3 |

<div class="margin-left">

Selects an input by a give address and writes the value at the selected input to it´s output.
</div>
</div>

## Demultiplexer

<div class="rows">

| I | S0 | S1 | 0 | 1 | 2 | 3 |
|---|----|----|---|---|---|---|
| X | 0  | 0  | I | 0 | 0 | 0 |
| X | 0  | 1  | 0 | I | 0 | 0 |
| X | 1  | 0  | 0 | 0 | I | 0 |
| X | 1  | 1  | 0 | 0 | 0 | I |

<div class="margin-left">

Takes one data input an n address inputs. The value of the data input is written to the output given by the address inputs.
</div>
</div>
