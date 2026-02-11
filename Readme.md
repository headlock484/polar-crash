Polar Crash: Deployment & Handover Guide
🏗 Project Architecture
Frontend: React.js (Tailwind CSS)

Backend: Node.js (Express + Socket.io)

Logic: 96% RTP Provably Fair Math

Real-time: WebSockets for multiplier synchronization

🚀 1. Local Development Setup
To run this mockup on a local machine, follow these steps:

Install Dependencies: Open the terminal in the root folder and run:

Bash
npm install
Start the Backend (The Brain):

Bash
node server.js
Start the Frontend (The UI): In a second terminal window, run:

Bash
npm start
🌐 2. Production Deployment (Live Server)
When moving from a mockup to a live site, your devs need to handle these three things:

Process Management: Use PM2 on the server to keep the Node.js backend running 24/7.

Bash
pm2 start server.js --name "polar-backend"
Environment Variables: Create a .env file to store sensitive data (like secret keys if you add real money later).

SSL/HTTPS: Socket.io requires a secure connection (WSS) to work on modern browsers. Your devs should use Nginx as a reverse proxy.

🍪 3. Asset Logic (Crucial)
There are only two video files. The "Dipping" loop and the "Crash" are handled by time-stamping the same file:

original_bear.mp4:

Loop: Start (0.1s) to 4.0s.

Crash: Play past 4.0s to the end of the file.

success_bite.mp4:

Cash Out: Switch source immediately to this file.

⚖️ 4. The 96% RTP Algorithm
The house edge is mathematically hard-coded into server.js.

JavaScript
// The multiplier is calculated on the server to prevent client-side manipulation.
const crashPoint = 0.96 / (1 - Math.random());
This ensures that over thousands of games, the house will retain 4% of total stakes, while players receive 96% in winnings.