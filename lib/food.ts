/** Temperatures are stored as integer tenths of a degree C (e.g. 4.5C -> 45). */
export function tempToTenths(value: number) {
  return Math.round(value * 10)
}

export function tenthsToTemp(value: number) {
  return value / 10
}
