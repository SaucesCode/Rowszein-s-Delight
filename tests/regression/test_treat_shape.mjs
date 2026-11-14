import assert from 'node:assert/strict';
import {SHAPES, guessShape, savedShapeChoice} from '../../frontend/src/lib/treatShape.ts';

const tests=[];
tests.push(['each keyword picks its drawing',()=>{
  const cases=[['Ube cheesecake','cake_slice'],['Mango slice','cake_slice'],['Red velvet cupcake','cupcake'],['Banana muffin','muffin'],
    ['Fudge brownie','brownie'],['Blondie bar','brownie'],['Choco chip cookie','cookie'],['Crinkle','cookie'],['Polvoron','cookie'],
    ['Banana bread','bread'],['Raisin loaf','bread'],['Pandesal','bread'],['Ensaymada','bread'],['Cinnamon bun','bread'],
    ['Spanish roll','bread'],['Monay','bread'],['Chocolate cake','whole_cake'],['Sacher torte','whole_cake']];
  for(const [name,shape] of cases) assert.equal(guessShape(name),shape,name);
}]);
tests.push(['earlier rules win, and the default is a whole cake',()=>{
  assert.equal(guessShape('Ube roll cake'),'whole_cake');
  assert.equal(guessShape('Ube cheesecake slice'),'cake_slice');
  assert.equal(guessShape('Chocolate cake cookie'),'cookie');
  assert.equal(guessShape('Leche flan'),'whole_cake');
}]);
tests.push(['the picker lists the seven treats with labels',()=>{
  assert.deepEqual(SHAPES.map(s=>s.label),['Whole cake','Cake slice','Cupcake','Muffin','Brownie','Cookie','Bread']);
}]);
tests.push(['a partner item saved before drawings existed opens with the guess, not a donut',()=>{
  assert.deepEqual(savedShapeChoice({partner:{id:1},shape:'donut'}),{shape:'whole_cake',touched:false});
  assert.deepEqual(savedShapeChoice({partner:{id:1},shape:'muffin'}),{shape:'muffin',touched:true});
  assert.deepEqual(savedShapeChoice({partner:null,shape:'donut'}),{shape:'whole_cake',touched:false});
  assert.deepEqual(savedShapeChoice(undefined),{shape:'whole_cake',touched:false});
}]);
for(const [name,run] of tests){await run();console.log('PASS '+name);}
console.log(JSON.stringify({tests:tests.length,failures:0,browser_tests:false,schema_executed:false}));
