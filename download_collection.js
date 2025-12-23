require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- Configuration from .env ---
const START_ID = parseInt(process.env.DOWNLOAD_START_ID || '1');
const END_ID = parseInt(process.env.DOWNLOAD_END_ID || '10');
const DOWNLOAD_IMAGES = process.env.DOWNLOAD_IMAGES === 'true';
const DOWNLOAD_JSON = process.env.DOWNLOAD_JSON === 'true';
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || '';
const JSON_BASE_URL = process.env.JSON_BASE_URL || '';
const CONCURRENCY = parseInt(process.env.DOWNLOAD_CONCURRENCY || '5');

const OUTPUT_DIR_IMAGES = path.join(__dirname, "nft_collection/images");
const OUTPUT_DIR_JSON = path.join(__dirname, "nft_collection/json");
const FILE_EXT_IMG = ".jpg";
const FILE_EXT_JSON = "";

// --- Validation ---
if (!IMAGE_BASE_URL && DOWNLOAD_IMAGES) {
    console.error("❌ Error: IMAGE_BASE_URL is missing in .env but DOWNLOAD_IMAGES is true.");
    process.exit(1);
}
if (!JSON_BASE_URL && DOWNLOAD_JSON) {
    console.error("❌ Error: JSON_BASE_URL is missing in .env but DOWNLOAD_JSON is true.");
    process.exit(1);
}

// --- Setup Directories ---
if (DOWNLOAD_IMAGES && !fs.existsSync(OUTPUT_DIR_IMAGES)) {
    fs.mkdirSync(OUTPUT_DIR_IMAGES, { recursive: true });
}
if (DOWNLOAD_JSON && !fs.existsSync(OUTPUT_DIR_JSON)) {
    fs.mkdirSync(OUTPUT_DIR_JSON, { recursive: true });
}

// --- Helper: Download Single File ---
async function downloadFile(url, outputPath, type) {
    try {
        if (fs.existsSync(outputPath)) {
            return { success: true, cached: true };
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: type === 'image' ? 'stream' : 'json',
            validateStatus: status => status === 200
        });

        if (type === 'image') {
            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } else {
            // JSON
            fs.writeFileSync(outputPath, JSON.stringify(response.data, null, 2));
        }

        return { success: true, cached: false };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// --- Worker ---
async function processId(id) {
    const results = [];

    // Image Task
    if (DOWNLOAD_IMAGES) {
        const fileName = `${id}${FILE_EXT_IMG}`;
        const url = `${IMAGE_BASE_URL}${fileName}`;
        const out = path.join(OUTPUT_DIR_IMAGES, fileName);

        const res = await downloadFile(url, out, 'image');
        results.push({ type: 'IMG', id, ...res });
    }

    // JSON Task
    if (DOWNLOAD_JSON) {
        // Handle flexible URL extension for JSON (e.g. "1" or "1.json")
        // But ALWAYS save as ".json" locally
        const remoteExt = process.env.JSON_URL_EXTENSION !== undefined ? process.env.JSON_URL_EXTENSION : '.json';
        const localExt = '.json';

        const remoteFileName = `${id}${remoteExt}`;
        const localFileName = `${id}${localExt}`;

        const url = `${JSON_BASE_URL}${remoteFileName}`;
        const out = path.join(OUTPUT_DIR_JSON, localFileName);

        const res = await downloadFile(url, out, 'json');
        results.push({ type: 'JSON', id, ...res });
    }

    return results;
}

// --- Main Execution ---
async function main() {
    console.log(`\n🚀 Starting Downloader`);
    console.log(`   Range: ${START_ID} -> ${END_ID}`);
    console.log(`   Modes: Images=${DOWNLOAD_IMAGES}, JSON=${DOWNLOAD_JSON}`);
    console.log(`   Concurrency: ${CONCURRENCY}\n`);

    const totalIds = END_ID - START_ID + 1;
    let completed = 0;
    const allIds = Array.from({ length: totalIds }, (_, i) => START_ID + i);

    // Simple Concurrency Control
    const activePromises = new Set();

    for (const id of allIds) {
        const p = processId(id).then(results => {
            activePromises.delete(p);
            completed++;

            // Log results
            const statusStr = results.map(r => {
                if (r.cached) return `[${r.type}:SKIP]`;
                if (r.success) return `[${r.type}:OK]`;
                return `[${r.type}:ERR]`;
            }).join(' ');

            process.stdout.write(`\rProgress: ${completed}/${totalIds} | ID ${id} ${statusStr}                  `);
        });

        activePromises.add(p);

        if (activePromises.size >= CONCURRENCY) {
            await Promise.race(activePromises);
        }
    }

    await Promise.all(activePromises);
    console.log(`\n\n✅ Done! Check the 'nft_collection' folder.`);
}

main();
