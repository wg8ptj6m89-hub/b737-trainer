'use strict';
// No external libraries, analytics, network fetches or remote APIs are used by this app.
const DEMO = {
  schemaVersion: 1,
  title: 'Демонстрационный учебный банк',
  operator: 'НЕ ЗАДАН — ДЕМО',
  aircraft: 'B737 NG (демо-оболочка)',
  bankRevision: 'DEMO-1',
  items: [
    {id:'demo-elec-1',type:'quiz',topic:'Electrical',prompt:'ДЕМО: в каком разделе FCOM следует искать описание электроснабжения?',options:['Electrical','Hydraulics','Air Conditioning','Landing Gear'],correctIndices:[0],answer:'Electrical',explanation:'Это демонстрационный вопрос для проверки интерфейса. Он не заменяет изучение FCOM.',source:{document:'FCOM',section:'Electrical (точный раздел уточнить)',revision:'ДЕМО',page:'',verified:false}},
    {id:'demo-hyd-1',type:'quiz',topic:'Hydraulics',prompt:'ДЕМО: какой источник должен иметь приоритет при проверке конкретного ограничения вашей авиакомпании?',options:['Проверенный актуальный документ оператора','Неподписанный конспект','Ответ на форуме','Квиз другой авиакомпании'],correctIndices:[0],answer:'Актуальный утверждённый документ оператора',explanation:'Наличие ссылки на документ и редакцию помогает проверить корректность учебного вопроса.',source:{document:'FCOM',section:'Limitations — указать конкретный пункт',revision:'ДЕМО',page:'',verified:false}},
    {id:'demo-memory-1',type:'memory',topic:'Memory Items',prompt:'ДЕМО: воспроизведи последовательность действий выбранного Memory Item из вашего QRH.',answer:'ЗДЕСЬ ДОЛЖНА БЫТЬ ТОЧНАЯ ПРОВЕРЕННАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ИЗ QRH ВАШЕГО ОПЕРАТОРА. В ДЕМО ОНА НАМЕРЕННО НЕ ПРИВЕДЕНА.',explanation:'При создании настоящей карточки необходимо сохранить порядок и условия применения, а также номер редакции QRH.',source:{document:'QRH',section:'Указать название чек-листа',revision:'ДЕМО',page:'',verified:false}},
    {id:'demo-limit-1',type:'limitation',topic:'Limitations',prompt:'ДЕМО: назови точное ограничение и условия его применения из выбранного пункта FCOM.',answer:'ЗДЕСЬ БУДЕТ ПРОВЕРЕННОЕ ЗНАЧЕНИЕ ИЗ АКТУАЛЬНОГО FCOM ВАШЕГО ОПЕРАТОРА. ЧИСЛО НЕ ПРИДУМЫВАЕТСЯ.',explanation:'При добавлении значения фиксируй единицы измерения, условия, оговорки и номер редакции руководства.',source:{document:'FCOM',section:'Limitations — выбрать пункт',revision:'ДЕМО',page:'',verified:false}},
    {id:'demo-interview-1',type:'interview',topic:'Interview',prompt:'ДЕМО: объясни работу выбранной системы в нормальном режиме и при отказе одного компонента.',answer:'ЗДЕСЬ ДОЛЖЕН БЫТЬ ПОДГОТОВЛЕННЫЙ ОТВЕТ С ПРИВЯЗКОЙ К FCOM/FCTM. В ДЕМО ОН НЕ СОДЕРЖИТ ТЕХНИЧЕСКИХ УТВЕРЖДЕНИЙ.',explanation:'Открытые вопросы удобно разбирать с использованием схем и ссылок на разделы руководств.',source:{document:'FCOM / FCTM',section:'Указать раздел',revision:'ДЕМО',page:'',verified:false}}
  ]
};
const PACK_KEY='b737_trainer_pack_v1', PROGRESS_KEY='b737_trainer_progress_v1';
function clone(v){return JSON.parse(JSON.stringify(v));}
function readStored(key, fallback){try {const d=JSON.parse(localStorage.getItem(key)); return d??clone(fallback);}catch{return clone(fallback);}}
let pack=readStored(PACK_KEY,DEMO);
let progress=readStored(PROGRESS_KEY,{answered:0,correct:0,wrongIds:[],cards:{}});
if(!validatePack(pack).ok) pack=clone(DEMO);
function save(){localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}
// Only publish a new bank in memory after both writes have succeeded.
function commitState(nextPack,nextProgress){
 const previousPack=localStorage.getItem(PACK_KEY), previousProgress=localStorage.getItem(PROGRESS_KEY);
 try{
  localStorage.setItem(PACK_KEY,JSON.stringify(nextPack));
  localStorage.setItem(PROGRESS_KEY,JSON.stringify(nextProgress));
 }catch(e){
  try{if(previousPack===null)localStorage.removeItem(PACK_KEY);else localStorage.setItem(PACK_KEY,previousPack);
      if(previousProgress===null)localStorage.removeItem(PROGRESS_KEY);else localStorage.setItem(PROGRESS_KEY,previousProgress);}catch(_ignored){}
  throw Error('Недостаточно места для сохранения базы. Экспортируй резервную копию и уменьши размер импорта. '+(e.message||''));
 }
 pack=nextPack;progress=nextProgress;
}

