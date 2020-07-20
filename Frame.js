class Frame {
    constructor(ip, id) {
        this._ip = ip;
        this._id = id;
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