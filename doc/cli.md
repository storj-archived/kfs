KFS comes bundles with a handy command line interface for dealing with your 
databases. You can access this tool by installing the package globally:

```
npm install -g kfs
```

Once the installation completes, you can use the `kfs` command. To see usage 
information, run:

```
Usage: kfs [options] [command]


  Commands:

    write <file_key> [file_path]                 write the file to the database (or read from stdin)
    read <file_key> [file_path]                  read the file from the database (or write to stdout)
    unlink <file_key>                            unlink (delete) the file from the database
    list [options] <bucket_index_or_file_index>  list all of the file keys in the given bucket
    stat [options] [bucket_index_or_file_key]    get the free and used space for the database 
    compact                                      trigger a compaction of all database buckets
    *                                            print usage information to the console

  Options:

    -h, --help          output usage information
    -V, --version       output the version number
    -d, --db <db_path>  path the kfs database to use (default: /home/bookchin/.kfs/default)
```

### Writing a File To KFS

There are two ways to write a file to a KFS database:

1. Supplying an optional path to an existing file
2. Reading from STDIN

To write a file that exists on the file system already, just supply it's path:

```
kfs write somefilekey /path/to/my/file.bin
```

To have the CLI read from STDIN, just pipe the output of another program to it:

```
cat /path/to/my/file.bin | kfs write somefilekey
```

If an error is encountered, the process will terminate and write the error 
message to STDERR.

### Reading a File From KFS

There are two ways to read a file from a KFS database:

1. Supplying a path to write the output
2. Writing to STDOUT

To read from a KFS and write it to a file, just supply a path:

```
kfs read somefilekey /path/to/write/file.webm
```

To have the CLI write to STDOUT, just pipe the output to another program:

```
kfs read somefilekey | mplayer -
```

If an error is encountered, the process will terminate and write the error 
message to STDERR.

### Unlinking a File From KFS

To unlink (or mark for deletion), simply provide the file key:

```
kfs unlink somefilekey
```

If an error is encountered, the process will terminate and write the error 
message to STDERR.

### Getting Stats for a KFS

You can see the amount of space available for a given file key:

```
kfs stat somefilekey
246.s    34359738368 
```

This writes the S-bucket index and the number of bytes available to STDOUT. 
You can also view this in a human readable form with the `-h` option:

```
kfs stat somefilekey -h
246.s    32.0 GiB
```
