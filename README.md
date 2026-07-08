# Academic STX Reward System

Telegram bot for rewarding academic achievement with STX on the Stacks network.

## What It Does
- Creates a wallet for each registered student
- Stores encrypted private keys in MongoDB
- Lets lecturers send STX rewards
- Shows balances, leaderboard, and system stats
- Exposes a `/health` endpoint for monitoring

## Features
- Seed phrase verification during wallet setup
- PIN-protected wallet recovery and reset
- Balance lookup from the Hiro API
- Leaderboard and stats views
- Optional keep-alive ping for hosting platforms

## Technologies Used
- Node.js
- Express
- MongoDB and Mongoose
- Telegram Bot API
- Stacks wallet and transaction libraries

## Commands
- `/start` - Register and create a wallet
- `/balance` - Check STX balance
- `/receive` - Show wallet address
- `/fund` - Funding guidance
- `/leaderboard` - Top users by balance
- `/stats` - System stats
- `/resetwallet` - Reset wallet with PIN
- `/recover` - Recover wallet with seed phrase
- `/help` - Show command help
- `/tip` - Send STX to another user

## Environment Variables
Copy `.env.example` to `.env` and fill in:

- `TELEGRAM_BOT_TOKEN`
- `MONGO_URI`
- `PRIVATE_KEY_SECRET`
- `PORT`
- `NODE_ENV`
- `ENABLE_KEEP_ALIVE`
- `SELF_PING_URL`
- `MIN_TIP_AMOUNT`
- `MAX_TIP_AMOUNT`
- `LOW_BALANCE_THRESHOLD`

## Install
```bash
npm install
```

## Run
```bash
npm start
```

For local development, set `NODE_ENV=development` in `.env`.

## Test Health Endpoint
After the server starts, open:

```text
http://localhost:5000/health
```

Or run the test script:

```bash
npm run health
```

## Notes
- The app expects MongoDB to be running and reachable.
- Keep real secrets out of the repository.
- If you deploy to a platform like Render, set `PORT` from the platform environment.
