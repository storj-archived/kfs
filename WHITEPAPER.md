KFS - A Local File Storage System Inspired by Kademlia
======================================================

Author: Gordon Hall

Abstract
--------

The KFS system describes a method for managing the storage layer of nodes on 
[Storj Network] by creating a sharded local database where content-addressable 
data is placed in a shard using on the same routing algorithm used by the 
[Kademlia] distributed hash table.

Motivation
----------

The Storj network consists of a number of distributed peers who provide 
storage capacity for lease to others. In it's current implementation, these 
nodes store encrypted shards and their associated metadata in a [LevelDB]. 
LevelDB provides a number of features that make it desirable for this use 
case; this includes it's lexicographically sorted keys providing fast lookups 
for content-addressable values, fast and efficient compression, and perhaps 
most notably it's portability which allows the Storj software to run on a 
wide range of hardware including dated or underpowered computers.

However, due to the nature of LevelDB's design and it's implementation in 
the Storj software, it's performance suffers after the size of the database 
exceeds approximately 100GiB. This impact is larger on lower end systems and 
can also vary based on the type of disk in use. These performance issues seem 
to arise from LevelDB's compaction mechanism (which is a desirable feature).
In addition to the cost of compaction, LevelDB blocks reads and writes during 
this process, which causes storage nodes to become effectively offline until 
the process completes. 

These properties indicate that if the size of a single database can be given an 
upper bound, then the cost of compaction can be significantly reduced to an 
acceptable level. Futhermore, in using a single database, if one level becomes 
corrupted, deleted, or otherwise inaccessible, the entire database may become 
unusable and unrecoverable. For these reasons, the KFS system seeks to create 
a series of size-capped databases where data is stored in a given "shard" 
based on a deterministic metric to ensure a sufficiently random and even 
spread to bound the cost of compaction and to reduce the impact of corruption.

Mechanics
---------



Implementation
--------------



---

[Kademlia]: https://en.wikipedia.org/wiki/Kademlia "Kademlia"
[Storj Network]: https://storj.io "Storj Labs"
[LevelDB]: http://leveldb.org/ "LevelDB"
