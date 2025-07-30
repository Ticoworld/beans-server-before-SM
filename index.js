const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { generateWallet, generateSecretKey, getStxAddress, restoreWalletAccounts } = require('@stacks/wallet-sdk');
const {
  makeSTXTokenTransfer,
  broadcastTransaction,
  standardPrincipalCV,
  PostConditionMode,
  TransactionVersion
} = require('@stacks/transactions');
const { STACKS_MAINNET } = require('@stacks/network');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const User = require('./model/user.model')

require('dotenv').config();
const network = STACKS_MAINNET
const PRIVATE_KEY_SECRET = process.env.PRIVATE_KEY_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const IV_LENGTH = 16;

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
// const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

app.post("/webhook", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Server is running");
});



function encryptPrivateKey(privateKey, pin) {
  // Derive a key by combining the PIN and the PRIVATE_KEY_SECRET
  const combinedKey = crypto.createHash('sha256').update(pin + PRIVATE_KEY_SECRET).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', combinedKey, iv);
  let encrypted = cipher.update(privateKey);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Helper function to generate a specified number of unique random indexes.
 */
function generateUniqueIndexes(max, count) {
  const indexes = new Set();
  while (indexes.size < count) {
    indexes.add(Math.floor(Math.random() * max));
  }
  return Array.from(indexes);
}

/**
 * Generate Wallet:
 * - Creates a wallet using a random secret phrase.
 * - Returns wallet address, private key, and seed phrase.
 */
async function createWallet() {
  const secretKey = generateSecretKey(128);
  const wallet = await generateWallet({ secretKey, password: 'password' });
  const account = wallet.accounts[0];
  const address = getStxAddress({ account, transactionVersion: TransactionVersion });

  return {
    address,
    privateKey: account.stxPrivateKey, // Will be encrypted later with the PIN
    seedPhrase: secretKey
  };
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Check if the command is used in a private message or group
  if (msg.chat.type !== 'private') {
    return bot.sendMessage(chatId, "🚨 *Please use the start command in a private message (DM) with the bot.*\n\nClick here to start: [Start DM](t.me/StacksTipBot)", { parse_mode: "Markdown" });
  }

  try {
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
      return bot.sendMessage(chatId, `🚀 *You're already registered!*  
🔹 *Wallet Address:* \`${existingUser.walletAddress}\`  

Use /help to see available commands.`, { parse_mode: "Markdown" });
    }

    // Generate a new wallet
    const wallet = await createWallet();
    const words = wallet.seedPhrase.split(' ');
    const randomIndexes = generateUniqueIndexes(words.length, 3);
    const challengeWords = randomIndexes.map(i => words[i]);

    // Send wallet info to user
    const sentMessage = await bot.sendMessage(chatId, `🚨 *IMPORTANT: Secure Your Seed Phrase!* 🚨  

🔹 *Wallet Address:* \`${wallet.address}\`  
🔹 *Seed Phrase:* \`${wallet.seedPhrase}\`  

⚠️ *The bot does NOT store your seed phrase!*  
If you lose it, you lose access to your wallet forever.  
✅ *Write it down and store it securely!*  

⏳ *This message will be deleted in 15 minutes for security.*  

Have you saved your seed phrase?  
1️⃣ Yes, I saved it  
2️⃣ No, I need more time`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Yes", callback_data: `seed_saved_${telegramId}` }],
          [{ text: "❌ No", callback_data: `seed_not_saved_${telegramId}` }]
        ]
      }
    });

    // Auto-delete the message after 15 minutes (900000 ms)
    setTimeout(() => {
      bot.deleteMessage(chatId, sentMessage.message_id).catch(() => { });
    }, 900000);

    bot.once("callback_query", async (callbackQuery) => {
      if (!callbackQuery.data.includes(`_${telegramId}`)) return;

      if (callbackQuery.data.startsWith("seed_saved")) {
        bot.deleteMessage(chatId, sentMessage.message_id).catch(() => { });

        bot.sendMessage(chatId, `📌 *Seed phrase verification:*  

Please enter the following words from your seed phrase:
- Word #${randomIndexes[0] + 1}
- Word #${randomIndexes[1] + 1}
- Word #${randomIndexes[2] + 1}

*(Reply in order, separated by spaces)*`, { parse_mode: "Markdown" });

        bot.once("message", async (response) => {
          const userResponse = response.text.trim().split(" ");
          if (
            userResponse.length === 3 &&
            userResponse[0] === challengeWords[0] &&
            userResponse[1] === challengeWords[1] &&
            userResponse[2] === challengeWords[2]
          ) {
            bot.sendMessage(chatId, "✅ *Seed phrase verified!*");

            bot.sendMessage(chatId, "🔐 Please set a 5-digit PIN to secure your wallet.", {
              reply_markup: { force_reply: true }
            }).then((pinRequestMessage) => {
              bot.onReplyToMessage(chatId, pinRequestMessage.message_id, async (msg) => {
                const firstPin = msg.text.trim();

                await bot.deleteMessage(chatId, msg.message_id).catch(() => { });

                if (!/^\d{5}$/.test(firstPin)) {
                  return bot.sendMessage(chatId, "⚠️ Invalid PIN! Must be 5 digits. Try again:");
                }

                const confirmMessage = await bot.sendMessage(chatId, "🔁 Please re-enter your 5-digit PIN to confirm:", {
                  reply_markup: { force_reply: true }
                });

                bot.onReplyToMessage(chatId, confirmMessage.message_id, async (confirmMsg) => {
                  const confirmedPin = confirmMsg.text.trim();

                  await bot.deleteMessage(chatId, confirmMsg.message_id).catch(() => { });

                  if (firstPin !== confirmedPin) {
                    await bot.deleteMessage(chatId, confirmMessage.message_id).catch(() => { });
                    return bot.sendMessage(chatId, "❌ PINs don't match! Start over with /start");
                  }

                  const encryptedPrivateKey = encryptPrivateKey(wallet.privateKey, confirmedPin);

                  await new User({
                    telegramId,
                    username: msg.from.username,
                    walletAddress: wallet.address,
                    encryptedPrivateKey,
                    securityCode: crypto.createHash("sha256").update(confirmedPin).digest("hex")
                  }).save();

                  await bot.deleteMessage(chatId, pinRequestMessage.message_id).catch(() => { });
                  bot.sendMessage(chatId, `✅ Your wallet is secured with your PIN and ready to use! 

🎓 *Welcome to the Academic Rewards System!*

Your wallet is now set up for receiving academic rewards. Here's what you can do:

• Check your balance with /balance
• Learn how to fund your wallet with /fund  
• View academic rankings with /leaderboard
• Get help anytime with /help

🌟 *Start earning STX rewards for:*
• Class attendance and participation
• Assignment completion and quality
• Academic excellence and improvement  
• Positive behavior and collaboration

Good luck with your academic journey! 📚`, { parse_mode: "Markdown" });
                });
              });
            });
          } else {
            bot.sendMessage(chatId, "❌ *Incorrect seed phrase verification!* Please use /start again and ensure you have saved your seed phrase correctly.");
          }
        });
      } else if (callbackQuery.data.startsWith("seed_not_saved")) {
        bot.sendMessage(chatId, "⚠️ *Please take your time and save your seed phrase securely.*\nUse /start again when you're ready.");
      }
    });

  } catch (error) {
    console.error("Error creating wallet:", error);
    bot.sendMessage(chatId, "❌ An error occurred while creating your wallet. Please try again later.");
  }
});


