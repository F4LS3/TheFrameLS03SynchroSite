class Frame {
    constructor(socket, ip, id) {
        this._socket = socket;
        this._ip = ip;
        this._id = id;
    }

    getSocket() {
        return this._socket;
    }

    getIp() {
        return this._ip;
    }

    getId() {
        return this._id;
    }

    setId(id) {
        this._id = id;
    }
}

module.exports = Frame;