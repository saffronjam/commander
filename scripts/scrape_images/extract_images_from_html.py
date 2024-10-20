from bs4 import BeautifulSoup
import requests
import os
import json

html_locations = [
    "https://satisfactory.fandom.com/wiki/Category:Icons",
    "https://satisfactory.fandom.com/wiki/Category:Building_icons",
    "https://satisfactory.fandom.com/wiki/Category:BuildMenu_icons",
    "https://satisfactory.fandom.com/wiki/Category:Fluid_icons",
    "https://satisfactory.fandom.com/wiki/Category:Item_icons",
    "https://satisfactory.fandom.com/wiki/Category:Milestone_icons",
    "https://satisfactory.fandom.com/wiki/Category:Vehicle_icons",
]


def download_html(url, filename):
    response = requests.get(url)
    if response.status_code == 200:
        print(f"Downloaded: {filename}")
        return response.text
    else:
        print(f"Failed to download {filename}")
        return None


def parse_html_files(folder="html"):
    os.makedirs(folder, exist_ok=True)
    for url in html_locations:
        filename = os.path.join(folder, url.split("/")[-1] + ".html")
        content = download_html(url, filename)
        if content:
            with open(filename, 'w', encoding="utf-8") as f:
                f.write(content)


def load_items(file_input):
    with open(file_input, "r", encoding="utf-8") as file:
        image_data = json.load(file)
    return image_data


def extract_items(current_items, file_input):
    with open(file_input, "r", encoding="utf-8") as file:
        html_content = file.read()

    soup = BeautifulSoup(html_content, 'html.parser')
    gallery_boxes = soup.find_all('li', class_='gallerybox')
    image_data = []

    for box in gallery_boxes:
        image_name = box.find('a', class_='galleryfilename').text.strip()
        image_url = box.find('a', class_='image')['href']
        image_data.append({
            'name': image_name,
            'url': image_url
        })

    # Merge and remove duplicates
    current_items_dict = {item['name']: item['url'] for item in current_items}

    for item in image_data:
        if item['name'] not in current_items_dict:
            current_items.append(item)

    return current_items


def main():
    parse_html_files()

    if os.path.exists("image_source.json"):
        with open("image_source.json", "r", encoding="utf-8") as file:
            items = json.load(file)
    else:
        items = []

    for url in html_locations:
        filename = os.path.join("html", url.split("/")[-1] + ".html")
        items = extract_items(items, filename)

    print(f"Total items: {len(items)}")

    with open("image_source.json", "w", encoding="utf-8") as file:
        json.dump(items, file, indent=4)


if __name__ == "__main__":
    main()
