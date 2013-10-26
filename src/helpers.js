var ovh = require('ovh'),
    async = require('async');
var rest, restPca, restTimeout = 3000, freshSessions, freshLimit = 120000;

exports.freshSessions;
exports.config = {};
exports.data = {};
exports.ltasks = {};
exports.lookup = function (path, fetchFiles, callback) {
  var cur = null, previous = null, name = '';
  if (path === '/') {
    exports.fetchSessions(function () {
      callback({ node: exports.data, parent: null, name: '' });
    });
  }
  else {
    var comps = path.split('/');
    var lookupProcess = function () {
      for (var i = 0; i < comps.length; i++) {
        previous = cur;
        if (i === 0) {
          cur = exports.data;
        }
        else if (typeof(cur) !== 'undefined') {
          name = comps[i];
          cur = cur[name];

          if (typeof(cur) === 'undefined') {
            if (previous.$type === 'session' &&
                typeof(previous.files[name]) !== 'undefined') {
              cur = previous.files[name];
              previous = previous.previous;
            }
            else {
              break;
            }
          }
        }
      }
      callback({ node: cur, parent: previous, name: name });
    };

    if (fetchFiles) {
      exports.fetchSessionFiles(comps[1], comps[1], lookupProcess);
    }
    else {
      lookupProcess();
    }
  }
};

exports.restPca = function () {
  exports.config.apis = ['cloud'];
  rest = rest || ovh(exports.config);
  return rest.cloud[exports.config.passportServiceName].pca[exports.config.pcaServiceName];
};

exports.fetchService = function (callback) {
  restPca = restPca || exports.restPca();
  restPca.$get(function(err, result) {
    if (err) {
      console.error('Unable to fetch service information. Check your configuration.');
      console.error('Error: ' + err);
    }

    callback.call(this, rest, err, result);
  });
};

exports.fetchSessions = function (callback) {
  if (typeof(freshSessions) !== 'undefined' && new Date() - freshSessions < freshLimit) {
    return callback(null);
  }

  freshSessions = new Date();
  restPca = restPca || exports.restPca();
  restPca.sessions.$get(function (err, sessions) {
    if (err) {
      console.error('Unable to fetch the sessions list:' + err);
      callback(true);
    }
    else {
      exports.data = {};
      if (sessions.length === 0) {
        callback(null);
      }
      else {
        async.each(
          sessions,
          function (session, callback) {
            this[session].$get(function (err, session) {
              if (err) {
                return callback(err);
              }

              exports.data[session.name] = {
                $type: 'session',
                $sessionId: session.id,
                $infos: session,
                files: {}
              };

              exports.data[session.id] = exports.data[session.name];
              callback(null);
            });
          }.bind(this),
          function (err) {
            if (err) {
              console.error('Unable to fetch infos of session: ' + err);
            }
            callback(null);
          }
        );
      }
    }
  });

  return true;
};

exports.fetchSessionFiles = function (sessionId, sessionName, callback) {
  if (typeof(exports.data[sessionName]) === 'undefined') {
    return callback(false);
  }
  if (Object.keys(exports.data[sessionName].files).length > 0 &&
      new Date() - freshSessions < freshLimit) {
    return callback(true);
  }

  sessionId = exports.data[sessionName].$sessionId;
  restPca = restPca || exports.restPca();

  restPca.sessions[sessionId].files.$get(function (err, files) {
    if (err) {
      console.error('Unable to fetch the session files of session ' + sessionId + ':' + err);
      callback(false);
    }
    else {
      async.each(
        files,
        function (file, callback) {
          this[file].$get(function (err, file) {
            if (err) {
              return callback(err);
            }

            var dirs = file.name.split('/');
            var previous = exports.data[sessionName].files;
            for (i = 0; i < dirs.length; i++) {
              if (typeof(previous[dirs[i]]) === 'undefined') {
                previous[dirs[i]] = {};
              }

              if (i + 1 < dirs.length) {
                previous = previous[dirs[i]];
              }
            }

            previous[dirs[i - 1]] = {
              $type: 'file',
              $fileId: file.id,
              $sessionId: sessionId,
              $infos: file
            };

            exports.data[sessionName].files[file.id] = previous[dirs[i - 1]];
            callback(null);
          });
        }.bind(this),
        function (err) {
          if (err) {
            console.error('Unable to fetch infos of file:', err);
          }
          callback(true);
        }
      );
    }
  });

  return true;
};

// Tasks
exports.createTask = function (fnc, sessionId, callback) {
  restPca = restPca || exports.restPca();
  
  if (fnc === 'restore') {
    restPca.sessions[sessionId].restore.$post(callback);
  }
  else if (fnc === 'delete') {
    restPca.sessions[sessionId].$delete(callback);
  }
  else if (fnc === 'rename') {
    freshSessions = 0;
    restPca.sessions[sessionId].$put({ name: exports.data[sessionId].$newName }, callback);
  }
  else {
    callback(null);
  }
};

// Restore
exports.addRestoreSession = function (node) {
  exports.ltasks.restore = exports.ltasks.restore || {};

  if (typeof(exports.ltasks.restore[node.$sessionId]) === 'undefined') {
    exports.ltasks.restore[node.$sessionId] = exports.data[node.$sessionId].$infos.name;
  }
};

exports.existsRestoreSession = function (sessionId) {
  return typeof(exports.ltasks.restore) !== 'undefined' &&
         typeof(exports.ltasks.restore[sessionId]) !== 'undefined';
};

exports.delRestoreSession = function (sessionId) {
  if (typeof(exports.ltasks.restore) !== 'undefined' &&
      typeof(exports.ltasks.restore[sessionId]) !== 'undefined') {
    delete exports.ltasks.restore[sessionId];
  }
};

// Delete
exports.addDeleteSession = function (node) {
  exports.ltasks.delete = exports.ltasks.delete || {};
  if (node.$type === 'session') {
    exports.ltasks.delete[node.$sessionId] = exports.data[node.$sessionId].$infos.name;
  }
};

exports.existsDeleteSession = function (sessionId) {
  if (typeof(exports.data[sessionId]) === 'undefined') {
    return false;
  }

  sessionId = exports.data[sessionId].$sessionId;
  return typeof(exports.ltasks.delete) !== 'undefined' &&
         typeof(exports.ltasks.delete[sessionId]) !== 'undefined';
};

// Rename
exports.addRenameSession = function (node, dst) {
  exports.ltasks.rename = exports.ltasks.rename || {};

  if (typeof(exports.ltasks.rename[node.$sessionId]) === 'undefined') {
    exports.ltasks.rename[node.$sessionId] = dst;
    exports.data[node.$sessionId].$newName = dst;
    exports.data[dst] = exports.data[node.$infos.name];
    delete exports.data[node.$infos.name];
  }
};

exports.existsRenameSession = function (sessionId) {
  return typeof(exports.ltasks.rename) !== 'undefined' &&
         typeof(exports.ltasks.rename[sessionId]) !== 'undefined';
};

exports.delRenameSession = function (sessionId) {
  if (typeof(exports.ltasks.rename) !== 'undefined' &&
      typeof(exports.ltasks.rename[sessionId]) !== 'undefined') {
    exports.data[exports.data[sessionId].$infos.name] = exports.data[sessionId];
    delete exports.data[exports.ltasks.rename[sessionId]];
    delete exports.data[sessionId].$newName;
    delete exports.ltasks.rename[sessionId];
  }
};
