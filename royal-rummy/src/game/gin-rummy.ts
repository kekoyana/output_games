/**
 * Gin Rummy engine — pure logic, no rendering.
 *
 * Standard 10-card variant:
 * - 52 cards, deal 10 to each player, one up-card.
 * - On a turn: draw (stock or discard), then discard.
 * - Knock allowed when deadwood <= 10 after discarding. Gin when deadwood = 0.
 * - Melds: sets (3-4 same rank) or runs (3+ consecutive same suit, ace low).
 * - Ace = 1 point, J/Q/K = 10, others = face value.
 */

export type Suit = 0 | 1 | 2 | 3; // 0=Sword 1=Wand 2=Shield 3=Crown
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  id: number;
  suit: Suit;
  rank: Rank;
}

/**
 * Royal Rummy suit names. The order matches the suits.png sprite sheet
 * layout (top-left, top-right, bottom-left, bottom-right).
 */
export const SUIT_NAMES: Record<Suit, string> = { 0: "Sword", 1: "Wand", 2: "Shield", 3: "Crown" };
export const RANK_LABELS: Record<Rank, string> = {
  1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "11", 12: "12", 13: "13",
};

export function cardPoints(rank: Rank): number {
  if (rank === 1) return 1;
  if (rank >= 11) return 10;
  return rank;
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (let s = 0; s < 4; s++) {
    for (let r = 1; r <= 13; r++) {
      deck.push({ id: id++, suit: s as Suit, rank: r as Rank });
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => a.suit - b.suit || a.rank - b.rank);
}

/** All possible melds (sets + runs) hidden inside a set of cards. */
export function findAllMelds(cards: Card[]): Card[][] {
  const melds: Card[][] = [];

  // Sets: same rank, size 3 or 4
  const byRank = new Map<number, Card[]>();
  for (const c of cards) {
    const list = byRank.get(c.rank) ?? [];
    list.push(c);
    byRank.set(c.rank, list);
  }
  for (const group of byRank.values()) {
    if (group.length === 3) {
      melds.push([...group]);
    } else if (group.length === 4) {
      melds.push([...group]);
      for (let i = 0; i < 4; i++) {
        melds.push(group.filter((_, idx) => idx !== i));
      }
    }
  }

  // Runs: same suit, 3+ consecutive (ace low, K high)
  const bySuit = new Map<number, Card[]>();
  for (const c of cards) {
    const list = bySuit.get(c.suit) ?? [];
    list.push(c);
    bySuit.set(c.suit, list);
  }
  for (const group of bySuit.values()) {
    const sorted = [...group].sort((a, b) => a.rank - b.rank);
    // Find maximal runs, then all 3+ contiguous sub-runs
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1].rank === sorted[j].rank + 1) j++;
      const runLen = j - i + 1;
      if (runLen >= 3) {
        for (let a = i; a <= j - 2; a++) {
          for (let b = a + 2; b <= j; b++) {
            melds.push(sorted.slice(a, b + 1));
          }
        }
      }
      i = j + 1;
    }
  }

  return melds;
}

export interface MeldResult {
  melds: Card[][];
  deadwood: Card[];
  deadwoodPoints: number;
}

/** Find the meld partition minimizing deadwood. */
export function bestMelds(cards: Card[]): MeldResult {
  const allMelds = findAllMelds(cards);
  const totalPts = cards.reduce((s, c) => s + cardPoints(c.rank), 0);

  let bestPts = totalPts;
  let bestMeldSet: Card[][] = [];
  let bestDeadwood: Card[] = cards;

  const usedIds = new Set<number>();
  const chosen: Card[][] = [];

  function tryAt(start: number): void {
    // Compute current deadwood if we stop here
    let pts = 0;
    const dw: Card[] = [];
    for (const c of cards) {
      if (!usedIds.has(c.id)) {
        dw.push(c);
        pts += cardPoints(c.rank);
      }
    }
    if (pts < bestPts) {
      bestPts = pts;
      bestMeldSet = chosen.map((m) => [...m]);
      bestDeadwood = dw;
    }
    if (pts === 0) return; // can't do better

    for (let i = start; i < allMelds.length; i++) {
      const meld = allMelds[i];
      if (meld.every((c) => !usedIds.has(c.id))) {
        meld.forEach((c) => usedIds.add(c.id));
        chosen.push(meld);
        tryAt(i + 1);
        chosen.pop();
        meld.forEach((c) => usedIds.delete(c.id));
      }
    }
  }

  tryAt(0);
  return { melds: bestMeldSet, deadwood: bestDeadwood, deadwoodPoints: bestPts };
}

