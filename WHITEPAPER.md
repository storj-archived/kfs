KFS - A Local File Storage System Inspired by Kademlia
======================================================

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

### S-Buckets and Routing

KFS requires that there be a reference identifier, which can be any arbitrary 
`B` bit key. This can be randomly generated upon creation of the database or 
derived from some other applcation or protocol specific information. In the 
Storj network, nodes are addressed with with a 160 bit node identifier derived 
from the public portion of an ECDSA key pair. This reference identifier is 
used to calculate the database shard or *S-Bucket* to which a given piece of 
data belongs by calculating the [distance] between the hash of the data and 
the *Reference ID*.

In KFS, there are a total of `B` S-Buckets (one per bit in the Reference ID). 
S-Buckets store the raw binary data whose hash's *nth* bit differs from the 
reference point. This is to say that if the resulting hash's nth bit differs 
from the reference point, then it should be stored in the nth S-Bucket. A 
S-Bucket has a fixed size, `S`, in bytes which means that a KFS database has 
a maximum size of `B * S` bytes. Once a S-Bucket is full, no more data can be 
placed in it. Once a KFS database is full, another should be created using a 
new Reference ID. Given the default constants, KFS databases are capped at a 
maximum of 8TiB each.

### Keying Data by Chunks

To optimize the efficiency of reads and writes in KFS, data is stored in `C` 
sized chunks (or less), keyed by the full content's hash, followed by a 
space and a numerical index. This is performed to ensure that key/value pairs 
are small and that reading and writing data to and from a S-Bucket is done 
sequentially and can allow for efficient streaming of data both in and out of 
an S-bucket.

Since LevelDB sorts items lexicographically, keys for data chunks should be 
strings and consist of:

```
Hexidecimal(Hash) + ' ' + 00000N
```

The number of preceding zeroes in the numerical index should be set such that 
a S-Bucket that contains only a single file split into `C` sized chunk can 
still be read sequentially from the database. Using the default constants 
would make the highest number index 838861, so the number of leading zeroes 
should be less than or equal to five.

Constants
---------

| Name | Description                       | Default               |
|------|-----------------------------------|-----------------------|
| B    | Number of bits in Reference ID    | 160                   |
| S    | Size (in bytes) of a S-Bucket     | 5.5 * 10<sup>10</sup> |
| C    | Size (in bytes) of a file chunk   | 65536                 |

Implementation
--------------



---

[Kademlia]: https://en.wikipedia.org/wiki/Kademlia "Kademlia"
[Storj Network]: https://storj.io "Storj Labs"
[LevelDB]: http://leveldb.org/ "LevelDB"
[distance]: https://en.wikipedia.org/wiki/Kademlia#Routing_tables