bot.onText(/\/resetwallet/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // If the command is issued in a group, instruct the user to check their DM.
  let targetChatId = chatId;
  if (msg.chat.type !== 'private') {
    bot.sendMessage(
      chatId,
      `@${msg.from.username || telegramId}, please check your DM for wallet reset instructions.`
    );
    targetChatId = telegramId; // Use DM for further interaction.
  }

  // Check if the user exists.
  const user = await User.findOne({ telegramId });
  if (!user) {
    return bot.sendMessage(targetChatId, "❌ You are not registered. Please use /start to create your wallet.");
  }

  // Check if the user has a security PIN set.
  if (!user.securityCode) {
    return bot.sendMessage(targetChatId, "❌ You have not set a security PIN. You cannot reset your wallet.");
  }

  // Send DM prompt for the current PIN.
  const dmPrompt = await bot.sendMessage(
    targetChatId,
    "🔐 Enter your 5-digit security PIN to reset your wallet:",
    { reply_markup: { force_reply: true } }
  );

  // Listen for the next message in the DM.
  bot.once("message", async (pinMsg) => {
    // Ensure the message is from the correct chat and, if replying, that it refers to our prompt.
    if (
      String(pinMsg.chat.id) !== targetChatId.toString() ||
      (pinMsg.reply_to_message && pinMsg.reply_to_message.message_id !== dmPrompt.message_id)
    ) {
      return;
    }
    
    // Immediately delete the PIN message for security.
    const pinMessageId = pinMsg.message_id;
    bot.deleteMessage(targetChatId, pinMessageId).catch(() => {});

    const pin = pinMsg.text.trim();
    const encryptedPin = crypto.createHash("sha256").update(pin).digest("hex");

    if (encryptedPin !== user.securityCode) {
      return bot.sendMessage(targetChatId, "❌ Incorrect PIN! Wallet reset denied.");
    }

    // Create a new wallet.
    const newWallet = await createWallet();
    const words = newWallet.seedPhrase.split(' ');
    const randomIndexes = generateUniqueIndexes(words.length, 3);
    const challengeWords = randomIndexes.map(i => words[i]);

    // Send the new wallet details (seed phrase) to the user.
    const sentSeedMsg = await bot.sendMessage(
      targetChatId,
      `🚨 *Your wallet has been reset!* 🚨
      
🔹 *New Wallet Address:* \`${newWallet.address}\`
🔹 *New Seed Phrase:* \`${newWallet.seedPhrase}\` 

⚠️ *This will NOT be stored! Write it down securely.*
✅ *Write it down and store it securely!*

⏳ *This message will be deleted in 15 minutes for security.*

Have you saved your seed phrase?
1️⃣ Yes, I saved it
2️⃣ No, I need more time`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Yes", callback_data: `seed_saved_${telegramId}` }],
            [{ text: "❌ No", callback_data: `seed_not_saved_${telegramId}` }]
          ]
        }
      }
    );

    // Auto-delete the seed phrase message after 15 minutes.
    setTimeout(() => {
      bot.deleteMessage(targetChatId, sentSeedMsg.message_id).catch(() => {});
    }, 900000);

    // Listen for the callback query for seed phrase confirmation.
    bot.once("callback_query", async (callbackQuery) => {
      if (!callbackQuery.data.includes(`_${telegramId}`)) return;

      if (callbackQuery.data.startsWith("seed_saved")) {
        // Delete the seed phrase message immediately upon confirmation.
        bot.deleteMessage(targetChatId, sentSeedMsg.message_id).catch(() => {});

        // Ask the user to verify their seed phrase by entering 3 words.
        bot.sendMessage(
          targetChatId,
          `📌 *Verify your seed phrase:*

Please enter the following words from your seed phrase:
- Word #${randomIndexes[0] + 1}
- Word #${randomIndexes[1] + 1}
- Word #${randomIndexes[2] + 1}

*(Reply in order, separated by spaces)*`,
          { parse_mode: "Markdown" }
        );

        // Listen for the seed phrase verification response.
        bot.once("message", async (response) => {
          const userResponse = response.text.trim().split(" ");
          if (
            userResponse.length === 3 &&
            userResponse[0] === challengeWords[0] &&
            userResponse[1] === challengeWords[1] &&
            userResponse[2] === challengeWords[2]
          ) {
            // Encrypt the new wallet's private key using the provided PIN.
            const encryptedPrivateKey = encryptPrivateKey(newWallet.privateKey, pin);

            // Update the user record with the new wallet details.
            user.walletAddress = newWallet.address;
            user.encryptedPrivateKey = encryptedPrivateKey;
            await user.save();

            bot.sendMessage(targetChatId, "✅ *Seed phrase verified! Your wallet reset is complete.*", { parse_mode: "Markdown" });
          } else {
            bot.sendMessage(targetChatId, "❌ *Incorrect seed phrase verification!* Wallet reset failed. Try again with /resetwallet.");
          }
        });
      } else if (callbackQuery.data.startsWith("seed_not_saved")) {
        bot.sendMessage(targetChatId, "⚠️ *Please take your time and save your seed phrase securely.*\nUse /resetwallet again when you're ready.");
      }
    });
  });
});



