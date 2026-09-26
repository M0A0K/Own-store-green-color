# OwnVerse Store — Production Deployment Guide (Railway & Cloud Run)

## 1. Architecture Overview
- **Runtime**: Node.js 22+ & Express (`server.ts`)
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 + Vite
- **Database**: PostgreSQL with Drizzle ORM (`src/db/schema.ts`, `src/db/index.ts`)
- **Authentication**: Firebase Authentication (Google Sign-In) + scrypt-hashed Admin Access Key & HMAC-SHA256 Admin Session Tokens

## 2. Required Environment Variables
Configure the following variables in your deployment environment (refer to `.env.example`):
- `PORT`: `3000`
- `SQL_HOST`: PostgreSQL host or Unix socket path
- `SQL_DB_NAME`: Database name
- `SQL_USER`: Application read/write database user
- `SQL_PASSWORD`: Application database password
- `SQL_ADMIN_USER`: Admin user for Drizzle schema migrations
- `SQL_ADMIN_PASSWORD`: Admin password for Drizzle schema migrations
- `ADMIN_EMAIL`: Primary administrator Google email
- `ADMIN_ACCESS_KEY`: Initial admin unlock key (hashed with `scrypt` into PostgreSQL on first seed)
- `ADMIN_SESSION_SECRET`: Secret key used to sign admin session tokens
- `DISCORD_WEBHOOK_URL`: Backend-only Discord Webhook URL for new order and status update embeds
- `MINECRAFT_SERVER_IP`: Target Minecraft server IP (e.g., `play.ownverse.mc`)

## 3. Build & Start Commands
- **Install Dependencies**: `npm install`
- **Build Frontend Assets**: `npm run build`
- **Start Production Server**: `npm run start` (`node server.ts`)
- **Health Check Endpoint**: `GET /api/health`
