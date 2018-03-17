var https = require("https");
var rp = require("request-promise");
var fs = require('fs');
const apiKeyQueue = require("./API_Keys_Queue");
const searchQueue = require("./Queue/mySearch");
console.log("Processing!.....")

console.log(searchQueue)

var responseArray = [];
const playlistLimit = 200;
const concurrentAmount = 20;

const quotaLimitPerKey = 1000000;
const quotaThreshhold = 950000;

const playlistSearchQuota = 102;
const playlistItemsQuota = 3;

var quotaUsage = 0;
var totalQuotaUsage = 0;
var APIIndexIterator = 0;
var current_API_Key = apiKeyQueue[APIIndexIterator];
var totalSongsRunTime = 0;
var searchIndex = searchQueue.length - 1;

function runRequest(url, params) {

    var uri = url + '?'
    var paramList = Object.keys(params);
    for (let i = 0; i < paramList.length; i++) {
        uri += i === 0 ? [paramList[i]] + '=' + params[paramList[i]] : '&' + [paramList[i]] + '=' + params[paramList[i]]
    }

    return rp({ uri, json: true });
}




console.time("Total Run Time");

fs.appendFile('message.json', "[", 'utf8', () => getPlaylists(searchQueue[searchIndex], true));

function addQuotaUsage(quotaType) {
    if (quotaType === "playlistSearchQuota") {
        quotaUsage += playlistSearchQuota
        totalQuotaUsage += playlistSearchQuota;
    }
    if (quotaType === "playlistItemsQuota") {
        quotaUsage += playlistItemsQuota
        totalQuotaUsage += playlistItemsQuota;
    }
    if (quotaUsage > quotaThreshhold) {
        APIIndexIterator++
        current_API_Key = apiKeyQueue[APIIndexIterator]

        quotaUsage = 0;
        console.log("Switching API key!")
    }
}


function getPlaylists(searchTerm, start, nextPageToken) {
    console.time("Process Songs")
    return new Promise((resolve, reject) => {
        var playlistSearchParams = {
            type: "playlist",
            q: searchTerm,
            part: "snippet",
            key: current_API_Key,
            maxResults: 50
        }
        if (nextPageToken) {
            playlistSearchParams.pageToken = nextPageToken;
        }


        runRequest('https://www.googleapis.com/youtube/v3/search', playlistSearchParams).then((response) => {


                addQuotaUsage("playlistSearchQuota");
                for (let i = 0; i < response.items.length; i++) {
                    responseArray.push({
                        url: response.items[i].id.playlistId,
                        title: response.items[i].snippet.title
                    })
                }
                if (!response.nextPageToken && start === false || responseArray.length >= playlistLimit) {
                    // console.log(responseArray);
                    // return fs.appendFile('message.json', JSON.stringify(responseArray), 'utf8', () => {});
                    return getAllSongs(responseArray);
                }
                if (response.nextPageToken) {
                    return getPlaylists(searchTerm, false, response.nextPageToken);
                }
            })
            .catch((err) => {

                console.log("Error in getting playlists for the search term " + searchTerm + " error is " + err);
                console.log(playlistSearchParams)
                
            })
    })
}


async function getAllSongs(playlistArray) {
    console.log("Found " + playlistArray.length + " playlists total for search term: " + searchQueue[searchIndex]);
    var totalCount = playlistArray.length;
    var finalData = {};

    function get50songs(playlistId, start, nextPageToken) {
        return new Promise((resolve, reject) => {
            let url = 'https://www.googleapis.com/youtube/v3/playlistItems';
            let searchParams = {
                part: 'snippet',
                key: current_API_Key,
                playlistId,
                maxResults: 50
            }
            if (nextPageToken) {
                searchParams.pageToken = nextPageToken;
            }

            runRequest(url, searchParams)
                .then((playlistItems) => {
                    addQuotaUsage("playlistItemsQuota");

                    for (let k = 0; k < playlistItems.items.length; k++) {
                        if (!finalData[playlistId] || !finalData[playlistId].videos) {

                            var schema = {
                                videos: []
                            }

                            finalData[playlistId] = schema;
                        }

                        finalData[playlistId].videos.push(playlistItems.items[k].snippet.resourceId.videoId);
                    }

                    if (playlistItems.nextPageToken) {
                        resolve(get50songs(playlistId, false, playlistItems.nextPageToken))
                    }

                    else if (!playlistItems.nextPageToken && start === true) {
                        
                        finalData[playlistId].amount = finalData[playlistId].videos.length;
                        totalCount--
                        console.log(totalCount + " left");

                        resolve();
                    }

                    else if (!playlistItems.nextPageToken && start === false) {

                        finalData[playlistId].amount = finalData[playlistId].videos.length;
                        finalData[playlistId].title = playlistArray.find((element) => {
                            return element.url === playlistId
                        }).title;

                        totalCount--
                        console.log(totalCount + " left");

                        resolve();
                    }

                })
                .catch((err) => {
                    console.log("Error in getting songs for the search term " + searchQueue[searchIndex] + " error is " + err)
                    // console.log("Going to retry search term " + searchQueue[searchIndex])
                    responseArray = [];
                    console.log(searchParams);
                    console.log(url);
                    
                    // return getPlaylists(searchQueue[searchIndex], true);
                })
        })
    }


    for (let i = 0; i < playlistLimit; i = i + concurrentAmount) {
        let promiseArray = [];

        var incSkip = 0;
            
        for (let k = 0; k < concurrentAmount; k++) {
            if(playlistArray.length > (i + k)){
                promiseArray.push(get50songs(playlistArray[i + k].url, true))
            }
            else{
                incSkip++;
            }
        }
        await Promise.all(promiseArray).catch((err) => console.log("My error is " + err));
        console.log("Taking next " + concurrentAmount + " to queue")
        if ((i + concurrentAmount) - incSkip === playlistArray.length) {


            var totalSongCount = 0;


            for (var key in finalData) {
                var getLength = finalData[key].amount;
                if (getLength === undefined) {
                    getLength = 0;
                }


                totalSongCount += getLength;
            }
            console.log("Total songs for", searchQueue[searchIndex], "is", totalSongCount)
            totalSongsRunTime = totalSongsRunTime + totalSongCount;

            // finalData


            var json = JSON.stringify(finalData);


            fs.appendFile('message.json', json + ",", 'utf8', () => {
                responseArray = [];
                console.timeEnd("Process Songs")
                console.log("Wrote to file!")
                console.log("---------------")
                searchIndex--
                // console.log("My search index is ", searchIndex)
                if (searchIndex >= 0) {

                    getPlaylists(searchQueue[searchIndex], true);
                }
                else {
                    fs.appendFile('message.json', "]", 'utf8', () => {
                        console.log("================")
                        console.timeEnd("Total Run Time");
                        console.log("Total songs in run time: " + totalSongsRunTime)
                        console.log("Total quota usage", totalQuotaUsage);
                        return console.log("COMPLETELY DONE!")
                    })
                }


            });
        }
    }
}

