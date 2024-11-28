

# In current folder and all sub-folders, remove all zone identifiers files (*.png:Zone.Identifier)

import os
import glob

for filename in glob.iglob('**/*.png:Zone.Identifier', recursive=True):
    os.remove(filename)
    print('Removed:', filename)