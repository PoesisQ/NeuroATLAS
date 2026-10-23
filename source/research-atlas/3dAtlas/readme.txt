- atlas.labels.rgb.nii.gz: RGB visualization in which the color of each voxel is a weighted sum
      of the colors of the different labels weighted by their probabilities at each location.

- atlas.labels.argmax.nii.gz: this is a hard segmentation in which each voxel is assigned the 
      label with the highest probability at its corresponding location.

If you have FreeSurfer installed, you can visualize them both simultaneously with the following command: 
freeview \
-v atlas.labels.rgb.nii.gz:rgb=true \
-v atlas.labels.argmax.nii.gz:colormap=lut:lut=lut.freeview.txt:opacity=0.5

You can also open the files with ITKsnap. 
For the RGB file, you need to select "Multi-component display -> RGB". 
For the argmax, load as segmentation and use the lookup table file lut.itksnap.txt
Alternatively, you can run the following command from the command line:
itksnap -g atlas.labels.rgb.nii.gz -s atlas.labels.argmax.nii.gz -l lut.itksnap.txt
(but you may still need to set the multi-component display to RGB manually)
