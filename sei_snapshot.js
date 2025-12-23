require('dotenv').config();
const { ethers } = require('ethers');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

// Configuration
const RPC_URL = process.env.RPC_URL || 'https://evm-rpc.sei-apis.com';
// Use CONTRACT_ADDRESS if available, otherwise fallback to COLLECTION_ADDRESS (from index.js config)
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || process.env.COLLECTION_ADDRESS || '0x972170dCF963E1Dc7Bdd7BDf85A3Abb35Fb4F15d';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const OUTPUT_FILENAME = 'sei_snapshot.csv';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 5;
const DELAY_BETWEEN_BATCHES_MS = parseInt(process.env.DELAY_MS) || 1000;

// Minimal ABI for ERC721Enumerable
const ABI = [
    'function totalSupply() view returns (uint256)',
    'function tokenByIndex(uint256 index) view returns (uint256)',
    'function ownerOf(uint256 tokenId) view returns (address)'
];

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        console.warn(`Request failed, retrying in ${delay}ms... (${retries} retries left) - Error: ${error.message}`);
        await sleep(delay);
        return retry(fn, retries - 1, delay * 2);
    }
}

async function main() {
    console.log('🚀 Starting Sei NFT Snapshot...');
    console.log(`📡 RPC: ${RPC_URL}`);
    console.log(`📝 Contract: ${CONTRACT_ADDRESS}`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

    try {
        // 1. Get Total Supply
        console.log('📊 Fetching total supply...');
        const totalSupplyBig = await retry(() => contract.totalSupply());
        const totalSupply = Number(totalSupplyBig);
        console.log(`✅ Total Supply: ${totalSupply}`);

        if (totalSupply === 0) {
            console.log('⚠️ Collection is empty. Exiting.');
            return;
        }

        // 2. Setup CSV Writer
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filepath = path.join(OUTPUT_DIR, `sei_snapshot_${timestamp}.csv`);

        // Ensure output dir exists
        const fs = require('fs');
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        const csvWriter = createCsvWriter({
            path: filepath,
            header: [
                { id: 'index', title: 'Index' },
                { id: 'tokenId', title: 'Token ID' },
                { id: 'owner', title: 'Owner Address' }
            ]
        });

        console.log(`💾 Saving data to: ${filepath}`);
        console.log('⏳ Starting snapshot process. This may take a while...');

        const records = [];

        // 3. Determine Strategy
        console.log('🕵️ Determining fetch strategy...');
        let useEnumerable = false;
        let useSequential = false;

        try {
            console.log('   Testing tokenByIndex(0)...');
            await contract.tokenByIndex(0);
            useEnumerable = true;
            console.log('   ✅ Enumeration supported (tokenByIndex works)');
        } catch (e) {
            console.log(`   ⚠️ tokenByIndex failed: ${e.code || e.message}`);
        }

        if (!useEnumerable) {
            try {
                console.log('   Testing ownerOf(1)...');
                await contract.ownerOf(1);
                useSequential = true;
                console.log('   ✅ Sequential IDs likely (ownerOf(1) works)');
            } catch (e) {
                console.log(`   ⚠️ ownerOf(1) failed: ${e.code || e.message}`);
            }
        }

        if (!useEnumerable && !useSequential) {
            console.error('❌ Could not determine how to fetch tokens. Contract might not be Enumerable and IDs might not be sequential starting at 1.');
            return;
        }

        // 4. Iterate and Fetch
        for (let i = 0; i < totalSupply; i += BATCH_SIZE) {
            const batchPromises = [];

            for (let j = 0; j < BATCH_SIZE && (i + j) < totalSupply; j++) {
                const currentIndex = i + j;

                const p = (async () => {
                    try {
                        let tokenId;
                        let owner;

                        if (useEnumerable) {
                            tokenId = await retry(() => contract.tokenByIndex(currentIndex));
                            owner = await retry(() => contract.ownerOf(tokenId));
                        } else {
                            // Sequential Strategy
                            tokenId = currentIndex + 1; // Assuming 1-based start
                            owner = await retry(() => contract.ownerOf(tokenId));
                        }

                        return {
                            index: currentIndex,
                            tokenId: tokenId.toString(),
                            owner: owner
                        };
                    } catch (err) {
                        // If sequential, maybe gap?
                        if (!useEnumerable && (err.code === 'CALL_EXCEPTION' || err.message.includes('revert'))) {
                            console.warn(`   ⚠️ Token ID ${currentIndex + 1} might not exist (burned?)`);
                            return null;
                        }
                        console.error(`❌ Failed to fetch index ${currentIndex}: ${err.message}`);
                        return null;
                    }
                })();

                batchPromises.push(p);
            }

            const results = await Promise.all(batchPromises);

            const validResults = results.filter(r => r !== null);
            if (validResults.length > 0) {
                await csvWriter.writeRecords(validResults);
            }

            const progress = Math.min(i + BATCH_SIZE, totalSupply);
            const percent = ((progress / totalSupply) * 100).toFixed(2);
            process.stdout.write(`\r🔄 Progress: ${progress}/${totalSupply} (${percent}%)`);

            await sleep(DELAY_BETWEEN_BATCHES_MS);
        }

        console.log('\n\n✅ Snapshot complete!');
        console.log(`📁 File saved: ${filepath}`);

    } catch (error) {
        console.error('\n❌ Fatal Error:', error);
    }
}

main();
