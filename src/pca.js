var fs = require('fs'),
    f4js = require('fuse4js'),
    moment = require('moment'),
    helpers = require('./helpers');

var config;
var handlers = {
  getattr: function (path, cb) {
    var stat = {};
    var err = 0; // assume success
    helpers.lookup(path, function (info) {
      var node = info.node;

      if (typeof(node) !== 'undefined' && node.$type === 'file' &&
          info.name !== node.$fileId) {
        node =  '';
      }

      switch (typeof node) {
      case 'undefined':
        err = -2; // -ENOENT
        break;

      case 'object':
        // Symlink to session name
        if (info.name === node.$sessionId) {
          stat.mode = 0120555; // symlink with 555
          stat.size = node.$infos.name.length;
        }
        // Symlink to file name
        else if (info.name === node.$fileId) {
          stat.mode = 0120555; // symlink with 555
          stat.size = node.$infos.name.length;
        }
        else {
          stat.size = 4096;   // standard size of a directory
          stat.mode = 040555; // directory with 555
        }

        break;

      case 'string':
        stat.size = node.length;
        stat.mode = 0100444; // file with 444

        if (typeof(info.node) === 'object' && info.node.$type === 'file') {
          stat.mode = 0100000;
          stat.size = info.node.$infos.size;
        }
        break;

      default:
        break;
      }

      // mtime
      node = info.node;
      if (typeof(node) === 'object' && typeof(node.$infos) === 'object') {
        var date;
        if (typeof(node.$infos.endDate) === 'string') {
          date = node.$infos.endDate;
        }
        else if (node.$type === 'file') {
          date = helpers.data[node.$sessionId].$infos.endDate;
        }

        if (typeof(date) !== 'undefined') {
          stat.ctime = stat.atime = stat.mtime = moment(date).toDate();
        }
      }

      cb(err, stat);
    });
  },

  /*
   * Handler for the readdir() system call.
   * path: the path to the file
   * cb: a callback of the form cb(err, names), where err is the Posix return code
   *     and names is the result in the form of an array of file names (when err === 0).
   */
  readdir: function (path, cb) {
    var names = [];
    var err = 0; // assume success
    var callCb = true;
    helpers.lookup(path, function (info) {
      switch (typeof info.node) {
      case 'undefined':
        err = -2; // -ENOENT
        break;

      case 'string': // file
        err = -22; // -EINVAL
        break;

      case 'object': // directory
        var i = 0;

        // Session
        if (typeof(info.node) === 'object' && info.node.$type === 'session') {
          callCb = false;

          helpers.fetchSessionFiles(info.node.$sessionId, info.node.$infos.name, function () {
            for (var key in info.node.files) {
              names[i++] = key;
            }

            cb(err, names);
          });
        }
        else {
          for (var key in info.node) {
            names[i++] = key;
          }
        }
        break;

      default:
        break;
      }

      if (callCb) {
        cb(err, names);
      }
    });
  },

  /*
   * Handler for the open() system call.
   * path: the path to the file
   * flags: requested access flags as documented in open(2)
   * cb: a callback of the form cb(err, [fh]), where err is the Posix return code
   *     and fh is an optional numerical file handle, which is passed to subsequent
   *     read(), write(), and release() calls.
   */
  open: function (path, flags, cb) {
    var err = 0;
    helpers.lookup(path, function (info) {
      if (typeof info.node === 'undefined') {
        err = -2; // -ENOENT
      }

      cb(err);
    });
  },

  /*
   * Handler for the read() system call.
   * path: the path to the file
   * offset: the file offset to read from
   * len: the number of bytes to read
   * buf: the Buffer to write the data to
   * fh:  the optional file handle originally returned by open(), or 0 if it wasn't
   * cb: a callback of the form cb(err), where err is the Posix return code.
   *     A positive value represents the number of bytes actually read.
   */
  read: function (path, offset, len, buf, fh, cb) {
    var err = 0; // assume success
    helpers.lookup(path, function (info) {
      var file = info.node;
      var maxBytes;
      var data;

      switch (typeof file) {
      case 'undefined':
        err = -2; // -ENOENT
        break;

      case 'object': // directory
        err = -1; // -EPERM
        break;

      case 'string': // a string treated as ASCII characters
        if (offset < file.length) {
          maxBytes = file.length - offset;
          if (len > maxBytes) {
            len = maxBytes;
          }
          data = file.substring(offset, len);
          buf.write(data, 0, len, 'ascii');
          err = len;
        }
        break;

      default:
        break;
      }
      cb(err);
    });
  },
  readlink: function (path, cb) {
    var err = -2, name = '';

    helpers.lookup(path, function (info) {
      if (info.node.$type === 'session' || info.node.$type === 'file') {
        err = 0;
        name = info.node.$infos.name;
      }

      return cb(err, name);
    });
  },
  write: function (path, cb) {
    cb(-30); // EROFS
  },
  release: function (path, fh, cb) {
    cb(0);
  },
  create: function (path, cb) {
    cb(-30); // EROFS
  },
  unlink: function (path, cb) {
    cb(-30); // EROFS
  },
  rename: function (path, cb) {
    cb(-30); // EROFS
  },
  mkdir: function (path, cb) {
    cb(-30); // EROFS
  },
  rmdir: function (path, cb) {
    cb(-30); // EROFS
  },
  init: function (cb) {
    console.log('File system started at ' + config.mountPoint);
    console.log('To stop it, type this in another shell: fusermount -u ' + config.mountPoint + ' or umount ' + config.mountPoint);
    cb();
  },
  destroy: function (cb) {
    console.log('File system stopped');
    cb();
  }
};

// Exports
exports.sshkey = function (_config, filekey) {
  helpers.config = config = _config;
  helpers.fetchService(function(rest, success, result) {
    if (!success) {
      return false;
    }

    this.sshkey = fs.readFileSync(filekey).toString();
    this.$put(function(success, error) {
      if (success) {
        console.info('Your SSH key has been updated.');
      }
      else {
        console.error('Error: ' + error);
      }
    });
  });
};

exports.mount = function (_config, mountPoint) {
  helpers.config = config = _config;
  config.mountPoint = mountPoint;
  helpers.fetchService(function(rest, success, result) {
    if (!success) {
      return false;
    }

    try {
      f4js.start(mountPoint, handlers, config.debug !== undefined);
    } catch (e) {
      console.log('Exception when starting file system: ' + e);
    }
  });
};