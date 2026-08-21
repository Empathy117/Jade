#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
wav_dir="$project_root/books/local/hongloumeng/assets/music-wav"
mp3_dir="$project_root/books/local/hongloumeng/assets/music"

mkdir -p "$mp3_dir"

# Uniform loudness across the BGM set, then MP3 for the Runtime. The wav
# intermediates are synthesis output and can be regenerated at any time.
for wav in "$wav_dir"/*.wav; do
  name="$(basename "${wav%.wav}")"
  ffmpeg -hide_banner -loglevel error -y -i "$wav" \
    -af "loudnorm=I=-21:LRA=11:TP=-2" \
    -ar 44100 -c:a libmp3lame -b:a 160k "$mp3_dir/$name.mp3"
  echo "encoded $name"
done
