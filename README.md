# PCA

[![NPM version](https://badge.fury.io/js/pca.png)](http://badge.fury.io/js/pca)
[![Dependency Status](https://david-dm.org/gierschv/node-ovh-pca.png)](https://david-dm.org/gierschv/node-ovh-pca)

This node module was developed to browse and manage the [OVH Public Cloud Archive Beta](http://www.ovh.com/fr/cloud/archives/). It's based on [VMWare fuse4js](https://github.com/vmware/fuse4js).

The goal is to provide a simple fuse file system containing the PCA sessions and files hierarchy to be able to find archived files and to restore and delete them easily.

**This module is unofficial and consequently not maintained by OVH.**

## Usage

### Installation:

```bash
$ npm install -g pca
```

### Configuration

Use ```--help``` to see available options.

```bash
$ pca-config publiccloud-passport-424242 pca-ZZ0000-424242
Your PCA configuration file was created: ~/.ovh-pca
Please go to the following URL to activate your consumer key:

	https://www.ovh.com/fr/cgi-bin/api/requestCredential.cgi?credentialToken=xxxxxx

```

### Set your SSH key

```bash
$ pca sshkey ~/.ssh/id_dsa.pub
Your SSH key has been updated.
```

### Mount your PCA

```bash
$ pca mount ~/mnt
File system started at ~/mnt
To stop it, type this in another shell: fusermount -u ~/mnt or umount ~/mnt
```

In an another terminal, list your sessions:

```bash
$ ls -l ~/mnt
total 64
dr-xr-xr-x  0 user  users  4096 Apr 10 18:33 2013-04-10@18:29:33
dr-xr-xr-x  0 user  users  4096 Apr 11 23:33 2013-04-11@23:33:34
dr-xr-xr-x  0 user  users  4096 Apr 11 23:35 2013-04-11@23:35:02
dr-xr-xr-x  0 user  users  4096 Apr 12 01:03 2013-04-12@01:03:19
lr-xr-xr-x  0 user  users    19 Apr 10 18:33 5165af8da0b3065823000000 -> 2013-04-10@18:29:33
lr-xr-xr-x  0 user  users    19 Apr 11 23:33 5167484e1b012e9c67000000 -> 2013-04-11@23:33:34
lr-xr-xr-x  0 user  users    19 Apr 11 23:35 516748a6cfba121168000000 -> 2013-04-11@23:35:02
lr-xr-xr-x  0 user  users    19 Apr 12 01:03 51675d57a68f060c2f000000 -> 2013-04-12@01:03:19
```

List a session:

```bash
$ ls -Rl ~/mnt/2013-04-12@01:03:19
lr-xr-xr-x  0 user  users    18 Apr 12 01:03 51675d5883ab26232f000000 -> test1/test1.2/toto
lr-xr-xr-x  0 user  users    18 Apr 12 01:03 51675d5883ab26232f000001 -> test1/test1.2/titi
dr-xr-xr-x  0 user  users  4096 Jan  1  1970 test1

~/mnt/2013-04-12@01:03:19/test1:
dr-xr-xr-x  0 user  users  4096 Jan  1  1970 test1.2

~/mnt/2013-04-12@01:03:19/test1/test1.2:
----------  0 user  users  307435 Apr 12 01:03 titi
----------  0 user  users       0 Apr 12 01:03 toto
```

### Restore the sessions

To restore the sessions, you have to stage the one you want to restore. To do that, just `chmod u+r` the sessions you want to restore:

```bash
$ chmod +r ~/mnt/2013-08-07@23:03:26/backup/git/flat/ta.git.tar.gpg
$ chmod -R +r ~/mnt/2013-08-08@23:03:24
```

Check your staging:
```bash
$ pca ltasks
┌──────────┬──────────────────────────┬────────────────────────────────────────────┐
│ action   │ session id               │ session name                               │
├──────────┼──────────────────────────┼────────────────────────────────────────────┤
│ restore  │ 5202d23e6eb57b1f5f000000 │ 2013-08-07@23:03:26                        │
├──────────┼──────────────────────────┼────────────────────────────────────────────┤
│ restore  │ 520423bcb0a662cd56000000 │ 2013-08-08@23:03:24                        │
└──────────┴──────────────────────────┴────────────────────────────────────────────┘
```

To unstage a file, just `chmod u-r` it.

Create the tasks for these two sessions:
```bash
$ pca ltask restore create 5202d23e6eb57b1f5f000000
$ pca ltask restore create 520423bcb0a662cd56000000
```

or

```bash
$ pca ltask restore create all
```

The tasks have been created:
```bash
$ pca tasks --status todo
┌──────┬───────────────┬────────────┬────────────────────────────┬────────────────┐
│ id   │ function      │ status     │ todoDate                   │ ipAddress      │
├──────┼───────────────┼────────────┼────────────────────────────┼────────────────┤
│ 8510 │ restore       │ todo       │ 2013-10-26T22:53:53+02:00  │ unkown         │
├──────┼───────────────┼────────────┼────────────────────────────┼────────────────┤
│ 8511 │ restore       │ todo       │ 2013-10-26T22:53:53+02:00  │ unkown         │
└──────┴───────────────┴────────────┴────────────────────────────┴────────────────┘
```

### Delete files or sessions

To delete the sesssions, the method is similar than to restore: just `rm` the files.

```bash
$ rm -rf ~/mnt/2013-08-07@23:03:26
 ```
 
Check your staging:
```bash
$ pca ltasks
┌──────────┬──────────────────────────┬────────────────────────────────────────────┐
│ action   │ session id               │ session name                               │
├──────────┼──────────────────────────┼────────────────────────────────────────────┤
│ delete   │ 5202d23e6eb57b1f5f000000 │ 2013-08-07@23:03:26                        │
└──────────┴──────────────────────────┴────────────────────────────────────────────┘
```

Create the tasks for this sessions:
```bash
$ pca ltask delete create 5202d23e6eb57b1f5f000000
```

The tasks have been created:
```bash
$ pca tasks --status todo
┌──────┬───────────────┬────────────┬────────────────────────────┬────────────────┐
│ id   │ function      │ status     │ todoDate                   │ ipAddress      │
├──────┼───────────────┼────────────┼────────────────────────────┼────────────────┤
│ 8512 │ delete        │ todo       │ 2013-10-26T23:01:26+02:00  │ unkown         │
└──────┴───────────────┴────────────┴────────────────────────────┴────────────────┘
```

### Rename a session

To rename a session, the method is similar than to delete or restore: just `mv` the sessions.

```bash
$ ls -al ~/mnt
drwxr-xr-x  0 giersc_v  staff  4096 Oct 26 22:56 2013-10-26@20:56:15
lr-xr-xr-x  0 giersc_v  staff    19 Oct 26 22:56 526c2c6f6dd9061727000000 -> 2013-10-26@20:56:15

$ mv ~/mnt/2013-10-26@20:56:15 ~/mnt/my_archive

$ pca ltasks
┌──────────┬──────────────────────────┬────────────────────────────────────────────┐
│ action   │ session id               │ session name                               │
├──────────┼──────────────────────────┼────────────────────────────────────────────┤
│ rename   │ 526c2c6f6dd9061727000000 │ my_archive                                 │
└──────────┴──────────────────────────┴────────────────────────────────────────────┘

$ pca ltask rename create all
$ ls -al ~/mnt
drwxr-xr-x  0 giersc_v  staff  4096 Oct 26 22:56 my_archive
lr-xr-xr-x  0 giersc_v  staff    10 Oct 26 22:56 526c2c6f6dd9061727000000 -> my_archive
```

## Changelog

### 0.3.4

* Fix cli `pca tasks` optional parameters that was sending bad urlFilters

### 0.3.3

* Fix args

### 0.3.2

* Fix shebang for `pca` script

### 0.3.1

* Remove useless depenency

### 0.3.0

* Uses npm [ovh](https://npmjs.org/package/ovh) v1.0.x.
* Stops using the deprecated API method `POST /cloud/{serviceName}/pca/{pcaServiceName}/tasks` (#9).
* Restores are now limited to the full session (#9).
* Fixes the missing "all" keyword for `ltask` (#6).
* Checks the existence of the UNIX socket before creating it (#8).
* The renaming of the sessions is now supported with a `mv` (#10).
* Usage of `cli-table` for tables.

### 0.2.1

* It no longer going to fetch the files details when *getattr* or *readlink* of /*.

### 0.2.0

* Restore / delete
* Update dependencies (uses node-ovh >= 0.3.7)
* Fixes mount of an empty PCA

### 0.1.0

* Initial release

## License

node-ovh-pca is freely distributable under the terms of the MIT license.

```
Copyright (c) 2013 Vincent Giersch <mail@vincent.sh>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

[![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/gierschv/node-ovh-pca/trend.png)](https://bitdeli.com/free "Bitdeli Badge")
