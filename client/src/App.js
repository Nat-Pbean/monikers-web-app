/**
 * 🃏 MONIKERS MOBILE 🃏
 * * Game Concept:
 * Based on the board game "Monikers" created by Alex Hague and Justin Vickers.
 * Inspired by the public domain game "Celebrity." 
 * Please support the original creators at: https://www.monikersgame.com/
 * * Technical Implementation:
 * Developed by Nathanael Panggabean.
 * Built using React, Node.js, and Socket.io.
 * * Description: 
 * A web-based multiplayer implementation designed for mobile play, 
 * featuring real-time card drafting, team scoring, and synced game states.
 */

import React, { useState, useEffect, useMemo } from "react";
import io from "socket.io-client";
import "./App.css";
import ALL_CARDS from './cards.json';

const socket = io.connect(`${window.location.protocol}//${window.location.hostname}:3001`);

// --- HELPER COMPONENTS ---

const Header = ({ roomCode, name, onLeave }) => (
  <div className="header-bar" style={{borderBottom: '1px solid #ddd', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white'}}>
    <div>
      <strong>Room: {roomCode}</strong>
      <div style={{fontSize: '0.8rem'}}>Player: {name}</div>
    </div>
    <button onClick={onLeave} style={{backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px'}}>
      Exit
    </button>
  </div>
);

const LoginScreen = ({ name, setName, roomCode, setRoomCode, onJoin }) => (
  <div className="App" style={{padding: '20px', textAlign: 'center'}}>
    <h1>Monikers Mobile</h1>
    <div style={{display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '300px', margin: '0 auto'}}>
      <input 
        placeholder="Your Name" 
        value={name} 
        onChange={(e) => setName(e.target.value)} 
        style={{padding: '10px', fontSize: '16px'}}
      />
      <input 
        placeholder="Room Code (e.g. A123)" 
        value={roomCode} 
        onChange={(e) => setRoomCode(e.target.value.toUpperCase())} 
        style={{padding: '10px', fontSize: '16px'}}
      />
      <button onClick={handleFormSubmit(onJoin)} style={{padding: '10px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px'}}>
        Join Room
      </button>
    </div>
  </div>
);

// Helper to prevent zoom on mobile form submit
const handleFormSubmit = (fn) => (e) => {
  e.preventDefault();
  fn();
};

const LobbyScreen = ({ roomData, onSwitchTeam, onStartDrafting }) => {
  const canStart = roomData.players.length >= 2;

  return (
    <div style={{padding: '20px'}}>
      <h2>Lobby</h2>
      <div style={{display:'flex', justifyContent:'space-around', marginBottom: '20px'}}>
        <div style={{border: '1px solid #ccc', padding: '10px', width: '45%', background: 'white', minHeight: '100px'}}>
          <h3>Team 1</h3>
          {roomData.players.filter(p => p.team === 1).map(p => <div key={p.playerId}>{p.name}</div>)}
        </div>
        <div style={{border: '1px solid #ccc', padding: '10px', width: '45%', background: 'white', minHeight: '100px'}}>
          <h3>Team 2</h3>
          {roomData.players.filter(p => p.team === 2).map(p => <div key={p.playerId}>{p.name}</div>)}
        </div>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
        <button onClick={onSwitchTeam} style={{padding: '10px'}}>Switch Team</button>
        <button 
          onClick={onStartDrafting} 
          disabled={!canStart}
          style={{
            padding: '15px', 
            backgroundColor: canStart ? '#2196F3' : '#ccc', 
            color: 'white', border: 'none', fontSize: '16px', fontWeight: 'bold'
          }}
        >
          {canStart ? "Start Game" : "Waiting for players..."}
        </button>
      </div>
    </div>
  );
};

const DraftingScreen = ({ selectedCards, onToggleCard, onSubmit, hasDrafted }) => {
  if (hasDrafted) return <div className="scroll-area" style={{textAlign: 'center', paddingTop: '40px'}}><h2>Waiting for others...</h2></div>;

  return (
    <div className="draft-container" style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      <div style={{padding: '10px 15px', background: '#eee'}}>
        <h3 style={{margin:0}}>Select 8 Cards ({selectedCards.length}/8)</h3>
      </div>
      <div className="scroll-area" style={{flex: 1, overflowY: 'auto', padding: '15px'}}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '20px'}}>
          {ALL_CARDS.map(card => {
            const isSelected = selectedCards.some(c => c.id === card.id);
            return (
              <div 
                key={card.id} 
                onClick={() => onToggleCard(card)}
                style={{
                  border: isSelected ? '3px solid #4CAF50' : '1px solid #ccc',
                  padding: '12px', borderRadius: '10px',
                  backgroundColor: isSelected ? '#e8f5e9' : 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}
              >
                <b style={{fontSize: '1rem'}}>{card.name}</b>
                <p style={{fontSize: '0.75rem', color: '#666', margin: '5px 0 0 0'}}>{card.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="footer-bar" style={{padding: '15px', borderTop: '1px solid #ddd', background: 'white'}}>
        <button 
          onClick={onSubmit} 
          disabled={selectedCards.length !== 8}
          style={{
            width: '100%', padding: '15px', 
            backgroundColor: selectedCards.length === 8 ? '#4CAF50' : '#ccc', 
            color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold'
          }}
        >
          {selectedCards.length === 8 ? "Confirm Selection" : `Select ${8 - selectedCards.length} more`}
        </button>
      </div>
    </div>
  );
};

const GameBoard = ({ roomData, timer, isMyTeamTurn, isClueGiver, isAwaitingDraw, onStartTurn, onDraw, onPass, onScore, onLeave }) => {
  const getRoundInfo = (round) => {
    switch(round) {
      case 1: return "Round 1: Describe freely";
      case 2: return "Round 2: One Word Only";
      case 3: return "Round 3: Charades Only";
      default: return "Game Over";
    }
  };

  // Determine which specific player name is currently the actor
  const teamPlayers = roomData.players.filter(p => p.team === roomData.turnTeam);
  const activePlayerName = teamPlayers[roomData.turnIndex % teamPlayers.length]?.name || "Someone";

  return (
    <div className="game-screen">
      <div style={{display: 'flex', justifyContent: 'space-between', padding: '10px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc'}}>
        <div style={{fontWeight: roomData.turnTeam === 1 ? 'bold' : 'normal', color: roomData.turnTeam === 1 ? 'blue' : 'black'}}>
          Team 1: {roomData.scores.team1}
        </div>
        <div style={{fontWeight: 'bold', fontSize: '1.2rem', color: timer <= 10 ? 'red' : 'black'}}>
          {timer}s
        </div>
        <div style={{fontWeight: roomData.turnTeam === 2 ? 'bold' : 'normal', color: roomData.turnTeam === 2 ? 'red' : 'black'}}>
          Team 2: {roomData.scores.team2}
        </div>
      </div>

      <div style={{textAlign: 'center', padding: '10px', backgroundColor: '#fff3cd', borderBottom: '1px solid #ffeeba'}}>
        {getRoundInfo(roomData.round)}
      </div>

      {roomData.phase === 'GAME_OVER' ? (
        <div style={{textAlign: 'center', marginTop: '50px', padding: '20px'}}>
          <h1>GAME OVER</h1>
          <h2 style={{color: '#4CAF50'}}>Winner: {roomData.scores.team1 > roomData.scores.team2 ? "Team 1" : "Team 2"}</h2>
          <button onClick={onLeave} style={{padding: '15px 30px', marginTop: '30px', borderRadius: '10px'}}>Back to Main Menu</button>
        </div>
      ) : (
        <div style={{padding: '20px'}}>
          {!roomData.timerActive ? (
            <div style={{textAlign: 'center', marginTop: '30px'}}>
              <h2>It is Team {roomData.turnTeam}'s Turn</h2>
              <p style={{fontSize: '1.2rem', color: '#2196F3', fontWeight: 'bold'}}>{activePlayerName}'s turn to give clues!</p>
              
              {/* Only the specific assigned player sees the Start button */}
              {isClueGiver ? (
                <div style={{marginTop: '30px'}}>
                  <button onClick={onStartTurn} style={{width: '100%', padding: '25px', fontSize: '22px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 'bold'}}>
                    START TIMER
                  </button>
                </div>
              ) : (
                <p style={{marginTop: '40px', color: '#888'}}>Waiting for {activePlayerName} to start...</p>
              )}
            </div>
          ) : (
            <div style={{marginTop: '10px'}}>
              {roomData.currentCard ? (
                isClueGiver ? (
                  /* --- CLUE GIVER VIEW (Visible only to active player) --- */
                  <div style={{textAlign: 'center'}}>
                    <div style={{border: '3px solid #333', borderRadius: '15px', padding: '40px 20px', marginBottom: '30px', backgroundColor: 'white'}}>
                      <h1 style={{fontSize: '2.8rem', margin: '0 0 15px 0'}}>{roomData.currentCard.name}</h1>
                      <p style={{fontSize: '1.2rem', color: '#666'}}>{roomData.currentCard.desc}</p>
                    </div>
                    <div style={{display: 'flex', gap: '15px'}}>
                      <button onClick={onPass} style={{flex: 1, padding: '20px', backgroundColor: '#FF9800', color: 'white', borderRadius: '12px', border: 'none'}}>PASS</button>
                      <button onClick={() => onScore(roomData.turnTeam)} style={{flex: 1, padding: '20px', backgroundColor: '#4CAF50', color: 'white', borderRadius: '12px', border: 'none'}}>GOT IT!</button>
                    </div>
                  </div>
                ) : (
                  /* --- TEAMMATE/OPPONENT VIEW (Card Hidden) --- */
                  <div style={{textAlign: 'center', marginTop: '60px'}}>
                    <h1 style={{color: isMyTeamTurn ? '#2196F3' : '#d32f2f'}}>
                      {isMyTeamTurn ? "GUESS!" : "OPPONENT'S TURN"}
                    </h1>
                    <div style={{marginTop: '20px', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '20px', border: '1px solid #ddd'}}>
                       <span style={{fontSize: '50px'}}>🤫</span>
                       <p style={{fontWeight: 'bold', marginTop: '10px'}}>The card is hidden.</p>
                       {isMyTeamTurn && <p>Listen to {activePlayerName}!</p>}
                    </div>
                  </div>
                )
              ) : (
                /* --- TAP TO DRAW (Only Clue Giver can interact) --- */
                isClueGiver ? (
                  <button onClick={onDraw} disabled={isAwaitingDraw} style={{width: '100%', height: '250px', fontSize: '24px', backgroundColor: '#fafafa', border: '3px dashed #bbb', borderRadius: '20px'}}>
                    {isAwaitingDraw ? "Drawing..." : "Tap to Draw Card"}
                  </button>
                ) : (
                    <div style={{textAlign: 'center', marginTop: '60px', color: '#888'}}>
                        <p>Waiting for {activePlayerName} to draw...</p>
                    </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---

function App() {
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [timer, setTimer] = useState(60);
  const [selectedCards, setSelectedCards] = useState([]);
  const [hasDrafted, setHasDrafted] = useState(false);
  const [isAwaitingDraw, setIsAwaitingDraw] = useState(false);

  const playerId = useMemo(() => {
    const saved = localStorage.getItem("monikers_player_id");
    if (saved) return saved;
    const newId = "p_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("monikers_player_id", newId);
    return newId;
  }, []);

  const localPlayer = roomData?.players.find(p => p.playerId === playerId);
  const isMyTeamTurn = roomData && localPlayer?.team === roomData.turnTeam;
  
  // FIX: Identify if THIS player is the assigned Clue Giver
  const isClueGiver = useMemo(() => {
    if (!roomData) return false;
    // During active timer, use the server-assigned ID
    if (roomData.timerActive) return roomData.activePlayerId === playerId;
    // Before timer starts, use the turnIndex logic to see if we ARE the next one
    const teamPlayers = roomData.players.filter(p => p.team === roomData.turnTeam);
    const activePlayer = teamPlayers[roomData.turnIndex % teamPlayers.length];
    return activePlayer?.playerId === playerId;
  }, [roomData, playerId]);

  useEffect(() => {
    socket.on("room_update", (data) => {
      setRoomData(data);
      if (data.currentCard) { setIsAwaitingDraw(false); }
      if (data.timer !== undefined) setTimer(data.timer);
      if (data.phase === 'LOBBY') { setHasDrafted(false); setSelectedCards([]); }
    });
    socket.on("timer_update", (time) => setTimer(time));
    return () => { socket.off("room_update"); socket.off("timer_update"); };
  }, []);

  const handleJoin = () => { if (name && roomCode) socket.emit("join_room", { roomCode, name, playerId }); };
  const handleLeave = () => { socket.emit("leave_room"); window.location.reload(); };

  return (
    <div className="App">
      {roomData && <Header roomCode={roomCode} name={name} onLeave={handleLeave} />}
      {!roomData ? (
        <LoginScreen name={name} setName={setName} roomCode={roomCode} setRoomCode={setRoomCode} onJoin={handleJoin} />
      ) : roomData.phase === 'LOBBY' ? (
        <LobbyScreen roomData={roomData} onSwitchTeam={() => socket.emit("switch_team", { roomCode })} onStartDrafting={() => socket.emit("start_drafting", { roomCode })} />
      ) : roomData.phase === 'DRAFTING' ? (
        <DraftingScreen selectedCards={selectedCards} onToggleCard={(card) => setSelectedCards(prev => prev.some(c => c.id === card.id) ? prev.filter(c => c.id !== card.id) : (prev.length < 8 ? [...prev, card] : prev))} onSubmit={() => { socket.emit("submit_draft", { roomCode, selectedCards }); setHasDrafted(true); }} hasDrafted={hasDrafted} />
      ) : (
        <GameBoard 
          roomData={roomData} timer={timer} isMyTeamTurn={isMyTeamTurn} isClueGiver={isClueGiver} isAwaitingDraw={isAwaitingDraw}
          onStartTurn={() => socket.emit("start_turn", { roomCode })}
          onDraw={() => { if (!isAwaitingDraw) { setIsAwaitingDraw(true); socket.emit("draw_card", { roomCode }); } }}
          onPass={() => socket.emit("pass_card", { roomCode })}
          onScore={(team) => socket.emit("score_card", { roomCode, team })}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
}

export default App;