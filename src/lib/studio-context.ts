export type CreativePurpose = 'social' | 'ad' | 'cover' | 'custom';
export type CreativeFormat = 'original' | 'square' | 'story' | 'landscape';
export interface CreativeContext {
  productId: string; productTitle: string; planId: string; price: string; destinationUrl: string;
  purpose: CreativePurpose; format: CreativeFormat; concept: string; postCopy: string; adHeadline: string; callToAction: string;
}
export const EMPTY_CONTEXT: CreativeContext = {productId:'',productTitle:'',planId:'',price:'',destinationUrl:'',purpose:'social',format:'square',concept:'Untitled concept',postCopy:'',adHeadline:'',callToAction:'learn_more'};
export const PURPOSE_LABELS: Record<CreativePurpose,string> = {social:'Social post',ad:'Paid ad',cover:'Product cover',custom:'Custom creative'};
export const FORMAT_LABELS: Record<CreativeFormat,string> = {original:'Original',square:'Square · 1:1',story:'Story / Reel · 9:16',landscape:'Landscape · 16:9'};
export function generationBrief(prompt:string, context:CreativeContext){
  const ratio={original:'',square:'square 1:1',story:'vertical 9:16',landscape:'horizontal 16:9'}[context.format];
  const suffix=`\nIntended use: ${PURPOSE_LABELS[context.purpose]}.${ratio?` Compose for ${ratio}.`:''}`;
  return prompt.trim().slice(0,2000-suffix.length)+suffix;
}
export function validDestination(url:string){try{return new URL(url).protocol==='https:';}catch{return false;}}
