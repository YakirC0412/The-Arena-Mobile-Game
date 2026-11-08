import { AVATARS } from '../content/avatars';

// Hebrew verbs and nouns change with the speaker's gender. A player is a man or a woman (chosen at sign-up; bots get
// the gender of their picture), and every text that talks about a player picks the right form with `by`.
export type Gender = 'male' | 'female';

export const GENDERS: readonly Gender[] = ['male', 'female'];

export const isGender = (value: unknown): value is Gender => value === 'male' || value === 'female';

// The gender of an avatar picture (used for bots, and as a guess for accounts made before gender existed).
export function genderOfAvatar(avatarId: string | undefined): Gender {
  return AVATARS.find((avatar) => avatar.id === avatarId)?.gender === 'female' ? 'female' : 'male';
}

// Picks the masculine or the feminine text for a player: by(player, 'ניצח', 'ניצחה').
export function by(player: { gender?: Gender } | null | undefined, male: string, female: string): string {
  return player?.gender === 'female' ? female : male;
}
