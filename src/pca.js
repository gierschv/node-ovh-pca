var fs = require('fs'),
    pad = require('pad-component'),
    f4js = require('fuse4js-gierschv'),
    moment = require('moment'),
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
        if (!helpers.existsDeleteFile(node.$sessionId)) {
          stat.mode = S_IFLNK | 0000555;
          stat.size = node.$infos.name.length;
        }
        else {
          err = -2;
        } 
      }
      // Symlink to file name
      else if (info.name === node.$fileId) {
        if (!helpers.existsDeleteFile(node.$sessionId, node.$fileId)) {
          stat.mode = S_IFLNK | 0000555;
          stat.size = node.$infos.name.length;
        }
        else {
          err = -2;
        }
      }
      else {
        if (!helpers.existsDeleteFile(node.$sessionId, node.$fileId)) {
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
        if (!helpers.existsDeleteFile(info.node.$sessionId, info.node.$fileId)) {
          stat.mode = S_IFREG | (helpers.existsRestoreFile(info.node.$sessionId, info.node.$fileId) ? 0000400 : 0000000);
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
            if (!helpers.existsDeleteFile(info.node.$sessionId, key)) {
              names[i++] = key;
            }
          }

          cb(err, names);
        });
      }
      else {
        for (var key in info.node) {
          if (!helpers.existsDeleteFile(key)) {
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

  helpers.lookup(path, function (info) {
    if (info.node.$type === 'session' || info.node.$type === 'file') {
      err = 0;
      name = info.node.$infos.name;
    }

    return cb(err, name);
  });
};

handlers.chmod = function (path, mode, cb) {
  var err = -30;

  helpers.lookup(path, function (info) {
    if (info.node.$type === 'file') {
      err = 0;
      if (mode & 0000400) {
        helpers.addRestoreFile(info.node);
      }
      else {
        helpers.delRestoreFile(info.node.$sessionId, info.node.$fileId);
      }
    }
    cb(err);
  });
};

handlers.release = function (path, fh, cb) {
  cb(0);
};

handlers.unlink = function (path, cb) {
  helpers.lookup(path, function (info) {
    if (typeof(info.node.$type) !== 'undefined') {
      helpers.addDeleteFile(info.node);
    }
    cb(0);
  });
};

handlers.rmdir = handlers.unlink;

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
  helpers.fetchService(function(rest, success, result) {
    if (!success) {
      return false;
    }

    this.sshkey = fs.readFileSync(argv._[1]).toString();
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

exports.tasks = function (_config, argv) {
  helpers.config = config = _config;
  helpers.restPca().tasks.$get({ function: argv.function }, function (success, tasks) {
    console.info('id        function       status    todoDate                 ipAddress');
    console.info('--        --------       ------    --------                 ---------');
    for (var i = 0 ; i < tasks.length ; ++i) {
      this[tasks[i]].$get(function (success, task) {
        if (success) {
          console.info(pad.right(task.id, 10) +
                       pad.right(task.function, 15) +
                       pad.right(task.status, 10) +
                       pad.right(task.todoDate, 25) + task.ipAddress);
        }
      });
    }
  });
};

exports.task = function (_config, argv) {
  if (argv._.length < 2) {
    return console.error('Usage: pca task id');
  }
  helpers.config = config = _config;

  helpers.restPca().tasks[argv._[1]].$get(function (success, task) {
    console.info(task);
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
      console.info('action    session id                    session name                  file id                       file name');
      console.info('------    ----------                    ------------                  -------                       ---------');

      var sid, fid;
      for (sid in sessions.restore) {
        for (fid in sessions.restore[sid]) {
          if (fid[0] !== '$') {
            console.info(pad.right('restore', 10) +
                         pad.right(sid, 30) + pad.right(sessions.restore[sid].$name, 30) +
                         pad.right(fid, 30) + sessions.restore[sid][fid].$infos.name);
          }
        }
      }

      for (sid in sessions.delete) {
        if (typeof(sessions.delete[sid]) === 'string') {
          console.info(pad.right('delete', 10) +
                       pad.right(sid, 30) + pad.right(sessions.delete[sid], 30) +
                       pad.right('*', 30) + '*');
        }
        else {
          for (fid in sessions.delete[sid]) {
            if (fid[0] !== '$') {
              console.info(pad.right('delete', 10) +
                           pad.right(sid, 30) + pad.right(sessions.delete[sid].$name, 30) +
                           pad.right(fid, 30) + sessions.delete[sid][fid].$infos.name);
            }
          }
        }
      }
    });
};

exports.ltask = function (_config, argv) {
  if (argv._.length < 4) {
    return console.error('Usage: pca ltask (restore|delete) (cancel|create) sessionId');
  }
  helpers.config = config = _config;
  ipcClt = new ipc(config.socketPath).client();
  ipcClt
    .on('connect', function(conn) {
      ipcClt.write({ call: 'ltask', task: argv._[1], action: argv._[2], sessionId: argv._[3] });
    })
    .on('data', function(result) {
      ipcClt.destroy();
      console.info(result);
    });
};

exports.ltaskProcess = function (ltask, callback) {
  if (ltask.task !== 'restore' && ltask.task !== 'delete') {
    return callback({ success: false, result: 400 });
  }

  if (typeof(helpers.ltasks[ltask.task]) !== 'undefined' &&
      typeof(helpers.ltasks[ltask.task][ltask.sessionId]) !== 'undefined') {
    if (ltask.action === 'cancel') {
      delete helpers.ltasks[ltask.task][ltask.sessionId];
      return callback({ success: true });
    }
    else if (ltask.action === 'create') {
      if (typeof(helpers.ltasks[ltask.task][ltask.sessionId]) === 'string' &&
          ltask.task === 'delete') {
        helpers.createTaskDeleteSession(ltask.sessionId, function (success, result) {
          delete helpers.ltasks[ltask.task][ltask.sessionId];
          callback({ success: success, result: utils.clone(result) });
        });
      }
      else {
        var files = [];
        for (var fid in helpers.ltasks[ltask.task][ltask.sessionId]) {
          if (fid[0] !== '$') {
            files.push(fid);
          }
        }

        helpers.createTask(ltask.task, ltask.sessionId, files, function (success, result) {
          delete helpers.ltasks[ltask.task][ltask.sessionId];
          callback({ success: success, result: utils.clone(result) });
        });
      }
    }
  }
  else {
    return callback({ success: false, result: 404 });
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
  helpers.fetchService(function(rest, success, result) {
    if (!success) {
      return false;
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

process.on('SIGINT', exports.exit)
       .on('SIGTERM', exports.exit);