# NextBrain: a next-generation, histological atlas of the human brain for high-resolution neuroimaging studies

We present a next-generation probabilistic atlas of the human brain using histological sections of five full human hemispheres with manual.

This data extension release includes a 200um isotropic labeling of the right hemisphere of the ex vivo scan publicly released by Edlow et al. in “7 Tesla MRI of the ex vivo human brain at 100 micron resolution”, Scientific data 6, 244 (2019). We include the original scan as well as the look-up-table for visualization (freeview format). From the root directory, you can open these files in Freeview with the command: 
```
freeview -v sub-001/ses-01/anat/sub-001_ses-01_T2w.nii.gz derivatives/manual_segmentation/sub-001/ses-01/sub-001_ses-01_desc-manual_dseg.nii.gz:colormap=lut:lut=derivatives/manual_segmentation/sub-001/sub-001_lut.txt

```

## References
You can see two videos flying over the coronal and axial slices of the dataset in the following links: 
https://youtu.be/bH09BVNjLek
https://youtu.be/SkX0GRm3p4c

For more information about the NextBrain project, please check [the project's webpage](https://github-pages.ucl.ac.uk/NextBrain)
