export type VoteLicense = 'everyone' | 'invited' | 'location';

export type RoomEvent = {
  id: number;
  name: string;
  owner_id: number;
  owner_username: string | null;
  is_private: boolean;
  vote_license: VoteLicense;
  location_radius_m: number | null;
  vote_starts_at: string | null;
  vote_ends_at: string | null;
  isOwner: boolean;
  hasControl: boolean;
  isInvited: boolean;
};

export type QueueTrack = {
  id: number;
  deezerId: number;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationMs: number;
  votes: number;
  addedBy: string | null;
};

export type NowPlaying = {
  track: {
    id: number;
    deezerId: number;
    title: string;
    artist: string;
    coverUrl: string | null;
    previewUrl: string | null;
  };
  durationMs: number;
  positionMs: number;
};

export type PlaybackState = {
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  volume: number;
  receivedAt: number;
};

// One entry per connected DEVICE
export type Member = {
  userId: number;
  username: string;
  deviceId: number;
  deviceName: string;
  platform: string;
  isOwner: boolean;
  hasControl: boolean;
};

export type DelegationCandidate = {
  device_id: number;
  device_name: string;
  platform: string;
  last_seen_at: string;
  user_id: number;
  username: string;
  has_control: boolean;
  in_room: boolean;
};

export type SearchResult = {
  deezerId: number;
  title: string;
  artist: string;
  coverUrl: string | null;
  durationMs: number;
};

export type Friend = { id: number; username: string };

export type PublicProfile = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  music_preferences?: string[];
  isSelf: boolean;
  isFriend: boolean;
};

export type AckResult = { ok: boolean; error?: string; [key: string]: unknown };
