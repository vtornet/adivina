@echo off
mkdir normalizados
for %%f in (*.mp3) do (
    ffmpeg -i "%%f" -af "loudnorm,volume=3dB" "normalizados\%%~nf.mp3"
)
pause
