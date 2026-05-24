# TradeAsk

AI-powered compliance question assistant for construction workers, site engineers, electricians, and field tradespeople. Users submit a question (with optional photo or document upload), receive an AI-generated answer reviewed by an expert, delivered via email.

## Prerequisites

- Node.js 18+ (tested with Node 24)
- npm 9+
- Angular CLI (`npm install -g @angular/cli`)
- MySQL 8 (local or hosted — Railway connection provided)

## Quick Start

### 1. Database Setup

Run the schema against your MySQL instance:

```bash
mysql -h YOUR_HOST -P YOUR_PORT -u root -p < TradeAsk.Database/schema.sql
```

### 2. Backend Setup

```bash
cd TradeAsk.API
cp .env.example .env
# Edit .env with your actual credentials (see Environment Variables below)
npm install
npm run dev
```

The API will start on http://localhost:3000.

### 3. Frontend Setup

```bash
cd TradeAsk.Web
npm install
ng serve
```

The app will start on http://localhost:4200.

### 4. Seed Admin Account

After the backend is running, create your first admin user:

```bash
curl -X POST http://localhost:3000/api/admin/seed \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-secure-password"}'
```

Then login at http://localhost:4200/admin.

## Environment Variables

Create a `.env` file in `TradeAsk.API/` with these values:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port (default: 3306) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (default: tradeask) |
| `ANTHROPIC_API_KEY` | Anthropic API key (get from console.anthropic.com) |
| `SENDGRID_API_KEY` | SendGrid API key (get from app.sendgrid.com) |
| `SENDGRID_FROM_EMAIL` | Verified sender email in SendGrid |
| `SENDGRID_FROM_NAME` | Sender display name (default: TradeAsk) |
| `JWT_SECRET` | Random string, minimum 32 characters |
| `UPLOAD_PATH` | File upload directory (default: uploads) |
| `PORT` | API port (default: 3000) |

## API Endpoints

### Public
- `POST /api/questions` — Submit a question (multipart/form-data)
- `GET /api/questions/status/:id` — Check question status
- `GET /api/health` — Health check

### Admin (JWT required)
- `POST /api/admin/login` — Get JWT token
- `POST /api/admin/seed` — Create first admin user
- `GET /api/admin/questions?status=pending` — List questions
- `GET /api/admin/questions/:id` — Get question detail
- `PUT /api/admin/questions/:id/approve` — Approve and send email
- `PUT /api/admin/questions/:id/escalate` — Mark for later
- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/files/:filename` — Download uploaded file

## Getting API Keys

### Anthropic (Claude AI)
1. Go to https://console.anthropic.com
2. Create an account and add billing
3. Generate an API key under Settings → API Keys

### SendGrid (Email)
1. Go to https://app.sendgrid.com
2. Create a free account (100 emails/day free)
3. Verify a sender email under Settings → Sender Authentication
4. Create an API key under Settings → API Keys

## Architecture

```
User submits question → API saves to DB → Claude generates answer
                                              ↓
Admin reviews in dashboard → Approves/edits → Email sent to user
```

## Tech Stack

- **Frontend**: Angular 21 (standalone components, Tailwind CSS via CDN)
- **Backend**: Express.js + TypeScript
- **Database**: MySQL 8
- **AI**: Anthropic Claude API (claude-sonnet-4-5)
- **Email**: SendGrid
- **Auth**: JWT (admin only)
