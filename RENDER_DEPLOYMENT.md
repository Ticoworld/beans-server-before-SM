# 🚀 Deploy to Render.com - Step by Step

## Prerequisites
- [x] GitHub account with your code pushed
- [x] MongoDB Atlas account (free)
- [x] Telegram Bot Token
- [x] This bot code ready

## Step 1: Set up MongoDB Atlas (Free Database)

1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create free account and cluster
3. Click "Connect" → "Connect your application"
4. Copy connection string (looks like): 
   ```
   mongodb+srv://username:password@cluster.mongodb.net/telegramBot
   ```
5. Replace `<password>` with your actual password
6. **Important**: Add your IP to Network Access (or use 0.0.0.0/0 for all IPs)

## Step 2: Deploy to Render

### A. Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub (easier)

### B. Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repo: `beans-server`
3. Configure:
   ```
   Name: stx-academic-bot (or any name)
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

### C. Set Environment Variables
Click "Environment" tab and add:

```env
TELEGRAM_BOT_TOKEN=your_real_bot_token_here
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/telegramBot
ENCRYPTION_KEY=your-super-secure-32-character-key-here-now
ENABLE_KEEP_ALIVE=true
SELF_PING_URL=https://your-app-name.onrender.com/health
PORT=5000
NODE_ENV=production
```

### D. Deploy
1. Click "Create Web Service"
2. Wait for deployment (3-5 minutes)
3. Your bot will be live at: `https://your-app-name.onrender.com`

## Step 3: Test Your Deployment

1. **Test Health Endpoint**:
   ```bash
   curl https://your-app-name.onrender.com/health
   ```

2. **Test Telegram Bot**:
   - Send `/start` to your bot
   - Should work normally

3. **Check Logs**:
   - In Render dashboard → "Logs" tab
   - Should see: "Server is running" and "MongoDB Connected"

## Step 4: Set up UptimeRobot (Optional but Professional)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Create free account
3. Add monitor:
   ```
   Type: HTTP(s)
   URL: https://your-app-name.onrender.com/health
   Interval: 5 minutes
   ```
4. Set up email alerts

## Step 5: Final Configuration

Update your app's `SELF_PING_URL` with the real URL:
1. In Render dashboard → Environment Variables
2. Update: `SELF_PING_URL=https://your-actual-app-name.onrender.com/health`
3. Click "Manual Deploy" to restart

## ✅ Your Bot is Now Live 24/7!

- 🌐 **Web URL**: https://your-app-name.onrender.com
- 🤖 **Bot**: Working in Telegram
- 📊 **Health**: /health endpoint for monitoring
- 🔄 **Keep-Alive**: Self-pinging every 14 minutes
- 📈 **Monitoring**: UptimeRobot watching

## Troubleshooting

### Bot Not Responding?
- Check Render logs for errors
- Verify TELEGRAM_BOT_TOKEN is correct
- Ensure MongoDB Atlas allows connections

### Database Errors?
- Check MONGO_URI connection string
- Verify MongoDB Atlas network access
- Check username/password in connection string

### Keep-Alive Not Working?
- Verify SELF_PING_URL matches your actual Render URL
- Check ENABLE_KEEP_ALIVE=true
- Look for ping logs in Render dashboard

## Professional Tips for Final Year Project

1. **Custom Domain** (Optional):
   - Add custom domain in Render settings
   - Makes it look more professional

2. **Monitoring Dashboard**:
   - Use UptimeRobot's public status pages
   - Include uptime stats in your presentation

3. **Documentation**:
   - Include this deployment guide in your project
   - Shows you understand production deployment

Your academic STX reward system is now production-ready! 🎓
