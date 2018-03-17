var fs = require('fs');
var lineReader = require('readline').createInterface({
  input: fs.createReadStream('genresList.txt')
});

var myArr = [];

lineReader.on('line', function(line) {
  myArr.push(line)
});

lineReader.on('close', () => {
  console.log(myArr)
  var json = JSON.stringify(myArr);
  fs.writeFile('../Queue/search_Queue.js', "module.exports = " + json + ",", 'utf8', () => {
    console.log("Done Writing to Disk")
  })
});
