// function timeout(ms) {
//     return new Promise(resolve => setTimeout(() => resolve("My data!"), ms));
// }



// async function hello() {
//     for (let i = 0; i < 10; i++) {
//         var l = await timeout(2000)
//         console.log(l)
//     }

// }

// hello();

const fs = require('fs');

fs.appendFileSync('message.json', JSON.stringify({
    data: "Entry",
    age: 22,
    list: [2,3,4,5,6]
}));
