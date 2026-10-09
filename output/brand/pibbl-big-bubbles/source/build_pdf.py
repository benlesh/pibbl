"""Build vector print masters and the usage guide. Requires reportlab."""
from pathlib import Path
import json
import sys
import re
import xml.etree.ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.graphics.shapes import Drawing, Group
from reportlab.graphics.svgpath import SvgPath
from reportlab.graphics import renderPDF, renderPS

ROOT = Path(__file__).resolve().parent.parent
I = json.loads((ROOT / 'source/identity.json').read_text())
P = I['palette']
W, H = 842, 595

def svg_drawing(file):
    tree = ET.parse(file).getroot()
    w, h = map(float, tree.attrib['viewBox'].split()[2:])
    clips={el.attrib['id']:el for el in tree.iter() if el.tag.split('}')[-1]=='clipPath'}
    drawing = Drawing(w, h)
    outer = Group()
    outer.scale(1, -1)
    outer.translate(0, -h)
    def add(el, parent, fill='#000000'):
        fill = el.attrib.get('fill', fill)
        tag = el.tag.split('}')[-1]
        if tag == 'path':
            parent.add(SvgPath(el.attrib['d'], fillColor=HexColor(fill), strokeColor=None, autoclose='svg',
                               fillMode=0 if el.attrib.get('fill-rule') == 'evenodd' else 1))
        elif tag in ('svg', 'g'):
            group = Group()
            for op, args in re.findall(r'(translate|scale)\(([^)]+)\)', el.attrib.get('transform', '')):
                nums = [float(n) for n in re.split(r'[ ,]+', args.strip())]
                if op == 'translate': group.translate(nums[0], nums[1] if len(nums) > 1 else 0)
                else: group.scale(nums[0], nums[1] if len(nums) > 1 else nums[0])
            if 'clip-path' in el.attrib:
                ref=el.attrib['clip-path'][5:-1]
                for child in clips[ref]:
                    group.add(SvgPath(child.attrib['d'],isClipPath=1,fillColor=None,strokeColor=None,autoclose='svg',fillMode=1))
            for child in el: add(child, group, fill)
            parent.add(group)
    add(tree, outer)
    drawing.add(outer)
    return drawing

if '--guide-only' not in sys.argv:
    for file in sorted((ROOT / 'svg').glob('*.svg')):
        drawing = svg_drawing(file)
        for ext, renderer in [('pdf', renderPDF), ('eps', renderPS)]:
            dest = ROOT / 'print' / ext / f'{file.stem}.{ext}'
            dest.parent.mkdir(parents=True, exist_ok=True)
            renderer.drawToFile(drawing, str(dest))

guide = ROOT / 'Pibbl-Big-Bubbles-Brand-Guide.pdf'
c = canvas.Canvas(str(guide), pagesize=(W, H))
c.setTitle('Pibbl Big Bubbles - Logo & Usage Guide')
c.setAuthor('Pibbl')

def box(x, y, w, h, color):
    c.setFillColor(HexColor(color)); c.rect(x, H-y-h, w, h, fill=1, stroke=0)

def text(x,y,s,size=12,color=None,font='Helvetica'):
    c.setFillColor(HexColor(color or P['ink'])); c.setFont(font,size); c.drawString(x,H-y-size,s)

def paragraph(x,y,s,width=78,size=11,color=None):
    import textwrap
    for line in textwrap.wrap(s,width):
        text(x,y,line,size,color);y+=size*1.45
    return y

def logo(form, style, x,y,w):
    d = svg_drawing(ROOT/'svg'/f'pibbl-{form}-{style}.svg')
    factor=w/d.width
    c.saveState();c.translate(x,H-y-d.height*factor);c.scale(factor,factor);renderPDF.draw(d,c,0,0);c.restoreState()
    return d.height*factor

def page(number,title,subtitle):
    box(0,0,W,H,P['paper'])
    text(42,28,'PIBBL / BIG BUBBLES',9,font='Helvetica-Bold')
    text(42,56,title,29,font='Helvetica-Bold')
    text(42,96,subtitle,11)
    box(42,550,758,1,'#D9DBD5')
    text(42,565,f"LOGO SUITE {I['version']} / OCTOBER 2026",8)
    text(750,565,f'{number:02d} / 05',8)

page(1,'Simple shapes. Playful possibilities.','The approved Tangram, with an organic cloud of bubbles and three vivid colors.')
box(42,131,758,245,P['white'])
logo('horizontal','color',146,141,550)
text(42,396,'Triangle / rectangle / curved bowl / bubbles',17,font='Helvetica-Bold')
paragraph(42,426,'The mark combines geometric composition with a playful particle release. Preserve the shape geometry, approved colors, interior cutouts and fixed bubble positions; the cloud is designed to feel organic.',75)
for i,key in enumerate(['coral','green','violet','ink']):
    box(580+i*56,413,46,46,P[key])
text(580,471,'Four core colors',10)
c.showPage()

