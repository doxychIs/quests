import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDOM} from './dom-harness.mjs';

test('Подбор команды учитывает обе границы вместимости и передаёт состав в запись',()=>{
 const x=setupDOM('iznanka',{adult:true});
 try{
  const picker=x.d.querySelector('[data-team-picker]');
  const rows=[...picker.querySelectorAll('[data-team-quest]')];
  function select(n){const radio=picker.querySelector(`input[value="${n}"]`);radio.checked=true;radio.dispatchEvent(new x.w.Event('change',{bubbles:true}));}
  const available=()=>rows.filter(row=>!row.querySelector('[data-team-book]').hidden).map(row=>row.querySelector('h3 .scroll-type-transcript')?.textContent||row.querySelector('h3').textContent);
  assert.equal(available().length,4);
  select(2);
  assert.deepEqual(available(),['ПАЛАТА 06','НЕ ОТВЕЧАЙ','ЛЕСНИК']);
  assert.match(rows[2].querySelector('[data-team-unavailable]').textContent,/От 3 игроков/);
  select(5);
  assert.deepEqual(available(),['ПАЛАТА 06','ПОСЛЕДНЯЯ СМЕНА','ЛЕСНИК']);
  select(6);
  assert.deepEqual(available(),['ПОСЛЕДНЯЯ СМЕНА','ЛЕСНИК']);
  assert.equal(picker.querySelector('[data-team-status]').textContent,'Подходят 2 квеста');
  for(const row of rows.filter(row=>row.dataset.suitable==='true')){
   const link=row.querySelector('[data-team-book]');
   assert.equal(new URL(link.href).searchParams.get('players'),'6');
   assert.match(link.getAttribute('aria-label'),/для 6 игроков/);
  }
  select(4);
  assert.equal(available().length,4);
  assert.deepEqual(x.errors,[]);
 }finally{x.close();}
});

test('Запись принимает выбранный состав только из допустимых значений квеста',()=>{
 for(const [slug,query,expected] of [
  ['lesnik','6','6'],['poslednyaya-smena','5','5'],['ne-otvechay','6','2'],
  ['poslednyaya-smena','2','3'],['lesnik','999','2'],['lesnik','4x','2']
 ]){
  const x=setupDOM(`iznanka/book/${slug}`,{adult:true,search:`?players=${query}`});
  try{assert.equal(x.d.querySelector('[name=players]').value,expected,`${slug}: ${query}`);assert.deepEqual(x.errors,[]);}
  finally{x.close();}
 }
});
