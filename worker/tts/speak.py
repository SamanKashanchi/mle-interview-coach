# Reads text on stdin and writes it as speech to a WAV file with Kokoro (runs on this Mac, no API).
#   speak.py <out.wav> [voice]
# worker/setup.sh installs kokoro-onnx in worker/tts/venv and downloads the model into worker/models/.
import os
import sys

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', 'models')

out = sys.argv[1]
voice = sys.argv[2] if len(sys.argv) > 2 else 'bf_emma'
text = sys.stdin.read().strip()
if not text:
    sys.exit('no text to speak')

kokoro = Kokoro(os.path.join(MODELS, 'kokoro-v1.0.onnx'), os.path.join(MODELS, 'voices-v1.0.bin'))
# Voices starting with b are British; they also need British pronunciation.
lang = 'en-gb' if voice.startswith('b') else 'en-us'
samples, rate = kokoro.create(text, voice=voice, speed=1.0, lang=lang)
sf.write(out, samples, rate)