page(2,'A lockup for every space.','Use one consistent mark across wide, tall, compact and text-only placements.')
cards=[('horizontal','color',42,132,365,180,'Primary / websites, decks and headers'),
       ('stacked','color',435,132,365,180,'Stacked / centered and square placements'),
       ('icon','color',42,333,365,180,'Icon / avatars, apps and favicons'),
       ('wordmark','color-on-dark',435,333,365,180,'Wordmark / supporting identity')]
for form,style,x,y,w,h,label in cards:
    dark=style=='color-on-dark';box(x,y,w,h,P['dark'] if dark else P['white'])
    lw=280 if form in ('horizontal','wordmark') else (120 if form=='stacked' else 94)
    d=I['forms'][form];lh=lw*d['height']/d['width']
    logo(form,style,x+(w-lw)/2,y+(h-30-lh)/2,lw)
    text(x+16,y+h-24,label,9,P['white'] if dark else P['ink'])
c.showPage()

page(3,'Color and lettering.','Flat source colors and a wordmark that travels without a font dependency.')
keys=['coral','green','violet','ink','white','dark']
for i,key in enumerate(keys):
    x=42+(i%3)*260;y=133+(i//3)*158
    box(x,y,238,69,P[key]);text(x,y+79,key.upper(),11,font='Helvetica-Bold')
    rgb=tuple(int(P[key][k:k+2],16) for k in (1,3,5))
    text(x,y+99,f'{P[key]}  /  RGB {rgb[0]} {rgb[1]} {rgb[2]}',10)
    r,g,b=(n/255 for n in rgb);k=1-max(r,g,b)
    vals=(0,0,0,100) if k==1 else tuple(round(v*100) for v in ((1-r-k)/(1-k),(1-g-k)/(1-k),(1-b-k)/(1-k),k))
    text(x,y+117,'CMYK approx. '+' / '.join(map(str,vals)),9,'#5B605D')
text(42,465,'The logo lettering is custom geometric artwork.',14,font='Helvetica-Bold')
paragraph(42,493,'All SVG lettering is outlined. Keep the lowercase pibbl artwork intact; use a readable sans serif for surrounding copy. CMYK values are conversion starting points: ask your printer to proof the intended stock and color profile.',113,10)
c.showPage()

page(4,'Space, scale and contrast.','Preserve breathing room; use the simplified icon when bubble details become too small.')
box(42,132,470,221,P['white'])
logo('horizontal','color',87,146,380)
c.setStrokeColor(HexColor('#8E9690'));c.setDash(3,3)
c.rect(87,H-146-380*I['forms']['horizontal']['height']/I['forms']['horizontal']['width'],380,380*I['forms']['horizontal']['height']/I['forms']['horizontal']['width'],fill=0,stroke=1);c.setDash()
text(60,320,'Keep at least 35 master units of space around the entire cloud.',10)
text(540,139,'Recommended minimum sizes',14,font='Helvetica-Bold')
for n,s in enumerate(['Full icon: 64 px high','Horizontal: 240 px wide','Stacked: 160 px wide','Wordmark: 100 px wide']):text(540,175+n*29,s,11)
text(540,303,'Solid Tangram favicon: 16 / 32 / 48 px.',9)
for x,bg,style,label in [(42,P['white'],'black','One color / dark'),(302,P['dark'],'white','One color / reversed'),(562,P['dark'],'color-on-dark','Full color / dark background')]:
    box(x,376,238,113,bg);logo('horizontal',style,x+10,397,218);text(x,504,label,10)
text(42,528,'Keep proportions. Keep color order. Avoid shadows, outlines, recoloring and busy backgrounds.',10)
c.showPage()

page(5,'Ready to use. Easy to hand off.','The kit includes vector masters, raster exports, marketing artwork and source files.')
rows=[('svg/','16 editable masters: horizontal, stacked, icon and wordmark.'),
      ('png/','Transparent exports at multiple sizes, up to 4096 px wide.'),
      ('print/','Vector PDF and EPS masters in all four colorways.'),
      ('web/','Favicon SVG/ICO/PNG, touch/app icons, WebP and web manifest.'),
      ('marketing/','Profiles, share cards, banners, slides, square posts, wallpaper,'),
      ('','pattern, sticker artwork and an email signature logo.'),
      ('animation/','SVG loader, three GIF sizes, bubble assets and Pibbl port guidance.'),
      ('source/','Identity specification, path artwork and reproducible export builders.')]
for n,(a,b) in enumerate(rows):
    y=129+n*29;text(42,y,a,11,font='Helvetica-Bold');text(157,y,b,10)
box(42,389,758,133,P['white'])
text(60,406,'Using the files',14,font='Helvetica-Bold')
paragraph(60,435,'Use SVG for websites and design tools, transparent PNG for slides and quick placement, and PDF/EPS for print workflows. White and color-on-dark logo files are transparent: place them on a dark background. Marketing exports include their background.',105,10)
paragraph(60,485,'Approved SVG loader: playful contact motion, then the P and bubble release on Ready. Includes white/dark GIFs and a Pibbl reproduction handoff. This brand implementation stays outside the Pibbl docs.',105,9,'#5B605D')
c.showPage();c.save()
print('Created 5-page brand guide.' if '--guide-only' in sys.argv else 'Created 16 vector PDFs, 16 EPS masters, and a 5-page brand guide.')