// Help Command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  // If the command is used in a group chat, instruct user to contact in DM.
  if (msg.chat.type !== "private") {
    bot.sendMessage(
      chatId,
      "🚨 *Help command only available in DM.*\nPlease contact me in DM for help by clicking the button below:",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Contact me for help", url: "https://t.me/StacksTipBot?start=help" }
            ]
          ]
        },
      }
    );
  } else {
    // In DM, show the full help message with available commands.
    const helpMessage = `
📘 *Available Commands:*

*🎓 Student Commands:*
/start - Create a new wallet or restore an existing wallet  
/balance - Check your STX wallet balance  
/receive - Get your wallet address  
/fund - Learn how to fund your STX wallet  
/leaderboard - View academic achievement rankings  
/resetwallet - Reset your wallet (requires PIN)  
/recover - Recover your wallet if you lost your PIN (requires seed phrase)

*👨‍🏫 Lecturer Commands:*
/tip <amount> - Reward STX to students you're replying to  
/tip @username <amount> - Reward STX to specific students  
/stats - View system statistics and overview  
/help - Show this help message  

🎓 *Academic Rewards System*
This bot helps lecturers reward students for academic excellence and positive behavior!

💡 *Best Practices for Lecturers:*
• Use reasonable reward amounts (0.1 - 5 STX)
• Recognize various achievements (attendance, participation, assignments)  
• Check /leaderboard to motivate students
• Use /stats to monitor system usage
• Encourage students to use /fund if they need wallet funding help

🌟 *Reward Categories Suggestions:*
• 📚 Assignment Excellence: 0.5 - 2 STX
• 🎯 Class Participation: 0.1 - 0.5 STX  
• 📈 Academic Improvement: 1 - 3 STX
• 🤝 Collaboration & Teamwork: 0.3 - 1 STX
• 🏆 Outstanding Achievement: 2 - 5 STX
    `;
    bot.sendMessage(chatId, helpMessage, { parse_mode: "Markdown" });
  }
});



