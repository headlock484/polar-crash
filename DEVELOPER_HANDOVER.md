# Polar Crash - Developer Handover Documentation

## 📋 Project Overview

This is a real-time crash game built with React (frontend) and Node.js/Express (backend) using Socket.io for real-time communication. The game features a polar bear dipping a biscuit, with players cashing out before the biscuit dissolves to win.

## 🏗️ Architecture

### Frontend (React)
- **Location**: `src/App.js` (main component)
- **Port**: 3000 (development)
- **Framework**: React 18.2.0 with React Scripts
- **Real-time**: Socket.io Client

### Backend (Node.js)
- **Location**: `server.js` (root directory)
- **Port**: 3001 (default)
- **Framework**: Express.js with Socket.io
- **Game Logic**: All game calculations run server-side

## 🎮 Key Features Implemented

### 1. Game Mechanics
- **Multiplier System**: Increments by 0.01 every 100ms (server-controlled)
- **96% RTP**: Crash probability algorithm ensures 96% Return to Player
- **Auto Cashout**: Players can set automatic cashout at specific multiplier
- **Auto Bet**: Configurable rounds with automatic round starting

### 2. UI Features
- **Responsive Design**: Fully responsive for mobile, tablet, and desktop
- **Video Playback**: 
  - `bear_game_launch.mp4` - Launch screen video (loops, appears when game is READY)
  - `bear_start.mp4` - Looping dipping animation (0s-2s loop)
  - `bear_crash.mp4` - Crash animation (starts at 1.25s)
  - `success.mp4` - Cashout success animation (starts at 4.0s)
- **Animated Coffee Cup Text**: "Don't let my biscuit dissolve!" appears on the coffee cup during READY state
  - Pink cursive font, curved to follow cup shape
  - Appears all at once when game launches
  - Positioned on the white coffee cup in the launch video
- **Menu System**: Overlay menu with accordion-style sections
- **Info Tooltip**: Clickable "i" icon with "don't show again" option
- **Bet History**: Tracks wins/losses with timestamps
- **Crash History**: Displays recent crash multipliers
- **Smooth Video Transitions**: No blank flashes during state changes (winning/losing phases)

### 3. Auto Bet System
- **Configuration Modal**: Stake, Rounds, Auto Cashout Point
- **Automatic Round Starting**: Rounds start automatically when enabled
- **Round Tracking**: Tracks remaining rounds and disables when complete
- **Auto Cashout**: Automatically cashes out at configured multiplier

## 🔧 Technical Details

### Server-Side Game Logic (server.js)

**All game calculations are server-side:**
- Multiplier calculation and incrementing
- Crash probability calculation (96% RTP)
- Random crash determination
- Cashout multiplier validation
- Game state management

**Socket Events:**
- `start_game` - Client requests to start a game (validates stake)
- `cash_out` - Client requests to cash out (server calculates multiplier)
- `tick` - Server broadcasts multiplier updates every 100ms
- `crash` - Server notifies client of crash with final multiplier
- `success` - Server notifies client of successful cashout with multiplier

### Client-Side (src/App.js)

**State Management:**
- Game state: `READY`, `DIPPING`, `CRASHED`, `CASHED_OUT`
- Multiplier (received from server)
- Stake, Balance, Auto Bet settings
- UI state (menu, tooltips, etc.)
- `visibleWords` - Controls coffee cup text visibility (0-5 for word-by-word animation, currently set to show all at once)

**Video Refs:**
- `videoRef` - Main video reference (used for dipping video)
- `dippingVideoRef` - Dipping video element
- `crashVideoElementRef` - Crash video element
- `successVideoRef` - Success video element
- `crashVideoRef` - Hidden preload element for crash video

**Key Functions:**
- `startDip()` - Emits `start_game` to server
- `cashOut()` - Emits `cash_out` to server
- Auto bet logic - Automatically starts rounds and cashes out

## 📁 File Structure

```
polar-crash/
├── server.js                 # Node.js backend (game logic)
├── src/
│   ├── App.js               # Main React component (all UI logic)
│   ├── index.js             # React entry point
│   ├── bear_game_launch.mp4 # Launch screen video (READY state)
│   ├── bear_start.mp4       # Dipping video (loops 0s-2s)
│   ├── bear_crash.mp4       # Crash video (starts at 1.25s)
│   └── success.mp4          # Success video (starts at 4.0s)
├── public/
│   └── index.html           # HTML template
├── package.json             # Dependencies and scripts
└── build/                   # Production build (generated)
```

## 🚀 Running the Project

### Development Mode

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Backend Server:**
   ```bash
   npm start
   # Runs on port 3001
   ```

3. **Start Frontend (in separate terminal):**
   ```bash
   npm run dev
   # Runs on port 3000
   ```

4. **Access the Game:**
   - Open browser to `http://localhost:3000`

### Production Build

1. **Build React App:**
   ```bash
   npm run build
   ```

2. **Start Server:**
   ```bash
   npm start
   # Server serves the built React app from /build directory
   ```

## 🔐 Security & Architecture Notes

### Important: All Game Logic is Server-Side

✅ **Server-Side (Secure):**
- Multiplier calculation
- Crash probability (96% RTP)
- Random crash determination
- Cashout multiplier calculation
- Input validation

❌ **Client-Side (UI Only):**
- Display multiplier (received from server)
- Send user actions (start_game, cash_out)
- UI state management
- No game calculations

**The client cannot manipulate game outcomes** - all critical logic runs on the Node.js server.

## 🎨 Styling & Design

