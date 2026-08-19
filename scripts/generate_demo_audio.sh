#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
music_dir="$project_root/books/restaurant-demo/assets/music"
ambience_dir="$project_root/books/restaurant-demo/assets/ambience"

mkdir -p "$music_dir" "$ambience_dir"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=110:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=165:duration=48:sample_rate=44100" \
  -filter_complex "[0:a]volume=0.10,tremolo=f=0.125:d=0.18[a];[1:a]volume=0.035,tremolo=f=0.125:d=0.25[b];[a][b]amix=inputs=2:normalize=0,lowpass=f=1200,loudnorm=I=-24:LRA=7:TP=-3" \
  -c:a libmp3lame -b:a 128k "$music_dir/forest-stillness.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=73:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=146:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=219:duration=48:sample_rate=44100" \
  -filter_complex "[0:a]volume=0.08,tremolo=f=0.125:d=0.3[a];[1:a]volume=0.035,tremolo=f=0.125:d=0.2[b];[2:a]volume=0.012,tremolo=f=0.1:d=0.4[c];[a][b][c]amix=inputs=3:normalize=0,lowpass=f=900,loudnorm=I=-24:LRA=7:TP=-3" \
  -c:a libmp3lame -b:a 128k "$music_dir/corridor-unease.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=55:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=58:duration=48:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.06:duration=48:sample_rate=44100" \
  -filter_complex "[0:a]volume=0.12[a];[1:a]volume=0.09[b];[2:a]lowpass=f=360,highpass=f=45[c];[a][b][c]amix=inputs=3:normalize=0,tremolo=f=0.166666:d=0.25,loudnorm=I=-24:LRA=7:TP=-3" \
  -c:a libmp3lame -b:a 128k "$music_dir/final-door-tension.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.20:duration=48:sample_rate=44100" \
  -filter_complex "highpass=f=70,lowpass=f=1200,tremolo=f=0.12:d=0.72,volume=0.35,loudnorm=I=-28:LRA=9:TP=-5" \
  -c:a libmp3lame -b:a 96k "$ambience_dir/mountain-wind.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.08:duration=48:sample_rate=44100" \
  -f lavfi -i "sine=frequency=50:duration=48:sample_rate=44100" \
  -filter_complex "[0:a]highpass=f=30,lowpass=f=500,volume=0.18[a];[1:a]volume=0.018[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-28:LRA=9:TP=-5" \
  -c:a libmp3lame -b:a 96k "$ambience_dir/empty-room.mp3"

echo "Generated demo audio in $project_root/books/restaurant-demo/assets"
