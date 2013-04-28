var ovh = require('ovh');
var rest, restPca, restTimeout = 3000, freshSessions, freshLimit = 120000;

exports.config = {};
exports.data = {};
exports.ltasks = {};
exports.lookup = function (path, callback) {
  var cur = null, previous = null, name = '';
  if (path === '/') {
    exports.fetchSessions(function () {
      callback({ node: exports.data, parent: null, name: '' });
    });
  }
  else {
    var comps = path.split('/');

    exports.fetchSessionFiles(comps[1], comps[1], function () {
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
    });
  }
};

exports.restPca = function () {
  rest = rest || ovh({ cloud: { type: 'REST', path: '/cloud' }}, exports.config, { timeout: restTimeout });
  return rest.cloud[exports.config.passportServiceName].pca[exports.config.pcaServiceName];
};

exports.fetchService = function (callback) {
  restPca = restPca || exports.restPca();
  restPca.$get(function(success, result) {
    if (!success) {
      console.error('Unable to fetch service information. Check your configuration.');
      console.error('Error: ' + result);
    }

    callback.call(this, rest, success, result);
  });
};

exports.fetchSessions = function (callback) {
  if (typeof(freshSessions) !== 'undefined' && new Date() - freshSessions < freshLimit) {
    return callback(true);
  }

  freshSessions = new Date();
  restPca = restPca || exports.restPca();
  restPca.sessions.$get(function (success, sessions) {
    if (!success) {
      console.error('Unable to fetch the sessions list:' + sessions);
      callback(false);
    }
    else {
      exports.data = {};
      var remaining = sessions.length;
      for (var i = 0 ; i < sessions.length; i++) {
        this[sessions[i]].$get(function (success, session) {
          if (!success) {
            console.error('Unable to fetch infos of session: ' + sessions[i]);
          }
          else {
            exports.data[session.name] = {
              $type: 'session',
              $sessionId: session.id,
              $infos: session,
              files: {}
            };

            exports.data[session.id] = exports.data[session.name];
          }

          // console.log('Remaining REST calls', + remaining - 1);
          if (--remaining === 0) {
            callback(true);
          }
        });
      }
    }
  });

  return true;
};

exports.fetchSessionFiles = function (sessionId, sessionName, callback) {
  if (typeof(exports.data[sessionName]) === 'undefined') {
    return callback(false);
  }
  else if (Object.keys(exports.data[sessionName].files).length > 0 && new Date() - freshSessions < freshLimit) {
    return callback(true);
  }

  sessionId = exports.data[sessionName].$sessionId;
  // freshSessions = new Date();
  restPca = restPca || exports.restPca();

  restPca.sessions[sessionId].files.$get(function (success, files) {
    if (!success) {
      console.error('Unable to fetch the session files of session ' + sessionId + ':' + files);
      callback(false);
    }
    else {
      var remaining = files.length;
      for (var i = 0 ; i < files.length; i++) {
        this[files[i]].$get(function (success, file) {
          if (!success) {
            console.error('Unable to fetch infos of file: ' + files[i]);
          }
          else {
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
          }

          // console.log('Remaining REST calls: ', remaining - 1);
          if (--remaining === 0) {
            callback(true);
          }
        });
      }
    }
  });

  return true;
};

// Tasks
exports.createTask = function (fnc, sessionId, fileIds, callback) {
  restPca = restPca || exports.restPca();
  restPca.tasks.$post({ taskFunction: fnc, sessionId: sessionId, fileIds: fileIds }, callback);
};

exports.createTaskDeleteSession = function (sessionId, callback) {
  restPca = restPca || exports.restPca();
  restPca.sessions[sessionId].$delete(callback);
};

// Restore
exports.addRestoreFile = function (node) {
  exports.ltasks.restore = exports.ltasks.restore || {};

  if (typeof(exports.ltasks.restore[node.$sessionId]) === 'undefined') {
    exports.ltasks.restore[node.$sessionId] = {};
    exports.ltasks.restore[node.$sessionId].$name = exports.data[node.$sessionId].$infos.name;
  }

  if (typeof(exports.ltasks.restore[node.$sessionId][node.$fileId]) === 'undefined') {
    exports.ltasks.restore[node.$sessionId][node.$fileId] = node;
  }
};

exports.existsRestoreFile = function (sessionId, fileId) {
  return typeof(exports.ltasks.restore) !== 'undefined' &&
         typeof(exports.ltasks.restore[sessionId]) !== 'undefined' &&
         typeof(exports.ltasks.restore[sessionId][fileId]) !== 'undefined';
};

exports.delRestoreFile = function (sessionId, fileId) {
  if (typeof(exports.ltasks.restore) !== 'undefined' &&
      typeof(exports.ltasks.restore[sessionId]) !== 'undefined' &&
      typeof(exports.ltasks.restore[sessionId][fileId]) !== 'undefined') {
    delete exports.ltasks.restore[sessionId][fileId];

    if (Object.keys(exports.ltasks.restore[sessionId]).length <= 1) {
      delete exports.ltasks.restore[sessionId];
    }
  }
};

// Delete
exports.addDeleteFile = function (node) {
  exports.ltasks.delete = exports.ltasks.delete || {};

  if (typeof(exports.ltasks.delete[node.$sessionId]) === 'undefined') {
    exports.ltasks.delete[node.$sessionId] = {};
    exports.ltasks.delete[node.$sessionId].$name = exports.data[node.$sessionId].$infos.name;
  }

  if (node.$type === 'session') {
    exports.ltasks.delete[node.$sessionId] = exports.data[node.$sessionId].$infos.name;
  }
  else if (node.$type === 'file' &&
           typeof(exports.ltasks.delete[node.$sessionId]) !== 'string' &&
           typeof(exports.ltasks.delete[node.$sessionId][node.$fileId]) === 'undefined') {
    exports.ltasks.delete[node.$sessionId][node.$fileId] = node;
  }
};

exports.existsDeleteFile = function (sessionId, fileId) {
  if (typeof(exports.data[sessionId]) === 'undefined') {
    return false;
  }

  sessionId = exports.data[sessionId].$sessionId;
  if (typeof(exports.data[sessionId].files[fileId]) !== 'undefined' &&
      typeof(exports.data[sessionId].files[fileId].$infos) !== 'undefined') {
    fileId = exports.data[sessionId].files[fileId].$infos.id;
  }

  return typeof(exports.ltasks.delete) !== 'undefined' &&
         typeof(exports.ltasks.delete[sessionId]) !== 'undefined' &&
         (typeof(exports.ltasks.delete[sessionId][fileId]) !== 'undefined' ||
          typeof(exports.ltasks.delete[sessionId]) === 'string');
};
