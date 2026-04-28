/**
 * Royal Rummy — 4 challengers in the king's tournament.
 *
 * Match structure: first to 5 wins (or HP 0) takes the duel. Each win raises
 * one of 5 royal flags above the opponent.
 *
 * `playStyle` controls AI behaviour (see src/game/gin-rummy.ts).
 * Each of the four contenders carries a distinct style so every match feels
 * different.
 */
import type { StageDef } from "./stage-types";

import player1Url from "./assets/characters/player1.jpg";
import player2Url from "./assets/characters/player2.jpg";
import player3Url from "./assets/characters/player3.jpg";
import player4Url from "./assets/characters/player4.jpg";

const FLAG_ROUNDS = [
  { label: "FLAG 1" },
  { label: "FLAG 2" },
  { label: "FLAG 3" },
  { label: "FLAG 4" },
  { label: "FLAG 5" },
];

export const STAGES: StageDef[] = [
  {
    name: "Cedric",
    portraitUrl: player1Url,
    rounds: FLAG_ROUNDS,
    accentColor: "#4a7ec8",
    description: "Lion-crest knight. Strikes first, asks later.",
    playStyle: "aggressive",
    tier: 1,
  },
  {
    name: "Elenor",
    portraitUrl: player2Url,
    rounds: FLAG_ROUNDS,
    accentColor: "#6ac86a",
    description: "Cathedral priestess. Unyielding patience.",
    playStyle: "defensive",
    tier: 1,
  },
  {
    name: "Finn",
    portraitUrl: player3Url,
    rounds: FLAG_ROUNDS,
    accentColor: "#a878d8",
    description: "Apprentice mage. Reads the deck like a spellbook.",
    playStyle: "tricky",
    tier: 1,
  },
  {
    name: "Vex",
    portraitUrl: player4Url,
    rounds: FLAG_ROUNDS,
    accentColor: "#7d6c4a",
    description: "Twin-blade scout. Adapts to every hand.",
    playStyle: "adaptive",
    tier: 1,
  },
];