### Color Scheme
- **Primary Pink**: `#ff1493` (borders, accents)
- **Cyan/Blue Gradient**: `linear-gradient(135deg, #40e0d0 0%, #00b8d4 100%)` (buttons)
- **Cyan Accent**: `#00f5ff` (menu highlights, glows)
- **Pink Gradient**: `linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)` (active buttons)

### Responsive Breakpoints
- **Mobile**: < 768px
- **Desktop**: >= 768px
- Uses `clamp()` for fluid typography and spacing

## 📝 Key Implementation Details

### Video Playback Logic
- **READY State**: Plays `bear_game_launch.mp4` (loops, with audio if sound enabled)
- **DIPPING State**: Plays `bear_start.mp4` from 0s, loops seamlessly from 2s
- **CRASHED State**: Plays `bear_crash.mp4` from 1.25s (smooth transition, no blank flash)
- **CASHED_OUT State**: Plays `success.mp4` from 4.0s (smooth transition, no blank flash)

**Video Transition Handling:**
- Separate video refs (`dippingVideoRef`, `crashVideoElementRef`, `successVideoRef`) prevent conflicts
- Videos use opacity transitions to prevent blank flashes during state changes
- Dipping video stays visible during transitions until next video is ready
- All videos preloaded to ensure smooth playback

### Auto Bet Flow
1. User clicks "AUTO BET" button
2. Modal opens with configuration (Stake, Rounds, Auto Cashout)
3. User clicks "Start Auto Bet"
4. First round starts automatically (if game is READY)
5. When multiplier reaches auto cashout point → auto cashout
6. After round ends → wait 3 seconds → next round starts automatically
7. Continues until all rounds complete

### Menu System
- Overlays game block (not full screen)
- Semi-transparent background shows game behind
- Accordion-style sections: How to Play, Bet History, Sound, Rules
- Sound toggle with pink color when enabled

## 🔌 Socket.io Events Reference

### Client → Server
- `start_game` - `{ stake: number }` - Start a new game round
- `cash_out` - No data - Cash out of current game

### Server → Client
- `tick` - `multiplier: number` - Multiplier update (every 100ms)
- `crash` - `multiplier: number` - Game crashed at this multiplier
- `success` - `multiplier: number` - Successfully cashed out at this multiplier

## 📦 Dependencies

### Production
- `express`: ^4.18.2 - Web server
- `socket.io`: ^4.7.2 - Real-time communication (server)
- `socket.io-client`: ^4.7.2 - Real-time communication (client)
- `react`: ^18.2.0 - UI framework
- `react-dom`: ^18.2.0 - React DOM renderer
- `react-scripts`: 5.0.1 - React build tools
- `cors`: ^2.8.5 - CORS middleware

### Development
- React DevTools recommended

## 🌐 Environment Variables

Optional (can be set in `.env`):
- `PORT` - Backend server port (default: 3001)
- `FRONTEND_URL` - CORS origin for Socket.io (default: "*")

## 🐛 Known Issues / Notes

1. **Video Loading**: Videos are loaded from `src/` folder - ensure they're included in build
2. **Auto Bet**: Rounds start automatically - ensure game state is properly managed
3. **Socket Connection**: Client connects to `window.location.origin` - ensure backend is accessible
4. **LocalStorage**: "Don't show again" preference stored in browser localStorage
5. **Coffee Cup Text**: Text appears on launch video - ensure `bear_game_launch.mp4` includes the white coffee cup
6. **Video Transitions**: Smooth transitions implemented to prevent blank flashes - videos fade in/out using opacity

## 🔄 State Flow

1. **READY** → User clicks "DIP BISCUIT" → **DIPPING**
2. **DIPPING** → Server sends `tick` events → Multiplier increases
3. **DIPPING** → User clicks "CASH OUT" OR Auto cashout triggers → **CASHED_OUT**
4. **DIPPING** → Server sends `crash` event → **CRASHED**
5. **CRASHED/CASHED_OUT** → User clicks "TRY AGAIN" OR Auto bet next round → **READY**

## 📞 Support Notes

- All game logic is in `server.js` - modify here for game mechanics
- All UI is in `src/App.js` - modify here for visual changes
- Server validates all inputs - client cannot manipulate game outcomes
- Socket.io handles real-time communication - ensure both servers running

## ✅ Testing Checklist

Before deployment:
- [ ] Test game flow: READY → DIPPING → CASH OUT/CRASH
- [ ] Test auto bet with multiple rounds
- [ ] Test auto cashout functionality
- [ ] Verify responsive design on mobile/tablet/desktop
- [ ] Test menu functionality
- [ ] Verify video playback for all states (launch, dipping, crash, success)
- [ ] Verify no blank flashes during transitions (winning/losing phases)
- [ ] Test coffee cup text appears correctly on launch screen
- [ ] Test socket reconnection handling
- [ ] Verify server-side validation works
- [ ] Test video audio (enable/disable sound toggle)

---

## 🎨 Recent Updates

### Coffee Cup Text Animation
- Added animated text "Don't let my biscuit dissolve!" on the coffee cup during READY state
- Pink cursive font, curved to follow cup shape
- Text appears all at once when game launches
- Positioned on white coffee cup in `bear_game_launch.mp4` video

### Video Transition Improvements
- Fixed blank page flashes during winning/losing phase transitions
- Implemented separate video refs for smooth transitions
- Videos use opacity transitions to prevent blank flashes
- All videos preloaded for immediate playback

### Video Updates
- Replaced static image with `bear_game_launch.mp4` for READY state
- Launch video includes audio support (controlled by sound toggle)

---

**Last Updated**: December 2024
**Game RTP**: 96% (hardcoded in server.js crash probability algorithm)

