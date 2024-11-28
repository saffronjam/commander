import os
from PIL import Image
from concurrent.futures import ThreadPoolExecutor

def replace_color(image_path, color_to_replace):
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        data = img.getdata()

        new_data = [
            (255, 255, 255, 0) if (item[0], item[1], item[2]) == color_to_replace else item
            for item in data
        ]

        img.putdata(new_data)
        img.save(image_path, "PNG")
        print(f"Processed: {image_path}")
    except Exception as e:
        print(f"Error processing {image_path}: {e}")

def main():
    # Collect all image paths
    image_paths = []
    for root, _, files in os.walk("./output/tiles/"):
        for file in files:
            if file.endswith(".png"):
                image_paths.append(os.path.join(root, file))

    # Process images in parallel
    with ThreadPoolExecutor() as executor:
        executor.map(lambda path: replace_color(path, (221, 221, 221)), image_paths)

if __name__ == "__main__":
    main()