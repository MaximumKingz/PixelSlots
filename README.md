# Pixel Slots: Crypto Spin Adventure 🎰

A pixel-art themed slot machine game built as a Telegram Mini-App with cryptocurrency integration and advanced analytics dashboard.

## Features

- 🎮 Classic slot machine gameplay with pixel-art graphics
- 💰 Cryptocurrency integration via Cryptomus API
- 🏆 Progressive jackpot system
- 🎁 Daily rewards and achievements
- 🌟 VIP membership system
- 🔄 Multiple betting tiers
- 🎨 Customizable themes and animations
- 📊 Advanced analytics dashboard
- 🔒 Secure admin panel
- 🤖 Telegram bot integration

## Analytics Features

- 📈 Real-time financial tracking
- 👥 User behavior analysis
- 🎲 Game performance metrics
- 💹 Cryptocurrency volume monitoring
- 🎯 Feature trigger analysis
- 🏆 Jackpot statistics
- ⚠️ Risk assessment system
- 📊 Data visualization
- 📱 Mobile-responsive design
- 📤 Excel export functionality

## Tech Stack

- Frontend: HTML5, CSS3, JavaScript
- Backend: Node.js, Express
- Database: MySQL 8.0, MongoDB
- Analytics: Chart.js
- Export: SheetJS (XLSX)
- Crypto Integration: Cryptomus API
- Telegram Bot API
- Telegram Mini App SDK

## Project Structure

```
/src
  /api         - Backend API endpoints
  /components  - Reusable UI components
  /config      - Configuration files
  /controllers - Request handlers
  /models      - Database models
  /public      - Static assets
    /admin     - Admin dashboard
    /images    - Game assets and sprites
    /sounds    - Sound effects
  /services    - Business logic
  /styles      - CSS styles
  /utils       - Utility functions
```

## Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Server Setup
1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your MongoDB connection string:
```env
MONGODB_URI=mongodb://localhost:27017/pixelslots
PORT=3000
```

4. Start the server:
```bash
npm run dev
```

### Game Setup
1. Host the game files on a static file server or GitHub Pages
2. Update the `apiBaseUrl` in `src/public/js/game.js` to point to your server

## Telegram Bot Setup

1. Create a new bot with [@BotFather](https://t.me/botfather)
2. Set the bot token in .env:
```
TELEGRAM_BOT_TOKEN=7700538384:AAEiaAnHNUknsW5UF7wcfhE60WkmXtciwB8
```
3. Set up webhook:
```bash
npm run setup-webhook
```

## Database Configuration

```
Host: database-5016671608.webspace-host.com
Database: dbs13505497
Username: dbu1342085
Password: KinGKOnG1989!
```

## Analytics Dashboard

Access the admin dashboard at `/admin/analytics.html`. Features include:
- Financial overview
- User activity tracking
- Game performance analysis
- Feature trigger monitoring
- Jackpot statistics
- User behavior analysis
- Risk assessment
- Data export

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Security

- Admin-only routes protected by JWT
- Rate limiting implemented
- IP tracking enabled
- Comprehensive audit logging
- Role-based access control

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
