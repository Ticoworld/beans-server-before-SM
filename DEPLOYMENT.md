# Deployment Guide for Academic STX Bot

## Option 1: Self-Ping (Built-in Keep-Alive)

### How it works:
- Your bot pings itself every 14 minutes to prevent sleeping
- Works with most free hosting platforms (Render, Railway, Heroku)
- No external services needed

### Setup:
1. Set `ENABLE_KEEP_ALIVE=true` in your `.env` file
2. Set `SELF_PING_URL` to your deployed app URL
3. Deploy to your hosting platform

### Hosting Platforms (Free Tier):

#### 🚀 Render.com (Recommended)
```bash
# 1. Connect your GitHub repo to Render
# 2. Set environment variables in Render dashboard
# 3. Your app will auto-deploy on git push
```

#### 🚂 Railway.app
```bash
# 1. Install Railway CLI: npm install -g @railway/cli
# 2. railway login
# 3. railway deploy
```

#### 📦 Heroku
```bash
# 1. Install Heroku CLI
# 2. heroku create your-stx-bot
# 3. git push heroku main
```

### Environment Variables for Production:
```env
TELEGRAM_BOT_TOKEN=your_real_bot_token
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/telegramBot
ENCRYPTION_KEY=your-super-secure-32-char-key-here
ENABLE_KEEP_ALIVE=true
SELF_PING_URL=https://your-app-name.render.com/health
PORT=5000
```

## Option 2: UptimeRobot.com (External Monitoring)

### Pros:
- ✅ More reliable than self-ping
- ✅ Real uptime monitoring with alerts
- ✅ Works with any hosting platform
- ✅ Free plan: 50 monitors, 5-minute intervals

### Setup:
1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP(s) monitor pointing to: `https://your-app.com/health`
3. Set interval to 5 minutes (free plan minimum)
4. Optional: Set up email/SMS alerts

### UptimeRobot Configuration:
```
Monitor Type: HTTP(s)
URL: https://your-stx-bot.render.com/health
Monitoring Interval: 5 minutes
Alert Contacts: your-email@example.com
```

## Option 3: Combined Approach (Best for Production)

Use **both** methods for maximum reliability:
1. **Self-ping** for immediate keep-alive (every 14 minutes)
2. **UptimeRobot** for monitoring and alerts (every 5 minutes)

## Free Hosting Comparison:

| Platform | Free Hours | Sleep Policy | MongoDB |
|----------|------------|--------------|---------|
| **Render** | 750hrs/month | Sleeps after 15min idle | Use MongoDB Atlas |
| **Railway** | 500hrs/month | Sleeps after 15min idle | Use MongoDB Atlas |
| **Heroku** | 550hrs/month | Sleeps after 30min idle | Use MongoDB Atlas |

## MongoDB Atlas (Free Database):
1. Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free M0 cluster
3. Add your IP to whitelist (or use 0.0.0.0/0 for all IPs)
4. Get connection string for `MONGO_URI`

## Testing Your Setup:

### Local Testing:
```bash
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Configure your tokens in .env
# 3. Test locally
npm run dev

# 4. Test health endpoint
curl http://localhost:5000/health
```

### Production Testing:
```bash
# Test your deployed health endpoint
curl https://your-app.render.com/health

# Should return:
{
  "status": "alive",
  "timestamp": "2025-07-30T...",
  "uptime": 123.45,
  "botStatus": "running"
}
```

## Recommended Setup for Your Final Year Project:

1. **Deploy to Render.com** (most reliable free option)
2. **Use MongoDB Atlas** for database
3. **Enable self-ping** in production
4. **Add UptimeRobot monitoring** for professional monitoring
5. **Set up email alerts** for any downtime

This gives you a professional, monitored academic reward system that stays online 24/7! 🎓
