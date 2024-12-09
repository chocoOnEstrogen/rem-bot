# 🤖 Rem Bot

> A GitHub integration bot that provides rich analytics, statistics, and notifications through Bluesky.

<p align="center">
  <img src="assets/banner.png" alt="Rem Bot Banner" width="600">
</p>

## ✨ Features

### 📊 Statistics & Analytics
- **Weekly Activity Reports**: Automated stats generation for users and repositories

### 🔔 Notifications
- **Commit Updates**: Real-time commit notifications on Bluesky

## 🚀 Getting Started

### Prerequisites
- Node.js 18 or higher
- A GitHub account
- A Bluesky account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/chocoOnEstrogen/rem-bot.git
cd rem-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Copy `.env.example` to `.env` and fill in the required values:
```env
# GitHub App Configuration
APP_ID=your_app_id
WEBHOOK_SECRET=your_webhook_secret
PRIVATE_KEY=your_private_key

# Bluesky Configuration
BLUESKY_IDENTIFIER=your.identifier
BLUESKY_PASSWORD=your_password

# GitHub Configuration
GITHUB_USERNAME=your_username
```

4. **Start the bot**
```bash
npm start
```

### 🐳 Docker Deployment

```bash
# Build container
docker build -t rem-bot .

# Run container
docker run -d \
  --name rem-bot \
  -e APP_ID=<app-id> \
  -e PRIVATE_KEY=<pem-value> \
  -e WEBHOOK_SECRET=<webhook-secret> \
  -e BLUESKY_IDENTIFIER=<identifier> \
  -e BLUESKY_PASSWORD=<password> \
  rem-bot
```

## 📝 Usage

### Setting Up the GitHub App

1. Create a new GitHub App in your organization settings
2. Configure the following permissions:
   - Repository contents: Read
   - Issues: Write
   - Pull requests: Write
   - Workflows: Read
   - Metadata: Read
3. Subscribe to events:
   - Push
   - Pull request
   - Issues
   - Workflow runs

### Configuring Bluesky Integration

1. Create a Bluesky account if you haven't already
2. Add your Bluesky credentials to the `.env` file
3. The bot will automatically post updates to your Bluesky feed

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Probot](https://github.com/probot/probot)
- Uses [Bluesky API](https://github.com/bluesky-social/atproto)
- Canvas rendering by [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas)

## 📞 Support

If you have any questions or need help with setup, please open an issue or reach out to [@chocoOnEstrogen](https://github.com/chocoOnEstrogen) on GitHub.

---
Made with ❤️ by stella~
