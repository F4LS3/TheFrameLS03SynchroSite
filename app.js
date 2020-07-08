console.clear();

const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const socket = require("socket.io");

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
        socket.emit('message', `time=${syncTime + 0.2758}`);
        socket.emit('message', `videoState=play`);
    }

    socket.on('sync', (currentTime) => {
        syncTime = currentTime;
    });

    socket.on('disconnect', () => {
        if(socket == masterSocket) {
            frames.splice(frames.indexOf(masterSocket), 1);
            if(frames.length > 0) {
                masterSocket = frames[frames.length - 1];
                masterSocket.emit('master');
            
            } else {
                masterSocket = null;
            }
        }
    });
});