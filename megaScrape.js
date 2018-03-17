const rp = require("request-promise");
const fs = require('fs');
const apiKeyQueue = require("./Queue/API_Keys_Queue");
const searchQueue = require("./Queue/search_Queue");
const settings = require("./settings");

const PLAYLIST_LIMIT = settings.PLAYLIST_LIMIT;
const CONCURRENT_AMOUNT = settings.CONCURRENT_AMOUNT;
const QUOTA_THRESHOLD = settings.QUOTA_THRESHOLD;
const WRITE_FILE_DIR = settings.WRITE_FILE_DIR;

// Youtube api quota costs for a task, found in official docs 
const PLAYLIST_SEARCH_QUOTA = 102;
const PLAYLIST_ITEMS_QUOTA = 3;

// API key list that will be switched from 
var CURRENT_API_ITERATION = 0;
var CURRENT_API_Key = apiKeyQueue[CURRENT_API_ITERATION];

var QUOTA_USAGE = 0;
var TOTAL_QUOTA_USAGE = 0;


// Encodes the url
function runRequest(url, params) {
    var uri = url + '?'
    var paramList = Object.keys(params);
    for (let i = 0; i < paramList.length; i++) {
        uri += i === 0 ? [paramList[i]] + '=' + params[paramList[i]] : '&' + [paramList[i]] + '=' + params[paramList[i]]
    }
    return rp({ uri, json: true });
}

// Splits an array for concurrent api calls queue
function chunk(array, size) {
    let chunked = [];
    for (let i = 0; i < array.length; i++) {
        const last = chunked[chunked.length - 1]


        if (!last || last.length === size) {
            chunked.push([array[i]])
        }
        else {
            last.push(array[i])
        }

    }
    return chunked;
}

// Rewrote write and append file to be a promise to be cleaner
function appendToMyFile(msg){
    return new Promise((resolve, reject) => {
        fs.appendFile(WRITE_FILE_DIR, msg, 'utf8', () => resolve());
    })
    
}

function replaceFileWrite(msg){
       return new Promise((resolve, reject) => {
        fs.writeFile(WRITE_FILE_DIR, msg, 'utf8', () => resolve());
    })
}

// Adds quota usage
function addQuotaUsage(quotaType) {
    if (quotaType === "playlistSearchQuota") {
        QUOTA_USAGE += PLAYLIST_SEARCH_QUOTA
        TOTAL_QUOTA_USAGE += PLAYLIST_SEARCH_QUOTA;
    }
    if (quotaType === "playlistItemsQuota") {
        QUOTA_USAGE += PLAYLIST_ITEMS_QUOTA;
        TOTAL_QUOTA_USAGE += PLAYLIST_ITEMS_QUOTA;
    }
    if (QUOTA_USAGE > QUOTA_THRESHOLD) {
        CURRENT_API_ITERATION++
        CURRENT_API_Key = apiKeyQueue[CURRENT_API_ITERATION]
        
        if(!CURRENT_API_Key){
            throw Error("Ran out of Api Keys, Make sure to supply more");
        }

        QUOTA_USAGE = 0;
        console.log("Switching API key!", CURRENT_API_ITERATION, 'out of', apiKeyQueue.length, 'keys');
    }
}

function getPlaylists(searchTerm, nextPageToken) {
    return new Promise((resolve, reject) => {
        let playlistIdCollection = [];

        function get50Playlists(searchTerm, nextPageToken) {
            return new Promise((resolve, reject) => {
                let url = 'https://www.googleapis.com/youtube/v3/search';
                var playlistSearchParams = {
                    type: "playlist",
                    q: searchTerm,
                    part: "snippet",
                    key: CURRENT_API_Key,
                    maxResults: 50
                }
                if (nextPageToken) {
                    playlistSearchParams.pageToken = nextPageToken;
                }


                addQuotaUsage("playlistSearchQuota");


                runRequest(url, playlistSearchParams)
                    .then(response => {

                        for (let i = 0; i < response.items.length; i++) {
                            if (response.items[i].id.playlistId) {
                                playlistIdCollection.push({ title: response.items[i].snippet.title, url: response.items[i].id.playlistId });
                            }

                        }
                        if (!response.nextPageToken || playlistIdCollection.length >= PLAYLIST_LIMIT) {
                            resolve(playlistIdCollection);
                        }
                        else if (response.nextPageToken) {
                            get50Playlists(searchTerm, response.nextPageToken).then(res => resolve(res)).catch(err => reject(err));
                        }

                    })
                    .catch(err => {
                        console.log("Error in get 50 playlists, " + searchTerm + " my params are", playlistSearchParams, "My error is ", err.message)
                        if (err.statusCode === 403) {
                            console.log("Your api key " + CURRENT_API_Key + " has run out of quota, program trusts that your quota usage is below 50000 on init run per key")
                        }
                        if (err.statusCode === 400) {
                            console.log("You can ignore this error most of the time, Youtube playlist most likely has been deleted in past, will ignore it")
                        }
                        return reject(err);
                    })
            });
        }
        get50Playlists(searchTerm).then((res) => resolve(res));
    })
}

