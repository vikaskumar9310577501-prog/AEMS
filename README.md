# AssetQR Tracker

AssetQR Tracker is an IT asset management system for tracking devices, employee assignments, inventory records, missing items, and QR-based asset lookup.

## Features

- QR code generation and scan-based asset lookup
- Employee assignment and asset history tracking
- Inventory, missing item, and audit log management
- Google Sheets sync support
- PDF generation for asset records
- Vercel-ready frontend deployment config

## Tech Stack

- React
- TypeScript
- Vite
- Express
- Google Sheets API

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   copy .env.example .env
   ```

3. Add the required values in `.env`.

4. Start the app:

   ```bash
   npm run dev
   ```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run start
```

## Environment

Use `.env.example` as the reference for required variables. Real `.env` files should stay local and must not be committed.
