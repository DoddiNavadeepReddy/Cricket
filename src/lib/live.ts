import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type LiveProfile = { displayName: string; teamName: string; color: string };

export type LiveRoom = {
  id: string;
  code: string;
  name: string;
  status: string;
  host_id: string;
  current_player_id: string | null;
  current_bid: number;
  current_bidder_id: string | null;
  auction_ends_at: string | null;
};

export type LiveMember = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  team_name: string;
  color: string;
  purse: number;
  ready: boolean;
  is_host: boolean;
  created_at?: string;
};

export type LiveBid = { id: string; room_id: string; player_id: string; bidder_id: string; amount: number; created_at: string };
export type LiveSquad = { id: string; room_id: string; member_id: string; player_id: string; bought_at: number; selected_style: string | null };
export type LiveMatch = { id: string; room_id: string; home_member_id: string; away_member_id: string; status: string; target: number; home_runs: number; home_wickets: number; home_balls: number; away_runs: number; away_wickets: number; away_balls: number };

export type LiveSnapshot = {
  userId: string;
  room: LiveRoom;
  member: LiveMember;
  members: LiveMember[];
  bids: LiveBid[];
  squads: LiveSquad[];
  match: LiveMatch | null;
};

const throwIfError = <T>(data: T, error: { message: string } | null) => {
  if (error) throw new Error(error.message);
  return data;
};

export async function bootstrapRoom(profile: LiveProfile): Promise<LiveSnapshot | null> {
  if (!supabase) return null;

  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const result = await supabase.auth.signInAnonymously();
    if (result.error) throw new Error(`Anonymous auth is not enabled in Supabase: ${result.error.message}`);
    session = result.data.session;
  }
  if (!session) throw new Error('Supabase did not return an authenticated session');

  const roomResponse = await supabase.rpc('create_room', {
    p_room_code: '24A8',
    p_room_name: 'Friends Premier League',
  });
  const room = throwIfError(roomResponse.data as LiveRoom | null, roomResponse.error);
  if (!room) throw new Error('Room could not be created');

  const memberResponse = await supabase.rpc('join_room', {
    p_room_code: '24A8',
    p_display_name: profile.displayName,
    p_team_name: profile.teamName,
    p_color: profile.color,
  });
  const member = throwIfError(memberResponse.data as LiveMember | null, memberResponse.error);
  if (!member) throw new Error('You could not join the room');

  const [membersResponse, bidsResponse, squadsResponse, matchResponse] = await Promise.all([
    supabase.from('room_members').select('*').eq('room_id', room.id).order('created_at'),
    supabase.from('auction_bids').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(12),
    supabase.from('squad_players').select('*').eq('room_id', room.id),
    supabase.from('matches').select('*').eq('room_id', room.id).order('created_at', { ascending: false }).limit(1),
  ]);

  return {
    userId: session.user.id,
    room,
    member,
    members: throwIfError((membersResponse.data ?? []) as LiveMember[], membersResponse.error),
    bids: throwIfError((bidsResponse.data ?? []) as LiveBid[], bidsResponse.error),
    squads: throwIfError((squadsResponse.data ?? []) as LiveSquad[], squadsResponse.error),
    match: throwIfError(((matchResponse.data ?? [])[0] ?? null) as LiveMatch | null, matchResponse.error),
  };
}

export function subscribeToRoom(roomId: string, onChange: (table: string, row: Record<string, unknown>) => void) {
  if (!supabase) return () => undefined;
  const client = supabase;

  const channel: RealtimeChannel = client
    .channel(`play-xi-room-${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => onChange('rooms', payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${roomId}` }, (payload) => onChange('room_members', payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_bids', filter: `room_id=eq.${roomId}` }, (payload) => onChange('auction_bids', payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_players', filter: `room_id=eq.${roomId}` }, (payload) => onChange('squad_players', payload.new as Record<string, unknown>))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `room_id=eq.${roomId}` }, (payload) => onChange('matches', payload.new as Record<string, unknown>))
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

export async function placeBid(roomId: string, playerId: string, amount: number) {
  if (!supabase) return null;
  const response = await supabase.rpc('place_bid', { p_room_id: roomId, p_player_id: playerId, p_amount: amount });
  return throwIfError(response.data as LiveRoom | null, response.error);
}

export async function buyPlayer(roomId: string, playerId: string, price: number, style: string) {
  if (!supabase) return null;
  const response = await supabase.rpc('buy_player', { p_room_id: roomId, p_player_id: playerId, p_price: price, p_selected_style: style });
  return throwIfError(response.data as LiveSquad | null, response.error);
}

export async function setPlayerStyle(squadId: string, style: string) {
  if (!supabase) return null;
  const response = await supabase.rpc('set_player_style', { p_squad_id: squadId, p_selected_style: style });
  return throwIfError(response.data as LiveSquad | null, response.error);
}

export async function startMatch(roomId: string) {
  if (!supabase) return null;
  const response = await supabase.rpc('start_match', { p_room_id: roomId });
  return throwIfError(response.data as LiveMatch | null, response.error);
}

export async function recordMatchBall(matchId: string, memberId: string, style: string, runs: number, isWicket: boolean, commentary: string) {
  if (!supabase) return null;
  const response = await supabase.rpc('record_match_ball', {
    p_match_id: matchId,
    p_innings_member_id: memberId,
    p_batting_style: style,
    p_runs: runs,
    p_is_wicket: isWicket,
    p_commentary: commentary,
  });
  return throwIfError(response.data as LiveMatch | null, response.error);
}