function getPlaylistSongs(playlistId) {
    return new Promise((resolve, reject) => {
        let videoIdCollection = [];

        function get50Songs(playlistId, nextPageToken) {
            return new Promise((resolve, reject) => {
                let url = 'https://www.googleapis.com/youtube/v3/playlistItems';
                let searchParams = {
                    part: 'snippet',
                    key: CURRENT_API_Key,
                    playlistId,
                    maxResults: 50
                }
                if (nextPageToken) {
                    searchParams.pageToken = nextPageToken;
                }



                addQuotaUsage("playlistItemsQuota");


                runRequest(url, searchParams)
                    .then(response => {

                        for (let k = 0; k < response.items.length; k++) {
                            videoIdCollection.push(response.items[k].snippet.resourceId.videoId);
                        }
                        if (response.nextPageToken) {
                            get50Songs(playlistId, response.nextPageToken).then(res => resolve(res)).catch(err => reject(err));
                        }
                        if (!response.nextPageToken) {

                            resolve(videoIdCollection)

                        }
                    })
                    .catch(err => {

                        console.log("Error in get 50 songs, my params are", searchParams, "My error is ", err.message)

                        if (err.statusCode === 403) {
                            console.log("Your api key " + CURRENT_API_Key + " has run out of quota, program trusts that your quota usage is below 50000 on init run per key")
                        }
                        if (err.statusCode === 400) {
                            console.log("Consider yourself screwed if this runs lol!")
                        }
                        
                        return reject(err);

                    })
            });
        }
        get50Songs(playlistId).then(res => resolve({ videoIds: res, playlistId })).catch(() => resolve({ videoIds: [], playlistId }));
    });
}





function completeSearchTerm(searchTerm) {
    return new Promise((resolve, reject) => {
        getPlaylists(searchTerm)
            .then((playlistArray) => {
                // Collection object that will end up writing to the file
                var resultObj = {};
                console.log("Searching for " + searchTerm + " found " + playlistArray.length + " playlists!");
                var splitArray = chunk(playlistArray, CONCURRENT_AMOUNT);

                async function iterator() {
                    for (let i = 0; i < splitArray.length; i++) {
                        let promiseArray = [];
                        for (let k = 0; k < splitArray[i].length; k++) {

                            if (!splitArray[i][k].url) {
                                return console.log("In the iterator you supplied a non existant playlist url")
                            }

                            promiseArray.push(getPlaylistSongs(splitArray[i][k].url));
                        }
                        console.log("Grabbing " + splitArray[i].length + " items " + Object.keys(resultObj).length + " / " + playlistArray.length + ' done!')
                        let songdata = await Promise.all(promiseArray).catch(err => reject(err));
                        for (let j = 0; j < songdata.length; j++) {
                            resultObj[songdata[j].playlistId] = songdata[j].videoIds;
                        }
                    }

                    var json = JSON.stringify(resultObj);
                    
                    appendToMyFile(json).then(() => {
                        console.log("Done writing to disk", searchTerm, "is complete")
                        console.log("===================================================")
                        return resolve();
                    });

                }
                iterator();
            });
    })

}

async function main() {
    console.time("RunTime")
    // Start the array brackets
    await replaceFileWrite("[")

    for (let z = 0; z < searchQueue.length; z++) {
        console.log(z + ' / ' + searchQueue.length + ' search terms done!')

        console.log("API Key " + CURRENT_API_ITERATION + "/" + apiKeyQueue.length);
        console.log("Current Key Usage: " + QUOTA_USAGE + '/' + QUOTA_THRESHOLD)
        console.log("- - - - - - - - - - - - - - -")
        await completeSearchTerm(searchQueue[z])
        // Seperate the objects as if in an array except for last one
        // Like so -->  {  }, {  }, {  }
        if(z !== searchQueue.length){
            await appendToMyFile(',')
        }
        
    }
    // Close the array braces
    await appendToMyFile(']')

    console.log("Total quota used for project", TOTAL_QUOTA_USAGE)
    console.timeEnd("RunTime")
    console.log("Completely Done!")
}
main();







