'use strict';
// No external libraries, analytics, network fetches or remote APIs are used by this app.
const EMPTY_BANK = {schemaVersion:1,title:'Моя база вопросов',operator:'',aircraft:'B737 NG',bankRevision:'',items:[]};
const EXAMPLE_BANK = {schemaVersion:1,title:'Новый раздел',operator:'',aircraft:'B737 NG',bankRevision:'',items:[
 {id:'unique-question-001',type:'quiz',topic:'Название раздела',prompt:'Текст вопроса',options:['Вариант 1','Вариант 2'],correctIndices:[0],answer:'Вариант 1',explanation:'Краткое объяснение',source:{document:'Название источника',section:'Раздел',page:'',revision:'',verified:false}}
]};
const PACK_KEY='b737_trainer_pack_v1', PROGRESS_KEY='b737_trainer_progress_v1';
function clone(v){return JSON.parse(JSON.stringify(v));}
function readStored(key, fallback){try {const d=JSON.parse(localStorage.getItem(key)); return d??clone(fallback);}catch{return clone(fallback);}}
let pack=readStored(PACK_KEY,EMPTY_BANK);
let progress=readStored(PROGRESS_KEY,{answered:0,correct:0,wrongIds:[],cards:{}});
if(!validatePack(pack).ok) pack=clone(EMPTY_BANK);
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
 if(value.items.length>5000)return {ok:false,error:'Максимум 5000 вопросов в одном файле.'};
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
// A section is a topic inside a source collection; revision changes do not rename it.
function sourceGroup(item){
 const label=String(item.bankId || item.source?.document || 'Личный банк').trim();
 return label || 'Личный банк';
}
function sectionKey(item){return JSON.stringify([String(item.topic).trim(),sourceGroup(item)]);}
function sectionGroups(items=pack.items){
 const groups=new Map();
 for(const item of items){
  const key=sectionKey(item);
  if(!groups.has(key))groups.set(key,{key,topic:item.topic.trim(),bank:sourceGroup(item),items:[],revisions:new Set()});
  const group=groups.get(key);group.items.push(item);
  if(item.source?.revision)group.revisions.add(String(item.source.revision));
 }
 return [...groups.values()].sort((a,b)=>a.topic.localeCompare(b.topic,'ru')||a.bank.localeCompare(b.bank,'ru'));
}
function sectionSubtitle(group){
 const count=group.items.length;
 const version=group.revisions.size===1?' · '+[...group.revisions][0]:group.revisions.size>1?' · несколько редакций':'';
 return count+' '+ruCount(count,'вопрос','вопроса','вопросов')+' · '+group.bank+version;
}
function removeItems(ids,description){
 const n=ids.size;if(!n)return;
 if(!confirm('Удалить '+description+'?\n\n'+n+' '+ruCount(n,'вопрос будет удалён','вопроса будут удалены','вопросов будут удалены')+'. Другие разделы и общая статистика сохранятся.'))return;
 try{
  const next=normalizePack(pack);
  next.items=next.items.filter(item=>!ids.has(item.id));
  const remaining=next.items.map(item=>item.id);
  const nextProgress=filteredProgress(progress,remaining,new Set());
  commitState(next,nextProgress);
  updateAll();
  $('file-message').className='inline-ok';
  $('file-message').textContent='Удалено: '+n+'. Остальные вопросы сохранены.';
 }catch(e){$('file-message').className='inline-err';$('file-message').textContent='Не удалось удалить: '+e.message;}
}
let pendingSectionKey='';
function beginSectionUpdate(key){
 pendingSectionKey=key;
 $('section-file').click();
}
function renderPack(){
 const n=pack.items.length;
 $('pack-info').textContent=n+' '+ruCount(n,'вопрос','вопроса','вопросов')+' · '+sectionGroups().length+' '+ruCount(sectionGroups().length,'раздел','раздела','разделов');
 const list=$('bank-list');clear(list);
 const groups=sectionGroups();
 if(!groups.length){
  const block=el('div',undefined,'empty-library');
  block.append(el('strong','Пока нет вопросов'),el('p','Добавь первый раздел через JSON-файл.','muted'));
  list.append(block);
 }
 for(const group of groups){
  const panel=el('div',undefined,'section-entry');
  const header=el('div',undefined,'section-head');
  const info=el('div',undefined,'section-info');
  info.append(el('strong',group.topic),el('span',sectionSubtitle(group),'muted'));
  const reveal=el('button','Вопросы','secondary mini-button');reveal.type='button';
  header.append(info,reveal);panel.append(header);
  const details=el('div',undefined,'section-questions hidden');
  group.items.forEach((it,index)=>{
   const line=el('div',undefined,'question-entry');
   const title=el('span',(index+1)+'. '+it.prompt,'question-title');
   const remove=el('button','Удалить','text-danger');remove.type='button';
   remove.addEventListener('click',()=>removeItems(new Set([it.id]),'этот вопрос'));
   line.append(title,remove);details.append(line);
  });
  reveal.addEventListener('click',()=>{const open=details.classList.toggle('hidden');reveal.textContent=open?'Вопросы':'Скрыть';});
  panel.append(details);
  const actions=el('div',undefined,'section-actions');
  const update=el('button','Обновить раздел','secondary mini-button');update.type='button';
  update.addEventListener('click',()=>beginSectionUpdate(group.key));
  const remove=el('button','Удалить раздел','text-danger');remove.type='button';
  remove.addEventListener('click',()=>removeItems(new Set(group.items.map(q=>q.id)),'раздел «'+group.topic+'» ('+group.bank+')'));
  actions.append(update,remove);panel.append(actions);list.append(panel);
 }
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
function planImport(current,incoming,mode,currentProgress,targetKey=''){
 const next=mode==='replace'?normalizePack(incoming):normalizePack(current);
 const changed=new Set(),counts={added:0,updated:0,unchanged:0,skipped:0,removed:0};
 const previousById=new Map(current.items.map(q=>[q.id,q]));
 if(mode==='replace-section'){
  const selected=sectionGroups(current.items).find(g=>g.key===targetKey);
  if(!selected)throw Error('Выбери раздел, который нужно обновить.');
  if(!incoming.items.length)throw Error('В файле нет вопросов. Для удаления раздела используй кнопку «Удалить раздел».');
  if(incoming.items.some(q=>sectionKey(q)!==targetKey))throw Error('В файле должны быть вопросы только для раздела «'+selected.topic+'» из источника «'+selected.bank+'».');
  const old=new Map(selected.items.map(q=>[q.id,q]));
  const keep=next.items.filter(q=>sectionKey(q)!==targetKey);
  const keptIds=new Set(keep.map(q=>q.id));
  for(const q of incoming.items){if(keptIds.has(q.id))throw Error('ID вопроса «'+q.id+'» уже используется в другом разделе.');}
  const received=new Set(incoming.items.map(q=>q.id));
  for(const q of incoming.items){
   if(!old.has(q.id))counts.added++;
   else if(sameItem(old.get(q.id),q))counts.unchanged++;
   else{counts.updated++;changed.add(q.id);}
  }
  for(const q of selected.items)if(!received.has(q.id))counts.removed++;
  next.items=[...keep,...clone(incoming.items)];
 }else if(mode==='replace'){
  const newIds=new Set(next.items.map(q=>q.id));
  for(const q of next.items){if(!previousById.has(q.id))counts.added++;else if(sameItem(previousById.get(q.id),q))counts.unchanged++;else{counts.updated++;changed.add(q.id);}}
  for(const q of current.items)if(!newIds.has(q.id))counts.removed++;
 }else{
  const byId=new Map(next.items.map((v,i)=>[v.id,i]));
  for(const q of incoming.items){
   if(!byId.has(q.id)){byId.set(q.id,next.items.length);next.items.push(clone(q));counts.added++;}
   else if(sameItem(next.items[byId.get(q.id)],q))counts.unchanged++;
   else if(mode==='update'){
    if(sectionKey(next.items[byId.get(q.id)])!==sectionKey(q))throw Error('В файле совпадает идентификатор вопроса из другого раздела. Исправь файл перед импортом.');
    next.items[byId.get(q.id)]=clone(q);changed.add(q.id);counts.updated++;
   }
   else counts.skipped++;
  }
 }
 if(mode!=='replace'){
  next.title='Моя база вопросов';
  next.importHistory.push({title:String(incoming.title||'Без названия'),revision:String(incoming.bankRevision||''),importedAt:new Date().toISOString(),added:counts.added,updated:counts.updated,skipped:counts.skipped,removed:counts.removed});
  next.importHistory=next.importHistory.slice(-50);
 }
 const valid=validatePack(next);if(!valid.ok)throw Error(valid.error);
 return {next,counts,changed,nextProgress:filteredProgress(currentProgress,next.items.map(q=>q.id),changed)};
}
function ruCount(n,one,few,many){
 const v=Math.abs(n)%100,last=v%10;
 return v>=11&&v<=14?many:last===1?one:last>=2&&last<=4?few:many;
}
function importConfirmation(plan,mode,bankTitle,targetKey=''){
 const c=plan.counts,dialog=$('import-dialog');
 const section=mode==='replace-section', restore=mode==='restore';
 const selected=section?sectionGroups().find(g=>g.key===targetKey):null;
 $('import-dialog-title').textContent=section?'Обновить «'+selected.topic+'»?':restore?'Восстановить базу?':'Добавить вопросы?';
 $('import-dialog-subtitle').textContent='Файл: «'+String(bankTitle||'Банк вопросов').slice(0,90)+'»';
 const metrics=$('import-dialog-metrics');clear(metrics);
 metrics.classList.toggle('three',!section&&!restore);
 function metric(label,value){const box=el('div',undefined,'dialog-metric');box.append(el('span',label,'dialog-metric-label'),el('strong',String(value),'dialog-metric-value'));metrics.append(box);}
 if(section){metric('Сейчас',selected.items.length);metric('Будет',selected.items.length+c.added-c.removed);}
 else if(restore){metric('Сейчас в базе',pack.items.length);metric('В копии',plan.next.items.length);}
 else{metric('Новых',c.added);metric('Изменено',c.updated);metric('Без изменений',c.unchanged);}
 const updateWrap=$('import-dialog-update-wrap');
 show('import-dialog-update-wrap',!section&&!restore&&c.updated>0);
 $('import-dialog-update').checked=true;
 let note='';
 if(section){
  note='Этот раздел будет полностью заменён. Остальные вопросы не изменятся.';
  if(c.removed)note+=' Будет удалено старых вопросов: '+c.removed+'.';
  if(c.updated)note+=' Для '+c.updated+' изменённых вопросов история повторений начнётся заново.';
 }else if(restore){
  note='Вопросы и статистика на этом устройстве будут заменены данными из копии. Перед восстановлением советуем сохранить текущую копию.';
 }else{
  note='Вопросы, которых нет в файле, останутся в базе. Прогресс новых и неизменённых вопросов сохранится.';
  if(c.updated)note+=' Для исправленных вопросов история повторений начнётся заново.';
 }
 $('import-dialog-note').textContent=note;
 $('import-dialog-accept').textContent=section?'Обновить раздел':restore?'Восстановить':'Импортировать';
 if(typeof dialog.showModal!=='function')return Promise.resolve({accepted:confirm($('import-dialog-title').textContent+'\n'+note),updateExisting:!section&&!restore});
 return new Promise(resolve=>{
  let done=false;
  const yes=$('import-dialog-accept'),no=$('import-dialog-cancel');
  function finish(accepted){
   if(done)return;done=true;
   const updateExisting=$('import-dialog-update').checked;
   yes.removeEventListener('click',accept);no.removeEventListener('click',cancel);dialog.removeEventListener('close',cancel);
   if(dialog.open)dialog.close();
   resolve({accepted,updateExisting});
  }
  function accept(){finish(true);}function cancel(){finish(false);}
  yes.addEventListener('click',accept);no.addEventListener('click',cancel);dialog.addEventListener('close',cancel);
  dialog.showModal();
 });
}
async function importFile(file,mode='add',targetKey=''){
 const msg=mode==='replace-section'?$('section-message'):mode==='restore'?$('backup-message'):$('file-message');
 msg.className='';msg.textContent='';if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('Файл слишком большой для текущего хранилища (максимум 10 МБ).');
  const raw=JSON.parse(await file.text());
  if(mode==='restore'&&(!raw.pack||!raw.progress||typeof raw.progress!=='object'))throw Error('Это не резервная копия приложения. Выбери файл, созданный кнопкой «Сохранить копию».');
  const incoming=raw.pack||raw;
  const valid=validatePack(incoming);if(!valid.ok)throw Error(valid.error);
  if(mode==='add' && !incoming.items.length)throw Error('В этом файле нет вопросов.');
  const planMode=mode==='add'?'update':mode==='restore'?'replace':mode;
  let plan=planImport(pack,incoming,planMode,progress,targetKey);
  const c=plan.counts;
  if(mode==='add'&&!c.added&&!c.updated){msg.className='inline-ok';msg.textContent='Все вопросы из файла уже есть в базе. Новых изменений нет.';return;}
  if(mode==='replace-section'&&!c.added&&!c.updated&&!c.removed){msg.className='inline-ok';msg.textContent='Этот раздел уже соответствует выбранному файлу.';return;}
  const choice=await importConfirmation(plan,mode,incoming.title,targetKey);
  if(!choice.accepted)return;
  if(mode==='add'&&!choice.updateExisting){
   plan=planImport(pack,incoming,'add',progress);
   if(!plan.counts.added){msg.className='inline-ok';msg.textContent='Новых вопросов нет. Существующие оставлены без изменений.';return;}
  }
  const nextProgress=mode==='restore'?progressFromBackup(raw.progress,plan.next.items.map(q=>q.id)):plan.nextProgress;
  commitState(plan.next,nextProgress);
  updateAll();
  msg.className='inline-ok';
  if(mode==='restore')msg.textContent='Копия восстановлена. Вопросы и прогресс загружены.';
  else if(mode==='replace-section')msg.textContent='Раздел обновлён. Остальные вопросы сохранены.';
  else msg.textContent='Готово! Добавлено: '+plan.counts.added+', исправлено: '+plan.counts.updated+'. Всего вопросов: '+pack.items.length+'.';
 }catch(e){msg.className='inline-err';msg.textContent='Не удалось загрузить файл: '+e.message;}
}
function updateAll(){fillSelect('quiz-topic');fillSelect('card-topic');renderStats();renderPack();quizReset();stopCards();}
function boot(){
 document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));
 $('start-quiz').addEventListener('click',quizStart);$('check-answer').addEventListener('click',quizCheck);$('next-question').addEventListener('click',quizNext);$('stop-quiz').addEventListener('click',quizFinish);$('restart-quiz').addEventListener('click',quizReset);
 $('start-cards').addEventListener('click',cardsStart);$('reveal-card').addEventListener('click',()=>{cards.revealed=true;renderCard();});$('again-card').addEventListener('click',()=>cardAnswer(false));$('know-card').addEventListener('click',()=>cardAnswer(true));$('stop-cards').addEventListener('click',stopCards);
 $('import-file').addEventListener('change',async e=>{try{await importFile(e.target.files[0],'add');}finally{e.target.value='';}});
 $('section-file').addEventListener('change',async e=>{const key=pendingSectionKey;try{await importFile(e.target.files[0],'replace-section',key);}finally{e.target.value='';pendingSectionKey='';}});
 $('restore-file').addEventListener('change',async e=>{try{await importFile(e.target.files[0],'restore');}finally{e.target.value='';}});
 $('export-backup').addEventListener('click',()=>download('b737-trainer-backup.json',{pack,progress,exportedAt:new Date().toISOString()}));
 $('export-template').addEventListener('click',()=>download('b737-trainer-json-example.json',EXAMPLE_BANK));
 updateAll();selectTab('quiz');
 const conn=$('connection'); const syncConn=()=>conn.textContent=navigator.onLine?'◉ Режим сети':'✓ Офлайн';window.addEventListener('online',syncConn);window.addEventListener('offline',syncConn);syncConn();
 if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost' || location.hostname==='127.0.0.1'))navigator.serviceWorker.register('./sw.js').catch(e=>{console.warn('Service worker registration failed',e);});
}
boot();