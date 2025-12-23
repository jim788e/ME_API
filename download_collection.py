import requests
import os

# --- Configuration ---
# This is the base path up to the transaction ID:
BASE_URL = "https://siyk2jbu3nbzwedzxpuz75lk55cldjuxhbhabfn24nz3x3kkjgdq.arweave.net/kjCtJDTbQ5sQebvpn_Vq70Sxppc4TgCVuuNzu-1KSYc/"

# Set the range of NFTs. You MUST confirm the collection size (e.g., 1 to 10,000).
START_ID = 1
END_ID = 1212 

OUTPUT_DIR = "nft_collection_images"
FILE_EXTENSION = ".jpg" # CONFIRM the file extension is .png
# ---------------------

# Create the output directory if it doesn't exist
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
    print(f"Created output directory: {OUTPUT_DIR}\n")

print(f"Starting download from ID {START_ID} to {END_ID}...")
download_count = 0

for token_id in range(START_ID, END_ID + 1):
    file_name = str(token_id) + FILE_EXTENSION
    full_url = BASE_URL + file_name
    output_path = os.path.join(OUTPUT_DIR, file_name)
    
    try:
        # Stream the request to handle potentially large files
        response = requests.get(full_url, stream=True)
        
        # Check for success (Status 200) and content size
        if response.status_code == 200 and response.content:
            
            # Simple check to stop the script once files run out
            # Arweave gateways will often return a 404 or an empty/default response
            if 'image/' in response.headers.get('Content-Type', ''):
                with open(output_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"✅ Downloaded: {file_name}")
                download_count += 1
            else:
                 # Assume this is the end of the collection if the file exists but isn't an image
                 print(f"❌ Content for {file_name} is not an image (Content-Type: {response.headers.get('Content-Type')}). Stopping.")
                 break
        else:
            # Stop if a token ID is not found, assuming sequential numbering
            if download_count > 0:
                 print(f"\nStopped at ID {token_id} (Status {response.status_code}). Assuming sequential file list ended.")
            else:
                 print(f"❌ Failed to download {file_name} (Status {response.status_code}). Check START_ID or BASE_URL.")
            break
            
    except requests.exceptions.RequestException as e:
        print(f"⚠️ Error downloading {file_name}: {e}")
        break

print(f"\n--- Download Complete ---")
print(f"Successfully downloaded {download_count} files to the '{OUTPUT_DIR}' folder.")