import test from 'node:test';
import assert from 'node:assert/strict';
import {passageTimeline,passageEnd} from '../src/lib/horror-passage.ts';
// Historical timeline remains a pure utility; room integration is covered in room-experience.test.mjs.

test('Проход: скролл привязан к кадрам, разворачивается назад и останавливается на общем плане',()=>{
 const forward=[0,.1,.25,.5,.82,1].map(p=>passageTimeline(p));
 for(let i=1;i<forward.length;i++)assert.ok(forward[i].time>=forward[i-1].time);
 assert.equal(forward[0].time,0);assert.equal(forward.at(-1).time,passageEnd);
 assert.ok(passageTimeline(.25).time<passageTimeline(.5).time);
 assert.equal(passageTimeline(.8).room,false);assert.equal(passageTimeline(1).room,true);
 assert.equal(passageTimeline(1).fit,1);assert.equal(passageTimeline(-1).time,0);assert.equal(passageTimeline(3).time,passageEnd);
});