bot.onText(/\/receive/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return bot.sendMessage(chatId, '❌ You are not registered yet. Use /start to register.');
    }

    // Send the user's wallet address
    bot.sendMessage(chatId, `🔹 *Your Wallet Address:* \`${user.walletAddress}\``, { parse_mode: "Markdown" });
  } catch (error) {
    console.error('Error fetching wallet address:', error);
    bot.sendMessage(chatId, '❌ An error occurred while fetching your wallet address. Please try again later.');
  }
});


// If needed, uncomment the following line for Node versions without native fetch support
// const fetch = require('node-fetch');

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Add reply options to all responses
  const replyOptions = {
    reply_to_message_id: msg.message_id // Reply directly to the user's command
  };

  try {
    const user = await User.findOne({ telegramId });
    if (!user) {
      return bot.sendMessage(
        chatId,
        '❌ You are not registered yet. Use /start to register.',
        replyOptions
      );
    }

    const address = user.walletAddress;
    const url = `https://api.hiro.so/extended/v1/address/${address}/balances`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Error fetching balance: HTTP status ${response.status}`);
      return bot.sendMessage(
        chatId,
        '❌ Error fetching your balance. Please try again later.',
        replyOptions
      );
    }

    const accountData = await response.json();

    if (!accountData?.stx) {
      return bot.sendMessage(
        chatId,
        '❌ Unexpected response structure. Please try again later.',
        replyOptions
      );
    }

    // STX Balance
    const stxBalance = parseInt(accountData.stx.balance) / 1e6;
    let message = `💰 *Your STX Balance:* ${stxBalance} STX`;
    
    // Add funding suggestion if balance is low
    if (stxBalance < 0.1) {
      message += `\n\n⚠️ *Low Balance Alert!*\nYour STX balance is low. Use /fund to learn how to add funds to your wallet.`;
    }

    // Send balance with reply
    bot.sendMessage(chatId, message, replyOptions);

  } catch (error) {
    console.error('Error fetching balance:', error);
    bot.sendMessage(
      chatId,
      '❌ An error occurred while fetching your balance. Please try again later.',
      replyOptions
    );
  }
});

// Fund Command - Help users understand how to fund their STX wallet
bot.onText(/\/fund/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Check if user is registered
  const user = await User.findOne({ telegramId });
  if (!user) {
    return bot.sendMessage(chatId, '❌ You are not registered yet. Use /start to register first.');
  }

  const fundingMessage = `
💳 *How to Fund Your STX Wallet*

Your wallet address: \`${user.walletAddress}\`

📋 *Funding Methods:*

1️⃣ *Buy STX from Exchanges:*
   • Coinbase, Binance, Kraken, OKX
   • KuCoin, Gate.io, Huobi
   • After purchase, withdraw to your wallet address above

2️⃣ *STX Faucets (Testnet/Small Amounts):*
   • Stacks Explorer Faucet
   • Community faucets for learning

3️⃣ *P2P Trading:*
   • Ask friends/colleagues to send STX
   • Use /receive to share your address

⚠️ *Important Security Tips:*
• Never share your seed phrase or PIN
• Double-check wallet addresses before sending
• Start with small amounts for testing
• This wallet is for educational/reward purposes

🎓 *For Academic Use:*
• Lecturers can fund student wallets as rewards
• Students can earn STX for academic achievements
• Use small amounts for meaningful recognition

Need help? Contact your lecturer or system administrator.
  `;

  bot.sendMessage(chatId, fundingMessage, { 
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Copy My Address", callback_data: `copy_address_${telegramId}` }],
        [{ text: "💰 Check Balance", callback_data: `check_balance_${telegramId}` }]
      ]
    }
  });

  // Handle inline keyboard callbacks
  bot.once("callback_query", async (callbackQuery) => {
    if (!callbackQuery.data.includes(`_${telegramId}`)) return;

    if (callbackQuery.data.startsWith("copy_address")) {
      bot.sendMessage(chatId, `📋 *Copy this address:*\n\`${user.walletAddress}\``, { parse_mode: "Markdown" });
    } else if (callbackQuery.data.startsWith("check_balance")) {
      // Trigger balance check
      bot.emit('message', { ...msg, text: '/balance' });
    }
  });
});

