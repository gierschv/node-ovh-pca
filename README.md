# node-ovh-pca

This node module was developped to test the [OVH Public Cloud Archive Beta](http://www.ovh.com/fr/cloud/archives/) solution and [VMWare fuse4js](https://github.com/vmware/fuse4js).

The goal is to provide a simple fuse file system containing the PCA sessions and files hierarchy to be able to find archived files and to restore and delete them easily.

**This module is unofficial and consequently not maintained by OVH. For testing purpose only.**

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

In an another terminal, list your sessions (presented as folder named with the session name and a symlink named with the session identifier):

```bash
$ ls -l ~/mnt
total 64
dr-xr-xr-x  0 root  wheel  4096 Apr 10 18:33 2013-04-10@18:29:33
dr-xr-xr-x  0 root  wheel  4096 Apr 11 23:33 2013-04-11@23:33:34
dr-xr-xr-x  0 root  wheel  4096 Apr 11 23:35 2013-04-11@23:35:02
dr-xr-xr-x  0 root  wheel  4096 Apr 12 01:03 2013-04-12@01:03:19
lr-xr-xr-x  0 root  wheel    19 Apr 10 18:33 5165af8da0b3065823000000 -> 2013-04-10@18:29:33
lr-xr-xr-x  0 root  wheel    19 Apr 11 23:33 5167484e1b012e9c67000000 -> 2013-04-11@23:33:34
lr-xr-xr-x  0 root  wheel    19 Apr 11 23:35 516748a6cfba121168000000 -> 2013-04-11@23:35:02
lr-xr-xr-x  0 root  wheel    19 Apr 12 01:03 51675d57a68f060c2f000000 -> 2013-04-12@01:03:19
```

List a session:

```bash
$ ls -Rl ~/mnt/2013-04-12@01:03:19
lr-xr-xr-x  0 root  wheel    18 Apr 12 01:03 51675d5883ab26232f000000 -> test1/test1.2/toto
lr-xr-xr-x  0 root  wheel    18 Apr 12 01:03 51675d5883ab26232f000001 -> test1/test1.2/titi
dr-xr-xr-x  0 root  wheel  4096 Jan  1  1970 test1

~/mnt/2013-04-12@01:03:19/test1:
dr-xr-xr-x  0 root  wheel  4096 Jan  1  1970 test1.2

~/mnt/2013-04-12@01:03:19/test1/test1.2:
----------  0 root  wheel  307435 Apr 12 01:03 titi
----------  0 root  wheel       0 Apr 12 01:03 toto
```

### Restore files

To restore files, you have to stage the files you want to restore. To do that, just `chmod u+r` the files you want to restore:

```bash
$ chmod -R u+r ~/mnt/517bf4f143e97ba44b000000/backup/mysql
$ chmod +r ~/mnt/2013-04-10@18:29:33/backup.tgz
```

Check your staging:
```bash
$ pca ltasks
action    session id                    session name                  file id                       file name
------    ----------                    ------------                  -------                       ---------
restore   5165af8da0b3065823000000      2013-04-10@18:29:33           5165b05ff0e897d225000000      backup.tgz
restore   517bf4f143e97ba44b000000      2013-04-27@15:55:29           517bf4f71d0e50c34b000001      backup/mysql/3.sql.gpg
restore   517bf4f143e97ba44b000000      2013-04-27@15:55:29           517bf4f71d0e50c34b000000      backup/mysql/2.sql.gpg
restore   517bf4f143e97ba44b000000      2013-04-27@15:55:29           517bf4f71d0e50c34b000002      backup/mysql/1.sql.gpg
```

To unstage a file, just `chmod u-r` it.

Create the tasks for these two sessions:
```bash
$ pca ltask restore create 5165af8da0b3065823000000
$ pca ltask restore create 517bf4f143e97ba44b000000
```

The tasks have been created:
```bash
$ pca tasks | grep restore
779       restore        todo      2013-04-28 20:46:57      178.33.241.56
778       restore        todo      2013-04-28 20:43:25      178.33.241.56
```

### Delete files or sessions

To delete files or sesssions, the method is similar than to restore: just `rm` the files.

```bash
$ rm -f ~/mnt/2013-04-11@23:33:34/memset.S
$ rm -f ~/mnt/2013-04-11@23:33:34/51674851fbcf72b56700000c
$ rm -rf ~/mnt/2013-04-10@18:29:33
 ```
 
Check your staging:
```bash
action    session id                    session name                  file id                       file name
------    ----------                    ------------                  -------                       ---------
delete    5167484e1b012e9c67000000      2013-04-11@23:33:34           51674851fbcf72b567000004      memset.S
delete    5167484e1b012e9c67000000      2013-04-11@23:33:34           51674851fbcf72b56700000c      strlen.S
delete    5165af8da0b3065823000000      2013-04-10@18:29:33           *                             *
```

Create the tasks for these two sessions:
```bash
$ pca ltask delete create 5167484e1b012e9c67000000
$ pca ltask delete create 5165af8da0b3065823000000
```

The tasks have been created:
```bash
$ pca tasks | grep delete
789       delete         todo      2013-04-28 23:35:20      178.33.62.120
790       delete         todo      2013-04-28 23:48:07      178.33.62.120
```

## Changelog

### 0.2.0

* Restore / delete

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
