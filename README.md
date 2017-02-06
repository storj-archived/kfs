KFS (Kademlia File Store)
=========================

[![Build Status](https://img.shields.io/travis/Storj/kfs.svg?style=flat-square)](https://travis-ci.org/Storj/kfs)
[![Coverage Status](https://img.shields.io/coveralls/Storj/kfs.svg?style=flat-square)](https://coveralls.io/r/Storj/kfs)
[![NPM](https://img.shields.io/npm/v/kfs.svg?style=flat-square)](https://www.npmjs.com/package/kfs)
[![License](https://img.shields.io/badge/license-GPL3.0-blue.svg?style=flat-square)](https://raw.githubusercontent.com/storj/kfs/master/LICENSE)

The KFS system describes a method for managing the storage layer of nodes on 
the [Storj Network](https://storj.io) by creating a sharded local database 
where content-addressable data is placed in a shard using the same routing 
metric and algorithm used by the Kademlia distributed hash table.

Be sure to read about the 
[motivation and how it works](https://storj.github.io/kfs/tutorial-about.html)!

Quick Start
-----------

Install the `kfs` package using [Node Package Manager].

```
npm install kfs --save
```

This will install `kfs` as a dependency of your own project. See the 
[documentation](https://storj.github.io/kfs/) for in-depth usage details. 
You can also install globally to use the `kfs` command line utility.

```
const kfs = require('kfs');
const store = kfs('path/to/store');

store.writeFile('some key', Buffer.from('some data'), (err) => {
  console.log(err || 'File written to store!');
});
```

License
-------

KFS - A Local File Storage System Inspired by Kademlia  
Copyright (C) 2016 Storj Labs, Inc

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see [http://www.gnu.org/licenses/].

[Kademlia]: https://en.wikipedia.org/wiki/Kademlia "Kademlia"
[Storj Network]: https://storj.io "Storj Labs"
[LevelDB]: http://leveldb.org/ "LevelDB"
[distance]: https://en.wikipedia.org/wiki/Kademlia#Routing_tables
[Node Package Manager]: https://npmjs.org "Node Package Manager"
[documentation]: http://bookch.in/kfs/ "Package Documentation"
