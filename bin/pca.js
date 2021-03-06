#!/usr/bin/env node --harmony-proxies

var path = require('path'),
    fs = require('fs'),
    utils = require('../src/utils'),
    optimist = require('optimist');

var argv = optimist.boolean(['help','debug']).argv,
    defaultConfigFile = path.normalize(path.join(process.env.HOME || process.env.HOMEPATH, '.ovh-pca')),
    config = JSON.parse(fs.readFileSync(argv.file || defaultConfigFile));

if (['sshkey', 'mount', 'tasks', 'task', 'ltasks', 'ltask'].indexOf(argv._[0]) >= 0) {
  require('../src/pca')[argv._[0]](config, argv);
}
else {
  console.info('Usage: pca action [arg, ...] [options]');
  console.info('Actions:');
  console.info('  mount          : Mount a PCA as a fuse volume');
  console.info('    directory        Target directory ');
  console.info('  sshkey         : Change the SSL key');
  console.info('    file             The public SSH key file');
  console.info('  tasks          : List tasks');
  console.info('    --function       Filter by function (sshKey|restore|delete)');
  console.info('    --status         The status of the task');
  console.info('  task           : Detail of a task');
  console.info('    id               The task ID');
  console.info('  ltasks         : List tasks in staging');
  console.info('  ltask          : Staged task');
  console.info('    type             Type of the task (restore|delete)');
  console.info('    action           Action for the new task (create|cancel)');
  console.info('    sessionId        Session ID ([0-9a-f]+|all)');
  console.info('Options:');
  console.info('  --debug        : Debug mode');
  console.info('  --file         : Path for the configuration file, default is ~/.ovh-pca');
  process.exit(0);
}