/** Simulate "what-if I discard card c from hand": return best deadwood of remaining 10 cards. */
export function deadwoodAfterDiscard(hand: Card[], discardId: number): MeldResult {
  const remaining = hand.filter((c) => c.id !== discardId);
  return bestMelds(remaining);
}

export interface AIMove {
  drawFromDiscard: boolean;
  discardCardId: number;
  knock: boolean;
  gin: boolean;
  resultingDeadwood: number;
}

/**
 * Per-character play style. Drives knock threshold and discard-bias differently.
 * - aggressive: knocks early (dw≤8), draws from discard often, suboptimal discards 30%
 * - defensive: knocks only at dw≤4, prefers stock draws, optimal discards
 * - tricky:    waits longer (dw≤6) hoping for undercut, noisy discards 35%
 * - adaptive:  defensive by default, but switches to aggressive when behind on HP/wins
 */
export type PlayStyle = "aggressive" | "defensive" | "tricky" | "adaptive";

export interface AIContext {
  /** Self HP ratio (0..1). Used by adaptive style. */
  selfHpRatio?: number;
  /** Opponent HP ratio (0..1). Used by adaptive style. */
  opponentHpRatio?: number;
}

interface StyleProfile {
  knockThreshold: number;
  ignoreDiscardChance: number;
  suboptimalDiscardChance: number;
}

function profileFor(style: PlayStyle, ctx?: AIContext): StyleProfile {
  if (style === "aggressive") {
    return { knockThreshold: 8, ignoreDiscardChance: 0.1, suboptimalDiscardChance: 0.3 };
  }
  if (style === "defensive") {
    return { knockThreshold: 4, ignoreDiscardChance: 0.4, suboptimalDiscardChance: 0.1 };
  }
  if (style === "tricky") {
    return { knockThreshold: 6, ignoreDiscardChance: 0.25, suboptimalDiscardChance: 0.35 };
  }
  // adaptive: defensive when ahead, aggressive when behind
  const self = ctx?.selfHpRatio ?? 1;
  const opp = ctx?.opponentHpRatio ?? 1;
  const behind = self < opp - 0.15;
  return behind
    ? { knockThreshold: 8, ignoreDiscardChance: 0.1, suboptimalDiscardChance: 0.25 }
    : { knockThreshold: 4, ignoreDiscardChance: 0.35, suboptimalDiscardChance: 0.1 };
}

/**
 * Decide AI's move given current 10-card hand and the top of discard pile.
 *
 * `knockMax` is the per-hand knock ceiling — the points value of the first
 * up-card determines this each hand (e.g. an up-card of 4 means knock only
 * when deadwood ≤ 4). This is the traditional Hollywood Gin "knock card".
 */
export function decideAIMove(
  hand: Card[],
  discardTop: Card | null,
  stockTop: Card,
  style: PlayStyle = "defensive",
  knockMax: number = 10,
  ctx?: AIContext,
  rng: () => number = Math.random,
): AIMove {
  const prof = profileFor(style, ctx);
  const ignoreDiscard = rng() < prof.ignoreDiscardChance;

  type Candidate = { src: "discard" | "stock"; card: Card };
  const candidates: Candidate[] = [];
  if (discardTop && !ignoreDiscard) candidates.push({ src: "discard", card: discardTop });
  candidates.push({ src: "stock", card: stockTop });

  let bestTake: {
    drawFromDiscard: boolean;
    card: Card;
    discardId: number;
    dw: number;
  } | null = null;

  for (const { src, card } of candidates) {
    const withNew = [...hand, card];
    const ranked: Array<{ id: number; dw: number }> = [];
    for (const c of withNew) {
      if (src === "discard" && c.id === card.id) continue;
      const res = deadwoodAfterDiscard(withNew, c.id);
      ranked.push({ id: c.id, dw: res.deadwoodPoints });
    }
    if (ranked.length === 0) continue;
    ranked.sort((a, b) => a.dw - b.dw);

    let pick = ranked[0];
    if (ranked.length > 1 && rng() < prof.suboptimalDiscardChance) {
      const idx = Math.min(ranked.length - 1, 1 + Math.floor(rng() * 2));
      pick = ranked[idx];
    }

    if (bestTake === null || pick.dw < bestTake.dw) {
      bestTake = {
        drawFromDiscard: src === "discard",
        card,
        discardId: pick.id,
        dw: pick.dw,
      };
    }
  }

  if (!bestTake) {
    return {
      drawFromDiscard: false,
      discardCardId: hand[0].id,
      knock: false,
      gin: false,
      resultingDeadwood: 100,
    };
  }

  const gin = bestTake.dw === 0;
  let knock = gin;
  if (!knock && bestTake.dw <= knockMax) {
    knock = bestTake.dw <= Math.min(prof.knockThreshold, knockMax);
  }

  return {
    drawFromDiscard: bestTake.drawFromDiscard,
    discardCardId: bestTake.discardId,
    knock,
    gin,
    resultingDeadwood: bestTake.dw,
  };
}

