#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ambience_dir="$project_root/books/local/hongloumeng/assets/ambience"

mkdir -p "$ambience_dir"

# Music for this book is synthesized by scripts/synth_hongloumeng_music.py.
# This script only regenerates the procedural ambience beds.

# 秋雨敲窗：steady rain wash with soft droplet flutter.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.2:duration=64:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=white:amplitude=0.06:duration=64:sample_rate=44100:seed=7" \
  -filter_complex "[0:a]highpass=f=300,lowpass=f=2600,volume=0.3[a];[1:a]highpass=f=1200,lowpass=f=6400,tremolo=f=9:d=0.85,volume=0.1[b];[a][b]amix=inputs=2:normalize=0,loudnorm=I=-31:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/rain.mp3"

# 潇湘竹风：leaves washing in slow gusts.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.2:duration=64:sample_rate=44100:seed=3" \
  -filter_complex "highpass=f=500,lowpass=f=3800,tremolo=f=0.14:d=0.82,volume=0.26,loudnorm=I=-31:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/bamboo.mp3"

# 夏夜虫声：layered chirps over a faint night floor.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=4200:duration=64:sample_rate=44100" \
  -f lavfi -i "sine=frequency=5150:duration=64:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.05:duration=64:sample_rate=44100" \
  -filter_complex "[0:a]tremolo=f=13:d=1,apulsator=mode=sine:hz=0.09:width=0.9,volume=0.05[a];[1:a]tremolo=f=17:d=1,apulsator=mode=sine:hz=0.13:offset_l=0.4:width=0.9,volume=0.033[b];[2:a]lowpass=f=300,volume=0.12[c];[a][b][c]amix=inputs=3:normalize=0,loudnorm=I=-33:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/crickets.mp3"

# 朔风夹雪：a colder, keener wind for winter nights.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "anoisesrc=color=pink:amplitude=0.22:duration=64:sample_rate=44100:seed=11" \
  -filter_complex "highpass=f=160,lowpass=f=1400,tremolo=f=0.11:d=0.85,tremolo=f=0.23:d=0.3,volume=0.3,loudnorm=I=-30:LRA=9:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/snowwind.mp3"

# 远寺钟磬：a bronze strike every so often over near-silence.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=142:duration=64:sample_rate=44100" \
  -f lavfi -i "sine=frequency=389:duration=64:sample_rate=44100" \
  -f lavfi -i "anoisesrc=color=brown:amplitude=0.04:duration=64:sample_rate=44100" \
  -filter_complex "[0:a]apulsator=mode=square:hz=0.031:width=0.16,aeval=val(0)*exp(-mod(t\,32)/6)[a];[1:a]apulsator=mode=square:hz=0.031:width=0.12,aeval=val(0)*exp(-mod(t\,32)/4),volume=0.4[b];[2:a]lowpass=f=240,volume=0.16[c];[a][b][c]amix=inputs=3:normalize=0,volume=0.5,loudnorm=I=-33:LRA=11:TP=-6" \
  -c:a libmp3lame -b:a 80k "$ambience_dir/temple.mp3"

echo "Generated ambience in $ambience_dir"
