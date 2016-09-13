## Performance Testing 

One major hypothesis of this project is that KFS enhances performance over 
the standardLevelDB protocol. A set of performance tests were run on a 
standard LevelDB along with our new version leveraging KFS. 
This is a short summary of our findings and their implications. 

### Experiment Design 

A series of one hundred trials were run in sequential order. 
Each trial consisted of measuring the execution time for a single read, 
write and unlink operation on file sizes of 8, 16, 32, 64,128, 256 and 
512 MB. This experiment was conducted for both a vanilla (standard) LevelDb 
and a version using the KFS protocol. All trials used a solid state drive (SSD). 

### Results 

An overview plot displaying the execution time by file size and operation for each
trial indicates some difference between KFS and a vanilla LevelDb. At a high level
it appears vanilla LevelDb higher variance across many categories. 

![Summary Chart](/doc/img/performanceTestOverviewKfsVsVanilla.png)

Upon closer inspection the data show that in every category the mean execution
time is lower for KFS for all categories. As for variance, vanilla LevelDb is
vastly greater than KFS for writes and unlinks but more consistent for reads.

![Mean Comparison](/doc/img/meanElapsedTimeByOperationAndDb.png)

![Standard Deviation Comparison](/doc/img/sdElapsedTimeByOperationAndDb.png)

Running two sided significant tests ([Tests of Significance](http://www.stat.yale.edu/Courses/1997-98/101/sigtest.htm)) on each combination of operation and file size
provides P-Values at the 95% confidence level or higher. This indicates that our 
measurement are no the result of a statistical fluke and KFS introduces meaningful change. 

![Two Sided Test](/doc/img/KFS_vs_Vanilla_TwoSidedTest.png)

### Conclusion 
While P-Values should not be followed blindly, the data does indicate that 
the KFS protocol gives statistically significant gains in speed and consistency.