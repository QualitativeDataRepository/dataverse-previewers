#!/usr/bin/env python3

import argparse
import re
import shlex
import subprocess
from pathlib import Path


BETA_MARKER = "## Beta Versions:"
UNBLOCK_HEADER = "X-Dataverse-unblock-key"


def add_unblock_header(command, unblock_key):
    """Add the unblock header after the initial curl command."""
    if unblock_key is None:
        return command

    header_value = f"{UNBLOCK_HEADER}: {unblock_key}"
    quoted_header = shlex.quote(header_value)

    # Match curl at the start of a non-empty command line.
    return re.sub(
        r"(?m)^(\s*)curl(?=\s|$)",
        rf"\1curl -H {quoted_header}",
        command,
        count=1,
    )


def find_curl_blocks(path, version, unblock_key=None):
    blocks = []
    in_beta_section = False
    in_code_block = False
    current = []

    for line in Path(path).read_text(encoding="utf-8").splitlines(
            keepends=True
    ):
        stripped = line.strip()

        if stripped.startswith(BETA_MARKER):
            in_beta_section = True
            continue

        include_section = (
            in_beta_section if version == "beta" else not in_beta_section
        )

        if not in_code_block:
            if include_section and stripped == "```bash":
                in_code_block = True
                current = []
        else:
            if stripped == "```":
                command = "".join(current)

                first_line = next(
                    (
                        line.strip()
                        for line in command.splitlines()
                        if line.strip()
                    ),
                    "",
                )

                if first_line == "curl" or first_line.startswith("curl "):
                    command = add_unblock_header(command, unblock_key)
                    blocks.append(command)

                in_code_block = False
            else:
                current.append(line)

    return blocks


def main():
    parser = argparse.ArgumentParser(
        description="Find and execute curl commands in fenced bash blocks."
    )

    parser.add_argument(
        "file",
        help="Input file containing the curl commands",
    )

    parser.add_argument(
        "version",
        choices=("standard", "beta"),
        help=(
            "Select standard previewers before '## Beta Versions:' "
            "or beta-only previewers after it"
        ),
    )

    parser.add_argument(
        "--unblock-key",
        help=(
            "Optional value for the X-Dataverse-unblock-key header"
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without executing them",
    )

    args = parser.parse_args()

    blocks = find_curl_blocks(
        args.file,
        args.version,
        args.unblock_key,
    )

    print(f"Found {len(blocks)} {args.version} curl command block(s).")

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