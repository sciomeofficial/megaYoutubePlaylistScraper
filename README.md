# megaYoutubePlaylistScraper

[![Bintray](https://img.shields.io/badge/node-%3E%207.6-green.svg?)](https://github.com/sciomeofficial/megaYoutubePlaylistScraper)

A massive youtube api scraper that recurively grabs all the video ids out of a playlist for any search term.

Supports multiple API keys to be set for grabbing huge amounts of data. Program automatically counts and iterates through keys as quota is used.
Also supports multiple search terms to run over a period of time. Logs the data in JSON format to file.

## Tests: 
In 4 hours it grabbed around 7 million video ids from 180,000 playlists with 300k~ api calls 

**(1000 search term queue, 200 playlists per search term)**



# Setup:
### Grab API Key

https://developers.google.com/youtube/v3/getting-started

Basically create a new google project, add Youtube Data API v3 from services, create a credential.
That will give you an API Key, repeat step for more keys.

### Install


Run `npm install`

### Configure Settings
Add a list of your own API Key(s) in `/Queue/API_Keys_Queue.js`

Add a list of your own Search Terms to `/Queue/search_Queue.js`

Change `settings.js` for any extra settings.

### Run!

`node megaScrape.js`

It will start collecting data and dumping to file for every new search term it processes.
The data will be seperated be inside an enclosing array, seperated by index per search term.
In the form of:
```javascript
[{
   "playlistID": [videoId list],
   "playlistID": [videoId list]
},
{
   "playlistID": [videoId list],
   "playlistID": [videoId list]
}]
```
