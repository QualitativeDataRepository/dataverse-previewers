import os, yaml, subprocess, shutil
from checksumdir import dirhash


def build_react_app(source_dir, TARGET_DIR, REPO_DIR):
    # Move to the source directory to read metadata and instructions
    os.chdir(source_dir)

    # Read the previewers metadata
    metadata = yaml.safe_load(open("previewer-meta.yaml"))
    dist_path = os.path.join(TARGET_DIR, metadata["name"].lower())

    # Get the hash of the source directory
    source_hash = dirhash(
        metadata["checkdir"],
        "sha256",
        excluded_files=[
            "previewer-meta.yaml",
            *metadata["files"],
        ],
    )

    if metadata["checksum"] == source_hash:
        print(f"No changes detected for {metadata['name']}")
        return
    else:
        print(f"Changes detected for {metadata['name']} updating checksum")
        metadata["checksum"] = source_hash
        yaml.safe_dump(metadata, open("previewer-meta.yaml", "w"), sort_keys=False)

    if not os.path.exists(dist_path):
        os.mkdir(dist_path)

    for command in metadata["build"]:
        subprocess.call(command, shell=True)

    for file in metadata["files"]:
        fname = os.path.basename(file)
        shutil.copy(file, os.path.join(dist_path, fname))

    os.chdir(REPO_DIR)


if __name__ == "__main__":
    # Build the react previewers
    BASE_DIR = "./previewers/react-source/"
    REPO_DIR = os.getcwd()
    TARGET_DIR = os.path.join(REPO_DIR, "previewers", "react-previewers")

    # Get all the react previewers
    react_previewers = [
        os.path.join(BASE_DIR, path)
        for path in os.listdir(BASE_DIR)
        if not path.startswith(".")
    ]

    for source_dir in react_previewers:
        build_react_app(source_dir, TARGET_DIR, REPO_DIR)
