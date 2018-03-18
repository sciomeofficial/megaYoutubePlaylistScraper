module.exports = {
    
    // How many playlists to find per search term, google caps out at around 500-600 results depending on api
    PLAYLIST_LIMIT: 1000,
    
    // How many concurrent playlists have their videos pulled out at once, 100+ might get buggy since it may be too many calls per second
    CONCURRENT_AMOUNT: 50,
    
    // How much until the quota counter will go to the next api key
    // QUOTA limit per key by youtube by default is 1000000 per day
    QUOTA_THRESHOLD: 950000,
    
    // Where do you want the file written to?
    WRITE_FILE_DIR: './fileRes/result.json'
}