import { Pipe, PipeTransform } from '@angular/core';
import { toSi } from './si';

@Pipe({
  standalone: true,
  name: 'si'
})
export class SiPipe implements PipeTransform {
  public transform(value: number, precision = 2, base = 1024): string {
    return toSi(value, precision, base);
  }
}
