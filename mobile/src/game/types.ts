export type Difficulty = 1 | 2 | 3;

// A "way" is how a category is played: what the picture shows and what the
// player types (decision 15). w1 uses the item's answer; w2 its secondAnswer.
export type WayId = 'w1' | 'w2';

export type CategoryWay = {
  id: WayId;
  // Shown to players, e.g. "דגל ← שם המדינה".
  label: string;
  // False until its items have answers (or pictures) for this way.
  available: boolean;
};

export type CategoryLevel = 'easy' | 'medium' | 'hard';

// active = pickable and drawn into arenas · soon = listed, waiting for
// pictures · reserve = hidden filler when too few categories are active.
export type CategoryStatus = 'active' | 'soon' | 'reserve';

export type CategoryItem = {
  id: string;
  visual: string;
  imageKey?: string;
  answer: string;
  aliases: string[];
  // The answer when the category is played its second way (w2).
  secondAnswer?: { answer: string; aliases: string[] };
  difficulty: Difficulty;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  level: CategoryLevel;
  status: CategoryStatus;
  ways: CategoryWay[];
  items: CategoryItem[];
};

export type ArenaCell = {
  id: number;
  row: number;
  column: number;
  ownerId: string;
};

export type ArenaPlayer = {
  id: string;
  name: string;
  avatar: string;
  // Hebrew texts use the masculine or feminine form (see game/gender.ts).
  gender: 'male' | 'female';
  color: string;
  // True while a human decides for this seat. In an online game a bot takes over a disconnected human's seat
  // by turning this off (the seat keeps its userId).
  isHuman: boolean;
  // The account behind a human seat (online games).
  userId?: string;
  isActive: boolean;
  categoryId: string;
  // How this player's category is played when they defend (decision 15).
  wayId: WayId;
  cellIds: number[];
  hasPlayedThisRound: boolean;
  winStreak: number;
  bonusReady: boolean;
};

export type ArenaEvent = {
  id: string;
  text: string;
};

export type GameState = {
  cells: ArenaCell[];
  players: Record<string, ArenaPlayer>;
  humanPlayerId: string;
  round: number;
  selectedPlayerId: string | null;
  events: ArenaEvent[];
  // Monotonic counter for event ids, so ids stay deterministic for a seed.
  eventCount: number;
};

export type BattleSetup = {
  attackerId: string;
  defenderId: string;
  categoryId: string;
  // Duels use the defender's category and way (the final: the chosen one's).
  wayId: WayId;
  attackerSeconds: number;
  defenderSeconds: number;
  attackerUsesBonus: boolean;
  defenderUsesBonus: boolean;
  isFinal?: boolean;
};

export type BattleResolution = {
  state: GameState;
  winnerId: string;
  loserId: string;
  inheritedCategory: boolean;
  winnerEarnedBonus: boolean;
  summary: string;
};
