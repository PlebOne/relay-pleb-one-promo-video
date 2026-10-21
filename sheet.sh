#!/bin/sh
# Tiles out/still-*.png for the given times into one preview image: ./sheet.sh out/sheet.png 1 2.6 ...
o=$1; shift; in=""; for t in "$@"; do in="$in out/still-$t.png"; done
montage $in -tile 3x -geometry 640x360+6+6 -background '#333' -font DejaVu-Sans -pointsize 18 $o 2>/dev/null || ffmpeg -v error -y $(for f in $in; do printf -- "-i %s " $f; done) -filter_complex "$(n=0; for f in $in; do printf "[%d]scale=640:360[v%d];" $n $n; n=$((n+1)); done; n=0; for f in $in; do printf "[v%d]" $n; n=$((n+1)); done; printf "xstack=inputs=%d:layout=" $#; i=0; for f in $in; do c=$((i%3)); r=$((i/3)); printf "%s%s_%s" "$( [ $i -gt 0 ] && echo '|')" "$([ $c = 0 ] && echo 0 || echo $((c*640)))" "$([ $r = 0 ] && echo 0 || echo $((r*360)))"; i=$((i+1)); done; printf ":fill=black")" $o
