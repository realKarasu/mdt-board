export function portraitSrc(displayId: number): string {
  return `/portraits/${displayId}.webp`;
}

export function isPriorityMob(count: number, isBoss: boolean, stealthDetect?: boolean): boolean {
  if (isBoss) return false;
  return Boolean(stealthDetect) || count >= 18;
}