// Leaderboard Command - Show top students by STX balance (for academic motivation)
bot.onText(/\/leaderboard/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Get all users with their wallet addresses
    const users = await User.find({}, 'username walletAddress telegramId').limit(10);
    
    if (users.length === 0) {
      return bot.sendMessage(chatId, '❌ No registered users found.');
    }

    let leaderboardData = [];

    // Fetch balances for all users
    for (const user of users) {
      try {
        const url = `https://api.hiro.so/extended/v1/address/${user.walletAddress}/balances`;
        const response = await fetch(url);
        
        if (response.ok) {
          const accountData = await response.json();
          const stxBalance = parseInt(accountData.stx?.balance || 0) / 1e6;
          
          leaderboardData.push({
            username: user.username || `User${user.telegramId.slice(-4)}`,
            balance: stxBalance
          });
        }
      } catch (error) {
        console.error(`Error fetching balance for ${user.username}:`, error);
      }
    }

    // Sort by balance (highest first)
    leaderboardData.sort((a, b) => b.balance - a.balance);

    // Create leaderboard message
    let leaderboardMessage = `🏆 *Academic Achievement Leaderboard*\n\n`;
    
    leaderboardData.slice(0, 10).forEach((user, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      leaderboardMessage += `${medal} *${user.username}*: ${user.balance.toFixed(4)} STX\n`;
    });

    leaderboardMessage += `\n🎓 *Keep up the excellent academic work!*\n📊 Balances update in real-time`;

    bot.sendMessage(chatId, leaderboardMessage, { parse_mode: "Markdown" });

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    bot.sendMessage(chatId, '❌ An error occurred while fetching the leaderboard. Please try again later.');
  }
});

// Stats Command - For lecturers/admins to see system overview
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    // Get total number of registered users
    const totalUsers = await User.countDocuments();
    
    // Get users with recent activity (optional - you could track last active time)
    const usersWithWallets = await User.find({}, 'username walletAddress').limit(5);
    
    let totalStxInSystem = 0;
    let activeWallets = 0;

    // Calculate total STX in the system
    for (const user of usersWithWallets) {
      try {
        const url = `https://api.hiro.so/extended/v1/address/${user.walletAddress}/balances`;
        const response = await fetch(url);
        
        if (response.ok) {
          const accountData = await response.json();
          const stxBalance = parseInt(accountData.stx?.balance || 0) / 1e6;
          totalStxInSystem += stxBalance;
          if (stxBalance > 0) activeWallets++;
        }
      } catch (error) {
        console.error(`Error fetching balance for stats:`, error);
      }
    }

    const statsMessage = `
📊 *Academic Rewards System Statistics*

👥 *Total Registered Users:* ${totalUsers}
💰 *Total STX in System:* ${totalStxInSystem.toFixed(4)} STX
🏦 *Active Wallets (with balance):* ${activeWallets}
📈 *System Status:* ✅ Operational

🎓 *Academic Features:*
• Reward distribution system
• Real-time balance tracking  
• Leaderboard motivation
• Secure wallet management

💡 *Usage Tips for Lecturers:*
• Reward amounts: 0.1 - 5 STX recommended
• Use /leaderboard to motivate students
• Students can use /fund for wallet funding help
• All transactions are recorded on Stacks blockchain

🔧 *System Info:*
• Network: Stacks Mainnet
• Database: MongoDB Connected
• Security: PIN-encrypted private keys
    `;

    bot.sendMessage(chatId, statsMessage, { parse_mode: "Markdown" });

  } catch (error) {
    console.error('Error fetching stats:', error);
    bot.sendMessage(chatId, '❌ An error occurred while fetching system statistics. Please try again later.');
  }
});

