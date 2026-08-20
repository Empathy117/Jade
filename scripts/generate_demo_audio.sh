#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ambience_dir="$project_root/books/restaurant-demo/assets/ambience"

mkdir -p "$ambience_dir"

# Demo music is curated CC0 material recorded in assets.json. This script only
# regenerates the procedural ambience tracks and must not overwrite music.

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.20:duration=48:sample_rate=44100" \
  -filter_complex "highpass=f=70,lowpass=f=1200,tremolo=f=0.12:d=0.72,volume=0.35,loudnorm=I=-28:LRA=9:TP=-5" \
  -c:a libmp3lame -b:a 96k "$ambience_dir/mountain-wind.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.08:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=50:duration=48:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=30,lowpass=f=500,volume=0.18[a];[1:a]volume=0.018[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-28:LRA=9:TP=-5" \
  -c:a libmp3lame -b:a 96k "$ambience_dir/empty-room.mp3"

echo "Generated demo ambience in $project_root/books/restaurant-demo/assets/ambience"
