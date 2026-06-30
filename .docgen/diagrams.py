# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import os
OUT = os.path.join(os.path.dirname(__file__), 'figs')
PUR='#7c3aed'; DARK='#2b2b40'; GREY='#555'; LP='#ede9fe'; BG='#f7f7fb'
plt.rcParams['font.family']='DejaVu Sans'

def box(ax,x,y,w,h,txt,fc='white',ec=PUR,fs=10,tc='#222',bold=False):
    b=FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.02,rounding_size=0.06",
                     fc=fc,ec=ec,lw=1.6,zorder=2)
    ax.add_patch(b)
    ax.text(x+w/2,y+h/2,txt,ha='center',va='center',fontsize=fs,color=tc,
            zorder=3,wrap=True,fontweight='bold' if bold else 'normal')

def arrow(ax,x1,y1,x2,y2,txt='',color=GREY,style='-|>',ls='-'):
    a=FancyArrowPatch((x1,y1),(x2,y2),arrowstyle=style,mutation_scale=14,
                      lw=1.5,color=color,zorder=1,linestyle=ls,
                      connectionstyle="arc3,rad=0")
    ax.add_patch(a)
    if txt:
        ax.text((x1+x2)/2,(y1+y2)/2+0.06,txt,ha='center',va='bottom',fontsize=8,color=color)

def save(fig,name):
    fig.savefig(os.path.join(OUT,name),dpi=160,bbox_inches='tight',facecolor='white')
    plt.close(fig); print("saved",name)

# 1. Architecture (3 layers)
fig,ax=plt.subplots(figsize=(7.2,4.6)); ax.set_xlim(0,10); ax.set_ylim(0,9); ax.axis('off')
box(ax,1,7,8,1.5,'Stratul de interfață  —  React + TypeScript\n(componente, vizualizări, controale)',LP,PUR,10,'#3b2a6b',True)
box(ax,1,4,8,1.5,'Puntea audio  —  AudioWorklet (fir audio dedicat)\nîncarcă WASM · copiază tampoane · transmite mesaje',BG,PUR,10,'#222',True)
box(ax,1,1,8,1.5,'Motorul de procesare  —  Rust → WebAssembly\nlanț de efecte stereo · sintetizator · analiză',LP,PUR,10,'#3b2a6b',True)
arrow(ax,5,7,5,5.5,'mesaje de control (postMessage)',PUR)
arrow(ax,4.6,4,4.6,2.5,'apeluri funcții (FFI / pointeri)',PUR)
arrow(ax,5.4,2.5,5.4,4,'date de analiză',GREY)
arrow(ax,5,5.5,5,7,'date de analiză (≈30 Hz)',GREY)
ax.text(5,8.7,'Arhitectura pe trei straturi a aplicației ResoLab',ha='center',fontsize=11,fontweight='bold',color=DARK)
save(fig,'fig_architecture.png')

# 2. Signal flow
fig,ax=plt.subplots(figsize=(8.6,3.4)); ax.set_xlim(0,13); ax.set_ylim(0,6); ax.axis('off')
box(ax,0.2,4.2,2.4,1,'Fișier audio\n(decodat local)',BG,PUR,9)
box(ax,0.2,2.6,2.4,1,'Sintetizator',BG,PUR,9)
box(ax,0.2,1.0,2.4,1,'Microfon /\ninterfață audio',BG,PUR,9)
box(ax,3.4,2.6,2.2,1,'Punct de\ninjectare',LP,PUR,9,'#3b2a6b',True)
box(ax,6.3,2.6,3.0,1,'Lanț de efecte\n(stereo, în Rust/WASM)',LP,PUR,9,'#3b2a6b',True)
box(ax,10.0,2.6,2.6,1,'Ieșire audio\n(difuzoare/căști)',BG,PUR,9)
box(ax,10.0,0.6,2.6,1,'Ramură de\nanaliză → vizualizări',BG,GREY,9)
for y in (4.7,3.1,1.5): arrow(ax,2.6,y,3.4,3.1,color=PUR)
arrow(ax,5.6,3.1,6.3,3.1,color=PUR)
arrow(ax,9.3,3.1,10.0,3.1,color=PUR)
arrow(ax,9.3,3.0,10.0,1.1,color=GREY,ls='--')
ax.text(6.5,5.4,'Traseul semnalului audio prin sistem',ha='center',fontsize=11,fontweight='bold',color=DARK)
save(fig,'fig_signalflow.png')