/**
 * Decrypts an encrypted private key using the provided PIN combined with PRIVATE_KEY_SECRET.
 */
function decryptPrivateKey(encryptedData, pin) {
  const combinedKey = crypto.createHash('sha256').update(pin + PRIVATE_KEY_SECRET).digest();
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', combinedKey, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Fetches the current nonce for the provided wallet address from the Stacks network.
 */
async function getNonce(address) {
  const accountUrl = `https://stacks-node-api.mainnet.stacks.co/v2/accounts/${address}`;
  const res = await fetch(accountUrl);
  if (!res.ok) {
    throw new Error('Failed to fetch account data');
  }
  const data = await res.json();
  return data.nonce;
}

/**
 * Tipping command supporting both formats:
 * 1. /tip amount         (used as a reply to a recipient's message)
 * 2. /tip @username amount  (used when not replying)
 *
 * In both cases, a DM is sent to the tipper to securely collect their 5-digit PIN.
 * This version sends STX tokens directly using makeSTXTokenTransfer.
 */
bot.onText(/\/tip(?:\s+(@\S+))?\s+(\d+(\.\d+)?)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const tipperTelegramId = String(msg.from.id);
  const optionalUsername = match[1];
  const tipAmount = parseFloat(match[2]);

  // Declare timeout in this scope
  let timeout;

  try {
    // Validate tip amount with academic context
    if (isNaN(tipAmount) || tipAmount <= 0) { 
      return bot.sendMessage(chatId, "❌ Invalid tip amount provided. Please enter a valid positive number.");
    }

    // Suggest reasonable academic reward amounts
    if (tipAmount > 10) {
      const confirmMsg = await bot.sendMessage(chatId, 
        `⚠️ You're about to tip ${tipAmount} STX. For academic rewards, consider smaller amounts (0.1 - 5 STX).\n\nProceed anyway?`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Proceed", callback_data: `proceed_${tipperTelegramId}` }],
              [{ text: "❌ Cancel", callback_data: `cancel_${tipperTelegramId}` }]
            ]
          }
        }
      );

      // Wait for confirmation
      return new Promise((resolve) => {
        bot.once("callback_query", async (callbackQuery) => {
          if (!callbackQuery.data.includes(`_${tipperTelegramId}`)) return;
          
          if (callbackQuery.data.startsWith("cancel")) {
            return bot.sendMessage(chatId, "❌ Tip cancelled.");
          }
          // If proceed, continue with the tip process
        });
      });
    }

    // Look up the tipper
    const tipper = await User.findOne({ telegramId: tipperTelegramId });
    if (!tipper) {
      return bot.sendMessage(chatId, "❌ You are not registered. Use /start to register.");
    }

    // Determine the recipient
    let recipient;
    if (msg.reply_to_message) {
      const recipientTelegramId = String(msg.reply_to_message.from.id);
      recipient = await User.findOne({ telegramId: recipientTelegramId });
      if (!recipient) {
        return bot.sendMessage(chatId, "❌ The recipient is not registered.");
      }
    } else if (optionalUsername) {
      const username = optionalUsername.replace('@', '');
      recipient = await User.findOne({ username });
      if (!recipient) {
        return bot.sendMessage(chatId, `❌ @${username} is not registered.`);
      }
    } else {
      return bot.sendMessage(chatId, "❌ Please reply to a user's message or specify @username.");
    }

    // If the command is NOT in a private DM, notify the tipper to check their DMs.
    if (msg.chat.type !== 'private') {
      await bot.sendMessage(
        chatId,
        `@${msg.from.username || tipperTelegramId}, check your DMs to confirm your STX tip.`,
        { reply_to_message_id: msg.message_id }
      );
    }

    // Send a DM to the tipper prompting for their 5-digit PIN.
    const dmMsg = await bot.sendMessage(
      tipperTelegramId,
      `You are tipping ${tipAmount} STX to @${recipient.username || recipient.telegramId}.\n` +
      "Please reply with your 5-digit PIN to confirm the tip:",
      { reply_markup: { force_reply: true } }
    );

    // Set up a reply listener in DM
    const replyListener = async (replyMsg) => {
      try {
        // Validate that this reply is in DM, from the same tipper, and replying to our DM
        if (
          !replyMsg.reply_to_message ||
          replyMsg.reply_to_message.message_id !== dmMsg.message_id ||
          String(replyMsg.from.id) !== tipperTelegramId
        ) {
          return;
        }

        // Remove listener and cancel the timeout
        bot.removeListener('message', replyListener);
        clearTimeout(timeout);

        // Process the PIN
        const pin = replyMsg.text.trim();
        await bot.deleteMessage(tipperTelegramId, replyMsg.message_id).catch(() => {});

        // Decrypt the tipper's private key using the provided PIN
        let decryptedPrivateKey;
        try {
          decryptedPrivateKey = decryptPrivateKey(tipper.encryptedPrivateKey, pin);
        } catch (error) {
          return bot.sendMessage(tipperTelegramId, "❌ Invalid PIN. Tip cancelled.");
        }

        // Get nonce and prepare STX transfer
        const nonce = await getNonce(tipper.walletAddress);
        const amountMicroSTX = BigInt(Math.round(tipAmount * 1e6));

        // Define transaction options for STX transfer
        const txOptions = {
          recipient: recipient.walletAddress,
          amount: amountMicroSTX,
          senderKey: decryptedPrivateKey,
          network,
          fee: BigInt(5000), // Transaction fee in microSTX
          nonce: nonce,
          memo: "STX Tip",
          postConditionMode: PostConditionMode.Allow
        };

        // Create and broadcast the transaction
        const transaction = await makeSTXTokenTransfer(txOptions);
        const result = await broadcastTransaction({ transaction, network });
        
        if (result.error) {
          throw new Error(`Broadcast failed: ${result.error}`);
        }
        
        const explorerLink = `https://explorer.hiro.so/txid/${result.txid}?chain=mainnet`;
        console.log("Broadcast Result:", result);

        // For DM-initiated commands, send the TX link to both tipper and recipient.
        if (msg.chat.type === 'private') {
          await bot.sendMessage(
            tipperTelegramId,
            `✅ ${tipAmount} STX reward sent successfully! 🎓\nTX ID: ${explorerLink}\n\n💡 Great job rewarding academic excellence!`
          );
          if (recipient.telegramId) {
            await bot.sendMessage(
              recipient.telegramId,
              `🎉 Congratulations! You've received an academic reward of ${tipAmount} STX from @${msg.from.username || tipperTelegramId}! 🎓\n\nKeep up the excellent work!\nTX ID: ${explorerLink}`
            );
          }
        } else {
          // In group chats, notify the tipper in DM and the group as before.
          await bot.sendMessage(
            tipperTelegramId,
            `✅ ${tipAmount} STX reward sent successfully! 🎓\nTX ID: ${explorerLink}`
          );
          await bot.sendMessage(
            recipient.telegramId,
            `🎉 Congratulations! You've received an academic reward of ${tipAmount} STX from @${msg.from.username || tipperTelegramId}! 🎓\n\nKeep up the excellent work!\nTX ID: ${explorerLink}`
          );
          await bot.sendMessage(
            chatId,
            `🎓 Academic Reward: ${tipAmount} STX from @${msg.from.username || tipperTelegramId} to @${recipient.username || recipient.telegramId}!\n\n✨ Recognizing academic excellence and positive behavior!`,
            { reply_to_message_id: msg.message_id }
          );
        }
      } catch (error) {
        console.error("Tip processing error:", error);
        bot.sendMessage(
          tipperTelegramId,
          "❌ Transaction failed. Please try again later."
        );
      }
    };

    // Set up the DM reply listener with a 5-minute timeout
    bot.on('message', replyListener);
    timeout = setTimeout(() => {
      bot.removeListener('message', replyListener);
      bot.sendMessage(tipperTelegramId, "⌛ Tip confirmation timed out.");
    }, 300000);

  } catch (error) {
    console.error("Tip command error:", error);
    bot.sendMessage(chatId, "❌ An error occurred. Please try again.");
  }
});



