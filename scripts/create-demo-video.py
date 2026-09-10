"""Create a small, visibly labeled playback fixture. This is not AI generation."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math, subprocess
root = Path(__file__).resolve().parents[1]
font = '/System/Library/Fonts/Supplemental/Arial.ttf'
bold = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
proc = subprocess.Popen(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','640x640','-r','24','-i','-','-an','-c:v','libx264','-profile:v','main','-pix_fmt','yuv420p','-crf','20','-movflags','+faststart',str(root/'public/demo/studio-sample.mp4')],stdin=subprocess.PIPE)
for n in range(120):
    t=n/24
    im=Image.new('RGB',(640,640),'#111413'); d=ImageDraw.Draw(im)
    d.text((36,32),'NORTHWIND PICKS',font=ImageFont.truetype(bold,19),fill='#f0f3f1')
    d.text((36,65),'DEMO VIDEO · NOT AI GENERATED',font=ImageFont.truetype(font,13),fill='#9ba9a0')
    for r in (65,118,174): d.ellipse((320-r,294-r,320+r,294+r),outline='#234432',width=2)
    a=t*2*math.pi/5
    x,y=320+174*math.cos(a),294+174*math.sin(a)
    d.line((320,294,x,y),fill='#3dd68c',width=3); d.ellipse((x-8,y-8,x+8,y+8),fill='#3dd68c')
    d.ellipse((312,286,328,302),fill='#3dd68c')
    d.text((36,515),'A sample in motion.',font=ImageFont.truetype(bold,32),fill='#f0f3f1')
    d.text((36,562),'Playback preview · no charge',font=ImageFont.truetype(font,17),fill='#9ba9a0')
    d.rounded_rectangle((36,610,604,613),radius=1,fill='#234432')
    d.rounded_rectangle((36,610,36+568*(n+1)/120,613),radius=1,fill='#3dd68c')
    proc.stdin.write(im.tobytes())
proc.stdin.close()
assert proc.wait()==0
