"""Validate the delivered asset set. Requires Pillow, pypdf and reportlab."""
from pathlib import Path
from html.parser import HTMLParser
import json
import xml.etree.ElementTree as ET
from PIL import Image
from pypdf import PdfReader
from reportlab.graphics.svgpath import SvgPath

ROOT=Path(__file__).resolve().parent.parent
I=json.loads((ROOT/'source/identity.json').read_text())
pieces={piece['id']:piece['d'] for piece in I['icon']}
assert SvgPath(pieces['bowl']).getBounds()[3]==SvgPath(pieces['square']).getBounds()[1]==140, 'Bowl/rectangle alignment drift'
catalog=json.loads((ROOT/'source/export-catalog.json').read_text())
svg_count=png_count=0
for item in catalog:
    f=ROOT/item['file']
    assert f.is_file() and f.stat().st_size>0, f'Missing export: {f}'
    if item.get('format')=='svg':
        el=ET.parse(f).getroot()
        assert el.attrib['viewBox'].startswith('0 0 ')
        svg_count+=1
    if item.get('format') in ('png','jpg','webp'):
        with Image.open(f) as im:
            assert im.size==(item['width'],item['height']),f'Wrong size: {f}'
            im.verify()
        png_count+=1

for f in (ROOT/'svg').glob('*.svg'):
    el=ET.parse(f).getroot()
    assert not any(e.tag.split('}')[-1] in ('image','text','foreignObject','script') for e in el.iter()),f'Non-path master: {f}'
    assert not any('href' in k for e in el.iter() for k in e.attrib),f'External dependency: {f}'
    assert any(e.attrib.get('id')=='tangram-mark' for e in el.iter()) or 'wordmark' in f.name
    for e in el.iter():
        if e.attrib.get('id') in pieces: assert e.attrib['d']==pieces[e.attrib['id']],f'Geometry drift: {f}'

for f in (ROOT/'png').rglob('*.png'):
    with Image.open(f) as im:
        assert im.mode=='RGBA',f'No alpha: {f}'
        alpha=im.getchannel('A');bounds=alpha.getbbox()
        assert alpha.getpixel((0,0))==0,f'Not transparent: {f}'
        assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<im.width and bounds[3]<im.height,f'Clipped artwork: {f}'

for f in (ROOT/'print/pdf').glob('*.pdf'):
    reader=PdfReader(f)
    assert len(reader.pages)==1
    assert not list(reader.pages[0].images),f'Raster content in vector master: {f}'
for f in (ROOT/'print/eps').glob('*.eps'):
    data=f.read_text()
    assert data.startswith('%!PS-Adobe') and '%%BoundingBox:' in data
    lines=data.splitlines()
    assert 'fill' in lines or 'eofill' in lines,f'Unpainted EPS: {f}'
    if 'icon' not in f.name: assert 'eofill' in lines,f'Missing wordmark counters: {f}'

assert len(list((ROOT/'svg').glob('*.svg')))==16
assert len(list((ROOT/'print/pdf').glob('*.pdf')))==16
assert len(list((ROOT/'print/eps').glob('*.eps')))==16
assert len(PdfReader(ROOT/'Pibbl-Big-Bubbles-Brand-Guide.pdf').pages)==5
assert Image.open(ROOT/'web/favicon.ico').ico.sizes()=={(16,16),(32,32),(48,48)}
manifest=json.loads((ROOT/'web/site.webmanifest').read_text())
for icon in manifest['icons']:assert (ROOT/'web'/icon['src']).exists()

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        self.links.extend(v for k,v in attrs if k in ('src','href'))
page=Links();page.feed((ROOT/'index.html').read_text())
for link in page.links:
    if link.endswith('.zip'):continue # Delivery archive is a sibling of the kit.
    assert (ROOT/link).is_file(),f'Broken catalog link: {link}'

report={'result':'passed','checks':[
    'Violet bowl bottom and green rectangle top align exactly at y=140; all SVG masters share the corrected geometry',
    'Export existence, file decoding and exact raster dimensions',
    '16 standalone vector SVG masters with path-only lettering and no external resources',
    'Transparent, unclipped core PNG exports',
    '16 vector PDFs without raster images; 16 EPS masters with painting and counter operators',
    '5-page brand guide',
    'Multiresolution ICO and web manifest icon references',
    'All local catalog asset links'
], 'exportsInCatalog':len(catalog),'svgExports':svg_count,'rasterExports':png_count}
for style in ('color','color-on-dark','black','white'):
    with Image.open(ROOT/'png/icon'/f'pibbl-icon-{style}-2048.png') as im:
        scale=im.width/I['forms']['icon']['width']
        for cut in I['cutouts']:
            x,y=round((35+cut['x'])*scale),round((41+cut['y'])*scale)
            assert im.getpixel((x,y))[3]==0, 'Opaque bubble cutout'
        for bubble in I['bubbles']:
            d=bubble['destination']
            x,y=round((35+d['x'])*scale),round((41+d['y'])*scale)
            color=bubble['fill'] if style in ('color','color-on-dark') else I['palette']['ink' if style=='black' else 'white']
            rgb=tuple(int(color[k:k+2],16) for k in (1,3,5))
            assert im.getpixel((x,y))==(*rgb,255), 'Bubble color drift'
for bubble in I['bubbles']:
    assert (ROOT/'animation/parts'/f'{bubble["id"]}.svg').exists()
report['checks'] += ['All five cutouts are transparent in every colorway',
                    'All nine bubble colors and positions match the approved identity',
                    'All nine independent animation bubble assets exist']
(ROOT/'source/verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
