# Deployment Notes

This project can be deployed to any Node.js host that supports Express apps.

## Required Environment Variables
- `TELEGRAM_BOT_TOKEN`
- `MONGO_URI`
- `PRIVATE_KEY_SECRET`
- `WEBHOOK_URL`
- `PORT`
- `NODE_ENV`

## Recommended Production Settings
- Set `NODE_ENV=production`
- Set `PORT` from the hosting platform
- Set `WEBHOOK_URL=https://academic-reward-bot.onrender.com/webhook`
- Set `ENABLE_KEEP_ALIVE=true` only if you want self-pinging
- Set `SELF_PING_URL` to your deployed `/health` endpoint

## Render Example
1. Create a new web service.
2. Set the build command to `npm install`.
3. Set the start command to `npm start`.
4. Add the environment variables above.
5. Redeploy after changing any secret.

## Notes
- Keep real tokens and passwords out of the repository.
- Rotate any secret that has ever been committed.
