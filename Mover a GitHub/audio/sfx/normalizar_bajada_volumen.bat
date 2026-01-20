@echo off
mkdir volumen-reducido
for %%f in (*.mp3) do (
    ffmpeg -i "%%f" -af "volume=-3dB" "volumen-reducido\%%~nf.mp3"
)
pause
