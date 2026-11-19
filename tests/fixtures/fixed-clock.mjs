// Loaded with `node --import` (tests/ui/snapshots.mjs puts it in the board server's NODE_OPTIONS): this process's clock
// starts at FIXED_NOW (ms since 1970) and runs on from there, so every timestamp the board writes is the same in every
// run (give or take the seconds the run takes).
const off = Number(process.env.FIXED_NOW) - Date.now();
if (Number.isFinite(off)) {
  const Real = Date;
  globalThis.Date = class extends Real {
    constructor(...a) { super(...(a.length ? a : [Real.now() + off])); }
    static now() { return Real.now() + off; }
  };
}
