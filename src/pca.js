var fs = require('fs'),
    pad = require('pad-component'),
    f4js = require('fuse4js'),
    moment = require('moment'),
    async = require('async'),
    Table = require('cli-table'),
    ipc = require('./ipc').ipc,
    helpers = require('./helpers'),
    utils = require('./utils');

/* File type */
var S_IFMT    =  0170000,         /* type of file mask */
    S_IFDIR   =  0040000,         /* directory */
    S_IFREG   =  0100000,         /* regular */
    S_IFLNK   =  0120000;         /* symbolic link */

var config, ipcClt, ipcSrv;
var handlers = {};
handlers.getattr = function (path, cb) {
  var stat = {};
  var err = 0; // assume success
  helpers.lookup(path, false, function (info) {
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
        if (!helpers.existsDeleteSession(node.$sessionId)) {
          stat.mode = S_IFLNK | 0000555;
          stat.size = node.$newName ? node.$newName.length : node.$infos.name.length;
        }
        else {
          err = -2;
        } 
      }
      // Symlink to file name
      else if (info.name === node.$fileId) {
        if (!helpers.existsDeleteSession(node.$sessionId, node.$fileId)) {
          stat.mode = S_IFLNK | 0000555;
          stat.size = node.$infos.name.length;
        }
        else {
          err = -2;
        }
      }
      else {
        if (!helpers.existsDeleteSession(node.$sessionId, node.$fileId)) {
          stat.size = 4096;
          stat.mode = S_IFDIR | 0000755;
        }
        else {
          err = -2;
        }
      }

      break;

    case 'string':
      stat.size = node.length;
      stat.mode = S_IFREG | 0000444;

      if (typeof(info.node) === 'object' && info.node.$type === 'file') {
        if (!helpers.existsDeleteSession(info.node.$sessionId)) {
          stat.mode = S_IFREG | (helpers.existsDeleteSession(info.node.$sessionId) ? 0000400 : 0000000);
          stat.size = info.node.$infos.size;
        }
        else {
          err = -2;
        }
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

    // uid & gid
    stat.uid = process.getuid();
    stat.gid = process.getgid();

    cb(err, stat);
  });
};

/*
 * Handler for the readdir() system call.
 * path: the path to the file
 * cb: a callback of the form cb(err, names), where err is the Posix return code
 *     and names is the result in the form of an array of file names (when err === 0).
 */
