/** Per-round flag pip definition (1〜5 wins → 5 flags) */
export interface RoundDef {
  label: string;
}

/** Stage (opponent) definition */
export interface StageDef {
  name: string;
  /** Character portrait URL (used in select & game scenes) */
  portraitUrl: string;
  rounds: RoundDef[];
  accentColor?: string;
  description?: string;
  /** AI play style for this opponent. Defaults to "defensive". */
  playStyle?: "aggressive" | "defensive" | "tricky" | "adaptive";
  /** Tournament tier (1-4). Used for cosmetic labels and seeding. */
  tier?: 1 | 2 | 3 | 4;
}
