# IoT Device Dashboard

A React/Vite dashboard for managing IoT devices with verifiable credentials and blockchain KPI tracking.

## Features

### Dashboard Page (`/`)

- **MAC Address Input**: Enter device MAC address with auto-generated hash (`domx_ot_{macAddress}`)
- **Request VC**: Create connection invitation for credential verification
- **Verify Device**: Connect and request proof from device
- **Set KPIs**: Submit baseline and savings data to blockchain
- **Modal Responses**: View detailed API responses in modal dialogs

### Stats Page (`/stats` or `/stats/:hash`)

- **Hash Search**: Look up KPI data by device hash
- **Smart Contract Data**: Get total baseline and savings from blockchain
- **Transaction History**: View all blockchain events for a specific hash
- **Event Details**: Date, hash, baseline, savings, block number, and transaction links

## API Endpoints Used

### Holder (Alice) - `https://holder.yanis.gr/api`

- `POST /connection/create-invitation` - Create connection invitation
- `POST /proofs/request` - Request proof from device
- `POST /blockchain/submit-kpis` - Submit KPIs to blockchain

### Verifier - `https://verifier.yanis.gr/api`

- `GET /blockchain/get-kpi/:hash` - Get KPI totals for specific hash
- `GET /blockchain/events/:hash?blocks=N` - Get events for specific hash
- `GET /blockchain/events?blocks=N` - Get all events from last N blocks

## Installation

```bash
cd dashboard
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx      # Main dashboard with device management
│   │   ├── Dashboard.css      # Dashboard styles
│   │   ├── StatsPage.tsx      # Statistics and blockchain data
│   │   ├── StatsPage.css      # Stats page styles
│   │   ├── Modal.tsx          # Reusable modal component
│   │   └── Modal.css          # Modal styles
│   ├── App.tsx                # Main app with routing
│   ├── App.css                # Global app styles
│   └── main.tsx               # React entry point
├── package.json
└── README.md
```

## Usage Examples

### Device Management

1. Enter MAC address (e.g., `00:11:22:33:44:55`)
2. Hash automatically generated: `domx_ot_00:11:22:33:44:55`
3. Click "Request VC" to create connection
4. Click "Verify Device" to request proof
5. Enter baseline and savings values
6. Click "Set KPIs" to submit to blockchain

### Statistics Lookup

1. Navigate to `/stats`
2. Enter device hash or use URL `/stats/domx_ot_00:11:22:33:44:55`
3. View smart contract totals and transaction history
4. Click transaction links to view on Etherscan

## Technology Stack

- **React 19** - UI Framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **CSS Grid/Flexbox** - Responsive layouts

## Environment

The dashboard is configured to work with:

- **Holder**: `https://holder.yanis.gr`
- **Verifier**: `https://verifier.yanis.gr`
- **Blockchain**: Ethereum Sepolia testnet
- **Smart Contract**: `0xf868d9130EA1a1B9Ca0b406411b4D6f646dDcD89`

## Features Highlights

- 📱 **Responsive Design** - Works on desktop and mobile
- 🔄 **Real-time Updates** - Live API responses in modals
- 🔗 **Blockchain Integration** - Direct links to Etherscan
- 🎨 **Modern UI** - Gradient designs and smooth transitions
- ⚡ **Fast Performance** - Vite-powered development and builds
- 🛡️ **Type Safety** - Full TypeScript coverage
