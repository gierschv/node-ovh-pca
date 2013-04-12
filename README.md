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

### Set your SSH key

```bash
$ pca sshkey ~/.ssh/id_dsa.pub
Your SSH key has been updated.
```

## Changelog

### Todo

* Restore / delete

### 0.1.0

* Initial release

## License

node-ovh-pca is freely distributable under the terms of the MIT license.

```
Copyright (c) 2012 - 2013 Vincent Giersch <mail@vincent.sh>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
