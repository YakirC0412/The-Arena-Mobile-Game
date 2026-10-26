export type AvatarGender = 'female' | 'male';

export type AvatarDefinition = {
  id: string;
  gender: AvatarGender;
};

export const AVATARS: AvatarDefinition[] = [
  { id: 'avatar-01', gender: 'female' },
  { id: 'avatar-02', gender: 'male' },
  { id: 'avatar-03', gender: 'female' },
  { id: 'avatar-04', gender: 'male' },
  { id: 'avatar-05', gender: 'female' },
  { id: 'avatar-06', gender: 'male' },
  { id: 'avatar-07', gender: 'male' },
  { id: 'avatar-08', gender: 'female' },
  { id: 'avatar-09', gender: 'male' },
  { id: 'avatar-10', gender: 'female' },
  { id: 'avatar-11', gender: 'male' },
  { id: 'avatar-12', gender: 'male' },
  { id: 'avatar-13', gender: 'female' },
  { id: 'avatar-14', gender: 'female' },
  { id: 'avatar-15', gender: 'male' },
  { id: 'avatar-16', gender: 'female' },
];

export const DEFAULT_AVATAR_ID = AVATARS[0].id;