handlers.readdir = function (path, cb) {
  var names = [];
  var err = 0; // assume success
  var callCb = true;
  helpers.lookup(path, true, function (info) {
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

        helpers.fetchSessionFiles(
          info.node.$sessionId,
          info.node.$newName || info.node.$infos.name,
          function () {
            cb(err, Object.keys(info.node.files));
          }
        );
      }
      else {
        for (var key in info.node) {
          if (!helpers.existsDeleteSession(key)) {
            names[i++] = key;
          }
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
};

handlers.readlink = function (path, cb) {
  var err = -2, name = '';

  helpers.lookup(path, path.split('/') <= 2, function (info) {
    if (info.node.$type === 'session' || info.node.$type === 'file') {
      err = 0;
      name = info.node.$newName || info.node.$infos.name;
    }

    return cb(err, name);
  });
};

handlers.chmod = function (path, mode, cb) {
  var err = -30;

  helpers.lookup(path, true, function (info) {
    if (info.node.$type === 'file') {
      err = 0;
      if (mode & 0000400) {
        helpers.addRestoreSession(info.node);
      }
      else {
        helpers.delRestoreSession(info.node.$sessionId);
      }
    }
    cb(err);
  });
};

handlers.unlink = function (path, cb) {
  helpers.lookup(path, true, function (info) {
    if (typeof(info.node.$type) !== 'undefined') {
      helpers.addDeleteSession(info.node);
    }
    cb(0);
  });
};

handlers.rmdir = handlers.unlink;

handlers.rename = function (src, dst, cb) {
  var err = 0; // assume success
  helpers.lookup(src, false, function (info) {
    if (info.node.$type === 'session') {
      helpers.addRenameSession(info.node, dst.split('/').pop());
    }

    cb(0);
  });
}

handlers.init = function (cb) {
  console.info('File system started at ' + config.mountPoint);
  console.info('To stop it, type this in another shell: fusermount -u ' +
              config.mountPoint + ' or umount ' + config.mountPoint);
  cb();
};

handlers.destroy = function (cb) {
  console.info('File system stopped');
  exports.exit();
  cb();
};

// Exports
exports.sshkey = function (_config, argv) {
  if (argv._.length < 2) {
    return console.error('Usage: pca sshkey file');
  }

  helpers.config = config = _config;
  helpers.fetchService(function(rest, err, result) {
    if (err) {
      return false;
    }

    this.sshkey = fs.readFileSync(argv._[1]).toString();
    this.$put(function(err) {
      if (!err) {
        console.info('Your SSH key has been updated.');
      }
      else {
        console.error('Error: ' + err);
      }
    });
  });
};

exports.tasks = function (_config, argv) {
  helpers.config = config = _config;
  helpers.restPca().tasks.$get(argv, function (err, tasks) {
    async.map(
      tasks,
      function (task, callback) {
        this[task].$get(task, callback);
      }.bind(this),
      function (error, tasks) {
        var table = new Table({
          head: ['id', 'function', 'status', 'todoDate', 'ipAddress'],
          colWidths: [6, 15, 12, 28, 16]
        });

        tasks.forEach(function (task) {
          table.push([
            task.id || 'unkown',
            task.function || 'unkown',
            task.status || 'unkown',
            task.todoDate || 'unkown',
            task.ipAddress || 'unkown'
          ]);
        });

        console.info(table.toString());
      }
    );
  });
};

exports.task = function (_config, argv) {
  if (argv._.length < 2) {
    return console.error('Usage: pca task id');
  }
  helpers.config = config = _config;

  helpers.restPca().tasks[argv._[1]].$get(function (err, task) {
    console.info(err || task);
  });
};

exports.ltasks = function (_config, argv) {
  helpers.config = config = _config;
  ipcClt = new ipc(config.socketPath).client();
  ipcClt
    .on('connect', function(conn) {
      ipcClt.write({ call: 'ltasks' });
    })
    .on('data', function(sessions) {
      ipcClt.destroy();
      var table = new Table({
          head: ['action', 'session id', 'session name'],
          colWidths: [10, 26, 44]
        });

      for (var fnc in sessions) {
        for (var sid in sessions[fnc]) {
          table.push([fnc, sid, sessions[fnc][sid]]);
        }
      }

      console.info(table.toString());
    });
};

exports.ltask = function (_config, argv) {
  if (argv._.length < 4) {
    return console.error('Usage: pca ltask (restore|rename|delete) (cancel|create) sessionId');
  }
  helpers.config = config = _config;
  ipcClt = new ipc(config.socketPath).client();
  ipcClt
    .on('connect', function(conn) {
      ipcClt.write({
        call: 'ltask',
        task: argv._[1],
        action: argv._[2],
        sessionId: argv._[3]
      });
    })
    .on('data', function(result) {
      ipcClt.destroy();
      console.info(result);
    });
};

exports.ltaskProcess = function (ltask, callback) {
  if (ltask.task !== 'restore' && ltask.task !== 'delete' && ltask.task !== 'rename') {
    return callback({ err: 400, result: 400 });
  }

  if (typeof(helpers.ltasks[ltask.task]) !== 'undefined' &&
      (ltask.sessionId === 'all' ||
      typeof(helpers.ltasks[ltask.task][ltask.sessionId]) !== 'undefined')) {
    if (ltask.action === 'cancel') {
      if (ltask.task === 'rename') {
        if (ltask.sessionId === 'all') {
          Object.keys(helpers.ltasks[ltask.task]).forEach(helpers.delRenameSession);
        }
        else {
          helpers.delRenameSession(ltask.sessionId);
        }
      }
      else {
        if (ltask.sessionId === 'all') {
          delete helpers.ltasks[ltask.task];
        }
        else {
          delete helpers.ltasks[ltask.task][ltask.sessionId];
        }
      }
      return callback({ err: null });
    }
    else if (ltask.action === 'create') {
      if (ltask.sessionId === 'all') {
        async.map(
          Object.keys(helpers.ltasks[ltask.task]),
          function (sessionId, callback) {
            helpers.createTask(ltask.task, sessionId, callback);
          },
          function (err, result) {
            delete helpers.ltasks[ltask.task];
            callback({ err: err, result: utils.clone(result) });
          }
        );
      }
      else {
        helpers.createTask(ltask.task, ltask.sessionId, function (err, result) {
          delete helpers.ltasks[ltask.task][ltask.sessionId];
          callback({ err: err, result: utils.clone(result) });
        });
      }
    }
  }
  else {
    return callback({ err: 404, result: 404 });
  }
};

exports.mount = function (_config, argv) {
  if (argv._.length < 2) {
    return console.error('Usage: pca mount directory');
  }

  helpers.config = config = _config;
  config.mountPoint = argv._[1];
  config.debug = argv.debug || false;

  // Listening for ltasks
  if (fs.existsSync(config.socketPath)) {
    return console.error('Another PCA is already mounted or the UNIX socket '
      + config.socketPath + ' was not removed properly.');
  }

  ipcSrv = new ipc(config.socketPath).server();
  ipcSrv.on('data', function(data, conn) {
    if (data.call === 'ltasks') {
      conn.write(utils.clone(helpers.ltasks));
      conn.end();
    }
    else if (data.call === 'ltask') {
      exports.ltaskProcess(data, function (result) {
        conn.write(result);
        conn.end();
      });
    }
  });

  // Fuse
  helpers.fetchService(function(rest, err, result) {
    if (err) {
      return console.error('Error:', err);
    }

    try {
      f4js.start(config.mountPoint, handlers, config.debug);
    } catch (e) {
      console.error('Exception when starting file system: ' + e);
    }
  });
};

// Graceful exit
exports.exit = function () {
  if (typeof(ipcSrv) !== 'undefined') {
    ipcSrv.close();
  }
  process.exit(0);
};

process
  .on('SIGINT', exports.exit)
  .on('SIGTERM', exports.exit);