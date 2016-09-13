## Performance Testing 

Our goal for this project is enhancing performance over the standard
LevelDB protocol. A robust set of performance tests were run on a 
standard LevelDB along with our new version leveraging KFS. 
This is a summary of the findings. 

### Experiment Design 
A series of one hundred trials were run in sequential order. 
Each trial consisted of measuring the execution time for a single read, 
write and unlink operation on file sizes of 8, 16, 32, 64,128, 256 and 
512 MB. This experiment was conducted for both a vanilla (standard) LevelDb 
and a version using the KFS protocol. All trials used a solid state drive (SSD). 
### Results 
 
#### *General Overview*
![Summary Chart](/doc/img/performanceTestOverviewKfsVsVanilla.png)
#### *Mean Execution Time Comparison*
![Mean Comparison](/doc/img/meanElapsedTimeByOperationAndDb.png)
#### *Standard Deviation Execution Time Comparison*
![Standard Deviation Comparison](/doc/img/sdElapsedTimeByOperationAndDb.png)
#### *Two Sided Significance Test*
![Two Sided Test](/doc/img/KFS_vs_Vanilla_TwoSidedTest.png)

### Conclusion 
 