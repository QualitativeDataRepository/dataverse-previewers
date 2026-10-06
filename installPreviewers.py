#!/usr/bin/env python3

import argparse
import subprocess
from pathlib import Path


def find_curl_blocks(path):
    blocks = []
    in_block = False
    current = []

    for line in Path(path).read_text().splitlines(keepends=True):
        stripped = line.strip()

        if not in_block:
            if stripped == "```bash":
                in_block = True
                current = []
        else:
            if stripped == "```":
                command = "".join(current)
                first_line = next(
                    (line.strip() for line in command.splitlines() if line.strip()),
                    "",
                )

                if first_line == "curl" or first_line.startswith("curl "):
                    blocks.append(command)

                in_block = False
            else:
                current.append(line)

    return blocks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("file", help="Input file containing curl commands")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing them",
    )
    args = parser.parse_args()

    blocks = find_curl_blocks(args.file)

    print(f"Found {len(blocks)} curl command block(s).")

    for index, command in enumerate(blocks, start=1):
        print(f"\n--- Command {index} ---")
        print(command.rstrip())

        if args.dry_run:
            continue

        print("--- Executing ---")
        subprocess.run(
            command,
            shell=True,
            executable="/bin/bash",
            check=True,
        )


if __name__ == "__main__":
    main()