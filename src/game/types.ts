export type Difficulty = 1 | 2 | 3;

export type CategoryItem = {
  id: string;
  visual: string;
  imageKey?: string;
  answer: string;
  aliases: string[];
  difficulty: Difficulty;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
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
  color: string;
  isHuman: boolean;
  isActive: boolean;
  categoryId: string;
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
};

export type BattleSetup = {
  attackerId: string;
  defenderId: string;
  categoryId: string;
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
