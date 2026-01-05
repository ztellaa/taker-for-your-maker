(function(){
  var $ = function(sel, el){ return (el||document).querySelector(sel); };
  var $$ = function(sel, el){ return Array.from((el||document).querySelectorAll(sel)); };

  // DOM refs
  var stageWrap=$('#stageWrap'), stage=$('#stage'), linkLayer=$('#linkLayer'), nodeLayer=$('#nodeLayer');
  var viewMindBtn=$('#viewMind'), viewListBtn=$('#viewList');
  var addRootBtn=$('#addRoot'), addChildBtn=$('#addChild'), editNodeBtn=$('#editNode'), toggleHighlightBtn=$('#toggleHighlight'), deleteNodeBtn=$('#deleteNode'), foldBtn=$('#foldBtn');
  var distributeBtn=$('#distributeBtn'), templateSelect=$('#templateSelect'), searchInput=$('#search');
  var defaultOffsetInput=$('#defaultOffset');
  var zoomInBtn=$('#zoomIn'), zoomOutBtn=$('#zoomOut'), zoomResetBtn=$('#zoomReset');
  var saveBtn=$('#saveBtn'), loadBtn=$('#loadBtn'), fileInput=$('#fileInput');
  var listView=$('#listView'), mindmapView=$('#mindmapView'), taskList=$('#taskList'), listSort=$('#listSort'), statusFilters=$('#statusFilters');
  var editorBackdrop=$('#editorBackdrop'), f_title=$('#f_title'), f_template=$('#f_template'), f_status=$('#f_status'), f_due=$('#f_due'), f_notes=$('#f_notes'), f_freq=$('#f_freq'), f_lastcontact=$('#f_lastcontact'), f_nextcontact=$('#f_nextcontact'), kvArea=$('#kvArea'), addKVBtn=$('#addKV'), cancelEditBtn=$('#cancelEdit'), saveEditBtn=$('#saveEdit'), colorPalette=$('#colorPalette'), importAccountsBtn=$('#importAccounts');
  var backupsBackdrop=$('#backupsBackdrop'), backupsList=$('#backupsList'), closeBackupsBtn=$('#closeBackups'), backupsBtn=$('#backupsBtn');
  var mailingBackdrop=$('#mailingBackdrop'), mailingBtn=$('#mailingBtn'), audienceSel=$('#audience'), tagsFilter=$('#tagsFilter'), mailingPreview=$('#mailingPreview'), refreshPreviewBtn=$('#refreshPreview'), downloadCSVBtn=$('#downloadCSV'), closeMailingBtn=$('#closeMailing');
  var statClients=$('#statClients'), statAUM=$('#statAUM'), statTasks=$('#statTasks'), statOpps=$('#statOpps');

  // State
  var map=null, selectedId=null, zoom=1, tx=40, ty=45;
  var childCycleIndex=new Map();
  var lastDirty=Date.now();
  var listFilter='now';

  // RBC-themed color palette for nodes
  var Palette=['#003168','#005daa','#0073cc','#10b981','#f59e0b','#8b5cf6','#ef4444','#38bdf8','#60a5fa','#3b82f6','#34d399','#fbbf24','#a78bfa','#f87171','#93c5fd','#86efac'];
  var TemplateDefaultsColor={'Client':'#003168','COI':'#005daa','Account':'#10b981','Task':'#f59e0b','Opportunity':'#8b5cf6','Recurring Contact':'#f59e0b','Note':'#38bdf8','Sub-Tree':'#0073cc'};
  
  // Standardized template chip colors (different from node colors)
  var TemplateChipColors={
    'Client':'#003168',      // RBC Blue
    'COI':'#005daa',         // RBC Light Blue  
    'Account':'#10b981',     // Green
    'Task':'#f59e0b',        // Orange
    'Opportunity':'#8b5cf6', // Purple
    'Recurring Contact':'#f97316', // Dark Orange
    'Note':'#06b6d4',        // Cyan
    'Sub-Tree':'#6366f1'     // Indigo
  };

  // Utilities
  var uuid=function(){ return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():'id-'+Math.random().toString(36).slice(2)+Date.now().toString(36); };
  var clamp=function(v,a,b){ return Math.max(a,Math.min(b,v)); };
  var esc=function(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); };
  var shade=function(hex,amt){ try{ var c=hex.replace('#',''); var num=parseInt(c,16); var r=(num>>16)&255,g=(num>>8)&255,b=num&255; r=Math.round(Math.max(0,Math.min(1,r/255+amt))*255); g=Math.round(Math.max(0,Math.min(1,g/255+amt))*255); b=Math.round(Math.max(0,Math.min(1,b/255+amt))*255); return '#'+(((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)); }catch(e){ return hex; } };
  var labelStatus = function(s){ return ({ todo:'To do', inprogress:'In progress', blocked:'Blocked', done:'Done', 'A-tier':'A-tier', 'B-tier':'B-tier', 'C-tier':'C-tier', 'Dormant':'Dormant' })[s] || s; };
  var formatCurrency = function(num){ var n = parseFloat(num)||0; return new Intl.NumberFormat('en-CA', {style:'currency',currency:'CAD'}).format(n); };
  
  // Date format utilities for DD/MM/YY
  var formatDateDisplay = function(isoDate){ 
    if(!isoDate) return ''; 
    try{ 
      var parts = isoDate.split('-'); 
      if(parts.length !== 3) return isoDate;
      var year = parts[0].slice(-2); // Last 2 digits of year
      var month = parts[1];
      var day = parts[2];
      return day + '/' + month + '/' + year;
    }catch(e){ return isoDate; }
  };
  
  var parseCanadianDate = function(ddmmyy){
    if(!ddmmyy) return '';
    try{
      var parts = ddmmyy.split('/');
      if(parts.length !== 3) return ddmmyy;
      var day = parts[0].padStart(2,'0');
      var month = parts[1].padStart(2,'0');
      var year = parts[2];
      // Convert 2-digit year to 4-digit
      if(year.length === 2){
        var currentYear = new Date().getFullYear();
        var century = Math.floor(currentYear/100)*100;
        var fullYear = century + parseInt(year);
        // If date is more than 50 years in future, assume previous century
        if(fullYear > currentYear + 50) fullYear -= 100;
        year = fullYear.toString();
      }
      return year + '-' + month + '-' + day;
    }catch(e){ return ''; }
  };

  // Templates
  var Templates={
    'Client':{fields:{'Client ID':'','First Name':'','Last Name':'','Email':'','Cell Number':'','Lead Source':'','Birthday':'','Employer':'','Phone':'','Risk':'Moderate','AUM':'','Last Contact':'','Next Contact':'','Next Meeting':'','Salesforce':'','Tags':''}},
    'COI':{fields:{'First Name':'','Last Name':'','Email':'','Cell Number':'','Lead Source':'','Birthday':'','Employer':'','Business Type':'','Last Contact':'','Next Contact':'','Salesforce':'','Notes':'','Tags':''}},
    'Account':{fields:{'Account #':'','Type':'RRSP','Institution':'','Holdings':'','Cash':'','Custodian':'','Tags':''}},
    'Task':{fields:{'Tags':''}, show:function(n){ return '<strong>'+esc(n.title)+'</strong>'+(n.due?'<div>Due: '+formatDateDisplay(n.due)+'</div>':''); }},
    'Opportunity':{fields:{'Last Contact':'','Next Contact':'','Email':'','First Name':'','Last Name':'','Cell Number':'','Lead Source':'','Birthday':'','Employer':'','Salesforce':'','Tags':''}},
    'Recurring Contact':{fields:{'Frequency':'','Target':'Client/COI','Tags':''}, show:function(n){ var freq=n.fields['Frequency']||n.freq||''; return '<strong>'+esc(n.title||'Recurring Contact')+'</strong>'+(n.due?('<div>Next: '+formatDateDisplay(n.due)+' ('+esc(freq)+')</div>'):''); }},
    'Note':{fields:{'Tags':''}, show:function(n){ return '<strong>'+esc(n.title)+'</strong>'+(n.notes?('<div style="margin-top:6px;color:#d2d7e2">'+esc(n.notes)+'</div>'):''); }},
    'Sub-Tree':{fields:{'Tags':''}, show:function(n,depth){ var size=Math.max(16,28-depth*2); var note=n.notes?('<div style="margin-top:6px;color:#d2d7e2">'+esc(n.notes)+'</div>'):''; return '<strong style="font-size:'+size+'px;display:block;line-height:1.1">'+esc(n.title)+'</strong>'+note; }}
  };

  function defaultColorForTemplate(t){ return TemplateDefaultsColor[t]||'#003168'; }
  function ensureTags(n){ var t=(n.fields['Tags']||'').split(',').map(function(s){return s.trim();}).filter(Boolean); var wanted=['template','node',(n.template||'').toLowerCase()]; wanted.forEach(function(tag){ if(t.indexOf(tag)===-1) t.push(tag); }); n.fields['Tags']=t.join(', '); }

  function newNode(title, tmpl, parent){
    if(title===undefined) title="Untitled"; if(tmpl===undefined) tmpl=""; if(parent===undefined) parent=null;
    var effective= tmpl || (parent && parent.template) || 'Client';
    var base=(parent && parent.pos)||{x:0,y:0};
    var tFields = (Templates[effective] && Templates[effective].fields) ? (function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(Templates[effective].fields) : {};
    if(!tFields['Tags']) tFields['Tags']='';
    var color = (parent && parent.template==='Sub-Tree') ? (parent.color||defaultColorForTemplate(effective)) : defaultColorForTemplate(effective);
    var defaultStatus = (effective==='Task'||effective==='Recurring Contact') ? 'todo' : (['Client','COI','Opportunity'].indexOf(effective)!==-1 ? 'A-tier' : '');
    var node={ id:uuid(), title:title, template:effective, status:defaultStatus, due:'', notes:'', fields:tFields, freq:'', highlight:false, proxyHighlight:false, collapsed:false, color:color, anchored:false, children:[], pos: parent?{x:base.x+280+Math.random()*60,y:base.y+(parent.children.length*90+Math.random()*40)}:{x:0,y:0} };
    ensureTags(node);
    if(['Client','COI'].indexOf(node.template)!==-1){
      var rcTree = newNode('Recurring Contacts','Sub-Tree',node);
      var rc = newNode('Recurring Contact','Recurring Contact',rcTree);
      rc.fields['Frequency']= node.freq || 'quarterly';
      var daysMap={monthly:30,quarterly:90,biannually:182,annually:365};
      var days=daysMap[rc.fields['Frequency']]||90; rc.due=new Date(Date.now()+days*86400000).toISOString().slice(0,10);
      rcTree.children.push(rc);
      var tasksTree = newNode('Tasks','Sub-Tree',node);
      node.children.push(rcTree, tasksTree);
    }
    return node;
  }

  // Traversal helpers
  function bfs(root,fn){ var q=[{node:root,parent:null,depth:0}]; while(q.length){ var cur=q.shift(); fn(cur.node,cur.parent,cur.depth); cur.node.children.forEach(function(c){ q.push({node:c,parent:cur.node,depth:cur.depth+1}); }); } }
  function findNode(id){ var out=null,parent=null; bfs(map,function(n,p){ if(n.id===id){ out=n; parent=p; }}); return {node:out,parent:parent}; }
  function isDescendant(ancestorId,id){ var res=false; var a=findNode(ancestorId).node; if(!a) return false; bfs(a,function(n){ if(n.id===id) res=true; }); return res; }
  function depthOf(id){ var d=0; (function dfs(n,dd){ if(n.id===id){ d=dd; return true;} for(var i=0;i<n.children.length;i++){ if(dfs(n.children[i],dd+1)) return true; } return false; })(map,0); return d; }

  function ensurePositions(){ if(!map.pos) map.pos={x:0,y:0}; bfs(map,function(n,p){ if(!n.pos){ var base=(p && p.pos)||{x:0,y:0}; n.pos={x:base.x+280, y:base.y+(p?p.children.indexOf(n)*100:0)}; } if(!n.color) n.color=defaultColorForTemplate(n.template||'Client'); if(typeof n.collapsed!=='boolean') n.collapsed=false; if(typeof n.anchored!=='boolean') n.anchored=false; if(typeof n.proxyHighlight!=='boolean') n.proxyHighlight=false; if(n.freq==null) n.freq=''; if(n.template==='Client'||n.template==='COI'||n.template==='Opportunity'){ n.fields['Email']=n.fields['Email']||''; n.fields['Cell Number']=n.fields['Cell Number']||''; n.fields['Lead Source']=n.fields['Lead Source']||''; n.fields['Birthday']=n.fields['Birthday']||''; n.fields['Employer']=n.fields['Employer']||''; n.fields['Salesforce']=n.fields['Salesforce']||''; n.fields['Last Contact']=n.fields['Last Contact']||''; n.fields['Next Contact']=n.fields['Next Contact']||''; } ensureTags(n); }); }

  // Layout tidy for subtree
  function tidySubtree(rootId){ var root=findNode(rootId).node; if(!root) return; var gapX=300,gapY=100,start=depthOf(rootId),origin={x:root.pos.x,y:root.pos.y},nextY={}; function setPos(n,depth,y){ n.pos.x=origin.x+(depth-start)*gapX; n.pos.y=y; if(n!==root) n.anchored=true; } function place(n,depth){ if(n.collapsed){ var y0=(nextY[depth]!=null?nextY[depth]:root.pos.y); setPos(n,depth,y0); nextY[depth]=y0+gapY; return {top:n.pos.y,bottom:n.pos.y}; } if(n.children.length===0){ var y=(nextY[depth]!=null?nextY[depth]:root.pos.y); setPos(n,depth,y); nextY[depth]=y+gapY; return {top:y,bottom:y}; } var top=Infinity,bottom=-Infinity; for(var i=0;i<n.children.length;i++){ var span=place(n.children[i],depth+1); top=Math.min(top,span.top); bottom=Math.max(bottom,span.bottom);} var mid=(top+bottom)/2; var y2=Math.max(mid,(nextY[depth]!=null?nextY[depth]:root.pos.y)); setPos(n,depth,y2); nextY[depth]=y2+gapY; return {top:Math.min(top,y2),bottom:Math.max(bottom,y2)}; } place(root,start); markDirty(); renderMindMap(); }

  function propagateProxyHighlights(){ function hasHighlightedDesc(n){ var found=false; (function walk(x){ if(x.highlight){found=true;return;} x.children.forEach(walk); })(n); return found; } bfs(map,function(n){ n.proxyHighlight=false; }); bfs(map,function(n){ if(n.collapsed){ for(var i=0;i<n.children.length;i++){ var c=n.children[i]; if(hasHighlightedDesc(c)){ n.proxyHighlight=true; break; } } } }); }

  function clearLayers(){ nodeLayer.innerHTML=''; linkLayer.innerHTML=''; }

  function nextDueForCard(n){
    var direct=(n.children||[]).filter(function(c){return c.template==='Task'||c.template==='Recurring Contact';});
    var fromSubtrees=(n.children||[]).filter(function(c){return c.template==='Sub-Tree';}).flatMap(function(st){ return (st.children||[]).filter(function(x){return x.template==='Task'||x.template==='Recurring Contact';}); });
    var dues=direct.concat(fromSubtrees).map(function(t){return t.due;}).filter(Boolean).sort();
    return dues[0]||'';
  }

  function updateStats(){
    var clients=0, aum=0, tasks=0, opps=0;
    bfs(map,function(n){
      if(n.template==='Client') clients++;
      if(n.template==='Opportunity') opps++;
      if((n.template==='Task'||n.template==='Recurring Contact') && n.status!=='done') tasks++;
      if(n.fields && n.fields['AUM']){
        var val = parseFloat(String(n.fields['AUM']).replace(/[^0-9.-]/g,''))||0;
        aum += val;
      }
    });
    statClients.textContent = clients;
    statAUM.textContent = formatCurrency(aum);
    statTasks.textContent = tasks;
    statOpps.textContent = opps;
  }

  function renderMindMap(){ if(!map){ clearLayers(); return;} ensurePositions(); propagateProxyHighlights(); clearLayers(); updateStats();
    var visible=new Set(); (function walk(n){ visible.add(n.id); if(n.collapsed) return; n.children.forEach(walk); })(map);
    var cardMap=new Map();
    bfs(map,function(n,p,depth){
      if(!visible.has(n.id)) return;
      var card=document.createElement('div');
      var highlightCls = n.highlight? ' highlight' : (n.proxyHighlight? ' proxy-highlight' : '');
      var subtreeCls = n.template==='Sub-Tree' ? ' subtree' : '';
      card.className='node'+highlightCls+subtreeCls; card.style.left=n.pos.x+'px'; card.style.top=n.pos.y+'px'; card.dataset.id=n.id; card.style.borderColor=shade(n.color,-0.2);

      var typeChip = '<span class="chip"><span class="swatch" style="background:'+(TemplateChipColors[n.template]||'#6b7280')+'"></span>'+esc(n.template)+'</span>';
      var collapsedChip = n.collapsed?'<span class="badge" title="Collapsed">▸</span>':'';

      var sfUrl = (n.fields && (n.fields['Salesforce']||'').trim()) || '';
      var sfChip = (['Client','COI','Opportunity'].indexOf(n.template)!==-1 && /^https?:\/\//i.test(sfUrl)) ? ' <a class="chip sf" href="'+esc(sfUrl)+'" target="_blank" rel="noopener">Salesforce</a>' : '';
      var webUrl = (n.fields && (n.fields['Web']||'').trim()) || '';
      var liUrl = (n.fields && (n.fields['LinkedIn']||'').trim()) || '';
      var webChip = /^https?:\/\//i.test(webUrl) ? ' <a class="chip sf" href="'+esc(webUrl)+'" target="_blank" rel="noopener">Web</a>' : '';
      var liChip = /^https?:\/\//i.test(liUrl) ? ' <a class="chip sf" href="'+esc(liUrl)+'" target="_blank" rel="noopener">LinkedIn</a>' : '';

      var bodyHTML='';
      if(Templates[n.template] && Templates[n.template].show){ bodyHTML=Templates[n.template].show(n,depth); } else { bodyHTML='<strong>'+esc(n.title)+'</strong>'; }

      var nextTask = nextDueForCard(n);
      var todoLine = nextTask? '<div class="meta"><span>Next task: '+formatDateDisplay(nextTask)+'</span></div>' : '';

      var doneChip = (n.status==='done') ? ' <span class="badge" title="Done">✓</span>' : '';
      var titleHTML='<div class="title" style="font-size:'+(n.template==='Sub-Tree'?Math.max(16,28-depth*2)+'px':'15px')+'">'+bodyHTML+' '+typeChip+' '+collapsedChip+sfChip+webChip+liChip+doneChip+'</div>';

      // Build meta section with contact dates for Client, COI, Opportunity
      var metaFragments = [];
      
      // Add contact dates for Client, COI, Opportunity
      if(['Client','COI','Opportunity'].indexOf(n.template)!==-1){
        var lastContact = (n.fields && n.fields['Last Contact']) || '';
        var nextContact = (n.fields && n.fields['Next Contact']) || '';
        if(lastContact) metaFragments.push('<span>Last: '+formatDateDisplay(lastContact)+'</span>');
        if(nextContact) {
          var isOverdueContact = false;
          if(nextContact){
            var contactDate = new Date(normalizeDate(nextContact));
            var today = new Date();
            today.setHours(0,0,0,0);
            isOverdueContact = contactDate < today;
          }
          if(isOverdueContact){
            metaFragments.push('<span class="badge danger">⚠ Next: '+formatDateDisplay(nextContact)+'</span>');
          } else {
            metaFragments.push('<span>Next: '+formatDateDisplay(nextContact)+'</span>');
          }
        }
      }
      
      // Add status for Client, COI, Opportunity
      var showStatus = ['Client','COI','Opportunity'].indexOf(n.template)!==-1;
      if(showStatus && n.status) metaFragments.push('<span>'+labelStatus(n.status)+'</span>');
      
      // Add due dates for tasks
      var childDue=(n.children||[]).map(function(c){return c.due;}).filter(Boolean).sort()[0];
      var showDue=!!n.due || !!childDue;
      if(showDue){
        var dueFrag = '';
        var isOverdue = false;
        if(n.due && n.status !== 'done'){
          var dueDate = new Date(n.due);
          var today = new Date();
          today.setHours(0,0,0,0);
          isOverdue = dueDate < today;
        }
        if(isOverdue){
          dueFrag = '<span class="badge danger">⚠ Due: '+formatDateDisplay(n.due)+'</span>';
        } else if(n.due) {
          dueFrag = '<span>Due: '+formatDateDisplay(n.due)+'</span>';
        } else if(childDue) {
          dueFrag = '<span>Next: '+formatDateDisplay(childDue)+'</span>';
        }
        if(dueFrag) metaFragments.push(dueFrag);
      }
      
      // Add notes preview
      if(n.notes) metaFragments.push('<span>📝 '+esc(n.notes).slice(0,40)+(n.notes.length>40?'…':'')+'</span>');
      
      var meta=document.createElement('div'); 
      meta.className='meta'; 
      meta.innerHTML=metaFragments.join(' ');

      var kv=null; if(n.template!=='Sub-Tree'){ kv=document.createElement('div'); kv.className='kv'; kv.innerHTML=Object.keys(n.fields||{}).length?Object.entries(n.fields).filter(function(entry){return ['Last Contact','Next Contact'].indexOf(entry[0])===-1;}).slice(0,4).map(function(entry){return '<div><strong>'+esc(entry[0])+':</strong> '+esc(String(entry[1]))+'</div>';}).join(''):'<em style="color:var(--muted)">No record fields</em>'; }

      var actions=document.createElement('div'); actions.className='actions'; actions.innerHTML=
        '<button class="btn" data-act="child" type="button">Child</button>'+
        '<button class="btn" data-act="add" type="button">+Child</button>'+
        '<button class="btn" data-act="fold" type="button">'+(n.collapsed?'Unfold':'Fold')+'</button>'+
        '<button class="btn" data-act="edit" type="button">Edit</button>'+
        (['Client','COI','Opportunity'].indexOf(n.template)!==-1?'<button class="btn" data-act="tap" type="button">Touch</button>':'')+
        '<button class="btn" data-act="hl" type="button">'+(n.highlight?'Unflag':'Flag')+'</button>'+
        '<button class="btn danger" data-act="del" type="button">Delete</button>';

      card.innerHTML=titleHTML+todoLine; card.appendChild(meta); if(kv) card.appendChild(kv); card.appendChild(actions);
      nodeLayer.appendChild(card); cardMap.set(n.id,card);
    });

    drawLinks(cardMap,visible);
    highlightSelection();
  }

  function drawLinks(cardMap,visible){
    linkLayer.innerHTML='';
    var g=document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('fill','none'); linkLayer.appendChild(g);
    bfs(map,function(n,p){ if(!p) return; if(!visible.has(n.id)||!visible.has(p.id)) return; var nodeW=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--node-w'))||260; var pe=cardMap.get(p.id), ce=cardMap.get(n.id); var y1=p.pos.y+(((pe&&pe.offsetHeight)||80)/2), y2=n.pos.y+(((ce&&ce.offsetHeight)||80)/2); var x1=p.pos.x+nodeW, x2=n.pos.x, mid=(x1+x2)/2; var path=document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('d','M '+x1+' '+y1+' C '+mid+' '+y1+', '+mid+' '+y2+', '+x2+' '+y2); path.setAttribute('opacity','0.5'); var color=shade(findNode(p.id).node.color,-0.4); path.setAttribute('stroke',color); path.setAttribute('stroke-width','2'); g.appendChild(path); });
  }

  // Selection & ops
  function selectNode(id){ selectedId=id; highlightSelection(); }
  function highlightSelection(){ $$('.node',nodeLayer).forEach(function(el){ var on=el.dataset.id===selectedId; el.style.outline=on?'2px solid var(--rbc-light-blue)':'none'; el.style.outlineOffset=on?'2px':'0'; }); }

  function addChildOf(parentId){ var parent=findNode(parentId).node; if(!parent) return; var tmpl=templateSelect.value||parent.template||'Client'; if(!templateSelect.value && (parent.template==='Account'||parent.template==='Opportunity'||parent.template==='COI'||parent.template==='Client')) tmpl='Task'; var child=newNode(tmpl?tmpl:'New node',tmpl,parent); if((tmpl==='Task'||tmpl==='Recurring Contact')&&!child.due){ var days=Math.max(0,parseInt(defaultOffsetInput.value||'7',10)); var dt=new Date(Date.now()+days*86400000); child.due=dt.toISOString().slice(0,10); } parent.children.push(child); markDirty(); selectNode(child.id); renderMindMap(); buildList(); }

  function toggleHighlightCascade(id){ var node=findNode(id).node; if(!node) return; var target=!node.highlight; (function apply(n){ n.highlight=target; n.children.forEach(apply); })(node); markDirty(); renderMindMap(); buildList(); }
  function toggleFold(id){ var node=findNode(id).node; if(!node) return; node.collapsed=!node.collapsed; markDirty(); renderMindMap(); }
  function deleteNodeCascade(id){ var found=findNode(id), node=found.node, parent=found.parent; if(!node) return; var ok=window.confirm('Delete "'+node.title+'" and all of its children? This cannot be undone.'); if(!ok) return; if(map.id===id){ map=newNode('Root','Client',null); map.pos={x:0,y:0}; selectedId=map.id; } else { parent.children=parent.children.filter(function(c){return c.id!==id;}); selectedId=parent.id; } markDirty(); renderMindMap(); buildList(); }

  // Editor
  var selectedPaletteColor=null;
  function buildPalette(current){ colorPalette.innerHTML=''; selectedPaletteColor=null; Palette.forEach(function(hex){ var b=document.createElement('button'); b.className='swatchbtn'; b.type='button'; b.style.background=hex; b.setAttribute('aria-pressed',String(hex===current)); if(hex===current) selectedPaletteColor=current; b.onclick=function(){ selectedPaletteColor=hex; $('.swatchbtn',colorPalette).forEach(function(x){x.setAttribute('aria-pressed','false');}); b.setAttribute('aria-pressed','true'); }; colorPalette.appendChild(b); }); }
  function rebuildTemplateSelect(sel){ sel.innerHTML='<option value="Client">Client</option><option value="COI">COI</option><option value="Account">Account</option><option value="Task">Task</option><option value="Opportunity">Opportunity</option><option value="Recurring Contact">Recurring Contact</option><option value="Note">Note</option><option value="Sub-Tree">Sub-Tree</option>'; }
  function addKVRow(k,v){ if(k===undefined) k=''; if(v===undefined) v=''; var line=document.createElement('div'); line.className='kv-line'; line.innerHTML='<input data-k placeholder="Field name" value="'+esc(k)+'" /><input data-v placeholder="Value" value="'+esc(v)+'" /><button class="btn" type="button" title="Remove">✕</button>'; $('button',line).onclick=function(){ line.remove(); }; kvArea.appendChild(line); }
  addKVBtn.onclick=function(){ return addKVRow(); };
  function openEditor(id){
    var node=findNode(id).node; if(!node) return;
    f_title.value=node.title||''; f_due.value=node.due||''; f_notes.value=node.notes||'';
    rebuildTemplateSelect(f_template); f_template.value=node.template||''; f_freq.value=node.freq||'';
    
    // Set contact dates if they exist
    f_lastcontact.value = normalizeDate((node.fields && node.fields['Last Contact']) || '');
    f_nextcontact.value = normalizeDate((node.fields && node.fields['Next Contact']) || '');
    
    buildPalette(node.color);
    kvArea.innerHTML='';
    var entries=Object.entries(node.fields||{}).filter(function(entry){return ['Last Contact','Next Contact'].indexOf(entry[0])===-1;});
    if(entries.length===0) addKVRow('',''); else entries.forEach(function(pair){addKVRow(pair[0],String(pair[1]));});

    function setStatusOptions(tmpl, current){
      var taskOpts=['todo','inprogress','blocked','done'];
      var tierOpts=['A-tier','B-tier','C-tier','Dormant'];
      var opts=[];
      if(tmpl==='Task' || tmpl==='Recurring Contact'){ opts=taskOpts; }
      else if(['Client','COI','Opportunity'].indexOf(tmpl)!==-1){ opts=tierOpts; }
      else { opts=[]; }
      f_status.innerHTML = opts.map(function(v){return '<option value="'+v+'">'+labelStatus(v)+'</option>';}).join('');
      if(opts.length){ f_status.disabled=false; f_status.value = opts.indexOf(current)!==-1?current:opts[0]; }
      else { f_status.innerHTML=''; f_status.disabled=true; }
    }
    function applyVisibility(tmpl){
      var freqField = f_freq.closest('.field');
      var dueField = f_due.closest('.field');
      var lastContactField = f_lastcontact.closest('.field');
      var nextContactField = f_nextcontact.closest('.field');
      
      freqField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Recurring Contact') ? '' : 'none';
      dueField.style.display = (tmpl==='Task'||tmpl==='Recurring Contact') ? '' : 'none';
      lastContactField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Opportunity') ? '' : 'none';
      nextContactField.style.display = (tmpl==='Client'||tmpl==='COI'||tmpl==='Opportunity') ? '' : 'none';
    }
    setStatusOptions(node.template, node.status||'');
    applyVisibility(node.template);
    f_template.onchange=function(){ setStatusOptions(f_template.value, f_status.value); applyVisibility(f_template.value); };

    editorBackdrop.style.display='flex';
    editorBackdrop.setAttribute('aria-hidden','false');
    importAccountsBtn.style.display=(node.template==='Account')?'inline-flex':'none';
    importAccountsBtn.onclick=function(){ alert('CSV import functionality - ready for implementation'); };

    saveEditBtn.onclick=function(){
      var prevTemplate=node.template; var prevStatus=node.status;
      node.title=f_title.value.trim()||'Untitled';
      node.due=f_due.value; node.notes=f_notes.value.trim();
      node.template=f_template.value||prevTemplate; node.freq=f_freq.value||'';
      if(!f_status.disabled){ node.status=f_status.value; }
      var freqField = f_freq.closest('.field');
      if(freqField.style.display!=='none'){ node.freq=f_freq.value||''; } else { node.freq=''; }
      if(node.template!==prevTemplate){
        var defaults=(Templates[node.template]&&Templates[node.template].fields)||{};
        var merged={}; for(var k in defaults){ if(Object.prototype.hasOwnProperty.call(defaults,k)) merged[k]=defaults[k]; }
        for(var k2 in node.fields){ if(Object.prototype.hasOwnProperty.call(node.fields,k2)) merged[k2]=node.fields[k2]; }
        node.fields=merged;
        node.color=defaultColorForTemplate(node.template);
        ensureTags(node);
      }
      node.fields={};
      $$('.kv-line',kvArea).forEach(function(line){
        var k=$('input[data-k]',line).value.trim();
        var v=$('input[data-v]',line).value.trim();
        if(k) node.fields[k]=v;
      });
      
      // Save contact dates if visible
      var lastContactField = f_lastcontact.closest('.field');
      var nextContactField = f_nextcontact.closest('.field');
      if(lastContactField.style.display!=='none'){
        node.fields['Last Contact'] = f_lastcontact.value || '';
      }
      if(nextContactField.style.display!=='none'){
        node.fields['Next Contact'] = f_nextcontact.value || '';
      }
      
      ensureTags(node);
      node.color=selectedPaletteColor||node.color;
      editorBackdrop.style.display='none';
      editorBackdrop.setAttribute('aria-hidden','true');
      if(prevStatus!=='done' && node.status==='done'){ onStatusChange(node); }
      markDirty(); renderMindMap(); buildList();
    };
    cancelEditBtn.onclick=function(){
      editorBackdrop.style.display='none';
      editorBackdrop.setAttribute('aria-hidden','true');
    };
  }

  // Task list
  function buildList(){ taskList.innerHTML=''; if(!map) return; var rows=[]; 
    bfs(map,function(n){ 
      // Add tasks and recurring contacts
      if((n.template==='Task'||n.template==='Recurring Contact')&&n.due){ 
        rows.push({id:n.id,title:n.title||'Untitled',crumbs:crumbsOf(n.id).join(' / ')||'Root',status:n.status||'todo',due:n.due||'',highlight:!!n.highlight}); 
      } 
      // Add next contacts for Opportunity, Client, and COI
      if(['Opportunity','Client','COI'].indexOf(n.template)!==-1){ 
        var next=(n.fields||{})['Next Contact']; 
        if(next){ 
          rows.push({id:n.id,title:'Contact: '+n.title,crumbs:crumbsOf(n.id).join(' / ')||'Root',status:'todo',due: normalizeDate(next),highlight:!!n.highlight}); 
        } 
      } 
    });
    var tstr=today(); var now = new Date(tstr);
    var pred = function(r){ var due=r.due?new Date(normalizeDate(r.due)):null; var isOverdue = due && due < now && r.status!=='done';
      if(listFilter==='now') return isOverdue || r.status==='todo';
      if(listFilter==='todo') return r.status==='todo';
      if(listFilter==='inprogress') return r.status==='inprogress';
      if(listFilter==='blocked') return r.status==='blocked';
      if(listFilter==='done') return r.status==='done';
      if(listFilter==='overdue') return isOverdue; return true; };
    rows = rows.filter(pred);
    var key=listSort.value; rows.sort(function(a,b){ if(key==='title') return a.title.localeCompare(b.title); if(key==='status') return a.status.localeCompare(b.status); if(key==='due'){ var av=a.due?new Date(a.due):null, bv=b.due?new Date(b.due):null; if(!av&&!bv) return 0; if(!av) return 1; if(!bv) return -1; return av-bv; } return 0; }); 
    rows.forEach(function(r){ 
      var row=document.createElement('div'); 
      row.className='row'; 
      row.dataset.id=r.id; 
      
      // Check if overdue
      var isOverdue = false;
      if(r.due && r.status !== 'done'){
        var dueDate = new Date(normalizeDate(r.due));
        var today = new Date();
        today.setHours(0,0,0,0);
        isOverdue = dueDate < today;
      }
      
      var dueBadgeClass = isOverdue ? 'badge danger' : 'badge';
      var dueBadgeText = isOverdue ? '⚠ '+formatDateDisplay(r.due) : formatDateDisplay(r.due);
      
      row.innerHTML='<div style="width:10px">'+(r.highlight?'🚩':'')+'</div><div><div class=title>'+esc(r.title)+'</div><div class=crumbs>'+esc(r.crumbs)+'</div></div><div class=right><span class=badge>'+labelStatus(r.status)+'</span><span class="'+dueBadgeClass+'">'+(r.due?dueBadgeText:'No due')+'</span><button class=btn data-act=open type=button>Open</button></div>'; 
      row.addEventListener('click',function(e){ if(e.target && e.target.dataset && e.target.dataset.act==='open'){ selectNode(r.id); switchToMind(); setTimeout(function(){ openEditor(r.id); },0);} else { selectNode(r.id); switchToMind(); } }); 
      taskList.appendChild(row); 
    }); 
  }
  
  function crumbsOf(id){ var out=[]; (function dfs(n,path){ if(n.id===id){ Array.prototype.push.apply(out,path); return true;} for(var i=0;i<n.children.length;i++){ if(dfs(n.children[i],path.concat([n.title]))) return true; } return false; })(map,[]); return out; }

  // View toggles
  var switchToMind=function(){ viewMindBtn.classList.add('active'); viewListBtn.classList.remove('active'); mindmapView.classList.add('active'); listView.classList.remove('active'); };
  var switchToList=function(){ viewListBtn.classList.add('active'); viewMindBtn.classList.remove('active'); listView.classList.add('active'); mindmapView.classList.remove('active'); listFilter='now';
    $('#statusFilters .btn').forEach(function(b){ b.classList.toggle('active', b.dataset.filter==='now'); });
    buildList(); };

  // Transform & zoom
  function stageTransform(){ stage.style.transform='translate('+tx+'px, '+ty+'px) scale('+zoom+')'; $('#zoomReset').textContent=Math.round(zoom*100)+'%'; };
  stageWrap.addEventListener('wheel',function(e){ e.preventDefault(); var rect=stage.getBoundingClientRect(); var worldX=(e.clientX-rect.left-tx)/zoom; var worldY=(e.clientY-rect.top-ty)/zoom; var base=(e.deltaMode===1?15:(e.deltaMode===2?360:1)); var delta=e.deltaY*base; var factor=Math.pow(1.0012,-delta); var newZoom=clamp(zoom*factor,0.3,4); tx=e.clientX-worldX*newZoom-rect.left; ty=e.clientY-worldY*newZoom-rect.top; zoom=newZoom; stageTransform(); },{passive:false});
  function applyZoom(mult){ var rect=stage.getBoundingClientRect(); var cx=rect.width/2, cy=rect.height/2; var px=(cx-rect.left-tx)/zoom, py=(cy-rect.top-ty)/zoom; var newZoom=clamp(zoom*mult,0.3,4); tx=cx-px*newZoom-rect.left; ty=cy-py*newZoom-rect.top; zoom=newZoom; stageTransform(); }
  zoomInBtn.onclick=function(){ return applyZoom(1.15); }; zoomOutBtn.onclick=function(){ return applyZoom(1/1.15); }; zoomResetBtn.onclick=function(){ zoom=1; tx=40; ty=45; stageTransform(); };

  // Pan background only
  var isPanning=false, panStart=null;
  stageWrap.addEventListener('pointerdown',function(e){ if(e.button!==0) return; if(e.target.closest('.node')) return; isPanning=true; panStart={x:e.clientX,y:e.clientY,tx:tx,ty:ty}; stageWrap.setPointerCapture(e.pointerId); });
  stageWrap.addEventListener('pointermove',function(e){ if(!isPanning) return; var dx=e.clientX-panStart.x, dy=e.clientY-panStart.y; tx=panStart.tx+dx; ty=panStart.ty+dy; stageTransform(); });
  stageWrap.addEventListener('pointerup',function(){ isPanning=false; }); stageWrap.addEventListener('pointercancel',function(){ isPanning=false; });

  // Buttons
  addRootBtn.onclick=function(){ if(map && !confirm('Start a new map? Current map will be replaced.')) return; map=newNode('Root','Client',null); map.pos={x:0,y:0}; selectedId=map.id; markDirty(); renderMindMap(); buildList(); };
  addChildBtn.onclick=function(){ if(!selectedId) return; var hadTemplate=!!templateSelect.value; addChildOf(selectedId); if(hadTemplate){ var node=findNode(selectedId).node; var created=node.children[node.children.length-1]; if(created){ selectNode(created.id); openEditor(created.id); } } };
  editNodeBtn.onclick=function(){ if(!selectedId) return; openEditor(selectedId); };
  toggleHighlightBtn.onclick=function(){ if(!selectedId) return; toggleHighlightCascade(selectedId); };
  foldBtn.onclick=function(){ if(!selectedId) return; toggleFold(selectedId); };
  deleteNodeBtn.onclick=function(){ if(!selectedId) return; deleteNodeCascade(selectedId); };
  distributeBtn.onclick=function(){ if(!selectedId) return; tidySubtree(selectedId); };

  // Node buttons & selection

  // === Patch: Arrow-key navigation & Touch shortcut ===
  function isTypingTarget(el){
    return el && (el.tagName==='INPUT' || el.tagName==='TEXTAREA' || el.tagName==='SELECT' || el.isContentEditable);
  }
  function moveSelection(dir){
    if(!selectedId || !map) return;
    var fp = findNode(selectedId); if(!fp || !fp.node) return;
    var node = fp.node, parent = fp.parent;
    if(dir==='left'){ if(parent){ selectNode(parent.id); highlightSelection(); } return; }
    if(dir==='right'){ if(node.children && node.children.length){ selectNode(node.children[0].id); highlightSelection(); } return; }
    if(!parent) return;
    var sibs = parent.children || [];
    var idx = sibs.findIndex(function(c){ return c.id===node.id; });
    if(idx===-1) return;
    if(dir==='up' && idx>0){ selectNode(sibs[idx-1].id); highlightSelection(); }
    if(dir==='down' && idx<sibs.length-1){ selectNode(sibs[idx+1].id); highlightSelection(); }
  }
  function randomNodeColor(tmpl){
    try{ if(Array.isArray(Palette) && Palette.length){ return Palette[Math.floor(Math.random()*Palette.length)]; } }catch(e){}
    return defaultColorForTemplate(tmpl||'Note');
  }
  function touchCurrent(){
    if(!selectedId) return;
    var f = findNode(selectedId); if(!f || !f.node) return;
    var n = f.node; if(!n.fields) n.fields = {};
    n.fields['Last Contact'] = today();
    var note = newNode('Touch '+today(),'Note',n);
    note.color = randomNodeColor('Note');
    note.notes = 'Touched on '+today();
    n.children = n.children || []; n.children.push(note);
    markDirty(); renderMindMap(); buildList();
  }
  window.addEventListener('keydown', function(e){
    if(isTypingTarget(e.target)) return;
    if(e.key==='ArrowUp'){ moveSelection('up'); e.preventDefault(); }
    else if(e.key==='ArrowDown'){ moveSelection('down'); e.preventDefault(); }
    else if(e.key==='ArrowLeft'){ moveSelection('left'); e.preventDefault(); }
    else if(e.key==='ArrowRight'){ moveSelection('right'); e.preventDefault(); }
    else if(e.key==='t' || e.key==='T'){ touchCurrent(); e.preventDefault(); }
  }, true);
  nodeLayer.addEventListener('click', function(e){
    var btn = e.target.closest('[data-act="tap"]'); if(!btn) return;
    var nodeEl = e.target.closest('.node'); if(nodeEl && nodeEl.dataset && nodeEl.dataset.id){ selectNode(nodeEl.dataset.id); }
    e.preventDefault(); e.stopPropagation(); touchCurrent();
  }, true);
  // === End Patch ===
  nodeLayer.addEventListener('click',function(e){ if(e.target && e.target.closest('a[href]')) { return; }
      var nodeEl=e.target.closest('.node'); if(!nodeEl) return; var id=nodeEl.dataset.id; selectNode(id); var btn=e.target.closest('.btn'); if(!btn) return; e.preventDefault(); e.stopPropagation(); var act=btn.dataset.act; if(act==='add') addChildOf(id); if(act==='edit') openEditor(id); if(act==='hl') toggleHighlightCascade(id); if(act==='del') deleteNodeCascade(id); if(act==='fold') toggleFold(id); if(act==='tap') tapRecurringFor(id); if(act==='child'){ var node=findNode(id).node; if(!node) return; if(node.children.length===0){ addChildOf(id); return;} var last=childCycleIndex.has(id)?childCycleIndex.get(id):-1; var next=(last+1)%node.children.length; childCycleIndex.set(id,next); selectNode(node.children[next].id); highlightSelection(); } });

  // Drag & re-parent
  var drag=null;
  var dragStartPos = null; // Track starting position
  nodeLayer.addEventListener('pointerdown',function(e){ 
    var card=e.target.closest('.node'); 
    if(!card) return; 
    if(e.button!==0) return; 
    if(e.target.closest('.btn, input, textarea, select, a[href], [role="link"]')) return; 
    var id=card.dataset.id; 
    selectNode(id); 
    var rect=stage.getBoundingClientRect(); 
    var localX=(e.clientX-rect.left)/zoom, localY=(e.clientY-rect.top)/zoom; 
    var node=findNode(id).node; 
    drag={id:id,offX:localX-node.pos.x,offY:localY-node.pos.y}; 
    dragStartPos={x:e.clientX, y:e.clientY}; // Store start position 
    card.classList.add('dragging'); 
    if(card.setPointerCapture) card.setPointerCapture(e.pointerId); 
    node.anchored=false; 
  });
  
  nodeLayer.addEventListener('pointermove',function(e){ 
    if(!drag) return; 
    var rect=stage.getBoundingClientRect(); 
    var localX=(e.clientX-rect.left)/zoom, localY=(e.clientY-rect.top)/zoom; 
    var node=findNode(drag.id).node; 
    var prevX=node.pos.x, prevY=node.pos.y; 
    node.pos.x=localX-drag.offX; 
    node.pos.y=localY-drag.offY; 
    var dx=node.pos.x-prevX, dy=node.pos.y-prevY; 
    (function moveAnchored(n){ 
      n.children.forEach(function(c){ 
        if(c.anchored){ 
          c.pos.x+=dx; 
          c.pos.y+=dy; 
          moveAnchored(c); 
        } 
      }); 
    })(node); 
    var card=nodeLayer.querySelector('.node[data-id="'+drag.id+'"]'); 
    if(card){ 
      card.style.left=node.pos.x+'px'; 
      card.style.top=node.pos.y+'px'; 
    } 
    drawLinks(new Map($$('.node',nodeLayer).map(function(el){return [el.dataset.id,el];})), new Set()); 
    markDirty(); 
  });
  
  nodeLayer.addEventListener('pointerup',function(e){ 
    if(!drag) return; 
    var card=nodeLayer.querySelector('.node[data-id="'+drag.id+'"]'); 
    if(card) card.classList.remove('dragging'); 
    
    // Calculate drag distance
    var dragDistance = 0;
    if(dragStartPos){
      var dx = e.clientX - dragStartPos.x;
      var dy = e.clientY - dragStartPos.y;
      dragDistance = Math.sqrt(dx*dx + dy*dy);
    }
    
    // Only reparent if dragged more than 25 pixels
    if(dragDistance > 25){
      var path=document.elementsFromPoint(e.clientX,e.clientY); 
      var targetEl=path.find(function(el){return el.classList && el.classList.contains('node') && el.dataset.id!==drag.id;}); 
      if(targetEl){ 
        var targetId=targetEl.dataset.id; 
        if(!isDescendant(drag.id,targetId)){ 
          var found=findNode(drag.id), oldParent=found.parent, me=found.node; 
          if(oldParent && oldParent.id!==targetId){ 
            var newParent=findNode(targetId).node; 
            oldParent.children=oldParent.children.filter(function(c){return c.id!==drag.id;}); 
            newParent.children.push(me); 
          } 
        } 
      }
    }
    drag=null; 
    dragStartPos=null;
    markDirty(); 
    renderMindMap(); 
    buildList(); 
  });
  
  nodeLayer.addEventListener('pointercancel',function(){ 
    drag=null; 
    dragStartPos=null; 
  });

  // Keyboard shortcuts
  window.addEventListener('keydown',function(e){ if(e.target.matches('input, textarea, select')) return; if(e.key==='f'||e.key==='F'){ if(selectedId){ toggleFold(selectedId); e.preventDefault(); } } if(e.key==='Delete'){ if(selectedId){ deleteNodeCascade(selectedId); e.preventDefault(); } } if(e.key==='e'||e.key==='E'){ if(selectedId){ openEditor(selectedId); e.preventDefault(); } } if(e.key==='c'||e.key==='C'){ if(selectedId){ addChildOf(selectedId); e.preventDefault(); } } if(e.key==='d'||e.key==='D'){ if(selectedId){ tidySubtree(selectedId); e.preventDefault(); } } if(e.key==='h'||e.key==='H'){ if(selectedId){ toggleHighlightCascade(selectedId); e.preventDefault(); } } });

  // Search
  
  // Robust search: case-insensitive across title, template, status, due, notes, tags and kv fields
  (function(){
    var lastQuery = '';
    function haystack(n){
      var parts = [n.title||'', n.template||'', n.status||'', n.due||'', n.notes||'', (n.fields&&n.fields['Tags'])||''];
      if(n.fields){ try{ for(var k in n.fields){ if(Object.prototype.hasOwnProperty.call(n.fields,k)) parts.push(String(n.fields[k])); } }catch(e){} }
      return parts.join(' ').toLowerCase();
    }
    function applyFilter(q){
      q = (q||'').trim().toLowerCase(); lastQuery = q;
      var firstHit = null;
      $$('.node', nodeLayer).forEach(function(el){
        var id = el.dataset.id; var node = findNode(id).node;
        var match = !q || haystack(node).indexOf(q)!==-1;
        el.style.filter = match ? 'none' : 'grayscale(0.2)';
        el.style.opacity = match ? '1' : '0.45';
        if(!firstHit && match) firstHit = el;
      });
      if(firstHit){
        var rect = firstHit.getBoundingClientRect();
        if(rect){ // center-ish scroll via selecting; map pans to selection already
          selectNode(firstHit.dataset.id); highlightSelection();
        }
      }
    }
    if(searchInput){
      searchInput.addEventListener('input', function(){ applyFilter(this.value); });
      searchInput.addEventListener('keydown', function(e){
        if(e.key==='Enter'){ applyFilter(this.value); e.preventDefault(); }
        if(e.key==='Escape'){ this.value=''; applyFilter(''); }
      });
    }
  })();
$('#search').addEventListener('input',function(){ var q=searchInput.value.trim().toLowerCase(); $$('.node',nodeLayer).forEach(function(el){ var id=el.dataset.id; var node=findNode(id).node; var hay=[node.title,node.template,node.status,node.due,node.notes,(node.fields['Tags']||'')].concat(Object.entries(node.fields||{}).flat()).join(' ').toLowerCase(); el.style.opacity = q && hay.indexOf(q)===-1 ? .25 : 1; el.style.filter = q && hay.indexOf(q)===-1 ? 'grayscale(0.2)' : 'none'; }); });

  // Save / Load
  saveBtn.onclick=function(){ return downloadCurrent(); };
  loadBtn.onclick=function(){ return fileInput.click(); };
  fileInput.onchange=function(e){ var file=e.target.files[0]; if(!file) return; var reader=new FileReader(); reader.onload=function(){ try{ var data=JSON.parse(reader.result); applyLoaded(data); } catch(err){ alert('Could not load file. '+err.message); } }; reader.readAsText(file); fileInput.value=''; };
  function sanitize(s){ return String(s).replace(/[^a-z0-9\- _]/gi,'_'); }
  function downloadCurrent(){ var payload={version:12.1, createdAt:Date.now(), map:map}; try{ localStorage.setItem('wm.mindmap', JSON.stringify(payload)); }catch(e){} var name=(sanitize((map&&map.title)||'Map')+'-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json'); var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
  function applyLoaded(data){ var m=(data&&data.map)? migrate(data) : migrate({version:0,map:data}); map=m.map; selectedId=map.id; ensurePositions(); ensureScaffolding(); markDirty(); renderMindMap(); buildList(); }

  // Autosave Backups
  var BACKUP_KEY='wm.backups';
  function markDirty(){ lastDirty=Date.now(); try{ localStorage.setItem('wm.mindmap', JSON.stringify({version:12.1, createdAt:Date.now(), map:map})); }catch(e){} }
  function readBackups(){ try{ return JSON.parse(localStorage.getItem(BACKUP_KEY)||'[]'); }catch(e){ return []; } }
  function writeBackups(list){ try{ localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); }catch(e){} }
  function rootTitle(){ return (map&&map.title)?map.title:'Map'; }
  function snapshotBackup(reason){ if(reason===undefined) reason='autosave'; var payload={version:12.1, createdAt:Date.now(), reason:reason, map:map}; var name=(sanitize(rootTitle())+'-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.json'); var entry={name:name, ts:Date.now(), payload:payload}; var list=readBackups(); list.unshift(entry); while(list.length>10) list.pop(); writeBackups(list); }
  setInterval(function(){ if(Date.now()-lastDirty<60000){ snapshotBackup('timer'); } }, 30000);
  document.addEventListener('visibilitychange',function(){ if(document.hidden) snapshotBackup('hide'); });
  window.addEventListener('beforeunload',function(){ snapshotBackup('beforeunload'); });

  backupsBtn.onclick=function(){ rebuildBackupsUI(); backupsBackdrop.style.display='flex'; backupsBackdrop.setAttribute('aria-hidden','false'); };
  closeBackupsBtn.onclick=function(){ backupsBackdrop.style.display='none'; backupsBackdrop.setAttribute('aria-hidden','true'); };
  function rebuildBackupsUI(){ backupsList.innerHTML=''; var list=readBackups(); if(!list.length){ backupsList.innerHTML='<div class="row"><div>No backups yet.</div></div>'; return; } list.forEach(function(b){ var row=document.createElement('div'); row.className='row'; var dt=new Date(b.ts).toLocaleString(); row.innerHTML='<div><div class=title>'+esc(b.name)+'</div><div class=crumbs>'+esc(dt)+' · '+esc(b.reason||'autosave')+'</div></div><div class=right><button class=btn data-act=restore>Restore</button><button class=btn data-act=download>Download</button></div>'; row.addEventListener('click',function(e){ var act=e.target && e.target.dataset && e.target.dataset.act; if(act==='restore'){ if(confirm('Restore this backup? Current map will be replaced.')){ applyLoaded(b.payload); backupsBackdrop.style.display='none'; } } if(act==='download'){ var blob=new Blob([JSON.stringify(b.payload,null,2)],{type:'application/json'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=b.name; a.click(); URL.revokeObjectURL(a.href); } }); backupsList.appendChild(row); }); }

  // Mailing modal
  mailingBtn.onclick=function(){ refreshMailingPreview(); mailingBackdrop.style.display='flex'; mailingBackdrop.setAttribute('aria-hidden','false'); };
  closeMailingBtn.onclick=function(){ mailingBackdrop.style.display='none'; mailingBackdrop.setAttribute('aria-hidden','true'); };
  refreshPreviewBtn.onclick=function(){ return refreshMailingPreview(); };
  downloadCSVBtn.onclick=function(){ var rows=computeAudience(); var lines=['first name,last name,email,company,type']; rows.forEach(function(r){ lines.push(csvEsc(r.first)+','+csvEsc(r.last)+','+csvEsc(r.email)+','+csvEsc(r.company)+','+csvEsc(r.type)); }); var blob=new Blob([lines.join('\n')],{type:'text/csv'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='mailing-'+new Date().toISOString().slice(0,10)+'.csv'; a.click(); URL.revokeObjectURL(a.href); };
  function csvEsc(s){ var v=(s||'').replace(/"/g,'""'); return /[",\n]/.test(v)?'"'+v+'"':v; }
  function refreshMailingPreview(){ var rows=computeAudience().slice(0,50); mailingPreview.innerHTML=''; rows.forEach(function(r){ var row=document.createElement('div'); row.className='row'; row.innerHTML='<div class=title>'+esc(r.first+' '+r.last)+'</div><div class=crumbs>'+esc(r.email)+' • '+esc(r.type)+'</div>'; mailingPreview.appendChild(row); }); }
  function computeAudience(){ var mode=audienceSel.value; var tagSet=new Set((tagsFilter.value||'').split(',').map(function(s){return s.trim().toLowerCase();}).filter(Boolean)); var out=[]; var seen=new Set(); bfs(map,function(n){ var email=(n.fields['Email']||'').trim(); if(!email) return; var first=(n.fields['First Name']||n.title.split(' ')[0]||'').trim(); var last=(n.fields['Last Name']||'').trim(); var company=(n.fields['Employer']||'').trim(); var tags=(n.fields['Tags']||'').toLowerCase(); var isClient=n.template==='Client'; var isOpp=n.template==='Opportunity'; var isCOI=n.template==='COI'; var include=false; if(mode==='clientsOpps') include=(isClient||isOpp); else if(mode==='clientsCoi') include=(isClient||isCOI); else if(mode==='byTags') include = tagSet.size===0 ? true : Array.from(tagSet).every(function(t){ return tags.indexOf(t)!==-1; }); if(include){ if(!seen.has(email)){ out.push({first:first,last:last,email:email,company:company,type:n.template}); seen.add(email);} } }); return out; }

  // Migrations & scaffolding
  function migrate(input){ var version=input.version, m=input.map; if(!version) version=0; bfs(m,function(n,p){ n.fields=n.fields||{}; if(n.fields['Web']===undefined) n.fields['Web']=''; if(n.fields['LinkedIn']===undefined) n.fields['LinkedIn']=''; n.notes=n.notes||''; n.status = n.status || ((n.template==='Task'||n.template==='Recurring Contact') ? 'todo' : (['Client','COI','Opportunity'].indexOf(n.template)!==-1 ? 'A-tier' : '')); n.due=n.due||''; n.template=n.template||((p && p.template) || 'Client'); n.color=n.color||defaultColorForTemplate(n.template); n.collapsed=!!n.collapsed; n.highlight=!!n.highlight; n.proxyHighlight=!!n.proxyHighlight; n.anchored=!!n.anchored; n.pos=n.pos||{x:0,y:0}; if(!n.fields['Tags']) n.fields['Tags']=''; if(n.freq==null) n.freq=''; if(n.template==='Client'||n.template==='COI'||n.template==='Opportunity'){ n.fields['Email']=n.fields['Email']||''; n.fields['Cell Number']=n.fields['Cell Number']||''; n.fields['Lead Source']=n.fields['Lead Source']||''; n.fields['Birthday']=n.fields['Birthday']||''; n.fields['Employer']=n.fields['Employer']||''; n.fields['Salesforce']=n.fields['Salesforce']||''; n.fields['Last Contact']=n.fields['Last Contact']||''; n.fields['Next Contact']=n.fields['Next Contact']||''; } ensureTags(n); }); return {version:12.1,map:m}; }

  function ensureScaffolding(){ bfs(map,function(n){
    if(n.template==='Client'||n.template==='COI'){
      var rcTree=n.children.find(function(c){return c.template==='Sub-Tree' && /^Recurring Contacts$/i.test(c.title);});
      if(!rcTree){ rcTree=newNode('Recurring Contacts','Sub-Tree',n); n.children.unshift(rcTree); }
      var stray=n.children.filter(function(c){return c.template==='Recurring Contact';});
      stray.forEach(function(c){ n.children=n.children.filter(function(x){return x!==c;}); rcTree.children.push(c); });
      if(rcTree.children.filter(function(c){return c.template==='Recurring Contact';}).length===0){ var rc=newNode('Recurring Contact','Recurring Contact',rcTree); rc.fields['Frequency']= n.freq||'quarterly'; var daysMap={monthly:30,quarterly:90,biannually:182,annually:365}; var days=daysMap[rc.fields['Frequency']]||90; rc.due=new Date(Date.now()+days*86400000).toISOString().slice(0,10); rcTree.children.push(rc); }
      var tasksTree=n.children.find(function(c){return c.template==='Sub-Tree' && /^Tasks$/i.test(c.title);});
      if(!tasksTree){ tasksTree=newNode('Tasks','Sub-Tree',n); n.children.push(tasksTree); }
    }
  }); }

  // Tap recurring: mark current as done and spawn next
  function tapRecurringFor(id){
    var node=findNode(id).node; if(!node) return; ensureScaffolding();
    var rcTree = node.children.find(function(c){return c.template==='Sub-Tree' && /^Recurring Contacts$/i.test(c.title);});
    if(!rcTree){ rcTree=newNode('Recurring Contacts','Sub-Tree',node); node.children.unshift(rcTree); }
    var list = rcTree.children.filter(function(c){return c.template==='Recurring Contact';});
    if(list.length===0){ var first=newNode('Recurring Contact','Recurring Contact',rcTree); first.fields['Frequency']= node.freq||'quarterly'; first.due = advanceDate(today(), freqToDays(first.fields['Frequency'])); rcTree.children.push(first); list=[first]; }
    list.sort(function(a,b){ return (a.due||'9999-12-31').localeCompare(b.due||'9999-12-31'); });
    var cur = list.find(function(x){return x.status!=='done';}) || list[0];
    if(!cur.due) cur.due = today();
    var prevStatus=cur.status; cur.status='done';
    if(prevStatus!=='done') onStatusChange(cur);
    markDirty(); renderMindMap(); buildList();
  }

  // Recurring completion logic
  function freqToDays(freq){ return ({monthly:30,quarterly:90,biannually:182,annually:365}[freq]||90); }
  function onStatusChange(n){ if((n.template==='Recurring Contact'||n.template==='Task') && (n.freq||n.fields['Frequency']) && n.status==='done'){ var parent=findNode(n.id).parent; if(!parent) return; var freq=n.freq||n.fields['Frequency']; var next=newNode(n.title,n.template,parent); next.freq=freq; next.fields=(function(o){var c={}; for(var k in o){ if(Object.prototype.hasOwnProperty.call(o,k)) c[k]=o[k]; } return c;})(n.fields); next.due=advanceDate(n.due||today(),freqToDays(freq)); parent.children.push(next); markDirty(); renderMindMap(); buildList(); } }
  function today(){ return new Date().toISOString().slice(0,10); }
  function advanceDate(ymd,days){ try{ var d=new Date(ymd+'T00:00:00'); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10);} catch(e){return ymd;} }
  // Normalize to ISO for calculations; accepts '' | 'yyyy-mm-dd' | 'dd/mm/yy'
  function normalizeDate(s){
    if(!s) return '';
    if(s.indexOf('/')!==-1){
      var parts = s.split('/');
      if(parts.length===3){
        var d = parts[0].padStart(2,'0');
        var m = parts[1].padStart(2,'0');
        var y = parts[2];
        if(y.length===2){ y = (parseInt(y,10)>=70 ? '19' : '20') + y; }
        return y+'-'+m+'-'+d;
      }
    }
    return s;
  }


  // Expand/Collapse all
  $('#expandAll').onclick=function(){ bfs(map,function(n){ n.collapsed=false; }); markDirty(); renderMindMap(); };
  $('#collapseAll').onclick=function(){ bfs(map,function(n){ n.collapsed=true; }); map.collapsed=false; markDirty(); renderMindMap(); };

  // Init
  function init(){ 
    restore(); 
    stageWrap.addEventListener('click',function(e){ 
      if(e.target===stageWrap || e.target===linkLayer){ 
        selectedId=(map&&map.id)||null; 
        highlightSelection(); 
      } 
    }); 
    window.addEventListener('resize',function(){ renderMindMap(); }); 
    viewMindBtn.onclick=switchToMind; 
    viewListBtn.onclick=switchToList; 
    statusFilters.addEventListener('click',function(e){ 
      var b=e.target.closest('button'); 
      if(!b) return; 
      $('#statusFilters .btn').forEach(function(x){x.classList.remove('active');}); 
      b.classList.add('active'); 
      listFilter=b.dataset.filter; 
      buildList(); 
    }); 
    listSort.addEventListener('change', buildList); 
  }
  
  function restore(){ 
    var raw=localStorage.getItem('wm.mindmap'); 
    if(raw){ 
      try{ 
        var data=JSON.parse(raw); 
        if(data&&data.map){ 
          var m=migrate(data); 
          map=m.map; 
          selectedId=map.id; 
          ensurePositions(); 
          ensureScaffolding(); 
          renderMindMap(); 
          buildList(); 
          return; 
        } 
      }catch(e){} 
    }
    map=newNode('RBC Wealth Portfolio','Client',null); 
    map.pos={x:0,y:0}; 
    selectedId=map.id; 
    var c1=newNode('Jane Smith','Client',map); 
    c1.fields['Email']='jane.smith@email.com'; 
    c1.fields['First Name']='Jane'; 
    c1.fields['Last Name']='Smith'; 
    c1.fields['AUM']='2500000'; 
    c1.fields['Last Contact']='2025-01-10';
    c1.fields['Next Contact']='2025-02-15';
    c1.freq='quarterly'; 
    var coi=newNode('Michael Chen','COI',map); 
    coi.fields['Email']='michael.chen@accounting.ca'; 
    coi.fields['First Name']='Michael'; 
    coi.fields['Last Name']='Chen'; 
    coi.fields['Business Type']='CPA'; 
    coi.fields['Last Contact']='2024-12-20';
    coi.fields['Next Contact']='2025-03-20';
    coi.freq='biannually'; 
    var a1=newNode('RRSP #8821','Account',c1); 
    a1.fields['Holdings']='850000'; 
    var o1=newNode('Estate Planning Review','Opportunity',c1); 
    o1.fields['Email']='jane.smith@email.com'; 
    o1.fields['First Name']='Jane'; 
    o1.fields['Last Name']='Smith'; 
    o1.fields['Last Contact']='2025-01-05';
    o1.fields['Next Contact']='2025-01-25';
    ensureScaffolding(); 
    map.children.push(c1,coi); 
    c1.children.push(a1,o1); 
    renderMindMap(); 
    buildList(); 
  }
  
  init();
})();
