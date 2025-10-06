# KPI Smart Contract

A Solidity smart contract for managing Key Performance Indicators (KPIs) with verifiable credential integration.

## Features

- **setKPIs(hash, baseline, savings)**: Add baseline and savings values for a specific hash
- **getKPIs(hash)**: Retrieve total baseline and savings for a hash
- **Events**: Indexed events for KPI updates
- **Batch operations**: Get multiple KPIs in one call
- **Global statistics**: Track totals across all hashes

## Smart Contract Details

### Main Functions

```solidity
function setKPIs(string memory hash, uint256 baseline, uint256 savings) external
function getKPIs(string memory hash) external view returns (uint256, uint256, uint256, bool)
function getAllHashes() external view returns (string[] memory)
function getGlobalStats() external view returns (uint256, uint256, uint256, uint256)
```

### Events

```solidity
event KPIsSet(string indexed hash, uint256 indexed baseline, uint256 indexed savings, uint256 newTotalBaseline, uint256 newTotalSavings, address sender, uint256 timestamp)
event KPIsUpdated(string indexed hash, uint256 previousTotalBaseline, uint256 previousTotalSavings, uint256 newTotalBaseline, uint256 newTotalSavings, uint256 entryCount)
```

## Setup

1. **Install dependencies:**

   ```bash
   cd smart-contract
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Get API keys:**
   - **Infura**: Sign up at [infura.io](https://infura.io) for Sepolia access
   - **Etherscan**: Get API key at [etherscan.io](https://etherscan.io/apis)

## Development

### Compile the contract:

```bash
npm run compile
```

### Run tests:

```bash
npm test
```

### Deploy to local network:

```bash
npm run node  # In one terminal
npm run deploy  # In another terminal
```

## Deployment to Sepolia

### Prerequisites:

1. **Fund your wallet**: Get Sepolia ETH from [sepoliafaucet.com](https://sepoliafaucet.com/)
2. **Set environment variables** in `.env`:
   ```
   INFURA_API_KEY=your_infura_key
   PRIVATE_KEY=92a876bd5419518f133ae8d0321bc7aa5d1d83dff206aeb3c4c5fde32315682b
   ETHERSCAN_API_KEY=your_etherscan_key
   ```

### Deploy:

```bash
npm run deploy:sepolia
```

### Verify on Etherscan:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

## Usage Examples

### Setting KPIs:

```javascript
// With ethers.js
const tx = await contract.setKPIs(
  "59994ab0b1b46f8d11c2b6b3574778644dd51293dee51634c4d6ea82cf7b97b5",
  1000, // baseline
  250 // savings
);
```

### Getting KPIs:

```javascript
const result = await contract.getKPIs("your_hash_here");
console.log(`Total Baseline: ${result.totalBaseline}`);
console.log(`Total Savings: ${result.totalSavings}`);
console.log(`Entry Count: ${result.entryCount}`);
```

### Listening to events:

```javascript
contract.on(
  "KPIsSet",
  (hash, baseline, savings, totalBaseline, totalSavings, sender, timestamp) => {
    console.log(`KPIs set for ${hash}: ${baseline}/${savings}`);
  }
);
```

## Integration with Verifier Server

The smart contract is designed to work with the Verifier REST API:

1. **Credential verification**: The verifier checks for valid proofs containing the hash
2. **Authorized transactions**: Only verified hashes can be used for setKPIs
3. **Audit trail**: All transactions are logged with events

### Example API call:

```bash
curl -X POST http://localhost:3002/blockchain/set-kpis \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "59994ab0b1b46f8d11c2b6b3574778644dd51293dee51634c4d6ea82cf7b97b5",
    "baseLine": 1000,
    "savings": 250,
    "contractAddress": "0xYourContractAddress"
  }'
```

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Input validation**: Validates hash and values
- **Event logging**: Complete audit trail
- **Access control**: Ownable pattern for administrative functions

## Gas Optimization

- **Optimized storage**: Efficient struct packing
- **Batch operations**: Reduce multiple calls
- **Event indexing**: Efficient event filtering

## Contract Address

After deployment, the contract address will be saved in `deployment-info.json` and displayed in the console.

## Testing

The contract includes comprehensive tests covering:

- Basic functionality
- Edge cases
- Access control
- Event emission
- Gas usage
- Security scenarios

Run tests with:

```bash
npm test
```

## Network Configuration

### Sepolia Testnet:

- **Chain ID**: 11155111
- **RPC URL**: `https://sepolia.infura.io/v3/YOUR_KEY`
- **Block Explorer**: [sepolia.etherscan.io](https://sepolia.etherscan.io)

## Support

For questions or issues:

1. Check the test files for usage examples
2. Review the contract comments for function details
3. Use Hardhat console for debugging: `npx hardhat console --network sepolia`
