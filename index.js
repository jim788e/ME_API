require('dotenv').config();
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'https://api-mainnet.magiceden.dev/v4';
const RATE_LIMIT_PER_MINUTE = 180;
const REQUEST_DELAY = Math.ceil((60 * 1000) / RATE_LIMIT_PER_MINUTE * 1.2); // 20% buffer for larger collections
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

class MagicEdenRarityFetcher {
  constructor() {
    this.collectionAddress = process.env.COLLECTION_ADDRESS;
    this.apiKey = process.env.API_KEY;
    this.chain = process.env.CHAIN || 'ethereum';
    this.outputDir = process.env.OUTPUT_DIR || './output';
    
    // Supported EVM chains
    this.supportedChains = [
      'ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 
      'sei', 'bsc', 'avalanche', 'fantom', 'cronos'
    ];
    
    if (!this.collectionAddress) {
      throw new Error('COLLECTION_ADDRESS is required in .env file');
    }
    
    if (!this.supportedChains.includes(this.chain.toLowerCase())) {
      throw new Error(`Unsupported chain: ${this.chain}. Supported chains: ${this.supportedChains.join(', ')}`);
    }
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async makeRequest(params, retries = 0) {
    try {
      const requestParams = {
        chain: this.chain,
        collectionId: this.collectionAddress,
        limit: params.limit || '100',
        sortBy: params.sortBy || 'price',
        sortDir: params.sortDir || 'asc'
      };
      
      // Add continuation token if provided (cursor-based pagination)
      if (params.continuation) {
        requestParams.continuation = params.continuation;
      }
      
      const config = {
        method: 'GET',
        url: `${API_BASE_URL}/evm-public/assets/collection-assets`,
        params: requestParams,
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json'
        }
      };

      if (this.apiKey) {
        config.headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const pageInfo = params.continuation ? `continuation: ${params.continuation.substring(0, 20)}...` : 'first page';
      console.log(`Making request (${pageInfo}), limit: ${params.limit}`);
      const response = await axios(config);
      
      // Add delay between requests to respect rate limit
      await this.delay(REQUEST_DELAY);
      
      return response.data;
    } catch (error) {
      if (retries < MAX_RETRIES && (error.response?.status === 429 || error.code === 'ECONNRESET')) {
        console.log(`Request failed, retrying in ${RETRY_DELAY}ms... (${retries + 1}/${MAX_RETRIES})`);
        await this.delay(RETRY_DELAY);
        return this.makeRequest(params, retries + 1);
      }
      
      throw error;
    }
  }

  async fetchCollectionAssets() {
    console.log(`Fetching assets for collection: ${this.collectionAddress} on ${this.chain}`);
    
    let allAssets = [];
    let continuation = null;
    let limit = 100;
    let hasMore = true;
    let totalRequests = 0;

    while (hasMore) {
      try {
        const params = {
          limit: limit.toString()
        };
        
        // Use continuation token for pagination if available, otherwise use offset
        if (continuation) {
          params.continuation = continuation;
        } else if (totalRequests === 0) {
          // First request - no continuation needed
        }
        
        const data = await this.makeRequest(params);
        
        // New API returns { assets: [...], continuation: "..." }
        const assets = data && data.assets && Array.isArray(data.assets) ? data.assets : [];
        
        if (assets.length > 0) {
          allAssets = allAssets.concat(assets);
          console.log(`Fetched page ${totalRequests + 1}: ${assets.length} assets (Total: ${allAssets.length})`);
          
          // Check if there are more assets using continuation token
          continuation = data.continuation || null;
          hasMore = !!continuation && assets.length === limit;
          totalRequests++;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Error fetching offset ${offset}:`, error.message);
        if (error.response?.status === 404) {
          console.log('Collection not found or no assets available');
          break;
        }
        if (error.response?.status === 400) {
          console.log('Reached end of collection or API limit reached');
          console.log(`Successfully fetched ${allAssets.length} assets before error`);
          console.log('Saving partial results...');
          break;
        }
        if (error.response?.status === 429) {
          console.log('Rate limit exceeded, waiting longer before retry...');
          await this.delay(RETRY_DELAY * 2);
          continue;
        }
        throw error;
      }
    }

    console.log(`\nCompleted fetching ${allAssets.length} assets in ${totalRequests} requests`);
    return allAssets;
  }

  processAssetData(assets) {
    console.log('Processing asset data...');
    
    return assets.map((tokenData, index) => {
      const asset = tokenData.asset;
      const floorAsk = tokenData.floorAsk;
      
      // Extract rarity information
      const rarityRank = asset.rarity && asset.rarity[0] ? asset.rarity[0].rank : null;
      const rarityProvider = asset.rarity && asset.rarity[0] ? asset.rarity[0].provider : null;
      
      // Extract attributes
      const attributes = asset.attributes || [];
      const attributesJson = JSON.stringify(attributes);
      
      // Extract market information (new API structure)
      const marketPrice = floorAsk?.price?.amount?.native || null;
      const currency = floorAsk?.price?.currency?.symbol || (asset.lastSalePrice?.currency?.symbol) || 'ETH';
      
      // Last sale price is directly on asset in new API
      const lastSalePrice = asset.lastSalePrice?.amount?.native || null;
      const lastSaleCurrency = asset.lastSalePrice?.currency?.symbol || 'ETH';

      return {
        tokenId: asset.tokenId || index + 1,
        name: asset.name || `Token #${asset.tokenId || index + 1}`,
        description: asset.description || '',
        rarityRank: rarityRank,
        rarityProvider: rarityProvider,
        attributes: attributesJson,
        imageUrl: asset.mediaV2?.main?.uri || '',
        marketPrice: marketPrice,
        currency: currency,
        lastSalePrice: lastSalePrice,
        lastSaleCurrency: lastSaleCurrency,
        owner: asset.owner,
        collectionAddress: this.collectionAddress,
        contractAddress: asset.contractAddress,
        chain: this.chain,
        standard: asset.standard,
        remainingSupply: asset.remainingSupply
      };
    });
  }

  async saveToCSV(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `me-rarity-${this.chain}-${this.collectionAddress}-${timestamp}.csv`;
    const filepath = path.join(this.outputDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'tokenId', title: 'Token ID' },
        { id: 'name', title: 'Name' },
        { id: 'description', title: 'Description' },
        { id: 'rarityRank', title: 'Rarity Rank' },
        { id: 'rarityProvider', title: 'Rarity Provider' },
        { id: 'attributes', title: 'Attributes (JSON)' },
        { id: 'imageUrl', title: 'Image URL' },
        { id: 'marketPrice', title: 'Market Price' },
        { id: 'currency', title: 'Currency' },
        { id: 'lastSalePrice', title: 'Last Sale Price' },
        { id: 'lastSaleCurrency', title: 'Last Sale Currency' },
        { id: 'owner', title: 'Owner' },
        { id: 'collectionAddress', title: 'Collection Address' },
        { id: 'contractAddress', title: 'Contract Address' },
        { id: 'chain', title: 'Chain' },
        { id: 'standard', title: 'Standard' },
        { id: 'remainingSupply', title: 'Remaining Supply' }
      ]
    });

    try {
      await csvWriter.writeRecords(data);
      console.log(`\n✅ Successfully saved ${data.length} records to: ${filepath}`);
      return filepath;
    } catch (error) {
      console.error('Error writing CSV file:', error);
      throw error;
    }
  }

  async run() {
    try {
      console.log('🚀 Starting Magic Eden Rarity CSV Fetcher');
      console.log(`📊 Collection: ${this.collectionAddress}`);
      console.log(`⛓️  Chain: ${this.chain}`);
      console.log(`⏱️  Rate limit: ${RATE_LIMIT_PER_MINUTE} requests/minute`);
      console.log(`⏳ Delay between requests: ${REQUEST_DELAY}ms`);
      console.log(`🛡️  Safety buffer: 20% (increased for larger collections)\n`);

      // Fetch all assets
      const assets = await this.fetchCollectionAssets();
      
      if (assets.length === 0) {
        console.log('❌ No assets found for this collection');
        return;
      }

      // Process the data
      const processedData = this.processAssetData(assets);
      
      // Save to CSV
      const csvPath = await this.saveToCSV(processedData);
      
      console.log('\n🎉 Process completed successfully!');
      console.log(`📁 Output file: ${csvPath}`);
      console.log(`📈 Total assets processed: ${processedData.length}`);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

// Run the fetcher
const fetcher = new MagicEdenRarityFetcher();
fetcher.run();
