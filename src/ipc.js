var net = require('net'),
    lazy = require('lazy');

function ipc(sockPath) {
  this.sockPath = sockPath;
}

ipc.prototype.client = function () {
  this.socket = net.createConnection(this.sockPath);
  this._parseStream(this.socket);
  return this.socket;
};

ipc.prototype.server = function () {
  var _this = this;
  this.socket = net.createServer(function(c) {
    _this._parseStream(c);
  });

  var umask = process.umask(0077);
  this.socket.listen(this.sockPath, function() {
    process.umask(umask);
  });

  return this.socket;
};

ipc.prototype._parseStream = function (c) {
  var _this = this;
  lazy(c)
    .lines
    .map(String)
    .forEach(this._onData.bind(this, c));

  var write = c.write;
  c.write = function() {
    if (c.writable) {
      arguments[0] = JSON.stringify(arguments[0]) + '\n';
      return write.apply(c, arguments);
    }
    else {
      this.emit('warn', new Error('Connection is not writable.'));
    }
  };
};

ipc.prototype._onData = function (c, data) {
  try {
    this.socket.emit('data', JSON.parse(data), c);
  } catch(e) { console.log(e); }
};

exports.ipc = ipc;