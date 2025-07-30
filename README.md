# Academic STX Reward System

## Overview
This Telegram bot facilitates STX (Stacks) token rewards for academic achievements, designed for lecturers to enhance student engagement and recognize academic excellence.

## Features

### For Students:
- **Wallet Management**: Secure STX wallet creation with PIN protection
- **Balance Checking**: View current STX balance with low balance alerts
- **Funding Guidance**: Comprehensive guide on how to fund STX wallets
- **Achievement Tracking**: View personal reward history and rankings

### For Lecturers:
- **Reward Distribution**: Send STX tokens for academic achievements
- **Student Leaderboard**: View top-performing students by total rewards
- **System Statistics**: Monitor overall engagement and reward distribution
- **Achievement Categories**: Reward different types of academic excellence

## Academic Reward Categories

### 🏆 Excellence Awards (2.0 - 5.0 STX)
- Outstanding exam performance (95%+)
- Exceptional project submissions
- Research paper publications
- Academic competition winners

### 🎯 Achievement Recognition (1.0 - 2.0 STX)
- Significant improvement in grades
- Successful presentation delivery
- Collaborative project leadership
- Consistent attendance and participation

### 💡 Participation Incentives (0.1 - 1.0 STX)
- Active class participation
- Helpful peer assistance
- Submission of quality assignments
- Attendance at academic events

## Security Features
- PIN-protected private keys
- Encrypted wallet storage
- Input validation and sanitization
- Rate limiting on commands
- Secure transaction handling

## Commands Reference

### Student Commands:
- `/start` - Register and create STX wallet
- `/balance` - Check current STX balance
- `/fund` - Get wallet funding instructions
- `/help` - View available commands

### Lecturer Commands:
- `/tip @username amount reason` - Reward student with STX
- `/leaderboard` - View top students
- `/stats` - View system statistics
- `/help lecturer` - View lecturer-specific commands

## Technical Specifications
- **Blockchain**: Stacks (STX) Mainnet
- **Database**: MongoDB for user management
- **Encryption**: AES-256 for private key protection
- **API**: Telegram Bot API for user interaction

## Getting Started
1. Contact your lecturer to be added to the academic reward program
2. Use `/start` to create your secure STX wallet
3. Set up a secure 5-digit PIN for wallet protection
4. Participate actively in academic activities to earn STX rewards
5. Use `/fund` if you need help adding STX to your wallet

## Support
For technical issues or questions about the reward system, contact your course administrator or lecturer.
