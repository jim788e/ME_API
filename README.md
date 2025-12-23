# Magic Eden Collection Info CSV Fetcher

A Node.js tool to fetch comprehensive collection token data (attributes, rarity, market info) from the Magic Eden EVM API and export it to CSV. Built for large collections with resilient pagination, rate limiting, and partial-result saving.

## Supported Chains

- **Ethereum** (ethereum)
- **Polygon** (polygon) 
- **Arbitrum** (arbitrum)
- **Optimism** (optimism)
- **Base** (base)
- **Sei** (sei)
- **BSC** (bsc)
- **Avalanche** (avalanche)
- **Fantom** (fantom)
- **Cronos** (cronos)

## Features

- ✅ Multi-chain EVM support (including `sei`)
- ✅ Automatic rate limiting (180 req/min) with 20% safety buffer
- ✅ Robust pagination with offsets for large collections (10k+ safe)
- ✅ Graceful handling of API 400/404/429 with retries and backoff
- ✅ Partial results saved if limits/errors occur mid-run
- ✅ CSV export with timestamped filenames in `output/`
- ✅ Clean logs with page/offset progress
- ✅ `.gitignore` excludes `output/`, `.env`, `node_modules/`

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env` file:
   ```bash
   cp env.template .env
   ```

4. Edit `.env` with your configuration:
   ```env
   COLLECTION_ADDRESS=0x1234567890abcdef...
   API_KEY=your_api_key_here
   CHAIN=sei
   OUTPUT_DIR=./output
   ```

## Configuration

### Required Environment Variables

- `COLLECTION_ADDRESS`: The contract address of the NFT collection
- `CHAIN`: The blockchain network (default: ethereum)

### Optional Environment Variables

- `API_KEY`: Your Magic Eden API key (optional but recommended)
- `OUTPUT_DIR`: Directory to save CSV files (default: ./output)

Git setup (optional):
- Main branch tracked at a remote (example) `origin`.
- `output/` is not synced to the repository.

## Usage

### Basic Usage

```bash
npm start
```

### Development Mode (with auto-restart)

```bash
npm run dev
```

## On-Chain Snapshot Tool (Sei)

In addition to the API fetcher, this repo includes a direct on-chain snapshot tool for Sei network. This interacts directly with the smart contract to fetch the "Source of Truth" for token ownership.

### Usage
```bash
node sei_snapshot.js
```

### Configuration (sei_snapshot.js)
You can directly edit the `sei_snapshot.js` file to change:
- `RPC_URL`: The RPC endpoint to use
- `CONTRACT_ADDRESS`: The NFT contract address
- `BATCH_SIZE`: Number of tokens to fetch in parallel (Adjust based on rate limits)
- `DELAY_BETWEEN_BATCHES_MS`: Delay between requests

## Output

The tool generates a CSV file with the following columns:

- **Token ID**: Unique identifier for the token
- **Name**: Token name
- **Description**: Token description
- **Rarity Rank**: Numerical rarity rank (if available)
- **Rarity Provider**: Rarity provider name (e.g., POPRANK)
- **Attributes (JSON)**: Token attributes in JSON format
- **Image URL**: Link to token image
- **Market Price**: Current listing price
- **Currency**: Price currency (ETH, etc.)
- **Last Sale Price**: Last sale price (native)
- **Last Sale Currency**: Last sale currency symbol
- **Owner**: Current owner address
- **Collection Address**: Contract address
- **Contract Address**: Token contract address
- **Chain**: Blockchain network
- **Standard**: Token standard (e.g., ERC721)
- **Remaining Supply**: Remaining supply

## Example Output File

```
me-rarity-sei-0x1234567890abcdef-2025-01-15T10-30-45-123Z.csv
```

## Rate Limiting

The tool automatically handles Magic Eden's limits:
- Adds ~400ms delay between requests (20% buffer over 180 req/min)
- Retries on 429 with longer waits
- Treats some 400 responses at high offsets as end-of-collection

## Error Handling

- **Invalid collection address**: Clear error message with supported chains
- **Network failures**: Automatic retry with exponential backoff
- **Rate limit exceeded**: Automatic retry with extended delay
- **Large collections**: Partial results are saved on safe exit
- **Missing environment variables**: Helpful error messages

## Troubleshooting

### Common Issues

1. **"Collection not found"**: Verify the collection address and chain are correct
2. **"Unsupported chain"**: Check that your chain is in the supported list
3. **Rate limit errors**: The tool handles this automatically, but you can increase delays if needed

### Debug Mode

For detailed logging, you can modify the script to add more console output or use a logging library.

## API Reference

This tool uses the Magic Eden EVM API v4:
- Endpoint: `https://api-mainnet.magiceden.dev/v4/evm-public/assets/collection-assets`
- Docs: [Magic Eden v4 Get Assets](https://docs.magiceden.io/v4.0/reference/getassets)

Example query shape used by the tool:
- `chain`: EVM chain, e.g. `ethereum`, `sei`
- `collectionId`: collection contract address
- `limit`: number of results per page (default: 100)
- `offset`: pagination offset (default: 0)
- `sortBy`: sort field (default: 'price')
- `sortDir`: sort direction (default: 'asc')

## License

MIT License - feel free to modify and distribute as needed.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the Magic Eden API documentation
3. Open an issue with detailed error information
