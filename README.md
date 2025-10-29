# Magic Eden Rarity CSV Fetcher

A Node.js tool to fetch token rarity information from the Magic Eden EVM API for any supported blockchain and export the data to CSV format.

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

- ✅ Multi-chain support for all major EVM chains
- ✅ Automatic rate limiting (180 requests/minute)
- ✅ Pagination handling for large collections
- ✅ Retry logic for failed requests
- ✅ Comprehensive error handling
- ✅ CSV export with timestamped filenames
- ✅ Detailed progress logging

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

## Usage

### Basic Usage

```bash
npm start
```

### Development Mode (with auto-restart)

```bash
npm run dev
```

## Output

The tool generates a CSV file with the following columns:

- **Token ID**: Unique identifier for the token
- **Name**: Token name
- **Description**: Token description
- **Rarity Rank**: Numerical rarity rank (if available)
- **Rarity Score**: Rarity score (if available)
- **Attributes (JSON)**: Token attributes in JSON format
- **Image URL**: Link to token image
- **Market Price**: Current listing price
- **Currency**: Price currency (ETH, etc.)
- **Last Sale**: Last sale information
- **Owner**: Current owner address
- **Collection Address**: Contract address
- **Contract Address**: Token contract address
- **Chain**: Blockchain network

## Example Output File

```
me-rarity-sei-0x1234567890abcdef-2024-01-15T10-30-45-123Z.csv
```

## Rate Limiting

The tool automatically handles Magic Eden's rate limit of 180 requests per minute by:
- Adding ~370ms delay between requests (with 10% buffer)
- Using a queue system to prevent burst requests
- Implementing retry logic for rate limit errors

## Error Handling

- **Invalid collection address**: Clear error message with supported chains
- **Network failures**: Automatic retry with exponential backoff
- **Rate limit exceeded**: Automatic retry after delay
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
- **Endpoint**: `https://api-mainnet.magiceden.dev/v4/assets`
- **Documentation**: [Magic Eden API Docs](https://docs.magiceden.io/v4.0/reference/getassets)

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