# 3. Data flow round trip
fig,ax=plt.subplots(figsize=(8.6,3.2)); ax.set_xlim(0,13); ax.set_ylim(0,5); ax.axis('off')
for i,(t) in enumerate(['Buton rotativ\n(interfață)','Depozit Zustand\n(stare)','AudioWorklet','Motor Rust/WASM']):
    box(ax,0.3+i*3.2,3.0,2.6,1.1,t,LP if i in(0,3) else BG,PUR,9)
for i in range(3): arrow(ax,2.9+i*3.2,3.55,3.5+i*3.2,3.55,color=PUR)
for i,(t) in enumerate(['Vizualizări\n(Canvas)','Depozit de analiză','AudioWorklet','Colectare metrici']):
    box(ax,0.3+i*3.2,0.7,2.6,1.1,t,BG,GREY,9)
for i in range(3): arrow(ax,3.5+i*3.2,1.25,2.9+i*3.2,1.25,color=GREY)
ax.text(6.5,4.5,'Circulația datelor: control (sus) și analiză (jos)',ha='center',fontsize=11,fontweight='bold',color=DARK)
save(fig,'fig_dataflow.png')

# 4. Stereo dual-instance engine
fig,ax=plt.subplots(figsize=(8,3.6)); ax.set_xlim(0,12); ax.set_ylim(0,6); ax.axis('off')
box(ax,0.3,3.6,1.8,1,'Intrare L',BG,PUR,9); box(ax,0.3,1.2,1.8,1,'Intrare R',BG,PUR,9)
for i in range(3):
    box(ax,2.8+i*2.6,3.6,2.0,1,f'Efect {i+1}\n(instanță L)',LP,PUR,8,'#3b2a6b')
    box(ax,2.8+i*2.6,1.2,2.0,1,f'Efect {i+1}\n(instanță R)',LP,PUR,8,'#3b2a6b')
box(ax,10.2,3.6,1.5,1,'Ieșire L',BG,PUR,9); box(ax,10.2,1.2,1.5,1,'Ieșire R',BG,PUR,9)
arrow(ax,2.1,4.1,2.8,4.1,color=PUR); arrow(ax,2.1,1.7,2.8,1.7,color=PUR)
for i in range(2):
    arrow(ax,4.8+i*2.6,4.1,5.4+i*2.6,4.1,color=PUR); arrow(ax,4.8+i*2.6,1.7,5.4+i*2.6,1.7,color=PUR)
arrow(ax,10.0,4.1,10.2,4.1,color=PUR); arrow(ax,10.0,1.7,10.2,1.7,color=PUR)
ax.text(2.0,2.9,'parametri\nsincronizați',ha='center',fontsize=7.5,color=GREY,style='italic')
for i in range(3): arrow(ax,3.8+i*2.6,3.6,3.8+i*2.6,2.2,color='#bbb',ls=':',style='-')
ax.text(6,5.4,'Motorul stereo cu instanțe duble pe canal',ha='center',fontsize=11,fontweight='bold',color=DARK)
save(fig,'fig_stereo.png')

# 5. Scheduler timeline
fig,ax=plt.subplots(figsize=(8,2.8)); ax.set_xlim(0,12); ax.set_ylim(0,4); ax.axis('off')
ax.annotate('',xy=(11.5,1),xytext=(0.3,1),arrowprops=dict(arrowstyle='-|>',color=DARK,lw=1.5))
ax.text(11.5,0.5,'timp (ceas audio)',ha='right',fontsize=8,color=DARK)
import numpy as np
for x in np.arange(1,11,1.4):
    ax.plot([x,x],[0.8,1.8],color=PUR,lw=2)
    ax.plot([x],[1.8],marker='v',color=PUR,ms=6)
ax.axvspan(1,4.6,ymin=0.55,ymax=0.78,color=LP,zorder=0)
ax.text(2.8,3.0,'fereastră de anticipare\n(lookahead ≈100 ms)',ha='center',fontsize=8.5,color='#3b2a6b')
ax.annotate('',xy=(4.6,2.4),xytext=(1,2.4),arrowprops=dict(arrowstyle='<->',color=PUR))
ax.text(0.5,1.95,'acum',fontsize=8,color=DARK)
ax.text(6,3.5,'Programarea anticipată a bătăilor metronomului',ha='center',fontsize=11,fontweight='bold',color=DARK)
ax.text(8.5,2.2,'bătăi programate în avans',fontsize=8,color=PUR)
save(fig,'fig_scheduler.png')

print("ALL DIAGRAMS DONE")
