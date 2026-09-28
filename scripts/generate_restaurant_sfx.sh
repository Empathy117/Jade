#!/usr/bin/env bash

set -euo pipefail

# Procedural placeholder sound effects for the 钥匙孔 visual-novel slice of
# 要求特别多的餐厅. Each is synthesized from noise and sine envelopes so the
# slice can be staged and timed end to end; the recorded replacements are
# listed in books/restaurant-demo/production-notes.md. Re-running overwrites
# only these placeholders.

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sfx_dir="$project_root/books/restaurant-demo/assets/sfx"
mkdir -p "$sfx_dir"

render() {
  local name="$1" duration="$2" expression="$3" filters="$4"
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "aevalsrc=exprs='$expression':s=44100:d=$duration" \
    -af "$filters,afade=t=out:st=$(awk "BEGIN{print $duration - 0.08}"):d=0.08,loudnorm=I=-20:TP=-3" \
    -ac 2 -c:a libmp3lame -b:a 128k "$sfx_dir/$name.mp3"
}

noise='(random(0)*2-1)'
thump() { echo "$2*sin(2*PI*$3*(t-$1))*exp(-(t-$1)*$4)*gte(t,$1)"; }

# Two slow lub-dubs, felt more than heard.
render heartbeat 1.9 \
  "$(thump 0 1 52 16)+$(thump 0.26 0.6 48 18)+$(thump 0.98 0.85 52 16)+$(thump 1.24 0.5 48 18)" \
  "lowpass=f=140"

# A whole door giving way: splintering noise over a heavy body.
render door-crash 1.5 \
  "$noise*exp(-t*8)*0.9+$(thump 0 1 66 6)+$(thump 0.05 0.5 140 14)" \
  "lowpass=f=3200,highpass=f=40"

# The 啪 of a door flung open.
render door-bang 1.0 \
  "$noise*exp(-t*26)+$(thump 0 0.9 118 20)" \
  "lowpass=f=4200,highpass=f=70"

# Dry grass pushed aside.
render rustle 2.6 \
  "$noise*(0.5+0.5*sin(2*PI*3.1*t)*sin(2*PI*0.7*t))*sin(PI*t/2.6)" \
  "bandpass=f=3800:width_type=h:w=3600"

# Voices behind a door: breath shaped into syllables, no words.
render whisper 3.6 \
  "$noise*pow(abs(sin(2*PI*4.6*t+sin(2*PI*0.9*t))),3)*sin(PI*t/3.6)" \
  "bandpass=f=2600:width_type=h:w=2800,volume=0.8"

# Muffled giggling: short breathy pulses that speed up and trail off.
render giggle 1.8 \
  "$noise*pow(abs(sin(2*PI*(6.5*t+1.2*t*t))),6)*exp(-t*1.1)" \
  "bandpass=f=1900:width_type=h:w=1800"

# A low growl with a rough flutter.
render growl 2.3 \
  "($noise*0.7+sin(2*PI*(88+6*sin(2*PI*5*t))*t)*0.5)*(0.6+0.4*sin(2*PI*27*t))*sin(PI*t/2.3)" \
  "lowpass=f=520"

# Two barks: a falling voiced burst over breath.
bark() {
  echo "(sin(2*PI*(520-900*(t-$1))*(t-$1))+0.5*sin(4*PI*(520-900*(t-$1))*(t-$1))+0.4*$noise)*exp(-(t-$1)*14)*gte(t,$1)"
}
render dog-bark 0.9 "$(bark 0)+0.9*$(bark 0.38)" "bandpass=f=900:width_type=h:w=1400"

# 喵——嗷——: a rising then falling wail with vibrato.
render cat-yowl 2.2 \
  "(sin(2*PI*(480*t+260*t*t-150*t*t*t+2*sin(2*PI*6*t)))+0.35*sin(4*PI*(480*t+260*t*t-150*t*t*t)))*sin(PI*t/2.2)" \
  "bandpass=f=1100:width_type=h:w=1600"

echo "Generated placeholder sound effects in $sfx_dir"
