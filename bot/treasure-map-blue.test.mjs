import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
const {analyzeTreasureMapImage,hashTreasureMapImage}=await import(process.env.MAP_DETECTOR_MODULE || './treasure-map-image.mjs');
const fixture=await fs.readFile(new URL('./data/test-fixtures/azim-steppe-blue.png',import.meta.url));
const svg=(background,marker='')=>Buffer.from(`<svg width="278" height="217"><rect width="278" height="217" fill="${background}"/>${marker}</svg>`);
const x='<path d="M128 94 L151 119 M151 94 L128 119" stroke="#bc2418" stroke-width="5"/>';
test('real rare blue Azim Steppe card is recognized',async()=>{
  assert.equal((await analyzeTreasureMapImage(fixture)).isMap,true);
  assert.match(await hashTreasureMapImage(fixture),/^tm2:/);
});
test('rare blue card survives JPEG compression and resizing',async()=>{
  const image=await sharp(fixture).resize({width:210}).jpeg({quality:75}).toBuffer();
  assert.equal((await analyzeTreasureMapImage(image)).isMap,true);
});
test('rare blue card can be isolated from a larger screenshot',async()=>{
  const image=await sharp({create:{width:900,height:600,channels:3,background:'#151515'}}).composite([{input:fixture,left:460,top:210}]).png().toBuffer();
  const result=await analyzeTreasureMapImage(image);
  assert.equal(result.isMap,true);
  const size=await sharp(result.card).metadata();assert.ok(size.width<400&&size.height<350);
});
test('ordinary parchment card remains recognized',async()=>{
  const image=await sharp(svg('#baa987',x)).png().toBuffer();
  assert.equal((await analyzeTreasureMapImage(image)).isMap,true);
});
test('blue paper without a red marker is rejected',async()=>{
  assert.equal((await analyzeTreasureMapImage(await sharp(svg('#739ebc')).png().toBuffer())).isMap,false);
});
test('unrelated dark picture with a red X is rejected',async()=>{
  assert.equal((await analyzeTreasureMapImage(await sharp(svg('#111111',x)).png().toBuffer())).isMap,false);
});
test('blue picture with a large red panel is rejected',async()=>{
  assert.equal((await analyzeTreasureMapImage(await sharp(svg('#739ebc','<rect x="70" y="50" width="140" height="120" fill="#bc2418"/>')).png().toBuffer())).isMap,false);
});
test('blue picture with an off-center marker is rejected',async()=>{
  assert.equal((await analyzeTreasureMapImage(await sharp(svg('#739ebc','<g transform="translate(-110,-80)">'+x+'</g>')).png().toBuffer())).isMap,false);
});
