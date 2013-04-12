var ovh = require('ovh');
var rest, restPca, restTimeout = 3000, freshSessions, freshLimit = 120000;

exports.config = {};
exports.data = {};
exports.lookup = function (path, callback) {
  var cur = null, previous = null, name = '';
  if (path === '/') {
    exports.fetchSessions(function () {
      callback({ node: exports.data, parent: null, name: '' });
    });
  }
  else {
    var comps = path.split('/');
    for (var i = 0; i < comps.length; i++) {
      previous = cur;
      if (i === 0) {
        cur = exports.data;
      }
      else if (cur !== undefined ) {
        name = comps[i];
        cur = cur[name];

        if (cur === undefined) {
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
  }
};

exports.fetchService = function (callback) {
  rest = rest || ovh({ cloud: { type: 'REST', path: '/cloud' }}, exports.config, { timeout: restTimeout });
  restPca = rest.cloud[exports.config.passportServiceName].pca[exports.config.pcaServiceName];
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
  rest = rest || ovh({ cloud: { type: 'REST', path: '/cloud' }}, exports.config, { timeout: restTimeout });
  restPca.sessions.$get(function(success, sessions) {
    if (!success) {
      console.error('Unable to fetch the sessions list:' + sessions);
      callback(false);
    }
    else {
      exports.data = {};
      var remaining = sessions.length;
      for (var i = 0 ; i < sessions.length; i++) {
        this[sessions[i]].$get(function(success, session) {
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

          console.log('Remaining REST calls', + remaining - 1);
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
  freshSessions = new Date();
  rest = rest || ovh({ cloud: { type: 'REST', path: '/cloud' }}, exports.config, { timeout: restTimeout });
  restPca.sessions[sessionId].files.$get(function(success, files) {
    if (!success) {
      console.error('Unable to fetch the session files of session ' + sessionId + ':' + files);
      callback(false);
    }
    else {
      var remaining = files.length;
      for (var i = 0 ; i < files.length; i++) {
        this[files[i]].$get(function(success, file) {
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

          console.log('Remaining REST calls: ', remaining - 1);
          if (--remaining === 0) {
            callback(true);
          }
        });
      }
    }
  });

  return true;
};
