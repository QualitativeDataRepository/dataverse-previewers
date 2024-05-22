#!/bin/bash

dirLocal=$(pwd)


# go to the version folder
if [ -z "$1" ]; then
    echo "The variable is empty."
    exit 1
fi
folder="$1"
cd "${folder}"


sed -n 's/.*src="\(http[^"]*\)".*/\1/p' *.html | sort -u | sed -n 's/^\(.*\/\)*\(.*\)/sed -i \x27s,\0\,lib\/\2,\x27 *.html/p' > replace_js.sh
sed -n 's/.*src="\(http[^"]*\)".*/\1/p' *.html | sort -u  > urls_js.txt
source replace_js.sh


if [ ! -d ./lib ]; then
  mkdir ./lib
fi
cd ./lib
while read url; do
    wget --quiet $url
done < "../urls_js.txt"


cd ".."
if [ ! -d ./css ]; then
  mkdir ./css
fi
cd ./css
while read url; do
    wget --quiet $url
done < "${dirLocal}/urls_css.txt"

exit 0
