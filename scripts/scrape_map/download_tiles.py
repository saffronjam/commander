import os
from typing import List


def get_dimensions(zoom: int) -> int:
    """
    Get the dimensions corresponding to the given zoom level.
    The dimensions are calculated as 5 * 2^(zoom - 3).

    Args:
        zoom (int): The zoom level.

    Returns:
        int: The corresponding dimensions.
    """
    if zoom < 3:
        raise ValueError("Zoom level must be 3 or higher.")

    return 5 * 2 ** (zoom - 3)


def get_fetch_commands(zoom: int, baseURL: str, version: str, output_dir: str) -> List[str]:
    """
    Get the fetch URL for the given zoom level.

    Args:
        zoom (int): The zoom level.
        baseURL (str): The base URL.
        version (str): The version.

    Returns:
        str: The fetch URL.
    """

    if zoom not in allowed_zoom_levels:
        raise ValueError("Zoom level not allowed.")

    dimensions = get_dimensions(zoom)

    commands = []
    for y in range(dimensions):
        for x in range(dimensions):
            src = f"{baseURL}/{zoom}/{x}/{y}.png?v={version}"
            dst = f"{output_dir}/{zoom}_{x}_{y}.png"
            command = f"curl {src} -o {dst} > /dev/null 2>&1"
            commands.append(command)

    return commands


allowed_zoom_levels = [3, 4, 5, 6, 7, 8]


def main():
    baseURL = "https://static.satisfactory-calculator.com/imgMap/gameLayer/Stable"
    version = "1732184952"
    output_dir = "output/tiles"

    os.makedirs(output_dir, exist_ok=True)

    for zoom in allowed_zoom_levels:
        fetch_commands = get_fetch_commands(zoom, baseURL, version, output_dir)
        print(
            f"Found {len(fetch_commands)} for zoom level {zoom}. Downloading...")

        for idx, fetch_url in enumerate(fetch_commands):
            print(f"[{idx + 1}/{len(fetch_commands)}]", fetch_url)
            os.system(fetch_url)


if __name__ == "__main__":
    main()
