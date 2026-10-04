import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Flame,
  Gavel,
  LayoutGrid,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  Send,
  Settings,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserPlus,
  Users,
  WalletCards,
  X,
  Zap,
} from 'lucide-react';
import {
  bootstrapRoom,
  buyPlayer as buyPlayerLive,
  placeBid as placeBidLive,
  recordMatchBall as recordMatchBallLive,
  setPlayerStyle as setPlayerStyleLive,
  startMatch as startMatchLive,
  subscribeToRoom,
} from './lib/live';
import type { LiveMatch, LiveMember, LiveProfile, LiveSquad } from './lib/live';

type View = 'auction' | 'squad' | 'match';
type Tone = 'lime' | 'violet' | 'peach' | 'blue';

type Player = {
  id: number;
  dbId: string;
  name: string;
  shortName: string;
  role: string;
  battingStyle: string;
  specialty: string;
  basePrice: number;
  image: string;
  tone: Tone;
  country: string;
  status: 'upcoming' | 'current' | 'sold';
  owner?: string;
};

type Member = {
  name: string;
  initials: string;
  team: string;
  color: Tone;
  balance: string;
  ready?: boolean;
};

const players: Player[] = [
  { id: 1, dbId: 'virat-kohli', name: 'Virat Kohli', shortName: 'V. Kohli', role: 'BATTER', battingStyle: 'The cover drive', specialty: 'Chase architect', basePrice: 11, image: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=85', tone: 'lime', country: 'IND', status: 'current' },
  { id: 2, dbId: 'rohit-sharma', name: 'Rohit Sharma', shortName: 'R. Sharma', role: 'BATTER', battingStyle: 'The pull shot', specialty: 'Powerplay captain', basePrice: 10, image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=85', tone: 'violet', country: 'IND', status: 'upcoming' },
  { id: 3, dbId: 'jasprit-bumrah', name: 'Jasprit Bumrah', shortName: 'J. Bumrah', role: 'BOWLER', battingStyle: 'The perfect yorker', specialty: 'Death overs', basePrice: 9, image: 'https://images.unsplash.com/photo-1508344928928-716c7b5d2f64?auto=format&fit=crop&w=600&q=85', tone: 'peach', country: 'IND', status: 'upcoming' },
  { id: 4, dbId: 'ms-dhoni', name: 'M. S. Dhoni', shortName: 'M. S. Dhoni', role: 'WICKETKEEPER', battingStyle: 'The helicopter', specialty: 'Finisher', basePrice: 8, image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=600&q=85', tone: 'blue', country: 'IND', status: 'upcoming' },
  { id: 5, dbId: 'smriti-mandhana', name: 'Smriti Mandhana', shortName: 'S. Mandhana', role: 'BATTER', battingStyle: 'The lofted drive', specialty: 'Elegant opener', basePrice: 7, image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=600&q=85', tone: 'violet', country: 'IND', status: 'upcoming' },
  { id: 6, dbId: 'glenn-maxwell', name: 'Glenn Maxwell', shortName: 'G. Maxwell', role: 'ALL-ROUNDER', battingStyle: 'The switch hit', specialty: 'Game breaker', basePrice: 7, image: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=600&q=85', tone: 'lime', country: 'AUS', status: 'sold', owner: 'Maya' },
  { id: 7, dbId: 'rashid-khan', name: 'Rashid Khan', shortName: 'R. Khan', role: 'BOWLER', battingStyle: 'The googly', specialty: 'Middle overs', basePrice: 6, image: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=600&q=85', tone: 'peach', country: 'AFG', status: 'sold', owner: 'Jay' },
];

const members: Member[] = [
  { name: 'You', initials: 'DN', team: 'Night Riders', color: 'lime', balance: '₹ 46.5 Cr', ready: true },
  { name: 'Maya', initials: 'MK', team: 'Super Giants', color: 'violet', balance: '₹ 38.0 Cr', ready: true },
  { name: 'Jay', initials: 'JP', team: 'Royals', color: 'peach', balance: '₹ 41.5 Cr', ready: true },
  { name: 'Aarav', initials: 'AS', team: 'Warriors', color: 'blue', balance: '₹ 49.0 Cr' },
];

const navItems: { view: View; label: string; icon: typeof LayoutGrid }[] = [
  { view: 'auction', label: 'Live auction', icon: Gavel },
  { view: 'squad', label: 'My squad', icon: LayoutGrid },
  { view: 'match', label: 'Match day', icon: Trophy },
];

const tones: Record<Tone, string> = {
  lime: '#d8ff45',
  violet: '#bf9bff',
  peach: '#ffb48f',
  blue: '#87c7ff',
};

const money = (value: number) => `₹ ${value.toFixed(1)} Cr`;

const colorForTone = (tone: Tone) => tones[tone];

const normalizeTone = (tone: string): Tone => tone === 'violet' || tone === 'peach' || tone === 'blue' ? tone : 'lime';

const getLocalProfile = (): LiveProfile => {
  const stored = window.localStorage.getItem('play-xi-profile');
  if (stored) {
    try {
      return JSON.parse(stored) as LiveProfile;
    } catch {
      window.localStorage.removeItem('play-xi-profile');
    }
  }

  const profile = { displayName: `Player ${Math.floor(100 + Math.random() * 900)}`, teamName: 'Night Riders', color: 'lime' } satisfies LiveProfile;
  window.localStorage.setItem('play-xi-profile', JSON.stringify(profile));
  return profile;
};

const localPlayerFromDbId = (dbId: unknown) => players.find((player) => player.dbId === dbId);

function App() {
  const [profile] = useState<LiveProfile>(() => getLocalProfile());
  const [view, setView] = useState<View>('auction');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isRoomPanelOpen, setIsRoomPanelOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState(1);
  const [currentBid, setCurrentBid] = useState(12.5);
  const [bidder, setBidder] = useState('Maya');
  const [myBalance, setMyBalance] = useState(46.5);
  const [bidHistory, setBidHistory] = useState([{ person: 'Maya', amount: 12.5 }, { person: 'You', amount: 12.0 }, { person: 'Jay', amount: 11.5 }]);
  const [ownedPlayerIds, setOwnedPlayerIds] = useState<number[]>([6]);
  const [activeStyle, setActiveStyle] = useState('The cover drive');
  const [inningsRuns, setInningsRuns] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [lastBall, setLastBall] = useState('Ready for the first ball');
  const [toast, setToast] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveRoomId, setLiveRoomId] = useState('');
  const [liveUserId, setLiveUserId] = useState('');
  const [liveMemberId, setLiveMemberId] = useState('');
  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);
  const [liveSquads, setLiveSquads] = useState<LiveSquad[]>([]);
  const [liveMatch, setLiveMatch] = useState<LiveMatch | null>(null);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? players[0];
  const myPlayers = players.filter((player) => ownedPlayerIds.includes(player.id));
  const upcomingPlayers = players.filter((player) => player.status === 'upcoming');
  const progress = Math.min(100, (balls / 24) * 100);

  const visibleMembers = liveMembers.length > 0
    ? liveMembers.map((member) => ({ name: member.user_id === liveUserId ? 'You' : member.display_name, initials: member.display_name.slice(0, 2).toUpperCase(), team: member.team_name, color: normalizeTone(member.color), balance: money(member.purse), ready: member.ready }))
    : members;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    let dispose: () => void = () => undefined;
    let cancelled = false;

    const connectRoom = async () => {
      try {
        const snapshot = await bootstrapRoom(profile);
        if (!snapshot || cancelled) return;

        setLiveReady(true);
        setLiveError('');
        setLiveRoomId(snapshot.room.id);
        setLiveUserId(snapshot.userId);
        setLiveMemberId(snapshot.member.id);
        setLiveMembers(snapshot.members);
        setLiveSquads(snapshot.squads);
        setLiveMatch(snapshot.match);
        setMyBalance(snapshot.member.purse);

        const roomPlayer = localPlayerFromDbId(snapshot.room.current_player_id);
        if (roomPlayer) setSelectedPlayerId(roomPlayer.id);
        if (snapshot.room.current_bid > 0) setCurrentBid(Number(snapshot.room.current_bid));
        if (snapshot.room.current_bidder_id) {
          const currentBidder = snapshot.members.find((member) => member.user_id === snapshot.room.current_bidder_id);
          if (currentBidder) setBidder(currentBidder.display_name);
        }

        const mySquads = snapshot.squads.filter((squad) => squad.member_id === snapshot.member.id);
        if (mySquads.length > 0) setOwnedPlayerIds(mySquads.map((squad) => players.find((player) => player.dbId === squad.player_id)?.id ?? 0).filter((id) => id > 0));
        if (snapshot.bids.length > 0) {
          setBidHistory(snapshot.bids.slice(0, 3).map((bid) => ({ person: bid.bidder_id === snapshot.userId ? 'You' : snapshot.members.find((member) => member.user_id === bid.bidder_id)?.display_name ?? 'Friend', amount: Number(bid.amount) })));
        }

        if (snapshot.match && snapshot.match.home_member_id === snapshot.member.id) {
          setInningsRuns(snapshot.match.home_runs);
          setWickets(snapshot.match.home_wickets);
          setBalls(snapshot.match.home_balls);
        }

        dispose = subscribeToRoom(snapshot.room.id, (table, row) => {
          if (table === 'rooms') {
            const nextPlayer = localPlayerFromDbId(row.current_player_id);
            if (nextPlayer) setSelectedPlayerId(nextPlayer.id);
            if (typeof row.current_bid === 'number') setCurrentBid(row.current_bid);
            if (row.current_bidder_id) {
              const nextBidder = snapshot.members.find((member) => member.user_id === row.current_bidder_id);
              setBidder(nextBidder?.display_name ?? (row.current_bidder_id === snapshot.userId ? 'You' : 'Friend'));
            }
          }
          if (table === 'room_members') {
            setLiveMembers((current) => {
              const member = row as unknown as LiveMember;
              const next = current.filter((item) => item.id !== member.id);
              return [...next, member].sort((a, b) => a.created_at?.localeCompare(b.created_at ?? '') ?? 0);
            });
            if (row.user_id === snapshot.userId && typeof row.purse === 'number') setMyBalance(row.purse);
          }
          if (table === 'auction_bids') {
            const nextBid = row as unknown as { bidder_id: string; amount: number };
            setBidHistory((current) => [{ person: nextBid.bidder_id === snapshot.userId ? 'You' : snapshot.members.find((member) => member.user_id === nextBid.bidder_id)?.display_name ?? 'Friend', amount: Number(nextBid.amount) }, ...current].slice(0, 3));
          }
          if (table === 'squad_players') {
            const nextSquad = row as unknown as LiveSquad;
            setLiveSquads((current) => [...current.filter((item) => item.id !== nextSquad.id), nextSquad]);
            if (nextSquad.member_id === snapshot.member.id) {
              const nextPlayer = localPlayerFromDbId(nextSquad.player_id);
              if (nextPlayer) setOwnedPlayerIds((current) => current.includes(nextPlayer.id) ? current : [...current, nextPlayer.id]);
            }
          }
          if (table === 'matches') {
            const nextMatch = row as unknown as LiveMatch;
            setLiveMatch(nextMatch);
            if (nextMatch.home_member_id === snapshot.member.id) {
              setInningsRuns(nextMatch.home_runs);
              setWickets(nextMatch.home_wickets);
              setBalls(nextMatch.home_balls);
            }
          }
        });
      } catch (error) {
        if (!cancelled) setLiveError(error instanceof Error ? error.message : 'Supabase connection failed');
      }
    };

    void connectRoom();
    return () => {
      cancelled = true;
      dispose();
    };
  }, [profile]);

  const setActiveView = (nextView: View) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  const placeBid = (increment = 0.5) => {
    const nextBid = Number((currentBid + increment).toFixed(1));
    if (nextBid >= myBalance) {
      showToast('That bid is above your remaining purse');
      return;
    }
    setCurrentBid(nextBid);
    setBidder('You');
    if (!liveReady) setMyBalance(Number((myBalance - increment).toFixed(1)));
    setBidHistory((current) => [{ person: 'You', amount: nextBid }, ...current].slice(0, 3));
    showToast(`You are leading at ${money(nextBid)}`);
    if (liveReady && liveRoomId) {
      void placeBidLive(liveRoomId, selectedPlayer.dbId, nextBid).catch((error: Error) => showToast(error.message));
    }
  };

  const selectUpcoming = (player: Player) => {
    setSelectedPlayerId(player.id);
    setCurrentBid(player.basePrice + 1.5);
    setBidder('Maya');
    showToast(`${player.name} is now on the auction block`);
  };

  const buySelectedPlayer = () => {
    if (ownedPlayerIds.includes(selectedPlayer.id)) {
      showToast(`${selectedPlayer.name} is already in your squad`);
      return;
    }
    if (currentBid >= myBalance) {
      showToast('Save some purse for the rest of your XI');
      return;
    }
    const finishPurchase = () => {
      setOwnedPlayerIds((current) => current.includes(selectedPlayer.id) ? current : [...current, selectedPlayer.id]);
      setMyBalance(Number((myBalance - currentBid).toFixed(1)));
      showToast(`${selectedPlayer.name} joined your squad at ${money(currentBid)}`);
      setActiveView('squad');
    };

    if (liveReady && liveRoomId) {
      void buyPlayerLive(liveRoomId, selectedPlayer.dbId, currentBid, selectedPlayer.battingStyle).then(finishPurchase).catch((error: Error) => showToast(error.message));
    } else {
      finishPurchase();
    }
  };

  const playBall = (style: string) => {
    const outcomes = style === 'The cover drive' ? [4, 4, 2, 6, 1] : style === 'The helicopter' ? [6, 4, 2, 1, 6] : [1, 2, 4, 0, 6];
    const outcome = outcomes[balls % outcomes.length];
    const isWicket = outcome === 0;
    setActiveStyle(style);
    setBalls((current) => current + 1);
    setInningsRuns((current) => current + (isWicket ? 0 : outcome));
    setWickets((current) => current + (isWicket ? 1 : 0));
    setLastBall(isWicket ? 'WICKET — edged behind' : `${outcome} run${outcome === 1 ? '' : 's'} — ${style.toLowerCase()}`);
    if (liveReady && liveMatch && liveMemberId) {
      void recordMatchBallLive(liveMatch.id, liveMemberId, style, outcome, isWicket, isWicket ? 'WICKET — edged behind' : `${outcome} runs — ${style.toLowerCase()}`).then(setLiveMatch).catch((error: Error) => showToast(error.message));
    }
  };

  const setStyle = (style: string) => {
    setActiveStyle(style);
    const matchingSquad = liveSquads.find((squad) => squad.member_id === liveMemberId && players.find((player) => player.dbId === squad.player_id)?.battingStyle === style);
    if (matchingSquad) void setPlayerStyleLive(matchingSquad.id, style).catch((error: Error) => showToast(error.message));
  };

  const startMatch = () => {
    if (liveReady && liveRoomId) {
      void startMatchLive(liveRoomId).then((match) => {
        if (match) setLiveMatch(match);
        setActiveView('match');
      }).catch((error: Error) => showToast(error.message));
      return;
    }
    setActiveView('match');
  };

  const copyRoomCode = () => {
    void navigator.clipboard?.writeText('PLAYXI-24A8');
    showToast('Room code copied — send it to your friends');
  };

  const viewHeading = useMemo(() => {
    if (view === 'auction') return { eyebrow: 'ROOM 24A8 / LOT 12', title: 'Build your team.', body: 'Bid smart. Pick the players whose signature style wins your matches.' };
    if (view === 'squad') return { eyebrow: 'YOUR TEAM / 01', title: 'Your playing XI.', body: 'Every player brings a move. Choose the style you want to take into the match.' };
    return { eyebrow: 'MATCH DAY / FRIENDLY 01', title: 'Make it count.', body: 'Pick your batting style, read the ball, and take your team over the line.' };
  }, [view]);

  return (
    <div className="app-shell">
      <div className="background-grid" />
      <header className="topbar">
        <div className="topbar-left">
          <button className="mobile-menu-button" type="button" aria-label="Open navigation" onClick={() => setIsMobileNavOpen((current) => !current)}>{isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <a href="#top" className="logo"><span className="logo-mark"><span /></span><span>PLAY <b>/</b> XI</span></a>
          <span className="topbar-divider" />
          <span className="league-name">FRIENDS PREMIER LEAGUE <span>SEASON 01</span></span>
        </div>
        <div className="topbar-right">
          <button className="room-pill" type="button" onClick={() => setIsRoomPanelOpen(true)}><span className="room-pulse" /> ROOM 24A8 <ChevronDown size={14} /></button>
          <button className="notification-button" type="button" aria-label="Notifications" onClick={() => showToast('No new match alerts')}><Bell size={17} /><span /></button>
          <button className="user-menu" type="button" onClick={() => showToast(`${profile.displayName} · ${profile.teamName}`)}><span className="user-avatar">{profile.displayName.slice(0, 2).toUpperCase()}</span><span>{profile.displayName}</span><ChevronDown size={13} /></button>
        </div>
      </header>

      <div className="app-layout" id="top">
        <aside className={`sidebar ${isMobileNavOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-room-card">
            <div className="sidebar-room-top"><span className="overline">PRIVATE ROOM</span><button type="button" aria-label="Room options" onClick={() => setIsRoomPanelOpen(true)}><MoreHorizontal size={16} /></button></div>
            <div className="sidebar-room-name">Room <strong>24A8</strong></div>
            <div className="room-status"><span className="status-live" /> {liveReady ? 'live sync' : liveError ? 'demo mode' : 'connecting'} <span>·</span> 04:26</div>
            <div className="room-member-stack">{visibleMembers.slice(0, 4).map((member) => <span className={`member-dot member-${member.color}`} key={member.name}>{member.initials}</span>)}{visibleMembers.length > 4 && <span className="member-count">+{visibleMembers.length - 4}</span>}</div>
            <button className="invite-button" type="button" onClick={copyRoomCode}><UserPlus size={14} /> Invite friends <Copy size={13} /></button>
          </div>

          <nav className="side-nav" aria-label="League navigation">
            <span className="overline side-nav-label">PLAYGROUND</span>
            {navItems.map((item) => { const Icon = item.icon; return <button key={item.view} className={`side-nav-item ${view === item.view ? 'side-nav-item-active' : ''}`} type="button" onClick={() => setActiveView(item.view)}><Icon size={17} /><span>{item.label}</span>{item.view === 'auction' && <span className="nav-live">LIVE</span>}</button>; })}
          </nav>

          <div className="sidebar-divider" />
          <div className="sidebar-section"><div className="sidebar-section-heading"><span className="overline">ROOM MEMBERS</span><button type="button" onClick={() => setIsRoomPanelOpen(true)}><Plus size={15} /></button></div>{visibleMembers.map((member) => <div className="member-row" key={member.name}><span className={`member-avatar member-${member.color}`}>{member.initials}</span><div><strong>{member.name}</strong><small>{member.team}</small></div><span className={`member-ready ${member.ready ? 'member-ready-yes' : ''}`}>{member.ready ? <Check size={12} /> : '—'}</span></div>)}</div>
          <div className="sidebar-bottom"><button type="button" onClick={() => showToast('Room rules: ₹ 100 Cr purse · 11 players · 4 friends')}><CircleHelp size={15} /> Room rules</button><button type="button" onClick={() => showToast('Settings are saved automatically')}><Settings size={15} /> Settings</button></div>
        </aside>

        <main className="main-content">
          <div className="page-heading"><div><span className="overline overline-lime">{viewHeading.eyebrow}</span><h1>{viewHeading.title}</h1><p>{viewHeading.body}</p></div><div className="heading-actions"><button className="icon-square-button" type="button" aria-label="Open chat" onClick={() => setIsChatOpen((current) => !current)}><MessageCircle size={17} /><span className="chat-badge">3</span></button><button className="button button-light" type="button" onClick={() => showToast('Invite link copied for your crew')}><Share2Icon /> Share room</button></div></div>

          {view === 'auction' && <AuctionView selectedPlayer={selectedPlayer} currentBid={currentBid} bidder={bidder} bidHistory={bidHistory} upcomingPlayers={upcomingPlayers} ownedPlayerIds={ownedPlayerIds} myBalance={myBalance} onBid={placeBid} onSelectPlayer={selectUpcoming} onBuy={buySelectedPlayer} onOpenSquad={() => setActiveView('squad')} />}
          {view === 'squad' && <SquadView players={myPlayers} activeStyle={activeStyle} onSetStyle={setStyle} onStartMatch={startMatch} onAuction={() => setActiveView('auction')} />}
          {view === 'match' && <MatchView players={myPlayers} activeStyle={activeStyle} inningsRuns={inningsRuns} wickets={wickets} balls={balls} progress={progress} lastBall={lastBall} onPlayBall={playBall} onSetStyle={setStyle} />}
        </main>
      </div>

      {isChatOpen && <ChatPanel onClose={() => setIsChatOpen(false)} onSend={() => { setIsChatOpen(false); showToast('Message sent to the room'); }} />}
      {isRoomPanelOpen && <RoomPanel onClose={() => setIsRoomPanelOpen(false)} onCopy={copyRoomCode} />}
      {toast && <div className="toast"><span className="toast-icon"><Check size={14} /></span>{toast}</div>}
    </div>
  );
}

function AuctionView({ selectedPlayer, currentBid, bidder, bidHistory, upcomingPlayers, ownedPlayerIds, myBalance, onBid, onSelectPlayer, onBuy, onOpenSquad }: { selectedPlayer: Player; currentBid: number; bidder: string; bidHistory: { person: string; amount: number }[]; upcomingPlayers: Player[]; ownedPlayerIds: number[]; myBalance: number; onBid: (increment?: number) => void; onSelectPlayer: (player: Player) => void; onBuy: () => void; onOpenSquad: () => void }) {
  const isOwned = ownedPlayerIds.includes(selectedPlayer.id);
  return <div className="auction-view">
    <div className="auction-meta-row"><div className="auction-live-state"><span className="status-live" /> LIVE AUCTION <span className="muted-separator">/</span> BIDDING OPEN</div><div className="auction-time"><span className="auction-time-label">LOT CLOSES IN</span><strong>00:34</strong><span className="time-bar"><i /></span></div></div>
    <section className="auction-hero-card">
      <div className="hero-player-visual" style={{ backgroundImage: `linear-gradient(180deg, rgba(18,23,22,.04) 20%, rgba(18,23,22,.94) 100%), url(${selectedPlayer.image})` }}><div className="hero-visual-top"><span className="lot-badge">LOT 12 / <b>{selectedPlayer.role}</b></span><span className="player-country">{selectedPlayer.country} <span className="flag-dot" /></span></div><div className="hero-visual-bottom"><span className="player-index">0{selectedPlayer.id}</span><div><span className="visual-kicker">SIGNATURE STYLE</span><strong>{selectedPlayer.battingStyle}</strong></div><span className="hero-arrow"><ArrowUpRight size={18} /></span></div></div>
      <div className="auction-panel"><div className="panel-label-row"><span className="overline">NOW ON THE BLOCK</span><span className="hot-label"><Flame size={13} /> HOT LOT</span></div><h2>{selectedPlayer.name}</h2><div className="player-role-line"><span>{selectedPlayer.role}</span><i /> <span>{selectedPlayer.specialty}</span></div><div className="bid-main"><div><span className="bid-label">CURRENT BID</span><strong>{money(currentBid)}</strong><span className="highest-bidder"><span className="mini-bid-avatar">{bidder.slice(0, 2).toUpperCase()}</span> {bidder} is leading</span></div><div className="bid-history">{bidHistory.map((bid, index) => <div className={`bid-history-row ${index === 0 ? 'bid-history-row-active' : ''}`} key={`${bid.person}-${bid.amount}`}><span>{bid.person}</span><strong>{money(bid.amount)}</strong></div>)}</div></div><div className="bid-actions"><button className="bid-increment" type="button" onClick={() => onBid(.5)}>+ ₹ 0.5 Cr</button><button className="bid-increment" type="button" onClick={() => onBid(1)}>+ ₹ 1 Cr</button><button className="button button-bid" type="button" onClick={() => onBid(.5)}><Gavel size={15} /> Bid {money(currentBid + .5)}</button></div><div className="bid-footer"><span><WalletCards size={14} /> Your purse <strong>{money(myBalance)}</strong></span><button className="buy-now" type="button" onClick={onBuy} disabled={isOwned}>{isOwned ? <><Check size={14} /> In your squad</> : <>Lock player <ArrowUpRight size={14} /></>}</button></div></div>
    </section>
    <div className="below-auction-grid"><section className="upcoming-section"><div className="section-title-row"><div><span className="overline">UP NEXT</span><h3>Players you might want.</h3></div><button className="link-button" type="button" onClick={() => onSelectPlayer(upcomingPlayers[0])}>View the board <ChevronRight size={14} /></button></div><div className="upcoming-grid">{upcomingPlayers.slice(0, 4).map((player) => <button type="button" className={`upcoming-card ${selectedPlayer.id === player.id ? 'upcoming-card-active' : ''}`} key={player.id} onClick={() => onSelectPlayer(player)}><span className="upcoming-image" style={{ backgroundImage: `linear-gradient(180deg, transparent, rgba(8,11,10,.85)), url(${player.image})` }} /><span className="upcoming-number">0{player.id}</span><span className="upcoming-info"><strong>{player.shortName}</strong><small>{player.battingStyle}</small></span><span className="upcoming-price">from {money(player.basePrice)}</span></button>)}</div></section><section className="auction-tips"><div className="section-title-row"><div><span className="overline">SMART PLAY</span><h3>Drafting notes.</h3></div><Sparkles size={17} className="tip-spark" /></div><div className="tip-row"><span className="tip-icon"><Target size={15} /></span><div><strong>Balance your XI</strong><p>Keep at least 25 Cr for your bowling unit.</p></div></div><div className="tip-row"><span className="tip-icon tip-icon-violet"><Zap size={15} /></span><div><strong>Styles win matches</strong><p>Every batter comes with a different playbook.</p></div></div><button className="watch-button" type="button" onClick={onOpenSquad}><Play size={13} fill="currentColor" /> Preview your squad <ArrowUpRight size={13} /></button></section></div>
  </div>;
}

function SquadView({ players: squad, activeStyle, onSetStyle, onStartMatch, onAuction }: { players: Player[]; activeStyle: string; onSetStyle: (style: string) => void; onStartMatch: () => void; onAuction: () => void }) {
  return <div className="squad-view"><div className="squad-summary-row"><div className="summary-stat"><span className="summary-icon summary-icon-lime"><Users size={16} /></span><div><strong>{squad.length} / 11</strong><small>players signed</small></div></div><div className="summary-stat"><span className="summary-icon summary-icon-violet"><WalletCards size={16} /></span><div><strong>₹ 46.5 Cr</strong><small>purse left</small></div></div><div className="summary-stat"><span className="summary-icon summary-icon-peach"><Star size={16} /></span><div><strong>88.4</strong><small>squad rating</small></div></div><button className="button button-primary" type="button" onClick={onStartMatch} disabled={squad.length === 0}><Play size={15} fill="currentColor" /> Start match</button></div><section className="squad-board"><div className="squad-board-header"><div><span className="overline">NIGHT RIDERS / YOUR XI</span><h2>Every player has a <span>way to win.</span></h2></div><button className="link-button" type="button" onClick={onAuction}><Gavel size={14} /> Back to auction</button></div><div className="squad-player-grid">{squad.map((player) => <article className="squad-player-card" key={player.id}><div className="squad-player-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 32%, rgba(8,11,10,.9) 100%), url(${player.image})` }}><span className="squad-role-badge">{player.role}</span><span className="squad-player-number">0{player.id}</span><div className="squad-player-name"><strong>{player.name}</strong><span>{player.specialty}</span></div></div><div className="style-selector"><span className="style-label">BATTING STYLE</span><button type="button" className="active-style-button" onClick={() => onSetStyle(player.battingStyle)}><span style={{ background: colorForTone(player.tone) }} /> {player.battingStyle}<ChevronDown size={13} /></button></div></article>)}<button className="add-player-card" type="button" onClick={onAuction}><span><Plus size={19} /></span><strong>Add player</strong><small>Continue building your XI</small></button></div></section><section className="style-note"><div className="style-note-icon"><Sparkles size={19} /></div><div><span className="overline">YOUR SELECTED MOVE</span><h3>{activeStyle}</h3><p>Pick a player above to set the move you want to take into match day.</p></div><button className="button button-dark" type="button" onClick={onStartMatch}>Take it to the pitch <ArrowUpRight size={15} /></button></section></div>;
}

function MatchView({ players: squad, activeStyle, inningsRuns, wickets, balls, progress, lastBall, onPlayBall, onSetStyle }: { players: Player[]; activeStyle: string; inningsRuns: number; wickets: number; balls: number; progress: number; lastBall: string; onPlayBall: (style: string) => void; onSetStyle: (style: string) => void }) {
  const styleOptions = squad.length > 0 ? squad.map((player) => player.battingStyle) : ['The cover drive', 'The pull shot', 'The helicopter'];
  return <div className="match-view"><div className="match-top-row"><div className="match-live-pill"><Radio size={13} /> LIVE / OVER 04.2</div><span className="match-ground">MUMBAI · FRIENDLY 01</span><button className="icon-square-button" type="button" aria-label="Match menu"><MoreHorizontal size={17} /></button></div><section className="match-scoreboard"><div className="scoreboard-top"><span className="innings-label">YOUR INNINGS <i /> 08 OVERS</span><span className="scoreboard-target">TARGET <strong>72</strong></span></div><div className="scoreboard-main"><div className="score-team"><span className="score-team-mark">NR</span><strong>NIGHT RIDERS</strong><small>YOU</small></div><div className="big-score"><strong>{inningsRuns}<i> / {wickets}</i></strong><span>{Math.floor(balls / 6)}.{balls % 6} overs</span></div><div className="score-team opponent"><span className="score-team-mark opponent-mark">TT</span><strong>THUNDER TIGERS</strong><small>OPPONENT</small></div></div><div className="over-progress"><div><span>OVER PROGRESS</span><span>{balls} / 24 balls</span></div><span className="progress-track"><i style={{ width: `${progress}%` }} /></span></div></section><div className="match-game-grid"><section className="action-panel"><div className="action-panel-heading"><div><span className="overline">CHOOSE YOUR MOVE</span><h2>Make it <span>yours.</span></h2></div><span className="action-batter"><span className="mini-bid-avatar">{squad[0]?.shortName.slice(0, 2).toUpperCase() ?? 'VK'}</span> {squad[0]?.shortName ?? 'Your opener'}</span></div><p className="action-intro">Your selected style changes how the shot plays. Pick a move, then watch the score update.</p><div className="style-buttons">{styleOptions.map((style) => <button type="button" key={style} className={`style-action-button ${activeStyle === style ? 'style-action-button-active' : ''}`} onClick={() => { onSetStyle(style); onPlayBall(style); }}><span className="style-action-icon"><Activity size={17} /></span><span><strong>{style}</strong><small>{style === 'The helicopter' ? 'high risk · high reward' : style === 'The cover drive' ? 'timing window · classic' : 'power play · aggressive'}</small></span><ArrowUpRight size={15} /></button>)}</div><div className="last-ball"><span className="ball-dot" /> LAST BALL <strong>{lastBall}</strong></div></section><section className="match-feed"><div className="feed-heading"><span className="overline">BALL BY BALL</span><button type="button" onClick={() => onPlayBall(activeStyle)}>Quick play <Zap size={12} /></button></div><div className="ball-list">{Array.from({ length: Math.max(4, Math.min(6, balls + 1)) }).map((_, index) => { const ballNumber = balls - index; return <div className={`ball-row ${index === 0 && balls > 0 ? 'ball-row-new' : ''}`} key={`${ballNumber}-${index}`}><span className="ball-count">{ballNumber > 0 ? `04.${Math.max(0, ballNumber - 1)}` : '04.0'}</span><span className={`ball-result ${index === 0 && balls > 0 ? 'ball-result-active' : ''}`}>{index === 0 && balls > 0 ? lastBall.split(' ')[0] : index === 1 ? '1' : index === 2 ? '4' : '·'}</span><span className="ball-batter">{index === 0 && balls > 0 ? activeStyle : 'Waiting for play'}</span></div>; })}</div><div className="crowd-card"><span className="crowd-avatar"><Users size={14} /></span><div><strong>Room is watching</strong><small>3 friends are following your innings</small></div><span className="crowd-reaction">🔥 12</span></div></section></div></div>;
}

function RoomPanel({ onClose, onCopy }: { onClose: () => void; onCopy: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><div className="room-modal" role="dialog" aria-modal="true" aria-labelledby="room-modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" type="button" aria-label="Close room panel" onClick={onClose}><X size={18} /></button><div className="room-modal-art"><span className="room-modal-art-ring" /><span className="room-modal-art-ball">XI</span><span className="room-modal-art-label">FRIENDS PREMIER LEAGUE</span></div><div className="room-modal-content"><span className="overline overline-lime">PRIVATE ROOM / READY</span><h2 id="room-modal-title">Bring your<br /><span>best XI.</span></h2><p>Share this room with your friends. Once everyone joins, the auction board is yours.</p><div className="invite-code"><div><small>ROOM CODE</small><strong>PLAYXI-24A8</strong></div><button type="button" onClick={onCopy}><Copy size={16} /> Copy</button></div><div className="modal-room-meta"><span><Users size={14} /> 4 of 6 joined</span><span><Shield size={14} /> invite only</span></div><button className="button button-primary room-close-button" type="button" onClick={onClose}>Back to room <ArrowUpRight size={16} /></button></div></div></div>;
}

function ChatPanel({ onClose, onSend }: { onClose: () => void; onSend: () => void }) {
  return <aside className="chat-panel"><div className="chat-header"><div><span className="overline">ROOM CHAT</span><strong>Playing fair <span>· 4 online</span></strong></div><button className="icon-square-button" type="button" aria-label="Close chat" onClick={onClose}><X size={17} /></button></div><div className="chat-messages"><div className="chat-message"><span className="chat-avatar chat-avatar-violet">MK</span><div><small>Maya · 2m</small><p>Going all in on Kohli 😤</p></div></div><div className="chat-message"><span className="chat-avatar chat-avatar-peach">JP</span><div><small>Jay · 1m</small><p>Save some purse for Bumrah!</p></div></div><div className="chat-message chat-message-you"><div><small>You · now</small><p>Let the best XI win.</p></div><span className="chat-avatar chat-avatar-lime">DN</span></div></div><div className="chat-input"><input aria-label="Chat message" placeholder="Say something..." /><button type="button" aria-label="Send message" onClick={onSend}><Send size={15} /></button></div></aside>;
}

function Share2Icon() {
  return <ArrowUpRight size={16} />;
}

export default App;
