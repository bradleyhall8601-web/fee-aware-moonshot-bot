export interface ScoreResult {
  score: number;
  components: Record<string, number>;
  incomplete: boolean;
  missing: string[];
  version: string;
}

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const ratio = (part: number, total: number) => total > 0 ? part / total : 0;
export const present = (value: unknown) => value !== null && value !== undefined;

export function finalize(components: Record<string, number>, missing: string[], version: string): ScoreResult {
  const score = clamp(Object.values(components).reduce((sum, value) => sum + value, 0));
  return { score: Math.round(score * 100) / 100, components, incomplete: missing.length > 0, missing: [...new Set(missing)], version };
}
