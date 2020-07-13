console.clear();

const fs = require("fs");
const path = require("path");
const express = require("express");
const app = express();
const socket = require("socket.io");
const Frame = require("./Frame.js");
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
let frames = [], ips = [];
let syncTime;

fs.readFile("./frames.json", "utf8", (err, data) => {
    if(err) return console.log(`ERROR: ${err}`);
    ips = JSON.parse(data.toString());
});

io.sockets.on('connection', (socket) => {
    let frame = new Frame(socket, socket.request.connection._peername.address.replace("::ffff:", ""), "");
    frames.push(frame);
    
    ips.forEach(o => {
        if(o.ip === frame.getIp()) {
            frame.setId(o.name);
        }
    });
    
    console.log(`Frame connected -> ${frame.getId()}`);

    if(masterSocket === null) {
        masterSocket = socket;
        socket.emit('master');
        socket.emit('message', `time=0`);
        socket.emit('message', `videoState=play`);
        console.log(`Master changed -> ${frame.getId()}`);

    } else {
        socket.emit('message', `time=${syncTime + 0.63}`);
        socket.emit('message', `videoState=play`);
    }

    socket.on('sync', (currentTime) => {
        syncTime = currentTime;
    });

    socket.on('disconnect', () => {
        console.log(`Frame disconnected -> ${frame.getId()}`);
        frames.splice(frames.indexOf(socket), 1);
        if(socket === masterSocket) {
            if(frames.length > 0) {
                masterSocket = frames[frames.length - 1];
                masterSocket.emit('master');
                console.log(`Master changed -> ${frame.getId()}`);

            } else {
                masterSocket = null;
                console.log(`master=null`);
            }
        }
    });
});

const stdin = process.openStdin();
stdin.addListener('data', (data) => {
    const args = data.toString().replace("\r", "").replace("\n", "").toLowerCase().split(" ");

    if(args[0] === "sync") {
        if(masterSocket != null) {
            console.log(`Synchronizing all frames from current given sync time (master=${frames.find(frame => frame.getSocket() === masterSocket).getId()})`);
            frames.forEach(frame => {
                if(frame.getSocket() != masterSocket) {
                    frame.getSocket().emit('message', `time=${syncTime + 0.63}`);
                }
            });

        } else {
            console.log(`No master connection is active`);
        }

    } else if(args[0] === "reconnect") {
        if(frames.length != 0) {
            frames.forEach(frame => {
                frame.getSocket().emit('reconnect');
            });

        } else {
            console.log(`No active connections to reconnect!`);
        }
    
    } else if(args[0] == "master") {
        if(args.length === 1) {
            if(frames.length === 1) {
                return console.log("Currently there is only 1 frame connected!");
            } else {
                let frame = frames[frames.length - 1];
                masterSocket = frame.getSocket();
                masterSocket.emit('master');
                console.log(`The new master is ${frame.getId()}`);
            }

        } else {
            if(masterSocket != null) {
                console.log(`Currently the master is ${frames.find(frame => frame.getSocket() === masterSocket).getId()}`);
    
            } else {
                console.log("There is no master connected!");
            }
        }
    }
});
