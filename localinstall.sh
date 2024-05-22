#!/bin/bash


# go to the version folder
if [ -z "$1" ]; then
    echo "The variable is empty. Provide the relative path to the previewer version you wish to make an all-local instance of."
    exit 1
fi
folder="$1"
cd "${folder}"

echo Downloading local copies of remote JavaScript libraries:
sed -n 's/.*src="\(http[^"]*\)".*/\1/p' *.html | sort -u | sed -n 's/^\(.*\/\)*\(.*\)/sed -i \x27s,\0\,lib\/\2,\x27 *.html/p' > replace_js.sh
sed -n 's/.*src="\(http[^"]*\)".*/\1/p' *.html | sort -u  > urls_js.txt
source replace_js.sh
cat urls_js.txt

echo Downloading local copies of remote CSS files:
sed -n 's/.*<link.*href="\(http[^"]*\)".*/\1/p' *.html | sort -u | sed -n 's/^\(.*\/\)*\(.*\)/sed -i \x27s,\0\,lib\/\2,\x27 *.html/p' > replace_css.sh
sed -n 's/.*<link.*href="\(http[^"]*\)".*/\1/p' *.html | sort -u ?urls_css.txt
source replace_css.sh
cat urls_css.txt

if [ ! -d ./lib ]; then
  mkdir ./lib
fi
cd ./lib
while read url; do
    wget --quiet $url
done < "../urls_js.txt"


cd "${folder}"
if [ ! -d ./css ]; then
  mkdir ./css
fi
cd ./css
while read url; do
    wget --quiet $url
done < "../urls_css.txt"

cd ..

echo Cleaning Up...
rm urls_js.txt
rm urls_css.txt
rm replace_js.sh
rm replace_css.sh

echo Done
exit 0