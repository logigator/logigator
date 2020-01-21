# Basic Gates

## NOT Gate

<div class="rows">

| Input | Output |
| ------| ------ |
| 0     | 1      |
| 1     | 0      |

<div class="margin-left">
Output is high if input is low.
</div>
</div>

## AND Gate

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 0      |
| 1   | 0   | 0      |
| 1   | 1   | 1      |

<div class="margin-left">
Output is high if all inputs are high.
</div>
</div>

## OR Gate

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

<div class="margin-left">
Output is high if at least one input is high.
</div>
</div>

## XOR Gate

<div class="rows">

| A   | B   | Output |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 0      |

<div class="margin-left">
Output is high if an odd number of inputs are high.
</div>
</div>

## Delay

Output equals Input, but delayed for one simulation tick.

## Clock

Periodically sends a one tick long pulse. Delay between pulses can be configured.<br>
If the STP input is high, no clock pulses are produced.
