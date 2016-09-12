Our goal for this project is enhancing performance over the standard
LevelDB protocol. A robust set of performance tests were run on a 
standard LevelDB along with our new version leveraging KFS. 
This is a summary of the findings. 

### Experiment Design 
To ensure robust metrics we ran a series of trials (one hundred) in 
sequential order. Each trial consisted of a single read, write and unlink
operation for file sizes of 8, 16, 32, 64, 128, 256 and 512 MB each. 
The experiment was conducted on both a solid state drive (SSD) and 
hard disk drive (HDD). 
### Results 

The below graphs display the measured execution times over one hundred 
trial runs. 
#### Operation and Drive Type 
![Graph One](/doc/img/executionTimeByOperationAndDriveType.png)
#### File Size, Operation and Drive Type
![Graph Two](/doc/img/executionTimeByOperationFileSizeAndDriveType.png)

### Conclusion 
 