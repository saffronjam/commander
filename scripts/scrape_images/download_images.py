import json
import os
import requests


# Function to download an image
def download_image(url, filename):
    response = requests.get(url)
    if response.status_code == 200:
        # Save the image file in the output folder
        with open(filename, 'wb') as f:
            f.write(response.content)
        print(f"Downloaded: {filename.split('/')[-1]}")
    else:
        print(f"Failed to download {filename}")


def main():
    json_file = "image_source.json"

    if not os.path.exists(json_file):
        print(f"File not found: {json_file}")
        exit()

    output_dir = "output/original"
    os.makedirs(output_dir, exist_ok=True)

    def img_fullpath(img_name):
        return os.path.join(output_dir, img_name)

    # Load image data from the JSON file
    with open(json_file, "r", encoding="utf-8") as file:
        image_data = json.load(file)

    # Iterate through the image data and download each image
    for image in image_data:
        image_name = image['name']
        image_url = image['url']

        # Only download the image if it doesn't already exist
        if os.path.exists(img_fullpath(image_name)):
            print(f"Skipping {image_name} - already downloaded")
            continue

        # Call the function to download the image
        download_image(image_url, img_fullpath(image_name))


if __name__ == "__main__":
    main()
