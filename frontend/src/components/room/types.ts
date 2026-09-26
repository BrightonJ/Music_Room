export type Track = {
  id: number;
  title: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  votes: number;
};

export type NowPlaying = {
  track: { id: number; title: string; artist: string; coverUrl: string | null; previewUrl: string | null };
  startedAt: string;
  durationMs: number;
} | null;

export type Member = { id: number; username: string; isOwner: boolean; hasControl: boolean; deviceName?: string };