// /recover command implementation
bot.onText(/\/recover/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const isGroupChat = msg.chat.type !== 'private';

  if (isGroupChat) {
    return bot.sendMessage(chatId, "🚨 *Please use the recover command in a private message (DM) with the bot.*\n\nClick here to start: [Start DM](t.me/StacksTipBot)", { parse_mode: "Markdown" });
  }

  try {
    const existingUser = await User.findOne({ telegramId });
    if (!existingUser) {
      return bot.sendMessage(chatId, "❌ *You are not registered yet.* Please start by registering first.");
    }

    // Ask the user to provide their seed phrase
    const seedMessage = await bot.sendMessage(chatId, "🔑 Please enter your seed phrase to recover your wallet:");

    // Listen for seed phrase input
    bot.once('message', async (response) => {
      if (response.chat.id !== chatId || !response.text) return;

      const providedSeedPhrase = response.text.trim();

      try {
        // Generate wallet from provided seed phrase
        const wallet = await createWalletFromSeed(providedSeedPhrase);
        const generatedAddress = wallet.address;
        const newPrivateKey = wallet.privateKey; // New private key from recovered wallet

        // Compare the generated address with the stored address
        if (generatedAddress !== existingUser.walletAddress) {
          return bot.sendMessage(chatId, "❌ *The provided seed phrase doesn't match the registered wallet address.*\n\nWould you like to try entering your seed phrase again? Type /recover to restart the process.", { parse_mode: "Markdown" });
        }

        // If the addresses match, ask the user for a new PIN
        bot.sendMessage(chatId, "✅ *Seed phrase confirmed.* Please set a new 5-digit PIN to secure your wallet.", {
          reply_markup: { force_reply: true }
        }).then((pinRequestMessage) => {
          // Listen for PIN input
          bot.once('message', async (pinMsg) => {
            const newPin = pinMsg.text.trim();

            // Validate new PIN
            if (!/^\d{5}$/.test(newPin)) {
              return bot.sendMessage(chatId, "⚠️ Invalid PIN! Must be 5 digits. Try again:");
            }

            // Ask for PIN confirmation
            const confirmMessage = await bot.sendMessage(chatId, "🔁 Please re-enter your new 5-digit PIN to confirm:", {
              reply_markup: { force_reply: true }
            });

            // Listen for PIN confirmation
            bot.once('message', async (confirmMsg) => {
              const confirmedPin = confirmMsg.text.trim();

              // Compare both PIN entries
              if (newPin !== confirmedPin) {
                return bot.sendMessage(chatId, "❌ PINs don't match! Start over with /recover.");
              }

              // Encrypt the new private key with the new PIN
              const encryptedPrivateKey = encryptPrivateKey(newPrivateKey, newPin);

              // Save new PIN and encrypted private key to the user
              existingUser.securityCode = crypto.createHash("sha256").update(newPin).digest("hex");
              existingUser.encryptedPrivateKey = encryptedPrivateKey;
              await existingUser.save();

              // Success message
              bot.sendMessage(chatId, "✅ Your wallet is recovered and secured with your new PIN.");
            });
          });
        });
      } catch (error) {
        if (error.message === "Not a valid bip39 mnemonic") {
          return bot.sendMessage(chatId, "❌ *Invalid mnemonic phrase provided. Please check the seed phrase and try again. /recover*", { parse_mode: "Markdown" });
        } else {
          console.error("Error during recovery:", error);
          return bot.sendMessage(chatId, "❌ *An error occurred while recovering your wallet. Please try again later. /recover*", { parse_mode: "Markdown" });
        }
      }
    });

  } catch (error) {
    console.error("Error during recovery:", error);
    bot.sendMessage(chatId, "❌ *An error occurred while recovering your wallet. Please try again later.*", { parse_mode: "Markdown" });
  }
});


