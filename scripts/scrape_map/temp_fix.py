


# In folder "output/tiles"

# restructure the files that are named <s>_<x>_<y>.png to subfolders named <s>/<x>/<y>.png

import os

files=os.listdir("output/tiles")

for file in files:
    s,x,y = file.split("_")
    os.makedirs(f"output/tiles/{s}", exist_ok=True)
    os.makedirs(f"output/tiles/{s}/{x}", exist_ok=True)
    os.rename(f"output/tiles/{file}", f"output/tiles/{s}/{x}/{y}")