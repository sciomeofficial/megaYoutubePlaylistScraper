var https = require("https");
var rp = require("request-promise");

console.log("Processing!.....")

function runRequest(url, params) {
    var uri = url + '?'
    var paramList = Object.keys(params);
    for (let i = 0; i < paramList.length; i++) {
        uri += i === 0 ? [paramList[i]] + '=' + params[paramList[i]] : '&' + [paramList[i]] + '=' + params[paramList[i]]
    }
    console.log(uri)
    return rp({ uri, json: true });


}

var responseArray = [];

getPlaylists("pop", true);

function getPlaylists(searchTerm, start, nextPageToken) {
    return new Promise((resolve, reject) => {
        var playlistSearchParams = {
            type: "playlist",
            q: searchTerm,
            part: "snippet",
            key: "AIzaSyBW8CE2V8yKiznYSmLi4EShTohuDiHyZM4",
            maxResults: 50
        }
        if (nextPageToken) {
            playlistSearchParams.pageToken = nextPageToken;
        }

        runRequest('https://www.googleapis.com/youtube/v3/search', playlistSearchParams).then((response) => {

            for (let i = 0; i < response.items.length; i++) {

                responseArray.push({
                    url: response.items[i].id.playlistId,
                    title: response.items[i].snippet.title
                })
            }
            if (!response.nextPageToken && start === false || responseArray.length >= 50) {
                // console.log(responseArray);
                return getAllSongs(responseArray);
            }
            if (response.nextPageToken) {
                return getPlaylists(searchTerm, false, response.nextPageToken);
            }





        })
    })
}

async function getAllSongs(playlistArray) {
    console.log(playlistArray)
    var finalData = [];
    for (let i = 0; i < playlistArray.length; i++) {
        async function get5Songs(nextPageToken) {

            let videosLibrary;
            let url = 'https://www.googleapis.com/youtube/v3/playlistItems';
            let searchParams = {
                part: 'snippet',
                key: "AIzaSyBW8CE2V8yKiznYSmLi4EShTohuDiHyZM4",
                playlistId: playlistArray[i].url
            }

            if (nextPageToken) {
                searchParams.pageToken = nextPageToken;
            }

            var playlistItems = await runRequest(url, searchParams)

            for (let k = 0; k < playlistItems.items.length; k++) {

                playlistArray[i].videos.push(playlistItems.items[k].snippet.resourceId.videoId)

            }

            if (playlistItems.nextPageToken) {
                // console.log("next page", playlistItems.nextPageToken)
                return get5Songs(playlistItems.nextPageToken)
            }
            if (!playlistItems.nextPageToken) {
                console.log(i)
                finalData.push(playlistArray[i])
                nextPageToken = null;
                if (i + 1 === playlistArray.length) {
                    var json = JSON.stringify(finalData);
                    var fs = require('fs');
                fs.writeFile('message.json', json, 'utf8', () => console.log("Done"));
                    return;
                }
            }

        }
        await get5Songs();
    }

}
