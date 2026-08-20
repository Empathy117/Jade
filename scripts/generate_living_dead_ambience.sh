#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ambience_dir="$project_root/books/death-of-the-living-dead/assets/ambience"

mkdir -p "$ambience_dir"

# Music for this book is curated public-domain / CC0 material recorded in
# assets.json. This script only regenerates the procedural ambience beds and
# must not overwrite music.

# Dry maple leaves and open hillside wind above the garden cemetery.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.22:duration=60:sample_rate=44100" \
  -filter_complex "highpass=f=90,lowpass=f=1800,tremolo=f=0.11:d=0.78,volume=0.32,loudnorm=I=-30:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/autumn-wind.mp3"

# Cabin rumble and slipstream of the hearse on Route 113.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.16:duration=60:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.05:duration=60:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=35,lowpass=f=420,volume=0.30[a];[1:a]highpass=f=400,lowpass=f=2600,tremolo=f=0.12:d=0.4,volume=0.10[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-30:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/road-wind.mp3"

# Marble halls and closed rooms: a low, almost inaudible building tone.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.07:duration=60:sample_rate=44100" \
  -f lavfi -i "sine=frequency=52:duration=60:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=28,lowpass=f=420,volume=0.16[a];[1:a]volume=0.016[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-32:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/room-tone.mp3"

# Distant city at night: traffic wash under a closed window.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.12:duration=60:sample_rate=44100" \
  -filter_complex "highpass=f=40,lowpass=f=900,tremolo=f=0.1:d=0.5,volume=0.24,loudnorm=I=-31:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/night-city.mp3"

# Burning gasoline and, later, a burning house.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.26:duration=60:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=white:amplitude=0.10:duration=60:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=45,lowpass=f=1100,tremolo=f=0.9:d=0.55,volume=0.30[a];[1:a]highpass=f=1800,lowpass=f=7000,tremolo=f=7:d=0.85,volume=0.07[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-29:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/fire.mp3"

echo "Generated ambience in $ambience_dir"
