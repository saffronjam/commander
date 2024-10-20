import os
from PIL import Image

# For each image in ./output/original
# Scale down the image to 64x64 pixels
# Save the scaled image in ./output/64x64


scales = [16, 32, 64, 128, 256, 512]

def main():
    for scale in scales:
        os.makedirs(f"output/{scale}x{scale}", exist_ok=True)
    for image in os.listdir("output/original"):
        img = Image.open(f"output/original/{image}")
        for scale in scales:
            img_scaled = img.resize((scale, scale))
            img_scaled.save(f"output/{scale}x{scale}/{image}")


if __name__ == "__main__":
    main()