async function createWalletFromSeed(seedPhrase) {
  // Implement wallet creation using the provided seed phrase and return wallet object
  try {
    const wallet = await generateWallet({ secretKey: seedPhrase, password: 'password' });
    const account = wallet.accounts[0];
    const address = getStxAddress({ account, transactionVersion: TransactionVersion });

    return {
      address,
      privateKey: account.stxPrivateKey // Return the new private key for encryption
    };
  } catch (error) {
    throw new Error("Not a valid bip39 mnemonic"); // Customize the error message if needed
  }
}




// Health check endpoint for uptime monitoring
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    botStatus: 'running'
  });
});

// Self-ping to keep bot alive (for services like Render, Railway, etc.)
function keepAlive() {
  const url = process.env.SELF_PING_URL || `http://localhost:${PORT}/health`;
  
  setInterval(async () => {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      console.log(`Keep-alive ping: ${response.status} at ${new Date().toISOString()}`);
    } catch (error) {
      console.log(`Keep-alive ping failed: ${error.message}`);
    }
  }, 14 * 60 * 1000); // Ping every 14 minutes (within free tier limits)
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  
  // Start keep-alive pings if enabled
  if (process.env.ENABLE_KEEP_ALIVE === 'true') {
    console.log('Keep-alive pings enabled');
    keepAlive();
  }
});