/** Try to lay off deadwood cards onto opponent's melds (after opponent knocks). */
export function tryLayoff(deadwood: Card[], opponentMelds: Card[][]): {
  layoffs: Card[];
  remainingDeadwood: Card[];
  remainingPoints: number;
} {
  const remaining = [...deadwood];
  const layoffs: Card[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      for (const meld of opponentMelds) {
        if (canLayoff(c, meld)) {
          meld.push(c);
          layoffs.push(c);
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  const pts = remaining.reduce((s, c) => s + cardPoints(c.rank), 0);
  return { layoffs, remainingDeadwood: remaining, remainingPoints: pts };
}

function canLayoff(card: Card, meld: Card[]): boolean {
  if (meld.length === 0) return false;
  // Set: all same rank?
  const allSameRank = meld.every((c) => c.rank === meld[0].rank);
  if (allSameRank) {
    return card.rank === meld[0].rank && meld.length < 4;
  }
  // Run: same suit, consecutive ranks
  const allSameSuit = meld.every((c) => c.suit === meld[0].suit);
  if (!allSameSuit) return false;
  if (card.suit !== meld[0].suit) return false;
  const ranks = meld.map((c) => c.rank).sort((a, b) => a - b);
  return card.rank === ranks[0] - 1 || card.rank === ranks[ranks.length - 1] + 1;
}

export interface HandOutcome {
  winner: "player" | "opponent";
  damage: number;
  gin: boolean;
  undercut: boolean;
  playerDeadwood: number;
  opponentDeadwood: number;
  playerMelds: Card[][];
  opponentMelds: Card[][];
}

/**
 * Resolve a knock. `knocker` is the side calling knock; both hands are their
 * current 10-card holdings after discarding.
 *
 * Damage model (mapped to HP / strip mechanic):
 * - Gin:           2 damage to loser
 * - Undercut:      2 damage to loser (original knocker)
 * - Normal knock:  1 damage to loser
 */
export function resolveKnock(
  knocker: "player" | "opponent",
  playerHand: Card[],
  opponentHand: Card[],
  isGin: boolean,
): HandOutcome {
  const pRes = bestMelds(playerHand);
  const oRes = bestMelds(opponentHand);

  if (isGin) {
    if (knocker === "player") {
      return {
        winner: "player",
        damage: 2,
        gin: true,
        undercut: false,
        playerDeadwood: pRes.deadwoodPoints,
        opponentDeadwood: oRes.deadwoodPoints,
        playerMelds: pRes.melds,
        opponentMelds: oRes.melds,
      };
    } else {
      return {
        winner: "opponent",
        damage: 2,
        gin: true,
        undercut: false,
        playerDeadwood: pRes.deadwoodPoints,
        opponentDeadwood: oRes.deadwoodPoints,
        playerMelds: pRes.melds,
        opponentMelds: oRes.melds,
      };
    }
  }

  // Normal knock: non-knocker may lay off onto knocker's melds
  let knockerDw: number;
  let defenderDw: number;
  let defenderMelds: Card[][];
  let knockerMelds: Card[][];
  if (knocker === "player") {
    knockerDw = pRes.deadwoodPoints;
    knockerMelds = pRes.melds;
    const lay = tryLayoff(oRes.deadwood, pRes.melds.map((m) => [...m]));
    defenderDw = lay.remainingPoints;
    defenderMelds = oRes.melds;
  } else {
    knockerDw = oRes.deadwoodPoints;
    knockerMelds = oRes.melds;
    const lay = tryLayoff(pRes.deadwood, oRes.melds.map((m) => [...m]));
    defenderDw = lay.remainingPoints;
    defenderMelds = pRes.melds;
  }

  const undercut = defenderDw <= knockerDw;
  const winner: "player" | "opponent" = undercut
    ? knocker === "player" ? "opponent" : "player"
    : knocker;
  const damage = undercut ? 2 : 1;

  return {
    winner,
    damage,
    gin: false,
    undercut,
    playerDeadwood: knocker === "player" ? knockerDw : defenderDw,
    opponentDeadwood: knocker === "opponent" ? knockerDw : defenderDw,
    playerMelds: knocker === "player" ? knockerMelds : defenderMelds,
    opponentMelds: knocker === "opponent" ? knockerMelds : defenderMelds,
  };
}
