console.clear();

const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const socket = require("socket.io");
const { SSL_OP_CISCO_ANYCONNECT } = require("constants");

app.get("/video", (req, res) => {
    const path = "./vid.mp4";
    const stat = fs.statSync(path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if(range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1]
        ? parseInt(parts[1], 10) : fileSize - 1;

        if(start >= fileSize) {
            res.status(416).send(`Requested range not satisfiable \n${start} >= ${fileSize}`);
            return;
        }

        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(path, {start, end});

        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4'
        };

        res.writeHead(206, head);
        file.pipe(res);

    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4'
        };

        res.writeHead(200, head);
        fs.createReadStream(path).pipe(res);
    }
});

const port = 30000;
let server = app.listen(port, () => {
    console.log("TheFrame LS03 SynchroServer started on port " + port);
    console.log(`Open a browser on http://192.168.145.65:${port}`);
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname + "/index.html"));
});

app.use(express.static('public'));

let io = socket(server);
let masterSocket = null;
let frames = [];
let syncTime;

io.sockets.on('connection', (socket) => {
    frames.push(socket);
    console.log(`Frame connected -> ${socket.id}`);

    if(masterSocket === null) {
        masterSocket = socket;
        socket.emit('master');
        socket.emit('message', `time=0`);
        socket.emit('message', `videoState=play`);

    } else {
        socket.emit('message', `time=${syncTime + 0.63}`);
    }

    socket.on('sync', (currentTime) => {
        syncTime = currentTime;
    });

    socket.on('disconnect', () => {
        console.log(`Frame disconnected -> ${socket.id}`);
        frames.splice(frames.indexOf(socket), 1);
        if(socket === masterSocket) {
            if(frames.length > 0) {
                masterSocket = frames[frames.length - 1];
                masterSocket.emit('master');

            } else {
                masterSocket = null;
            }
        }
    });

    /*socket.on('resSync', (currentTime) => {
        if(!(syncTime >= (currentTime - 1.5) && x <= (currentTime + 1.5))) {
            socket.emit('message', `time=${syncTime + 1}`);
        }
    });*/
});

/*setInterval(sync, 15000);

function sync() {
   if(masterSocket != null) {
        masterSocket.emit('message', 'videoState=pause');
        frames.forEach(frame => {
            if(frame != masterSocket) {
                frame.emit('message', `time=${syncTime + 0.63}`);
            }
        });
        masterSocket.emit('message', 'videoState=play');
    }
}*/

const stdin = process.openStdin();
stdin.addListener('data', (data) => {
    const args = data.toString().replace("\r", "").replace("\n", "").split(" ");

    if(args[0] === "sync") {
        if(masterSocket != null) {
            console.log(`Synchronizing all frames from current given sync time (master=${masterSocket.id})`);
            frames.forEach(frame => {
                if(frame != masterSocket) {
                    frame.emit('message', `time=${syncTime + 0.63}`);
                }
            });

        } else {
            console.log(`No master connection is active`);
        }
    }
});