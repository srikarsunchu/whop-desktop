export interface Finish { headline: string; caption: string; color: string; position: 'top' | 'bottom'; format: 'original' | 'square' | 'story' | 'landscape'; shade: boolean; offsetX: number; offsetY: number; }
export const DEFAULT_FINISH: Finish = { headline: '', caption: '', color: '#ffffff', position: 'bottom', format: 'original', shade: true, offsetX: 50, offsetY: 50 };
export function renderCreative(canvas: HTMLCanvasElement, image: HTMLImageElement, edit: Finish) {
  const sizes = { original: [image.naturalWidth, image.naturalHeight], square: [1080,1080], story: [1080,1920], landscape: [1920,1080] };
  const [w,h] = sizes[edit.format]; canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext('2d'); if(!ctx) throw Error('Image renderer unavailable');
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
  ctx.drawImage(image,(w-image.naturalWidth*scale)*(edit.offsetX??50)/100,(h-image.naturalHeight*scale)*(edit.offsetY??50)/100,image.naturalWidth*scale,image.naturalHeight*scale);
  const pad=w*.07, font=w*.07;
  ctx.font=`700 ${font}px Inter, sans-serif`;
  const lines:string[]=[];
  for(const paragraph of edit.headline.split('\n')) {
    let line='';
    for(const word of paragraph.split(' ')) {
      const next=line ? `${line} ${word}` : word;
      if(ctx.measureText(next).width>w-pad*2 && line){lines.push(line);line=word;}else line=next;
    }
    lines.push(line);
  }
  const textLines=edit.headline ? lines : [];
  const total=textLines.length*font*1.15+(edit.caption ? font*.85 : 0);
  let y=edit.position==='top' ? pad : h-pad-total;
  if(edit.shade && (edit.headline || edit.caption)) {
    const gradient=ctx.createLinearGradient(0,edit.position==='top'?0:h,0,edit.position==='top'?Math.max(h*.5,total+pad*2):h-Math.max(h*.5,total+pad*2));
    gradient.addColorStop(0,'rgba(0,0,0,.8)'); gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
  }
  ctx.fillStyle=edit.color;ctx.textBaseline='top';
  for(const line of textLines){ctx.fillText(line,pad,y,w-pad*2);y+=font*1.15;}
  if(edit.caption){ctx.font=`500 ${font*.4}px Inter, sans-serif`;ctx.fillText(edit.caption,pad,y+font*.25,w-pad*2);}
}
export const canvasBytes = (canvas: HTMLCanvasElement):Promise<number[]> => new Promise((resolve,reject)=>canvas.toBlob(async b=>b?resolve(Array.from(new Uint8Array(await b.arrayBuffer()))):reject(Error('Could not export image')),'image/png'));