function $(id){return document.getElementById(id);}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function clear(n){n.replaceChildren();}
function show(id,yes){$(id).classList.toggle('hidden',!yes);}
function classify(it){return it.type==='quiz'?'Systems':it.type==='memory'?'Memory Items':it.type==='limitation'?'Limitations':'Interview';}
function validatePack(value){
 if(!value||typeof value!=='object'||value.schemaVersion!==1||!Array.isArray(value.items))return {ok:false,error:'Нужен объект schemaVersion: 1 с массивом items.'};
 if(value.items.length>5000)return {ok:false,error:'Максимум 5000 карточек для демонстрационного приложения.'};
 const ids=new Set();
 for(let i=0;i<value.items.length;i++){
  const q=value.items[i];
  if(!q||typeof q.id!=='string'||!q.id||ids.has(q.id))return {ok:false,error:`Некорректный или повторяющийся id: строка ${i+1}`};
  ids.add(q.id);
  if(!['quiz','memory','limitation','interview'].includes(q.type)||typeof q.topic!=='string'||typeof q.prompt!=='string'||typeof q.answer!=='string')return {ok:false,error:`Ошибка полей у ${q.id}`};
  if(q.type==='quiz'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>8||!q.options.every(v=>typeof v==='string')||!Array.isArray(q.correctIndices)||q.correctIndices.length<1||!q.correctIndices.every(x=>Number.isInteger(x)&&x>=0&&x<q.options.length)||new Set(q.correctIndices).size!==q.correctIndices.length))return {ok:false,error:`Некорректные варианты или правильные ответы у ${q.id}`};
  if(q.source && (typeof q.source !== 'object'||Array.isArray(q.source)))return {ok:false,error:`Некорректный source у ${q.id}`};
 }
 return {ok:true};
}
function sourceNode(it){
 const src=it.source||{}; const c=el('div',undefined,'source');
 const revision=src.revision||'не указана';
 c.textContent=`Источник: ${src.document||'не указан'} · ${src.section||'раздел не указан'}\nРедакция: ${revision}${src.page?' · Стр./пункт: '+src.page:''}\nСверено автором банка: ${src.verified?'да (требует самостоятельной проверки)':'нет'}`;
 return c;
}
function itemHeading(it){const c=el('div');c.append(el('span',classify(it),'pill'));c.append(el('span',it.topic,'pill'));if(!it.source?.verified)c.append(el('span','Не сверено','pill unverified'));return c;}
function topics(){return [...new Set(pack.items.map(q=>q.topic))].sort((a,b)=>a.localeCompare(b,'ru'));}
function fillSelect(id){const s=$(id), current=s.value;clear(s);s.append(new Option('Все темы','all'));topics().forEach(x=>s.append(new Option(x,x)));if([...s.options].some(x=>x.value===current))s.value=current;}
function renderStats(){const c=$('stats');clear(c);[[pack.items.length,'Карточек в банке'],[progress.answered,'Ответов'],[progress.answered?Math.round(progress.correct/progress.answered*100)+'%':'—','Точность'],[progress.wrongIds.length,'Ошибок к повтору']].forEach(([num,label])=>{const box=el('div',undefined,'stat');box.append(el('div',String(num),'num'),el('div',label,'lbl'));c.append(box);});}
let session=null;
function quizStart(){
 const topic=$('quiz-topic').value,set=$('quiz-set').value;
 let items=pack.items.filter(q=>q.type==='quiz'&&(topic==='all'||q.topic===topic));
 if(set==='wrong')items=items.filter(q=>progress.wrongIds.includes(q.id));
 if(!items.length){alert('По выбранным условиям нет вопросов с вариантами ответа. Для Memory Items и Limitations используй «Карточки».');return;}
 items=items.slice().sort(()=>Math.random()-.5);
 session={items,index:0,selected:[],checked:false,correct:0};
 show('quiz-start',false);show('quiz-finish',false);show('quiz-active',true);renderQuestion();
}
function renderQuestion(){
 const it=session.items[session.index], b=$('question-body');clear(b);session.selected=[];session.checked=false;
 $('question-meta').textContent=`Вопрос ${session.index+1} из ${session.items.length}`;
 $('quiz-progress').style.width=`${(session.index)/session.items.length*100}%`;
 b.append(itemHeading(it),el('div',it.prompt,'qtext'));
 it.options.forEach((option,i)=>{
  const btn=el('button',undefined,'choice');btn.type='button';btn.dataset.index=i;
  btn.append(el('span',String.fromCharCode(65+i),'letter'),el('span',option));
  btn.addEventListener('click',()=>{
   if(session.checked)return;
   if(it.correctIndices.length===1) session.selected=[i];
   else if(session.selected.includes(i))session.selected=session.selected.filter(x=>x!==i);
   else session.selected.push(i);
   [...b.querySelectorAll('.choice')].forEach(c=>c.classList.toggle('selected',session.selected.includes(Number(c.dataset.index))));
  });b.append(btn);
 });
 if(it.correctIndices.length>1)b.append(el('p','Выбери все правильные варианты.','muted'));
 show('quiz-feedback',false);show('check-answer',true);show('next-question',false);
 b.append(sourceNode(it));
}
function quizCheck(){if(!session||session.checked||!session.selected.length)return;
 const it=session.items[session.index], sel=session.selected.slice().sort((a,b)=>a-b), ans=it.correctIndices.slice().sort((a,b)=>a-b);
 const ok=JSON.stringify(sel)===JSON.stringify(ans);session.checked=true;session.correct+=ok?1:0;progress.answered++;progress.correct+=ok?1:0;
 if(ok)progress.wrongIds=progress.wrongIds.filter(x=>x!==it.id);
 else if(!progress.wrongIds.includes(it.id))progress.wrongIds.push(it.id);
 save();
 [...$('question-body').querySelectorAll('.choice')].forEach(c=>{let n=Number(c.dataset.index);if(ans.includes(n))c.classList.add('correct');else if(sel.includes(n))c.classList.add('incorrect');});
 const f=$('quiz-feedback');clear(f);f.className='feedback '+(ok?'good':'bad');f.append(el('strong',ok?'Верно':'Есть ошибка'));
 f.append(el('div','\nПравильный ответ: '+ans.map(n=>it.options[n]).join(' + ')));
 if(it.explanation)f.append(el('div','\n'+it.explanation));
 show('quiz-feedback',true);show('check-answer',false);show('next-question',true);$('next-question').textContent=session.index===session.items.length-1?'Результаты →':'Следующий →';renderStats();
}
function quizNext(){if(!session)return;session.index++;if(session.index>=session.items.length)quizFinish();else renderQuestion();}
function quizFinish(){if(!session)return;show('quiz-active',false);show('quiz-finish',true);const n=session.index>=session.items.length?session.items.length:session.index+(session.checked?1:0);$('quiz-summary').textContent=`Правильных ответов: ${session.correct} из ${n}. Ошибки сохранены для повторения.`;$('quiz-progress').style.width='100%';}
function quizReset(){session=null;show('quiz-active',false);show('quiz-finish',false);show('quiz-start',true);renderStats();}
let cards=null;
function cardsStart(){
 const t=$('card-topic').value, type=$('card-type').value;
 const items=pack.items.filter(q=>(t==='all'||q.topic===t)&&(type==='all'||(type==='system'?q.type==='quiz':q.type===type)));
 if(!items.length){alert('Нет карточек по выбранной теме и типу.');return;}
 // Due cards first, then the rest; both available offline.
 const now=Date.now();items.sort((a,b)=>(progress.cards[a.id]?.next||0)-(progress.cards[b.id]?.next||0));
 cards={items,index:0,revealed:false};show('cards-start',false);show('cards-active',true);renderCard();
}
function renderCard(){if(!cards)return;const it=cards.items[cards.index], n=$('card-content');clear(n);
 $('card-count').textContent=`Карточка ${cards.index+1} из ${cards.items.length}`;n.append(itemHeading(it),el('div',it.prompt,'qtext'));
 if(cards.revealed){n.append(el('div',it.answer||'Ответ в банке не указан.','feedback flash'));if(it.explanation)n.append(el('p',it.explanation,'muted'));}
 n.append(sourceNode(it));show('reveal-card',!cards.revealed);show('again-card',cards.revealed);show('know-card',cards.revealed);
}
function cardAnswer(known){if(!cards)return;const it=cards.items[cards.index];const old=progress.cards[it.id]||{level:0};
 const level=known?Math.min(old.level+1,4):0;const days=[0,1,3,7,14][level];progress.cards[it.id]={level,next:Date.now()+days*86400000};save();
 cards.index++;
 if(cards.index>=cards.items.length){stopCards();alert('Повторение завершено. Прогресс сохранён на устройстве.');return;}
 cards.revealed=false;renderCard();
}
function stopCards(){cards=null;show('cards-active',false);show('cards-start',true);}
function selectTab(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab-content').forEach(p=>p.classList.toggle('hidden',p.id!==id));if(id==='library')renderPack();}
function renderPack(){const n=pack.items.length;const verified=pack.items.filter(q=>q.source?.verified).length;
 $('pack-info').textContent=`${pack.title||'Без названия'} · ${pack.aircraft||'тип не указан'} · Вопросов и карточек: ${n}; отмечено автором банка как сверенные: ${verified}.`;
 const byTopic=new Map();for(const q of pack.items)byTopic.set(q.topic,(byTopic.get(q.topic)||0)+1);
 $('pack-topics').textContent=byTopic.size?[...byTopic].sort((a,b)=>a[0].localeCompare(b[0],'ru')).map(([t,n])=>`${t}: ${n}`).join(' · '):'Банк пока пуст.';
}
function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2500);}
function normalizePack(value){return {schemaVersion:1,title:String(value.title||'Мой банк'),operator:String(value.operator||''),aircraft:String(value.aircraft||'B737 NG'),bankRevision:String(value.bankRevision||''),items:clone(value.items),importHistory:Array.isArray(value.importHistory)?clone(value.importHistory.slice(-50)):[]};}
// Compare semantic content independent of JSON property ordering.
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
function sameItem(a,b){return JSON.stringify(canonical(a))===JSON.stringify(canonical(b));}
function filteredProgress(base,keepIds,changedIds){
 const p=clone(base), allowed=new Set(keepIds);
 p.wrongIds=(Array.isArray(p.wrongIds)?p.wrongIds:[]).filter(id=>allowed.has(id)&&!changedIds.has(id));
 p.cards=Object.fromEntries(Object.entries(p.cards&&typeof p.cards==='object'?p.cards:{}).filter(([id])=>allowed.has(id)&&!changedIds.has(id)));
 return p;
}
function progressFromBackup(value,ids){
 const valid=new Set(ids);const answered=Math.max(0,Math.floor(Number(value.answered)||0));
 const correct=Math.min(answered,Math.max(0,Math.floor(Number(value.correct)||0)));
 return {answered,correct,wrongIds:[...new Set(Array.isArray(value.wrongIds)?value.wrongIds.filter(x=>typeof x==='string'&&valid.has(x)):[])],cards:Object.fromEntries(Object.entries(value.cards&&typeof value.cards==='object'?value.cards:{}).filter(([k,v])=>valid.has(k)&&v&&typeof v==='object'&&Number.isFinite(v.next)&&Number.isFinite(v.level)).map(([k,v])=>[k,{next:v.next,level:Math.max(0,Math.min(4,Math.floor(v.level)))}]))};
}
function planImport(current,incoming,mode,currentProgress){
 const next=mode==='replace'?normalizePack(incoming):normalizePack(current);
 const byId=new Map(next.items.map((v,i)=>[v.id,i]));
 const changed=new Set(),counts={added:0,updated:0,unchanged:0,skipped:0,removed:0};
 if(mode==='replace'){
  const old=new Map(current.items.map(q=>[q.id,q]));
  const nextIds=new Set(next.items.map(q=>q.id));
  for(const q of next.items){if(!old.has(q.id))counts.added++;else if(sameItem(old.get(q.id),q))counts.unchanged++;else{counts.updated++;changed.add(q.id);}}
  for(const q of current.items)if(!nextIds.has(q.id))counts.removed++;
 }else{
  for(const q of incoming.items){
   if(!byId.has(q.id)){byId.set(q.id,next.items.length);next.items.push(clone(q));counts.added++;}
   else if(sameItem(next.items[byId.get(q.id)],q))counts.unchanged++;
   else if(mode==='update'){next.items[byId.get(q.id)]=clone(q);changed.add(q.id);counts.updated++;}
   else counts.skipped++;
  }
  next.title='Накопительная база B737 NG';next.bankRevision='Сборная: редакции указаны в источниках вопросов';
  next.importHistory.push({title:String(incoming.title||'Без названия'),revision:String(incoming.bankRevision||''),importedAt:new Date().toISOString(),added:counts.added,updated:counts.updated,skipped:counts.skipped});
  next.importHistory=next.importHistory.slice(-50);
 }
 const valid=validatePack(next);if(!valid.ok)throw Error(valid.error);
 const ids=next.items.map(q=>q.id);
 return {next,counts,changed,nextProgress:filteredProgress(currentProgress,ids,changed)};
}
async function importFile(file){
 const msg=$('file-message');msg.className='';msg.textContent='';if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('Файл больше 10 МБ; нужна оптимизация хранения для больших банков.');
  const raw=JSON.parse(await file.text()), incoming=raw.pack||raw;
  const valid=validatePack(incoming);if(!valid.ok)throw Error(valid.error);
  const mode=$('import-mode').value;
  const plan=planImport(pack,incoming,mode,progress),c=plan.counts;
  if(mode!=='replace'&&!c.added&&!c.updated){
   msg.className='inline-ok';msg.textContent=`Изменений нет. Совпадающих без изменений: ${c.unchanged}; конфликтов с другими данными: ${c.skipped}. Для обновления существующих ID выбери соответствующий режим.`;return;
  }
  const confirmation=`Режим: ${mode==='add'?'только новые ID':mode==='update'?'добавить и обновить ID':'полная замена'}.
Добавить: ${c.added}; обновить: ${c.updated}; уже совпадают: ${c.unchanged}; пропустить конфликты: ${c.skipped}; удалить: ${c.removed}.
${c.updated?'Прогресс изменённых карточек будет сброшен; общая статистика сохранится.\n':''}Продолжить? Перед крупным импортом рекомендуется экспорт резервной копии.`;
  if(!confirm(confirmation))return;
  let nextProgress=plan.nextProgress;
  if(mode==='replace'&&raw.pack&&raw.progress&&typeof raw.progress==='object'&&confirm('Это резервная копия с прогрессом. Восстановить статистику ИЗ ФАЙЛА вместо текущей?'))nextProgress=progressFromBackup(raw.progress,plan.next.items.map(q=>q.id));
  commitState(plan.next,nextProgress);
  updateAll();msg.className='inline-ok';msg.textContent=`Готово. Добавлено: ${c.added}, обновлено: ${c.updated}, пропущено: ${c.skipped}, удалено: ${c.removed}. Всего: ${pack.items.length}.`;
 }catch(e){msg.className='inline-err';msg.textContent='Ошибка импорта: '+e.message;}
 finally{$('import-file').value='';}
}
function removeDemo(){
 const ids=new Set(pack.items.filter(q=>q.id.startsWith('demo-')&&q.source?.revision==='ДЕМО').map(q=>q.id));
 if(!ids.size){$('file-message').textContent='Демонстрационных карточек нет.';return;}
 if(!confirm(`Удалить ${ids.size} демонстрационных карточек? Остальные вопросы и статистика сохранятся.`))return;
 try{const next=normalizePack(pack);next.items=next.items.filter(q=>!ids.has(q.id));const p=filteredProgress(progress,next.items.map(q=>q.id),new Set());commitState(next,p);updateAll();$('file-message').className='inline-ok';$('file-message').textContent=`Удалено демонстрационных карточек: ${ids.size}.`;}
 catch(e){$('file-message').className='inline-err';$('file-message').textContent=e.message;}
}
function updateAll(){fillSelect('quiz-topic');fillSelect('card-topic');renderStats();renderPack();quizReset();stopCards();}
function boot(){
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
 $('start-quiz').addEventListener('click',quizStart);$('check-answer').addEventListener('click',quizCheck);$('next-question').addEventListener('click',quizNext);$('stop-quiz').addEventListener('click',quizFinish);$('restart-quiz').addEventListener('click',quizReset);
 $('start-cards').addEventListener('click',cardsStart);$('reveal-card').addEventListener('click',()=>{cards.revealed=true;renderCard();});$('again-card').addEventListener('click',()=>cardAnswer(false));$('know-card').addEventListener('click',()=>cardAnswer(true));$('stop-cards').addEventListener('click',stopCards);
 $('import-file').addEventListener('change',e=>importFile(e.target.files[0]));
 $('remove-demo').addEventListener('click',removeDemo);
 $('export-backup').addEventListener('click',()=>download('b737-trainer-backup.json',{pack,progress,exportedAt:new Date().toISOString()}));
 $('export-template').addEventListener('click',()=>download('b737-trainer-example-bank.json',DEMO));
 $('reset-demo').addEventListener('click',()=>{if(confirm('ПОЛНОСТЬЮ заменить базу и обнулить статистику? Сначала экспортируй резервную копию.')){try{commitState(clone(DEMO),{answered:0,correct:0,wrongIds:[],cards:{}});updateAll();$('file-message').textContent='Восстановлена демонстрационная база.';}catch(e){$('file-message').textContent=e.message;}}});
 updateAll();selectTab('quiz');
 const conn=$('connection'); const syncConn=()=>conn.textContent=navigator.onLine?'◉ Режим сети':'✓ Офлайн';window.addEventListener('online',syncConn);window.addEventListener('offline',syncConn);syncConn();
 if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(e=>{console.warn('Service worker registration failed',e);});
}
boot();