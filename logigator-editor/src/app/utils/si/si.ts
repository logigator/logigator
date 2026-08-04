export const toSi = (value: number, precision = 2, base = 1024): string => {
  if (isNaN(value)) return 'NaN';

  const siSymbols_gr = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
  const siSymbols_lw = ['', 'm', 'μ', 'n', 'p', 'f', 'a', 'z', 'y'];

  let gr = 0;
  let lw = 0;

  for (; Math.abs(value) > base && gr < siSymbols_gr.length; gr++) {
    value /= base;
  }

  for (
    ;
    Math.abs(value) > 0 && Math.abs(value) < 1 && lw < siSymbols_lw.length;
    lw++
  ) {
    value *= base;
  }

  return value.toFixed(precision) + siSymbols_gr[gr] + siSymbols_lw[lw];
};

export const fromSi = (value: string, base = 1024): number => {
  // No Si Symbol in number, so plain number
  if (!isNaN(Number(value))) return Number(value);

  const siSymbols = [
    'y',
    'z',
    'a',
    'f',
    'p',
    'n',
    'μ',
    'm',
    '',
    'k',
    'M',
    'G',
    'T',
    'P',
    'E',
    'Z',
    'Y'
  ];

  const number = Number(value.substring(0, value.length - 1));
  if (!number) return NaN;

  const symbol = value.charAt(value.length - 1);

  const index = siSymbols.indexOf(symbol);
  if (index < 0) return NaN;

  return Math.pow(base, index - 8) * number;
};
