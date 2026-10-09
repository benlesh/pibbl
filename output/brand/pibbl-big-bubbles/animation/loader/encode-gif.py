"""Encode shared-score PNG frames with one palette per GIF. Requires Pillow."""
from pathlib import Path
from PIL import Image
import sys,json
root=Path(__file__).resolve().parent.parent/'gif'
root.mkdir(exist_ok=True)
frames_root=Path(sys.argv[1])
report=[]
for theme in ('white','dark'):
 for sequence in ('loop','finish'):
  paths=sorted((frames_root/f'{theme}-{sequence}').glob('*.png'))
  sizes=(256,512,1024) if sequence=='loop' else (512,)
  for width in sizes:
   height=round(width*450/640)
   # Include varied moments to reserve palette entries for all shape colors and antialiasing.
   sheet=Image.new('RGB',(width*8,height*4))
   for j in range(32):
    with Image.open(paths[round(j*(len(paths)-1)/31)]) as im:
     sheet.paste(im.convert('RGB').resize((width,height),Image.Resampling.LANCZOS),((j%8)*width,(j//8)*height))
   palette=sheet.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
   frames=[]
   for p in paths:
    with Image.open(p) as im:
     frames.append(im.convert('RGB').resize((width,height),Image.Resampling.LANCZOS).quantize(palette=palette,dither=Image.Dither.NONE))
   target=root/f'pibbl-{sequence}-{theme}-{width}.gif'
   frames[0].save(target,save_all=True,append_images=frames[1:],duration=40,loop=0,optimize=False,disposal=1)
   with Image.open(target) as gif:
    duration=0
    for i in range(gif.n_frames):gif.seek(i);duration+=gif.info['duration']
    assert gif.size==(width,height)
    assert duration==len(paths)*40
    report.append(dict(file=target.name,width=width,height=height,durationMs=duration,frames=gif.n_frames,bytes=target.stat().st_size,integrity='passed'))
   print(target.name,flush=True)
(root/'EXPORTS.json').write_text(json.dumps(report,indent=2)+'\n')
