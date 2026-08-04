export class IdAllocator {
  private _counter = 0;

  next(): number {
    return this._counter++;
  }

  bump(id: number): void {
    if (id >= this._counter) {
      this._counter = id + 1;
    }
  }
}
