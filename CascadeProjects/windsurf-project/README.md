# JohnyBrowserHub

A comprehensive browser hub for VPN apps and privacy browsers.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up OpenAI API Key (optional):**
   ```bash
   npm run set-openai-key
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

## Available NPM Commands

- `npm start` - Launch the application
- `npm run open` - Alternative way to launch the application
- `npm run set-openai-key` - Configure OpenAI API key for chatbot features

## Features

- **User Authentication** - Email/password and Google OAuth
- **App Catalog** - 100+ VPN apps and privacy browsers
- **Search & Filter** - Find apps by platform, type, or tags
- **AI Chatbot** - Powered by OpenAI for user assistance
- **Profile Management** - Customizable profiles with avatars

## Requirements

- Node.js (v14 or higher)
- Windows PowerShell
- OpenAI API Key (for chatbot features)

## Project Structure

- `main.js` - Electron main process
- `server.js` - Backend HTTP server
- `renderer.js` - Frontend logic
- `ai.js` - OpenAI integration
- `index.html` - Main UI
- `styles.css` - Styling
- `apps.json` - App catalog data

## Development

The application uses Electron for desktop functionality and includes:
- Firebase Authentication
- OpenAI API integration
- Local HTTP server for API endpoints

## License

© 2026 Umukunzi Mubaraka Johnson. All rights reserved.
