(function(){
"use strict";
/* ===================== nav — §7 proposed IA ===================== */
var NAV=[
 {sec:"Overview",items:[
  {id:"dashboard",l:"Dashboard",i:"i-gauge"},
  {id:"assets",l:"Asset inventory",i:"i-pie"}]},
 {sec:"Work",items:[
  {id:"approvals",l:"Device approvals",i:"i-inbox",attn:6},
  {id:"requests",l:"Access requests",i:"i-inbox",attn:2}]},
 {sec:"Identity",items:[
  {id:"users",l:"Users",i:"i-users",n:1820},
  {id:"groups",l:"Groups",i:"i-users",n:46},
  {id:"authp",l:"Auth profiles",i:"i-finger",n:5}]},
 {sec:"Security",items:[
  {id:"devices",l:"Devices",i:"i-laptop",n:775},
  {id:"devchecks",l:"Device checks",i:"i-shield",n:150},
  {id:"filters",l:"Filters",i:"i-funnel",n:0}]},
 {sec:"Access",items:[
  {id:"apps",l:"Applications",i:"i-grid",n:53},
  {id:"rules",l:"Access rules",i:"i-key",n:57},
  {id:"explorer",l:"Access explorer",i:"i-compass"}]},
 {sec:"Monitoring",items:[
  {id:"eventlog",l:"Logs & reports",i:"i-chart",n:794},
  {id:"downloads",l:"Downloads",i:"i-dl"}]},
 {sec:"Settings",items:[
  {id:"setcompany",l:"Company",i:"i-gear"},
  {id:"setidentity",l:"Identity",i:"i-gear"},
  {id:"setnotify",l:"Notifications",i:"i-gear"},
  {id:"support",l:"Tech support",i:"i-life"}]}
];
var CRUMB={};NAV.forEach(function(g){g.items.forEach(function(it){CRUMB[it.id]=g.sec+" › "+it.l;});});
CRUMB.signin="Sign in";CRUMB.onboard="Identity › Onboard a user";CRUMB.setup="Overview › Set up i365";CRUMB.import="Identity › Import users";

/* ===================== data ===================== */
var FIRST="Alen Debajyoti Kavya Rohit Priya Arjun Meera Sanjay Nikhil Ananya Vikram Shruti Karan Divya Rahul Neha Aditya Pooja Manish Ritu Suresh Tara Imran Lakshmi Gaurav Sneha Varun Anjali Harsh Kiran Deepak Swati Naveen Isha Aman Rekha Siddharth Nandini Yash Preeti".split(" ");
var LAST="Joseph Darshan Menon Nair Sharma Reddy Iyer Gupta Bose Kulkarni Rao Patel Singh Chopra Verma Das Malhotra Pillai Shetty Banerjee".split(" ");
var PROF=["Local","Active Directory","Azure AD","OpenLDAP","SAML"];
var OSL=["Windows 11","Windows 10","macOS 15","Ubuntu 24.04","Android 15","iOS 18"];
var SEEN=["just now","2 min ago","18 min ago","1 h ago","4 h ago","yesterday","3 d ago","12 d ago"];
var USERS=[],DEV=[],APPS=[],GROUPS=[],RULES=[];
(function(){
 for(var i=0;i<60;i++){var f=FIRST[i%FIRST.length],l=LAST[(i*7)%LAST.length];
  USERS.push({id:"u"+i,first:f,last:l,n:f+" "+l,u:(f+"."+l).toLowerCase(),p:PROF[(i*3)%PROF.length],
   mfa:!(i%7===2||i%13===5),s:(i%11===3)?"Suspended":"Active",
   ip:"10.24."+(8+(i%6))+"."+(11+(i*13)%220),seen:SEEN[(i*5)%SEEN.length],
   email:(f+"."+l).toLowerCase()+"@instasafe.com",groups:[(i%6),(i%6)+6],devices:1+(i%3)});}
 for(var d=0;d<48;d++){var pend=(d%9===1||d%14===4),fail=(d%6===2);
  DEV.push({id:"d"+d,name:(d%2?"LT":"WS")+"-"+(1040+d*3),os:OSL[(d*5)%OSL.length],
   owner:FIRST[(d*3)%FIRST.length]+" "+LAST[(d*5)%LAST.length],
   mac:("A4:"+(16+d).toString(16)+":7B:"+(32+d*3).toString(16)+":C1:"+((10+d*7)%256).toString(16)).toUpperCase(),
   posture:fail?"Failed":"Passed",state:pend?"Pending":"Approved",
   failed:fail?["Disk encryption off","OS patch level 3 behind"][d%2]:null,
   wait:pend?(1+(d*3)%9):0,seen:SEEN[(d*3)%SEEN.length]});}
 var TY=["WEB","RDP","SSH","DB","FQDN","VNC","WFS"];
 for(var a=0;a<28;a++)APPS.push({id:"a"+a,name:["payroll","wiki","jenkins","grafana","jira","reports","crm","vault"][a%8]+"-"+(a+1),
   type:TY[a%7],host:"10.6."+(2+a%8)+"."+(20+a*5),port:[443,3389,22,5432,443,5900,445][a%7]});
 for(var g=0;g<14;g++)GROUPS.push({id:"g"+g,name:["Engineering","Finance","Contractors","Sales","Support","Ops","Legal"][g%7]+(g>6?" (EMEA)":""),
   members:6+(g*13)%180,apps:[(g%8),(g%8)+8,(g%8)+16]});
 var ST=["User","Group","Application"];
 for(var r=0;r<34;r++)RULES.push({id:"r"+r,name:["finance-rdp","hr-portal","build-ssh","vpn-full","db-readonly","wiki-web"][r%6]+"-"+(r+1),
   src:ST[r%3],source:r%3===1?GROUPS[r%GROUPS.length].name:USERS[(r*3)%USERS.length].u,
   dst:"Application",dest:APPS[(r*2)%APPS.length].name,
   act:(r%8===3)?"Deny":(r%13===5?"Bypass":"Allow"),users:12+(r*37)%420,devices:8+(r*23)%260});
})();
var OSOPT=[];(function(){var v=["Windows","macOS","Ubuntu","Debian","RHEL","Android","iOS","Fedora","AlmaLinux","Amazon Linux"];
 for(var i=0;i<2393;i++)OSOPT.push(v[i%v.length]+" "+(10+i%40)+(i%7?"."+(i%13):"")+(i%11?" build "+(1000+i):""));})();

/* ===================== state ===================== */
var S={page:"dashboard",q:"",sel:{},sort:null,dir:"asc",tab:"all",cols:null,view:"",
       data:"normal",sheet:null,editing:null,added:[],hidden:{},db:null,
       wiz:null,exp:null,imp:null,approved:{}};
var LSK="i365vb";
function lg(k,d){try{var v=localStorage.getItem(LSK+":"+k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function ls(k,v){try{localStorage.setItem(LSK+":"+k,JSON.stringify(v));}catch(e){}}
var storeMsg="Local only — created records stay in this browser.";
(function(){
 S.hidden=lg("hidden",{});S.approved=lg("approved",{});S.wiz=lg("wizdraft",null);
 if(!(window.claude&&window.claude.use)){S.added=lg("added",[]);return;}
 window.claude.use("db").then(function(db){
  if(!db){S.added=lg("added",[]);syncRail();return;}
  S.db=db;storeMsg="Shared — created records save to this artifact and appear for everyone on the team.";
  db.collection("tenant_users").orderBy("createdAt","desc").limit(200).onSnapshot(function(sn){
   S.added=sn.docs.map(function(x){var o=x.data()||{};o.id=x.id;o.added=true;return o;});render();syncRail();
  },function(){storeMsg="Local only — shared storage stopped responding.";S.added=lg("added",[]);render();});
  syncRail();
 }).catch(function(){S.added=lg("added",[]);syncRail();});
})();

/* ===================== helpers ===================== */
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function ic(i){return '<svg><use href="#'+i+'"/></svg>';}
function init2(n){return String(n||"").split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();}
function selIds(){return Object.keys(S.sel).filter(function(k){return S.sel[k];});}
function pill(k,t,dot){return '<span class="pill p-'+k+'">'+(dot?'<i></i>':'')+esc(t)+'</span>';}
function quiet(t){return '<span class="quiet">'+esc(t)+'</span>';}
function toast(title,msg,kind){
 var w=document.getElementById("toasts");
 var col=kind==="bad"?"var(--bad)":kind==="att"?"var(--c600)":"var(--ok)";
 var el=document.createElement("div");el.className="toast";el.setAttribute("role","status");
 el.innerHTML='<span class="ti" style="color:'+col+'">'+ic(kind==="bad"||kind==="att"?"i-warn":"i-check")+'</span>'+
  '<div style="flex:1"><b>'+esc(title)+'</b><span>'+esc(msg||"")+'</span></div>'+
  '<button class="cl" aria-label="Dismiss">'+ic("i-x")+'</button>';
 el.querySelector(".cl").onclick=function(){el.remove();};
 w.appendChild(el);setTimeout(function(){el.remove();},6500);
}
function closeLayer(){document.getElementById("layer").innerHTML="";}
function allUsers(){return S.added.concat(USERS.filter(function(u){return !S.hidden[u.id];}));}
function devState(d){return S.approved[d.id]?"Approved":d.state;}
function pendingDevs(){return DEV.filter(function(d){return devState(d)==="Pending"&&d.posture!=="Failed";});}
function failingDevs(){return DEV.filter(function(d){return d.posture==="Failed";});}

/* ===================== B0 · list template ===================== */
var COLDEFS={
 users:[{k:"n",l:"Name",on:1},{k:"u",l:"Username",on:1},{k:"p",l:"Auth profile",on:1},
        {k:"ip",l:"Last IP",on:1,mono:1},{k:"mfa",l:"MFA",on:1},{k:"s",l:"Status",on:1},
        {k:"seen",l:"Last seen",on:1},{k:"email",l:"Email",on:0},{k:"devices",l:"Devices",on:0,mono:1}],
 devices:[{k:"name",l:"Device",on:1},{k:"os",l:"Operating system",on:1},{k:"owner",l:"Owner",on:1},
        {k:"mac",l:"MAC address",on:1,mono:1},{k:"posture",l:"Posture",on:1},{k:"state",l:"State",on:1},
        {k:"seen",l:"Last seen",on:1},{k:"wait",l:"Waiting",on:0,mono:1}]
};
function cols(key){
 if(!S.cols)S.cols=lg("cols",{});
 if(!S.cols[key])S.cols[key]=COLDEFS[key].filter(function(c){return c.on;}).map(function(c){return c.k;});
 return S.cols[key];
}
function sortRows(rows,key){
 if(!S.sort)return rows;
 var k=S.sort,dir=S.dir==="asc"?1:-1;
 return rows.slice().sort(function(a,b){
  var x=a[k],y=b[k];
  if(k==="mfa"){x=x?1:0;y=y?1:0;}
  if(typeof x==="number"&&typeof y==="number")return (x-y)*dir;
  return String(x==null?"":x).localeCompare(String(y==null?"":y))*dir;});
}
function th(key,c){
 var on=S.sort===c.k;
 return '<th class="srt" data-sort="'+c.k+'"'+(on?' aria-sort="'+(S.dir==="asc"?"ascending":"descending")+'"':'')+'>'+
  esc(c.l)+'<span class="ar">'+(on?(S.dir==="asc"?"▲":"▼"):"")+'</span></th>';
}
function ftabs(list){
 return '<div class="ftabs" role="tablist">'+list.map(function(t){
  return '<button class="ftab" role="tab" data-ftab="'+t[0]+'" aria-selected="'+(S.tab===t[0]?"true":"false")+'">'+
   esc(t[1])+'<span class="n'+(t[3]?" att":"")+'">'+t[2]+'</span></button>';}).join("")+'</div>';
}
function listTools(key,extra){
 var n=selIds().length;
 return '<div class="strip">'+
  '<span class="search">'+ic("i-search")+'<input id="q" value="'+esc(S.q)+'" placeholder="Search"></span>'+
  (extra||"")+
  (n?'<span class="selnote">'+n+' selected</span>':"")+
  '<span class="spacer"></span>'+
  '<button class="chip" id="viewBtn">'+ic("i-save")+' View <b>'+(S.view||"Default")+'</b></button>'+
  '<button class="chip" id="colBtn">'+ic("i-cols")+' Columns</button>'+
  '<button class="btn btn-danger" id="delBtn"'+(n?"":" disabled")+'>'+ic("i-trash")+'Delete</button>'+
 '</div>';
}
function colMenu(btn,key){
 var l=document.getElementById("layer"),r=btn.getBoundingClientRect(),cur=cols(key);
 l.innerHTML='<div class="menu" style="top:'+(r.bottom+6)+'px;left:'+Math.max(8,r.right-210)+'px">'+
  '<div class="lbl">Columns shown</div>'+COLDEFS[key].map(function(c){
   return '<label><input type="checkbox" data-col="'+c.k+'"'+(cur.indexOf(c.k)>=0?" checked":"")+'> '+esc(c.l)+'</label>';
  }).join("")+'</div>';
 var close=function(e){if(!e||!e.target.closest(".menu")){closeLayer();document.removeEventListener("mousedown",close);}};
 setTimeout(function(){document.addEventListener("mousedown",close);},0);
 l.querySelectorAll("[data-col]").forEach(function(cb){
  cb.onchange=function(){
   var k=cb.getAttribute("data-col"),arr=cols(key);
   if(cb.checked){if(arr.indexOf(k)<0)arr.push(k);}else{var i=arr.indexOf(k);if(i>=0)arr.splice(i,1);}
   S.cols[key]=arr;ls("cols",S.cols);render();};});
}
function viewMenu(btn,key){
 var l=document.getElementById("layer"),r=btn.getBoundingClientRect();
 var saved=lg("views",{})[key]||{};
 var names=Object.keys(saved);
 l.innerHTML='<div class="menu" style="top:'+(r.bottom+6)+'px;left:'+Math.max(8,r.right-210)+'px">'+
  '<div class="lbl">Saved views</div>'+
  '<button data-v="">Default</button>'+
  names.map(function(n){return '<button data-v="'+esc(n)+'">'+esc(n)+'</button>';}).join("")+
  '<hr><button data-save="1">'+ic("i-plus")+'Save current view…</button></div>';
 var close=function(e){if(!e||!e.target.closest(".menu")){closeLayer();document.removeEventListener("mousedown",close);}};
 setTimeout(function(){document.addEventListener("mousedown",close);},0);
 l.querySelectorAll("[data-v]").forEach(function(b){b.onclick=function(){
  var v=b.getAttribute("data-v");closeLayer();
  if(v&&saved[v]){S.tab=saved[v].tab;S.sort=saved[v].sort;S.dir=saved[v].dir;S.q=saved[v].q||"";
   if(saved[v].cols){S.cols=S.cols||{};S.cols[key]=saved[v].cols.slice();}}
  else{S.tab="all";S.sort=null;S.q="";}
  S.view=v;render();};});
 l.querySelector("[data-save]").onclick=function(){
  closeLayer();
  var nm=prompt("Name this view","Pending, oldest first");
  if(!nm)return;
  var all=lg("views",{});all[key]=all[key]||{};
  all[key][nm]={tab:S.tab,sort:S.sort,dir:S.dir,q:S.q,cols:cols(key).slice()};
  ls("views",all);S.view=nm;render();
  toast("View saved","“"+nm+"” is available to everyone in this tenant.","ok");};
}

/* ===================== pages ===================== */
function bars(rows){return rows.map(function(r,i){
 return '<div class="barrow"><span>'+esc(r[0])+'</span><span class="bartrack">'+
  '<span class="barfill'+(i?" s"+(i+1):"")+'" style="width:'+r[2]+'%"></span></span>'+
  '<span class="barval">'+r[1]+'</span></div>';}).join("");}

function dashboard(){
 if(S.data==="zero")return setupPage(true);
 var pend=pendingDevs().length,fail=failingDevs().length,noMfa=allUsers().filter(function(u){return !u.mfa;}).length;
 return '<div class="pad phead"><div><h1>Dashboard</h1>'+
  '<p>veno.instasafe.com · 1,820 users · 775 devices · 4 gateways</p></div>'+
  '<div class="acts"><button class="btn" id="goSetup">'+ic("i-check")+'Setup checklist</button>'+
  '<button class="btn btn-primary" id="goOnboard">'+ic("i-plus")+'Onboard a user</button></div></div>'+
  (pend||fail?'<div class="pad band"><span class="fdot"></span><div><h2>'+
   ((pend?1:0)+(fail?1:0)===1?"One thing needs":"Two things need")+' your attention</h2>'+
   '<div class="sub">Everything else is healthy. Four gateways reachable, nothing blocked today.</div></div>'+
   '<div class="bandacts">'+
   (pend?'<button class="ba" data-go="approvals"><span class="n">'+pend+'</span><span class="l">Devices waiting'+
     '<span>oldest '+Math.max.apply(null,pendingDevs().map(function(d){return d.wait;}))+' days</span></span></button>':"")+
   (fail?'<button class="ba" data-go="approvals"><span class="n">'+fail+'</span><span class="l">Failing posture'+
     '<span>needs a decision</span></span></button>':"")+
   '<button class="btn" data-go="approvals">Open the queue</button></div></div>':"")+
  '<div class="pad stats">'+
  '<div class="stat"><div class="sl">Online gateways</div><div class="sv">4<i>&thinsp;/&thinsp;4</i></div><div class="sm">All reachable</div></div>'+
  '<div class="stat"><div class="sl">Online users</div><div class="sv">318<i>&thinsp;/&thinsp;1,820</i></div><div class="sm">17% connected now</div></div>'+
  '<div class="stat"><div class="sl">Users without MFA</div><div class="sv">'+noMfa+'</div><div class="sm">mostly Local profile</div></div>'+
  '<div class="stat"><div class="sl">Subscription renews</div><div class="sv">31 Dec 2026</div><div class="sm">103 days</div></div>'+
  '</div>'+
  '<div class="pad cols"><div class="col">'+
  '<div class="chead"><h3>Devices by operating system</h3><span class="hint">All time</span></div>'+
  bars([["Windows 11",402,100],["macOS 15",186,46],["Ubuntu 24.04",104,26],["Android 15",83,21]])+
  '</div><div class="col">'+
  '<div class="chead"><h3>Top blocked services</h3><span class="hint">Today</span></div>'+
  '<div class="zero" style="padding:34px 12px 8px"><div class="zi">'+ic("i-shield")+'</div>'+
  '<h3>Nothing blocked today</h3><p>No traffic hit a block rule in this window. That is the healthy state.</p></div>'+
  '</div></div>';
}

/* ---- B1 · device approvals ---- */
function approvalsPage(){
 var pend=pendingDevs(),fail=failingDevs();
 var showing=S.tab==="failing"?fail:S.tab==="all"?DEV.filter(function(d){return devState(d)==="Pending"||d.posture==="Failed";}):pend;
 if(S.q){var q=S.q.toLowerCase();showing=showing.filter(function(d){return (d.name+d.os+d.owner).toLowerCase().indexOf(q)>=0;});}
 showing=sortRows(showing,"devices");
 if(S.sort==="wait")showing=showing.slice().sort(function(a,b){return (S.dir==="asc"?1:-1)*(a.wait-b.wait);});
 else if(!S.sort)showing=showing.slice().sort(function(a,b){return b.wait-a.wait;});
 var n=selIds().length;
 var h='<div class="pad phead"><div><h1>Device approvals</h1>'+
  '<p>'+(pend.length+fail.length===0?"Nothing waiting":
   pend.length+" waiting · "+fail.length+" failing posture · oldest "+
   (pend.length?Math.max.apply(null,pend.map(function(d){return d.wait;})):0)+" days")+'</p></div>'+
  '<div class="acts">'+
  (n?'<button class="btn btn-primary" id="bulkApprove">'+ic("i-check")+'Approve '+n+' selected</button>':
     '<button class="btn" disabled>'+ic("i-check")+'Approve selected</button>')+'</div></div>';
 h+=ftabs([["pending","Waiting",pend.length,pend.length>0],
           ["failing","Failing posture",fail.length,fail.length>0],
           ["all","Everything",pend.length+fail.length,0]]);
 h+=listTools("devices");
 if(!showing.length){
  h+=S.q?'<div class="zero"><div class="zi">'+ic("i-search")+'</div><h3>Nothing matches “'+esc(S.q)+'”</h3>'+
    '<p>Try a shorter term, or clear the search.</p><div class="za"><button class="btn" id="clrBtn">Clear search</button></div></div>'
   :'<div class="zero"><div class="zi">'+ic("i-check")+'</div><h3>The queue is empty</h3>'+
    '<p>Every registered device has been approved and every posture check is passing. Nothing needs you here.</p>'+
    '<div class="za"><button class="btn" data-go="devices">See all devices</button></div></div>';
  return h;
 }
 h+='<table><thead class="t145"><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>'+
  '<th class="srt" data-sort="name">Device<span class="ar">'+(S.sort==="name"?(S.dir==="asc"?"▲":"▼"):"")+'</span></th>'+
  '<th class="srt" data-sort="owner">Owner<span class="ar">'+(S.sort==="owner"?(S.dir==="asc"?"▲":"▼"):"")+'</span></th>'+
  '<th class="srt" data-sort="os">Operating system<span class="ar">'+(S.sort==="os"?(S.dir==="asc"?"▲":"▼"):"")+'</span></th>'+
  '<th>Posture</th>'+
  '<th class="srt" data-sort="wait"'+(!S.sort?' aria-sort="descending"':'')+'>Waiting<span class="ar">'+(S.sort==="wait"?(S.dir==="asc"?"▲":"▼"):(!S.sort?"▼":""))+'</span></th>'+
  '<th></th></tr></thead><tbody>';
 showing.forEach(function(d){
  h+='<tr'+(S.sel[d.id]?' class="sel"':'')+'>'+
   '<td class="cb"><input type="checkbox" data-cb="'+d.id+'"'+(S.sel[d.id]?" checked":"")+' aria-label="Select '+esc(d.name)+'"></td>'+
   '<td><b style="font-weight:450">'+esc(d.name)+'</b></td>'+
   '<td class="uname">'+esc(d.owner)+'</td>'+
   '<td class="uname">'+esc(d.os)+'</td>'+
   '<td>'+(d.posture==="Failed"?pill("att",d.failed,1):quiet("Passed"))+'</td>'+
   '<td class="tech">'+(d.wait?d.wait+" d":"—")+'</td>'+
   '<td style="text-align:right">'+
     (d.posture==="Failed"
      ? '<button class="btn btn-sm" data-fix="'+d.id+'">Contact owner</button>'
      : '<button class="btn btn-sm btn-primary" data-approve="'+d.id+'">Approve</button>')+'</td></tr>';
 });
 h+='</tbody></table>'+
  '<div class="tfoot"><span>'+showing.length+' shown</span><span class="rt"><span>'+
  (pend.length+fail.length)+' in the queue</span></span></div>';
 return h;
}

/* ---- users list (B0 applied) ---- */
function usersPage(){
 var rows=allUsers();
 if(S.data==="zero")rows=[];
 if(S.tab==="nomfa")rows=rows.filter(function(u){return !u.mfa;});
 else if(S.tab==="susp")rows=rows.filter(function(u){return u.s==="Suspended";});
 if(S.q&&S.data!=="zero"){var q=S.q.toLowerCase();
  rows=rows.filter(function(u){return (u.n+" "+u.u+" "+(u.email||"")+" "+(u.ip||"")).toLowerCase().indexOf(q)>=0;});}
 if(S.data==="nomatch")rows=[];
 rows=sortRows(rows,"users");
 var total=rows.length?(S.q||S.tab!=="all"?rows.length:1820+S.added.length):0;
 var shown=cols("users"),n=selIds().length;
 var all=allUsers();
 var h='<div class="pad phead"><div><h1>Users</h1><p>'+
  (total?total.toLocaleString()+" total":"Nothing configured yet")+'</p></div>'+
  '<div class="acts"><button class="btn" id="goImport">'+ic("i-up")+'Import</button>'+
  '<button class="btn btn-primary" id="goOnboard">'+ic("i-plus")+'Onboard a user</button></div></div>';
 h+=ftabs([["all","All",(1820+S.added.length).toLocaleString(),0],
           ["nomfa","Without MFA",all.filter(function(u){return !u.mfa;}).length,1],
           ["susp","Suspended",all.filter(function(u){return u.s==="Suspended";}).length,1]]);
 h+=listTools("users");
 if(!rows.length){
  h+=(S.q||S.data==="nomatch")
   ?'<div class="zero"><div class="zi">'+ic("i-search")+'</div><h3>No users match “'+esc(S.q||"zz-no-match")+'”</h3>'+
    '<p>Try a shorter term, or clear the search to see all 1,820 users.</p>'+
    '<div class="za"><button class="btn" id="clrBtn">Clear search</button></div></div>'
   :'<div class="zero"><div class="zi">'+ic("i-users")+'</div><h3>Add your first user</h3>'+
    '<p>Users reach applications through access rules. The onboarding flow creates the user, the group and the rule in one pass.</p>'+
    '<div class="za"><button class="btn btn-primary" id="goOnboard">'+ic("i-plus")+'Onboard a user</button>'+
    '<button class="btn" id="goImport">Import from CSV</button></div></div>';
  return h;
 }
 h+='<table><thead class="t145"><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>';
 COLDEFS.users.forEach(function(c){if(shown.indexOf(c.k)>=0)h+=th("users",c);});
 h+='<th></th></tr></thead><tbody>';
 rows.slice(0,50).forEach(function(u){
  h+='<tr class="click'+(S.sel[u.id]?" sel":"")+'" data-user="'+u.id+'">'+
   '<td class="cb"><input type="checkbox" data-cb="'+u.id+'"'+(S.sel[u.id]?" checked":"")+' aria-label="Select '+esc(u.n)+'"></td>';
  COLDEFS.users.forEach(function(c){
   if(shown.indexOf(c.k)<0)return;
   var v=u[c.k];
   if(c.k==="n")h+='<td><div class="who"><span class="av">'+esc(init2(u.n))+'</span><b>'+esc(u.n)+'</b></div></td>';
   /* colour on exceptions: only "Not enrolled" is marked — see note in States panel */
   else if(c.k==="mfa")h+='<td>'+(u.mfa?quiet("Enrolled"):pill("att","Not enrolled",1))+'</td>';
   else if(c.k==="s")h+='<td>'+(v==="Active"?quiet("Active"):pill("att",v,1))+'</td>';
   else if(c.mono)h+='<td class="tech">'+esc(v==null?"—":v)+'</td>';
   else h+='<td class="uname">'+esc(v==null?"—":v)+'</td>';});
  h+='<td style="text-align:right"><button class="rowbtn" data-menu="'+u.id+'" aria-label="Row actions">'+ic("i-dots")+'</button></td></tr>';
 });
 h+='</tbody></table><div class="tfoot"><span>Rows per page</span>'+
  '<select id="psz"><option>50</option><option>100</option></select>'+
  '<span class="rt"><span>1–'+Math.min(50,rows.length)+' of '+total.toLocaleString()+'</span>'+
  '<button class="pbtn" disabled>'+ic("i-l")+'</button><button class="pbtn">'+ic("i-r")+'</button></span></div>';
 return h;
}

/* ---- B2 · onboarding wizard ---- */
var WSTEPS=[["Identity","Who is joining"],["Access","What they need"],["Review","Check and create"],["Done",""]];
function wizInit(){S.wiz={step:0,first:"",last:"",email:"",profile:"Local",groups:[],apps:[],err:{},created:null};saveWiz();}
function saveWiz(){ls("wizdraft",S.wiz);}
function wizPage(){
 if(!S.wiz)wizInit();
 var W=S.wiz,st=W.step;
 var h='<div class="wiz"><div class="wsteps">';
 WSTEPS.forEach(function(s,i){
  if(i===3&&!W.created)return;
  h+='<button class="wstep'+(i<st?" done":"")+'" data-step="'+i+'"'+(i===st?' aria-current="step"':'')+'>'+
   '<span class="n">'+(i<st?ic("i-check"):(i+1))+'</span>'+
   '<span class="t">'+esc(s[0])+(s[1]?'<span>'+esc(s[1])+'</span>':'')+'</span></button>';});
 h+='<div style="margin-top:22px;font-size:11.5px;color:var(--mute);line-height:1.6">'+
  'Progress is saved as you type. You can leave and come back.</div></div><div class="wbody">';

 if(st===0){
  h+='<h2>Who is joining?</h2><p class="lede">Four fields. Everything else has a sensible default you can change later.</p>';
  h+=wfield("first","First name",W.first,"As it should appear in logs and the user portal.");
  h+=wfield("last","Last name",W.last,null);
  h+=wfield("email","Work email",W.email,"Becomes the username. The welcome email goes here.");
  h+='<div class="frow"><div class="lb"><label>Authentication profile</label>'+
   '<div class="h">Where this person\'s password lives. Local means i365 holds it.</div></div>'+
   '<div class="ctl"><select id="w_profile">'+PROF.map(function(p){
    return '<option'+(W.profile===p?" selected":"")+'>'+esc(p)+'</option>';}).join("")+'</select></div></div>';
 }
 else if(st===1){
  h+='<h2>What do they need to reach?</h2>'+
   '<p class="lede">Pick the groups and applications. Anything missing can be created here without losing this form.</p>';
  h+='<div class="frow"><div class="lb"><label>Groups</label>'+
   '<div class="h">Groups carry policy. Most people need one.</div></div><div class="ctl">'+
   taField("grp","Search groups",GROUPS.map(function(g){return [g.id,g.name,g.members+" members"];}),W.groups)+
   '<button class="btn btn-sm" id="newGrp" style="margin-top:9px">'+ic("i-plus")+'Create a group</button></div></div>';
  h+='<div class="frow"><div class="lb"><label>Applications</label>'+
   '<div class="h">What they should be able to open. The access rule is written for you.</div></div><div class="ctl">'+
   taField("app","Search applications",APPS.map(function(a){return [a.id,a.name,a.type];}),W.apps)+
   '<button class="btn btn-sm" id="newApp" style="margin-top:9px">'+ic("i-plus")+'Create an application</button></div></div>';
 }
 else if(st===2){
  var gn=W.groups.map(function(id){return (GROUPS.filter(function(g){return g.id===id;})[0]||{}).name;});
  var an=W.apps.map(function(id){return (APPS.filter(function(a){return a.id===id;})[0]||{}).name;});
  var nm=(W.first+" "+W.last).trim()||"This person";
  h+='<h2>Check this, then create it</h2><p class="lede">This is what will exist when you press Create.</p>';
  h+='<div class="sentence"><b>'+esc(nm)+'</b> signs in with <b>'+esc(W.profile)+'</b>'+
   (gn.length?' as a member of '+gn.map(function(x){return '<b>'+esc(x)+'</b>';}).join(" and "):'')+
   ', and can reach '+
   (an.length?an.map(function(x){return '<b>'+esc(x)+'</b>';}).join(", "):'<b>nothing yet</b>')+
   '.</div>';
  h+='<div class="impact">'+
   '<div class="i"><b>1</b>user created</div>'+
   '<div class="i"><b>'+(an.length?1:0)+'</b>access rule written</div>'+
   '<div class="i"><b>'+an.length+'</b>applications reachable</div>'+
   '<div class="i'+(an.length?"":" att")+'"><b>'+(an.length?"0":"1")+'</b>'+(an.length?"blocked":"warning")+'</div>'+
   '</div>';
  if(!an.length)h+='<p style="color:var(--c600);font-size:12.5px;margin:14px 0 0">'+
   'No applications selected. The account will exist but will not be able to reach anything — which is a valid choice if access comes later from a group.</p>';
  h+='<div style="margin-top:22px;font-size:12.5px;color:var(--mute);line-height:1.65">'+
   'The access rule is generated from this sentence. You will not be asked to pick a source type — '+
   'the flow already knows the source is this user.</div>';
 }
 else{
  var an2=W.apps.map(function(id){return (APPS.filter(function(a){return a.id===id;})[0]||{}).name;});
  h+='<h2 style="color:var(--ok)">'+esc(W.created)+' can sign in now</h2>'+
   '<p class="lede">A welcome email has been sent to '+esc(W.email||"their address")+'.</p>'+
   '<div class="sentence" style="border-bottom:0">They can reach '+
   (an2.length?an2.map(function(x){return '<b>'+esc(x)+'</b>';}).join(", "):'<b>nothing yet</b>')+
   '. Everything else is blocked by default.</div>'+
   '<div style="display:flex;gap:8px;margin-top:24px;flex-wrap:wrap">'+
   '<button class="btn btn-primary" id="wAnother">'+ic("i-plus")+'Onboard another</button>'+
   '<button class="btn" id="wExplore">See what they can reach</button>'+
   '<button class="btn btn-quiet" data-go="users">Back to users</button></div>';
 }

 if(st<3){
  var clicks=[2,3,1,0][st];
  h+='<div class="wfoot">'+
   (st>0?'<button class="btn" id="wBack">Back</button>':'<button class="btn btn-quiet" data-go="users">Cancel</button>')+
   '<span class="save">Draft saved</span>'+
   '<span class="sp"></span>'+
   (st===2?'<button class="btn btn-primary" id="wCreate">'+ic("i-check")+'Create user and rule</button>'
          :'<button class="btn btn-primary" id="wNext">Continue</button>')+
   '</div>';
 }
 return h+'</div></div>';
}
function wfield(k,label,val,help){
 var e=S.wiz.err[k];
 return '<div class="frow'+(e?" bad":"")+'"><div class="lb"><label>'+esc(label)+'</label>'+
  (help?'<div class="h">'+esc(help)+'</div>':"")+'</div><div class="ctl">'+
  '<input type="text" id="w_'+k+'" value="'+esc(val)+'">'+
  '<div class="err">'+esc(e||"")+'</div></div></div>';
}
function taField(kind,ph,items,chosen){
 var tags=chosen.map(function(id){
  var it=items.filter(function(x){return x[0]===id;})[0];
  return '<span class="tag">'+esc(it?it[1]:id)+'<button data-untag="'+kind+':'+id+'" aria-label="Remove">'+ic("i-x")+'</button></span>';
 }).join("");
 return '<div class="ta" data-ta="'+kind+'"><input type="text" placeholder="'+esc(ph)+'" data-tainput="'+kind+'" autocomplete="off">'+
  '</div><div class="tags">'+tags+'</div>';
}

/* ---- B3 · access explorer ---- */
function explorerPage(){
 if(!S.exp)S.exp={uid:allUsers()[0]?allUsers()[0].id:null,mode:"user"};
 var u=allUsers().filter(function(x){return x.id===S.exp.uid;})[0]||allUsers()[0];
 var h='<div class="pad phead"><div><h1>Access explorer</h1>'+
  '<p>What a person can reach, and why they cannot reach the rest</p></div>'+
  '<div class="acts"><button class="btn">'+ic("i-dl")+'Export entitlements</button></div></div>';
 h+='<div class="strip"><span class="search">'+ic("i-search")+
  '<input id="expq" placeholder="Search a user" value="'+esc(u?u.n:"")+'"></span>'+
  '<button class="chip on">Subject <b>User</b></button>'+
  '<button class="chip">Subject <b>Group</b></button>'+
  '<button class="chip">Subject <b>Application</b></button><span class="spacer"></span>'+
  '<button class="chip">'+ic("i-save")+' View <b>Default</b></button></div>';
 if(!u)return h+'<div class="zero"><div class="zi">'+ic("i-compass")+'</div><h3>No users yet</h3>'+
  '<p>The explorer answers questions about a person. Create one first.</p></div>';
 var reach=[],blocked=[];
 APPS.forEach(function(a,i){
  var granted=(i%3!==2);
  if(granted&&u.s==="Active"&&u.mfa)reach.push({a:a,rule:RULES[i%RULES.length]});
  else if(!granted)blocked.push({a:a,why:"no-rule"});
  else if(u.s!=="Active")blocked.push({a:a,why:"suspended"});
  else if(!u.mfa)blocked.push({a:a,why:"mfa"});
 });
 var dev=DEV.filter(function(d){return d.owner.split(" ")[0]===u.first;});
 var pendDev=dev.filter(function(d){return devState(d)==="Pending";});
 if(pendDev.length)blocked=blocked.concat(reach.splice(0,2).map(function(r){return {a:r.a,why:"device"};}));
 h+='<div class="exp"><div class="expmain">';
 h+='<div class="reachgrp">Can reach — '+reach.length+'</div>';
 if(!reach.length)h+='<div class="reach"><div class="nm">Nothing<span class="why">Every application is blocked. The reasons are below.</span></div></div>';
 reach.forEach(function(r){
  h+='<div class="reach"><div class="nm">'+esc(r.a.name)+
   '<span class="why">granted by <b>'+esc(r.rule.name)+'</b> · '+esc(r.a.type)+' on <span class="tech">'+esc(r.a.host)+'</span></span></div>'+
   '<div>'+quiet("Allowed")+'</div></div>';});
 h+='<div class="reachgrp">Cannot reach — '+blocked.length+'</div>';
 var WHY={"no-rule":["No access rule grants it","Write a rule"],
  "suspended":["The account is suspended","Reactivate the account"],
  "mfa":["MFA is not enrolled","Send an enrolment link"],
  "device":["Their device is waiting for approval","Open the approval queue"]};
 blocked.slice(0,9).forEach(function(b){
  var w=WHY[b.why];
  h+='<div class="reach"><div class="nm">'+esc(b.a.name)+
   '<span class="why">'+esc(w[0])+'</span></div>'+
   '<div><button class="fixlink" data-fix2="'+b.why+'">'+esc(w[1])+' →</button></div></div>';});
 h+='</div><div class="expside">'+
  '<h3>'+esc(u.n)+'</h3>'+
  '<p>'+esc(u.u)+' · '+esc(u.p)+'</p>'+
  '<div class="readrow"><dt>Status</dt><dd>'+(u.s==="Active"?quiet("Active"):pill("att",u.s,1))+'</dd></div>'+
  '<div class="readrow"><dt>MFA</dt><dd>'+(u.mfa?quiet("Enrolled"):pill("att","Not enrolled",1))+'</dd></div>'+
  '<div class="readrow"><dt>Devices</dt><dd>'+dev.length+(pendDev.length?' <span class="pill p-att"><i></i>'+pendDev.length+' pending</span>':'')+'</dd></div>'+
  '<div class="readrow"><dt>Groups</dt><dd>'+esc(GROUPS[0].name)+'</dd></div>'+
  '<div class="readrow" style="border-bottom:0"><dt>Last seen</dt><dd>'+esc(u.seen)+'</dd></div>'+
  '<div style="margin-top:20px;display:flex;flex-direction:column;gap:8px">'+
  '<button class="btn" data-go="users">Open the user record</button>'+
  '<button class="btn btn-danger" id="offboard">'+ic("i-exit")+'Offboard this person</button></div>'+
  '<p style="margin-top:22px;font-size:11.5px;line-height:1.6;color:var(--mute)">'+
  'Reachability is computed live from rules, posture and account state. In production this needs a policy-evaluation endpoint — see the note in the States panel.</p>'+
  '</div></div>';
 return h;
}

/* ---- B4 · offboard ---- */
function offboardModal(u){
 var dev=DEV.filter(function(d){return d.owner.split(" ")[0]===u.first;});
 var rules=RULES.filter(function(r){return r.source===u.u;});
 var l=document.getElementById("layer");
 l.innerHTML='<div class="scrim" id="scrim"></div><div class="modal" role="dialog" aria-modal="true" aria-label="Offboard '+esc(u.n)+'">'+
  '<div class="modalb"><h3>Offboard '+esc(u.n)+'?</h3>'+
  '<p>Everything attached to this person, and what happens to it.</p>'+
  '<div class="names">'+
   '<div>Account <b style="margin-left:auto;font-weight:450">suspended immediately</b></div>'+
   '<div>'+dev.length+' registered device'+(dev.length===1?"":"s")+'<span>unenrolled</span></div>'+
   '<div>'+rules.length+' access rule'+(rules.length===1?"":"s")+' naming them<span>'+(rules.length?"removed":"none")+'</span></div>'+
   '<div>Group memberships<span>revoked</span></div>'+
   '<div>Session history<span>kept for audit</span></div>'+
  '</div>'+
  '<p style="margin-top:14px">The account is suspended, not deleted, so the audit trail survives. Deleting it outright is a separate action.</p>'+
  '</div><div class="modalf"><button class="btn" id="mNo">Cancel</button>'+
  '<button class="btn btn-danger" id="mYes" style="border-color:var(--rule-strong)">Offboard '+esc(u.first)+'</button></div></div>';
 document.getElementById("scrim").onclick=closeLayer;
 document.getElementById("mNo").onclick=closeLayer;
 document.getElementById("mYes").onclick=function(){closeLayer();
  toast("Offboarded",u.n+" is suspended, "+dev.length+" devices unenrolled, "+rules.length+" rules removed.","ok");};
 document.getElementById("mNo").focus();
}

/* ---- F5 · import with dry run ---- */
var IMPROWS=[
 {r:1,n:"Sunita Rao",e:"sunita.rao@instasafe.com",g:"Finance",ok:1},
 {r:2,n:"Mohan Iyer",e:"mohan.iyer@instasafe.com",g:"Engineering",ok:1},
 {r:3,n:"Aarti Das",e:"aarti.das@instasafe",g:"Sales",ok:0,err:"Email is missing a domain suffix"},
 {r:4,n:"Tarun Bose",e:"alen.joseph@instasafe.com",g:"Ops",ok:0,err:"A user with this email already exists"},
 {r:5,n:"Jyoti Nair",e:"jyoti.nair@instasafe.com",g:"Legal",ok:1},
 {r:6,n:"",e:"vishal.menon@instasafe.com",g:"Support",ok:0,err:"Name is required"},
 {r:7,n:"Kamala Shetty",e:"kamala.shetty@instasafe.com",g:"Finance",ok:1},
 {r:8,n:"Abhay Singh",e:"abhay.singh@instasafe.com",g:"Nonexistent team",ok:0,err:"Group “Nonexistent team” does not exist — create it or fix the row"}
];
function importPage(){
 if(!S.imp)S.imp={stage:"pick"};
 var h='<div class="pad phead"><div><h1>Import users</h1>'+
  '<p>Nothing is written until you have seen the parsed result</p></div>'+
  '<div class="acts"><button class="btn">'+ic("i-dl")+'Download template</button></div></div>';
 if(S.imp.stage==="pick"){
  return h+'<div class="zero"><div class="zi">'+ic("i-up")+'</div><h3>Choose a CSV file</h3>'+
   '<p>Use the template so the column names match. The file is parsed in your browser and shown to you row by row before anything is created.</p>'+
   '<div class="za"><button class="btn btn-primary" id="impPick">'+ic("i-up")+'Select a file</button>'+
   '<button class="btn">'+ic("i-dl")+'Download template</button></div></div>';
 }
 var ok=IMPROWS.filter(function(r){return r.ok;}).length,bad=IMPROWS.length-ok;
 h+='<div class="drystat pad" style="padding-left:var(--gut);padding-right:var(--gut)">'+
  '<div class="i"><b>'+IMPROWS.length+'</b>rows parsed</div>'+
  '<div class="i"><b>'+ok+'</b>will be created</div>'+
  '<div class="i'+(bad?" bad":"")+'"><b>'+bad+'</b>have problems</div>'+
  '<div class="i"><b>0</b>written so far</div></div>';
 h+='<table><thead class="t50"><tr><th>Row</th><th>Name</th><th>Email</th><th>Group</th><th>Result</th></tr></thead><tbody>';
 IMPROWS.forEach(function(r){
  h+='<tr'+(r.ok?"":' class="rowbad"')+'><td class="tech">'+r.r+'</td>'+
   '<td>'+(r.n?esc(r.n):'<span class="quiet">—</span>')+'</td>'+
   '<td class="tech">'+esc(r.e)+'</td><td class="uname">'+esc(r.g)+'</td>'+
   '<td>'+(r.ok?quiet("Ready"):'<span class="rowerr">'+esc(r.err)+'</span>')+'</td></tr>';});
 h+='</tbody></table>'+
  '<div class="tfoot"><span>'+bad+' row'+(bad===1?"":"s")+' will be skipped unless you fix the file</span>'+
  '<span class="rt">'+
  '<button class="btn btn-quiet" id="impBack">Choose a different file</button>'+
  '<button class="btn btn-primary" id="impGo">Create '+ok+' users</button></span></div>';
 return h;
}

/* ---- B5 · first-run checklist, reads live state ---- */
function setupPage(embedded){
 var st=[
  {t:"Connect a gateway",d:"Users connect through a gateway. One is enough to start.",done:true,ev:"4 gateways online"},
  {t:"Connect a directory, or add users by hand",d:"Active Directory, Azure AD or a CSV import.",
   done:allUsers().length>0,ev:allUsers().length?allUsers().length+" users provisioned":"no users yet",go:"users"},
  {t:"Define an application",d:"The internal resource people need to reach.",done:APPS.length>0,ev:APPS.length+" applications defined",go:"apps"},
  {t:"Write your first access rule",d:"Nothing is reachable until a rule allows it.",done:RULES.length>0,ev:RULES.length+" rules active",go:"rules"},
  {t:"Approve the first device",d:"A device must be approved before it can connect.",
   done:DEV.filter(function(d){return devState(d)==="Approved";}).length>0,
   ev:DEV.filter(function(d){return devState(d)==="Approved";}).length+" approved · "+pendingDevs().length+" waiting",go:"approvals"}
 ];
 var done=st.filter(function(s){return s.done;}).length;
 var h='<div class="pad phead"><div><h1>Set up i365</h1>'+
  '<p>'+done+' of '+st.length+' complete · read from your tenant, not from saved progress</p></div>'+
  (embedded?'':'<div class="acts"><button class="btn btn-quiet" data-go="dashboard">Skip for now</button></div>')+'</div>';
 if(embedded)h='<div class="pad phead"><div><h1>Set up i365</h1>'+
  '<p>Your tenant is empty. Five steps to a first protected application.</p></div></div>';
 h+='<div class="ck">'+st.map(function(s){
  return '<div class="ckrow'+(s.done?" done":"")+'"><span class="m">'+(s.done?ic("i-check"):"")+'</span>'+
   '<span class="t">'+esc(s.t)+'<span>'+esc(s.d)+'</span><span class="ev">'+esc(s.ev)+'</span></span>'+
   '<span>'+(s.done?quiet("Done"):'<button class="btn btn-sm btn-primary" data-go="'+(s.go||"dashboard")+'">Start</button>')+'</span></div>';
 }).join("")+'</div>'+
 '<div class="pad" style="padding-top:20px;font-size:12.5px;color:var(--mute);max-width:64ch;line-height:1.65">'+
 'Each line is checked against live tenant state. If a colleague or an InstaSafe engineer finishes a step, it ticks here too — the list has no memory of its own.</div>';
 return h;
}

/* ---- generic list for the rest ---- */
function simpleList(title,sub,cols2,rows,rowf,obj,zeroBody){
 var q=S.q.toLowerCase(),r=rows.slice();
 if(S.data==="zero")r=[];
 else if(q)r=r.filter(function(x){return JSON.stringify(x).toLowerCase().indexOf(q)>=0;});
 if(S.data==="nomatch")r=[];
 var h='<div class="pad phead"><div><h1>'+esc(title)+'</h1><p>'+esc(r.length?sub:"Nothing configured yet")+'</p></div>'+
  '<div class="acts"><button class="btn">'+ic("i-dl")+'CSV</button>'+
  '<button class="btn btn-primary">'+ic("i-plus")+'Add '+esc(obj)+'</button></div></div>'+
  '<div class="strip"><span class="search">'+ic("i-search")+'<input id="q" value="'+esc(S.q)+'" placeholder="Search"></span>'+
  '<span class="spacer"></span><button class="chip">'+ic("i-cols")+' Columns</button></div>';
 if(!r.length)return h+(q||S.data==="nomatch"
  ?'<div class="zero"><div class="zi">'+ic("i-search")+'</div><h3>Nothing matches “'+esc(q||"zz-no-match")+'”</h3>'+
   '<p>Try a shorter term, or clear the search.</p><div class="za"><button class="btn" id="clrBtn">Clear search</button></div></div>'
  :'<div class="zero"><div class="zi">'+ic("i-grid")+'</div><h3>Add your first '+esc(obj)+'</h3>'+
   '<p>'+esc(zeroBody)+'</p><div class="za"><button class="btn btn-primary">'+ic("i-plus")+'Add '+esc(obj)+'</button></div></div>');
 h+='<table><thead class="t103"><tr>'+cols2.map(function(c){return '<th>'+esc(c)+'</th>';}).join("")+'</tr></thead><tbody>'+
  r.slice(0,50).map(function(x){return '<tr>'+rowf(x)+'</tr>';}).join("")+
  '</tbody></table><div class="tfoot"><span>'+r.length+' shown</span></div>';
 return h;
}

function signinPage(){
 return '<div class="signin"><div class="in">'+
  '<img class="lock" alt="InstaSafe — Cloud. Secure. Instant." src="assets/img/lockup.png">'+
  '<h2>Sign in to i365</h2><p>Use the work account your administrator provisioned.</p>'+
  '<label for="si_u">Username or email</label>'+
  '<input id="si_u" type="text" autocomplete="username" placeholder="you@company.com">'+
  '<button class="btn btn-primary go" id="si_go">Continue</button>'+
  '<div class="ten">veno.instasafe.com</div>'+
  '<div class="foot">Trouble signing in? Your administrator can reset access.<br>'+
  'InstaSafe never asks for your password by email.</div>'+
  '</div></div>';
}

/* ===================== render ===================== */
function pageHTML(){
 switch(S.page){
  case "signin":return signinPage();
  case "dashboard":return dashboard();
  case "setup":return setupPage(false);
  case "approvals":return approvalsPage();
  case "users":return usersPage();
  case "onboard":return wizPage();
  case "import":return importPage();
  case "explorer":return explorerPage();
  case "devices":return simpleList("Devices","775 total · "+pendingDevs().length+" pending · "+failingDevs().length+" failing posture",
    ["Device","Operating system","Owner","MAC address","Posture","State"],DEV,function(d){
     return '<td><b style="font-weight:450">'+esc(d.name)+'</b></td><td class="uname">'+esc(d.os)+'</td>'+
      '<td class="uname">'+esc(d.owner)+'</td><td class="tech">'+esc(d.mac)+'</td>'+
      '<td>'+(d.posture==="Failed"?pill("att","Failed",1):quiet("Passed"))+'</td>'+
      '<td>'+(devState(d)==="Approved"?quiet("Approved"):pill("att","Pending",1))+'</td>';},"device",
    "A device appears here the first time someone signs in with the agent installed.");
  case "groups":return simpleList("Groups","46 groups",["Group","Members","Applications"],GROUPS,function(g){
     return '<td><b style="font-weight:450">'+esc(g.name)+'</b></td><td class="tech">'+g.members+'</td>'+
      '<td class="uname">'+g.apps.length+' applications</td>';},"group",
    "Groups carry policy. Put people in one and the rules follow them.");
  case "apps":return simpleList("Applications","53 applications",["Application","Type","Host","Port"],APPS,function(a){
     return '<td><b style="font-weight:450">'+esc(a.name)+'</b></td><td class="uname">'+esc(a.type)+'</td>'+
      '<td class="tech">'+esc(a.host)+'</td><td class="tech">'+a.port+'</td>';},"application",
    "An application is the internal resource your people need to reach.");
  case "rules":return simpleList("Access rules","57 rules · 48 allow · 6 deny · 3 bypass",
    ["Rule","Source","Destination","Affects","Action"],RULES,function(r){
     return '<td><b style="font-weight:450">'+esc(r.name)+'</b></td><td class="uname">'+esc(r.source)+'</td>'+
      '<td class="uname">'+esc(r.dest)+'</td><td class="tech">'+r.users+' users</td>'+
      '<td>'+(r.act==="Allow"?quiet("Allow"):pill("att",r.act,1))+'</td>';},"rule",
    "Nobody can reach anything until a rule allows it.");
  case "devchecks":return simpleList("Device checks","150 checks",["Rule","OS","Check","Expected"],
    [{n:"Disk encrypted",o:"Windows",c:"BitLocker",v:"On"},{n:"Antivirus running",o:"Windows",c:"AntiVirusStatus",v:"Enabled"},
     {n:"Screen lock",o:"macOS",c:"ScreenLock",v:"300"},{n:"OS patch level",o:"Windows",c:"Hotfix",v:"KB5031354"}],
    function(c){return '<td><b style="font-weight:450">'+esc(c.n)+'</b></td><td class="uname">'+esc(c.o)+'</td>'+
     '<td class="uname">'+esc(c.c)+'</td><td class="tech">'+esc(c.v)+'</td>';},"check",
    "A device check is a posture condition a device must satisfy before it connects.");
  case "requests":return '<div class="pad phead"><div><h1>Access requests</h1>'+
    '<p>2 waiting · raised from the user portal</p></div></div>'+
    '<table><thead class="t50"><tr><th>Requester</th><th>Application</th><th>Reason</th><th>Waiting</th><th></th></tr></thead><tbody>'+
    [["Priya Bose","payroll-3","Joined Finance last week","2 d"],["Arjun Das","grafana-4","On call from Monday","4 h"]]
    .map(function(r){return '<tr><td><div class="who"><span class="av">'+init2(r[0])+'</span><b>'+r[0]+'</b></div></td>'+
     '<td class="uname">'+r[1]+'</td><td class="uname">'+r[2]+'</td><td class="tech">'+r[3]+'</td>'+
     '<td style="text-align:right"><button class="btn btn-sm btn-primary">Grant</button></td></tr>';}).join("")+
    '</tbody></table>';
  case "eventlog":return simpleList("Logs & reports","794 events today",["Time","User","Event","Source IP"],
    (function(){var a=[];for(var i=0;i<24;i++)a.push({t:"2026-09-20 "+String(9+(i%9)).padStart(2,"0")+":"+String((i*7)%60).padStart(2,"0"),
     u:USERS[i%USERS.length].u,e:["signed in","access allowed","access denied","device registered"][i%4],
     ip:"49.36."+(80+i%40)+"."+(11+(i*17)%200)});return a;})(),
    function(e){return '<td class="tech">'+esc(e.t)+'</td><td class="uname">'+esc(e.u)+'</td>'+
     '<td>'+esc(e.e)+'</td><td class="tech">'+esc(e.ip)+'</td>';},"report","");
  case "filters":return simpleList("Filters","",["Name","URL","Match type"],[],function(){return"";},"filter",
    "A filter matches destinations by address, category or file type. Use one as the destination of an access rule.");
  case "authp":return simpleList("Auth profiles","5 profiles",["Profile","Type","Users"],
    [{n:"Local",t:"Built in",u:412},{n:"corp-ad",t:"Active Directory",u:1109},{n:"azure-tenant",t:"Azure AD",u:284},
     {n:"okta-saml",t:"SAML",u:15},{n:"legacy-ldap",t:"OpenLDAP",u:0}],
    function(p){return '<td><b style="font-weight:450">'+esc(p.n)+'</b></td><td class="uname">'+esc(p.t)+'</td>'+
     '<td class="tech">'+p.u+'</td>';},"profile","");
  case "assets":return '<div class="pad phead"><div><h1>Asset inventory</h1><p>775 devices · 17 manufacturers</p></div></div>'+
    '<div class="pad stats"><div class="stat"><div class="sl">Devices</div><div class="sv">775</div></div>'+
    '<div class="stat"><div class="sl">Disk encrypted</div><div class="sv">712<i>&thinsp;/&thinsp;775</i></div><div class="sm">63 unencrypted</div></div>'+
    '<div class="stat"><div class="sl">Average age</div><div class="sv">2.1<i>&thinsp;yrs</i></div></div>'+
    '<div class="stat"><div class="sl">Out of support</div><div class="sv">28</div><div class="sm">past end-of-service</div></div></div>'+
    '<div class="pad cols"><div class="col"><div class="chead"><h3>By manufacturer</h3></div>'+
    bars([["Dell Inc.",219,100],["HP",143,65],["Apple",134,61],["LENOVO",56,26]])+'</div>'+
    '<div class="col"><div class="chead"><h3>By asset age</h3></div>'+
    bars([["Under 1 year",204,71],["1–2 years",286,100],["2–3 years",171,60],["Over 3 years",114,40]])+'</div></div>';
  case "downloads":return simpleList("Downloads","Agent 4.8.2",["Platform","Package","Size"],
    [{p:"Windows",f:"ISA-Agent-Setup-4.8.2.exe",s:"64.2 MB"},{p:"macOS",f:"ISA-Agent-4.8.2.pkg",s:"58.9 MB"},
     {p:"Linux",f:"isa-agent_4.8.2_amd64.deb",s:"41.3 MB"}],
    function(a){return '<td><b style="font-weight:450">'+esc(a.p)+'</b></td><td class="tech">'+esc(a.f)+'</td>'+
     '<td class="tech">'+esc(a.s)+'</td>';},"package","");
  case "setcompany":case "setidentity":case "setnotify":
   var T={setcompany:["Company","Identity, branding and contacts"],
          setidentity:["Identity settings","Password policy, MFA and session limits"],
          setnotify:["Notifications","Who hears about provisioning and posture events"]}[S.page];
   return '<div class="pad phead"><div><h1>'+T[0]+'</h1><p>'+T[1]+'</p></div>'+
    '<div class="acts"><button class="btn btn-quiet">Discard</button><button class="btn btn-primary">Save changes</button></div></div>'+
    '<div class="pad"><div class="formsec"><h3>Settings live in one place now</h3>'+
    '<p class="d">The production console scatters configuration across General settings, User settings and Report settings, '+
    'none of which is reachable from the others. Version B merges them into this one group.</p>'+
    '<div class="frow"><div class="lb"><label>Example field</label><div class="h">Every field here carries one line of help. That was the 0-of-44 finding.</div></div>'+
    '<div class="ctl"><input type="text" value="veno.instasafe.com"></div></div>'+
    '<div class="frow"><div class="lb"><label>Another</label><div class="h">Long option lists are typeahead, never a 2,393-option select.</div></div>'+
    '<div class="ctl"><div class="ta" data-ta="os"><input type="text" placeholder="Search operating systems" data-tainput="os" autocomplete="off"></div></div></div>'+
    '</div></div>';
  case "support":return '<div class="pad phead"><div><h1>Tech support</h1>'+
   '<p>Grant InstaSafe engineers time-boxed access</p></div></div>'+
   '<div class="zero"><div class="zi">'+ic("i-life")+'</div><h3>No support access granted</h3>'+
   '<p>Nobody outside your organisation can see this tenant. Every grant expires on its own and is written to the event log.</p>'+
   '<div class="za"><button class="btn btn-primary">'+ic("i-plus")+'Grant access</button></div></div>';
 }
 return '<div class="zero"><div class="zi">'+ic("i-grid")+'</div><h3>Not in this prototype</h3><p>—</p></div>';
}
function renderNav(){
 var w=document.getElementById("nav");w.innerHTML="";
 NAV.forEach(function(g){
  var s=document.createElement("div");s.className="navsec";s.textContent=g.sec;w.appendChild(s);
  g.items.forEach(function(it){
   var b=document.createElement("button");b.className="navitem";
   var badge=it.attn?('<span class="attn">'+(it.id==="approvals"?(pendingDevs().length+failingDevs().length):it.attn)+'</span>')
    :(it.n!==undefined?'<span class="cnt">'+it.n.toLocaleString()+'</span>':"");
   b.innerHTML=ic(it.i)+"<span>"+esc(it.l)+"</span>"+badge;
   if(S.page===it.id)b.setAttribute("aria-current","page");
   b.onclick=function(){go(it.id);};w.appendChild(b);});
 });
}
function go(id){S.page=id;S.q="";S.sel={};S.sort=null;S.tab=id==="approvals"?"pending":"all";S.view="";
 ls("page",id);document.getElementById("rail").classList.remove("on");closeLayer();render();syncRail();}

function render(){
 renderNav();
 document.getElementById("crumb").innerHTML=(CRUMB[S.page]||"").split("›").map(function(p){return esc(p.trim());}).join(' <b>›</b> ');
 if(S.page==="signin")document.documentElement.setAttribute("data-signin","1");else document.documentElement.removeAttribute("data-signin");
 var p=document.getElementById("page");p.innerHTML=pageHTML();
 var q=function(i){return document.getElementById(i);};

 if(q("q"))q("q").oninput=function(e){var pos=e.target.selectionStart;S.q=e.target.value;S.data="normal";
  render();var n=q("q");if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}};
 if(q("clrBtn"))q("clrBtn").onclick=function(){S.q="";S.data="normal";render();syncRail();};
 p.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){go(b.getAttribute("data-go"));};});
 p.querySelectorAll("[data-ftab]").forEach(function(b){b.onclick=function(){S.tab=b.getAttribute("data-ftab");S.sel={};render();};});
 p.querySelectorAll("[data-sort]").forEach(function(t){t.onclick=function(){
  var k=t.getAttribute("data-sort");
  if(S.sort===k)S.dir=S.dir==="asc"?"desc":"asc";else{S.sort=k;S.dir="asc";}
  render();};});
 if(q("colBtn"))q("colBtn").onclick=function(e){e.stopPropagation();colMenu(q("colBtn"),S.page==="users"?"users":"devices");};
 if(q("viewBtn"))q("viewBtn").onclick=function(e){e.stopPropagation();viewMenu(q("viewBtn"),S.page==="users"?"users":"devices");};
 if(q("allcb"))q("allcb").onchange=function(e){p.querySelectorAll("[data-cb]").forEach(function(c){
  S.sel[c.getAttribute("data-cb")]=e.target.checked;});render();};
 p.querySelectorAll("[data-cb]").forEach(function(c){c.onchange=function(){S.sel[c.getAttribute("data-cb")]=c.checked;render();};});
 if(q("delBtn"))q("delBtn").onclick=function(){
  var ids=selIds();if(!ids.length)return;
  var names=ids.map(function(i){var u=allUsers().filter(function(x){return x.id===i;})[0];
   if(u)return u.n;var d=DEV.filter(function(x){return x.id===i;})[0];return d?d.name:i;});
  confirmDelete(S.page==="users"?"user":"device",names,function(){
   ids.forEach(function(i){if(String(i).charAt(0)==="u")S.hidden[i]=1;});ls("hidden",S.hidden);
   var mine=ids.filter(function(i){return String(i).charAt(0)!=="u"&&String(i).charAt(0)!=="d";});
   var fin=function(){S.sel={};render();toast("Deleted",names.length+" record"+(names.length>1?"s":"")+" removed.","ok");};
   if(mine.length&&S.db)Promise.all(mine.map(function(i){return S.db.collection("tenant_users").doc(i).delete();})).then(fin).catch(fin);
   else{S.added=S.added.filter(function(u){return mine.indexOf(u.id)<0;});ls("added",S.added);fin();}});};
 p.querySelectorAll("[data-menu]").forEach(function(b){b.onclick=function(e){e.stopPropagation();rowMenu(b,b.getAttribute("data-menu"));};});
 p.querySelectorAll("[data-user]").forEach(function(tr){tr.onclick=function(e){
  if(e.target.closest("input,button"))return;
  S.exp={uid:tr.getAttribute("data-user"),mode:"user"};go("explorer");};});

 /* B1 */
 p.querySelectorAll("[data-approve]").forEach(function(b){b.onclick=function(){
  var id=b.getAttribute("data-approve");S.approved[id]=1;ls("approved",S.approved);
  var d=DEV.filter(function(x){return x.id===id;})[0];
  render();syncRail();toast("Approved",(d?d.name:"Device")+" can connect now.","ok");};});
 p.querySelectorAll("[data-fix]").forEach(function(b){b.onclick=function(){
  var d=DEV.filter(function(x){return x.id===b.getAttribute("data-fix");})[0];
  toast("Message sent",(d?d.owner:"The owner")+" has been emailed the steps to fix “"+(d?d.failed:"")+"”.","att");};});
 if(q("bulkApprove"))q("bulkApprove").onclick=function(){
  var ids=selIds(),okN=0,skip=0;
  ids.forEach(function(i){var d=DEV.filter(function(x){return x.id===i;})[0];
   if(d&&d.posture==="Failed"){skip++;return;}S.approved[i]=1;okN++;});
  ls("approved",S.approved);S.sel={};render();syncRail();
  toast(okN+" approved",skip?skip+" skipped because posture is failing — approve those individually after the owner fixes them.":"They can all connect now.",skip?"att":"ok");};

 /* B2 */
 if(q("wNext"))q("wNext").onclick=wizNext;
 if(q("wBack"))q("wBack").onclick=function(){readWiz();S.wiz.step--;saveWiz();render();};
 if(q("wCreate"))q("wCreate").onclick=wizCreate;
 if(q("wAnother"))q("wAnother").onclick=function(){wizInit();render();};
 if(q("wExplore"))q("wExplore").onclick=function(){go("explorer");};
 p.querySelectorAll("[data-step]").forEach(function(b){b.onclick=function(){
  var i=+b.getAttribute("data-step");if(i<S.wiz.step){readWiz();S.wiz.step=i;saveWiz();render();}};});
 if(q("newGrp"))q("newGrp").onclick=function(){inlineCreate("group");};
 if(q("newApp"))q("newApp").onclick=function(){inlineCreate("application");};
 p.querySelectorAll("[data-untag]").forEach(function(b){b.onclick=function(){
  var v=b.getAttribute("data-untag").split(":"),arr=v[0]==="grp"?S.wiz.groups:S.wiz.apps;
  var i=arr.indexOf(v[1]);if(i>=0)arr.splice(i,1);saveWiz();render();};});
 wireTypeahead(p);

 /* B3 / B4 */
 if(q("offboard"))q("offboard").onclick=function(){
  var u=allUsers().filter(function(x){return x.id===S.exp.uid;})[0]||allUsers()[0];offboardModal(u);};
 p.querySelectorAll("[data-fix2]").forEach(function(b){b.onclick=function(){
  var w=b.getAttribute("data-fix2");
  if(w==="device")go("approvals");else if(w==="no-rule")go("rules");else go("users");};});
 if(q("expq"))q("expq").onfocus=function(){this.select();};

 /* F5 */
 if(q("impPick"))q("impPick").onclick=function(){S.imp={stage:"dry"};render();
  toast("Parsed 8 rows","Nothing has been written. Review the result and press Create.","att");};
 if(q("impBack"))q("impBack").onclick=function(){S.imp={stage:"pick"};render();};
 if(q("impGo"))q("impGo").onclick=function(){
  var ok=IMPROWS.filter(function(r){return r.ok;}).length;
  S.imp={stage:"pick"};go("users");toast(ok+" users created","3 rows were skipped. Fix them in the file and import again.","ok");};

 if(q("goOnboard"))q("goOnboard").onclick=function(){if(!S.wiz||S.wiz.created)wizInit();go("onboard");};
 if(q("goImport"))q("goImport").onclick=function(){S.imp={stage:"pick"};go("import");};
 if(q("goSetup"))q("goSetup").onclick=function(){go("setup");};
 if(document.getElementById("si_go"))document.getElementById("si_go").onclick=function(){go("dashboard");toast("Signed in","Welcome back, Debajyoti.","ok");};
 document.getElementById("main").scrollTop=0;
}

/* ---- typeahead ---- */
function wireTypeahead(root){
 root.querySelectorAll("[data-tainput]").forEach(function(inp){
  var kind=inp.getAttribute("data-tainput");
  var src=kind==="grp"?GROUPS.map(function(g){return [g.id,g.name,g.members+" members"];})
        :kind==="app"?APPS.map(function(a){return [a.id,a.name,a.type];})
        :OSOPT.map(function(o,i){return ["os"+i,o,""];});
  var box=inp.parentNode;
  function close(){var l=box.querySelector(".talist");if(l)l.remove();}
  inp.oninput=inp.onfocus=function(){
   close();var q=inp.value.toLowerCase();
   var hits=src.filter(function(x){return !q||x[1].toLowerCase().indexOf(q)>=0;});
   var d=document.createElement("div");d.className="talist";
   d.innerHTML=(hits.length?hits.slice(0,8).map(function(x){
     return '<button data-pick="'+esc(x[0])+'">'+esc(x[1])+'<span class="s">'+esc(x[2])+'</span></button>';}).join("")
    :'<div class="none">Nothing matches “'+esc(inp.value)+'”</div>')+
    (hits.length>8?'<div class="tacount">'+hits.length.toLocaleString()+' matches · keep typing to narrow</div>':"");
   box.appendChild(d);
   d.querySelectorAll("[data-pick]").forEach(function(b){b.onclick=function(){
    var id=b.getAttribute("data-pick");
    if(kind==="grp"){if(S.wiz.groups.indexOf(id)<0)S.wiz.groups.push(id);saveWiz();render();}
    else if(kind==="app"){if(S.wiz.apps.indexOf(id)<0)S.wiz.apps.push(id);saveWiz();render();}
    else{inp.value=b.textContent.trim();close();}};});};
  inp.onblur=function(){setTimeout(close,160);};
 });
}
function inlineCreate(kind){
 readWiz();
 var l=document.getElementById("layer");
 l.innerHTML='<div class="scrim" id="scrim"></div><div class="modal" role="dialog" aria-modal="true">'+
  '<div class="modalb"><h3>New '+esc(kind)+'</h3>'+
  '<p>This is created immediately and selected for you. Your place in the onboarding flow is kept.</p>'+
  '<div style="margin-top:16px"><label style="font-size:12.5px;display:block;margin-bottom:5px">Name</label>'+
  '<input id="icName" type="text" style="width:100%;height:32px;padding:0 10px;border-radius:6px;'+
  'border:1px solid var(--rule-strong);background:var(--canvas);color:var(--ink)" placeholder="'+
  (kind==="group"?"Finance (EMEA)":"payroll-uat")+'"></div>'+
  '</div><div class="modalf"><button class="btn" id="icNo">Cancel</button>'+
  '<button class="btn btn-primary" id="icYes">Create and select</button></div></div>';
 document.getElementById("scrim").onclick=closeLayer;
 document.getElementById("icNo").onclick=closeLayer;
 document.getElementById("icName").focus();
 document.getElementById("icYes").onclick=function(){
  var nm=document.getElementById("icName").value.trim();
  if(!nm){toast("Name it first","Give the "+kind+" a name a colleague would recognise.","bad");return;}
  if(kind==="group"){var g={id:"gN"+Date.now(),name:nm,members:0,apps:[]};GROUPS.push(g);S.wiz.groups.push(g.id);}
  else{var a={id:"aN"+Date.now(),name:nm,type:"WEB",host:"10.6.9.1",port:443};APPS.push(a);S.wiz.apps.push(a.id);}
  saveWiz();closeLayer();render();toast(kind.charAt(0).toUpperCase()+kind.slice(1)+" created","“"+nm+"” was added and selected.","ok");};
}
function readWiz(){
 var g=function(i){var e=document.getElementById(i);return e?e.value:undefined;};
 if(S.wiz.step===0){
  var a=g("w_first");if(a!==undefined)S.wiz.first=a;
  var b=g("w_last");if(b!==undefined)S.wiz.last=b;
  var c=g("w_email");if(c!==undefined)S.wiz.email=c;
  var d=g("w_profile");if(d!==undefined)S.wiz.profile=d;}
 saveWiz();
}
function wizNext(){
 readWiz();var W=S.wiz;W.err={};
 if(W.step===0){
  if(!W.first.trim())W.err.first="Enter a first name.";
  if(!W.email.trim())W.err.email="Enter a work email.";
  else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(W.email.trim()))W.err.email="That is not a valid email address.";
  else if(allUsers().some(function(u){return (u.email||"").toLowerCase()===W.email.trim().toLowerCase();}))
   W.err.email="Someone already uses that address.";
  if(Object.keys(W.err).length){saveWiz();render();
   toast("Check the form",W.err[Object.keys(W.err)[0]],"bad");return;}
 }
 W.step++;saveWiz();render();
}
function wizCreate(){
 var W=S.wiz;
 var rec={first:W.first.trim(),last:W.last.trim(),n:(W.first+" "+W.last).trim(),
  u:(W.first+"."+W.last).toLowerCase().replace(/\s+/g,""),email:W.email.trim(),p:W.profile,
  s:"Active",mfa:false,ip:"—",seen:"never",groups:W.groups.slice(),devices:0};
 (function(){
  if(S.db){rec.createdAt=Date.now();
   return S.db.collection("tenant_users").add(rec).then(function(){return true;})
    .catch(function(e){toast("Could not save",(e&&e.code)==="invalid_argument"
     ?"You have view-only access to this prototype, so records cannot be saved."
     :"Storage is unavailable right now.","bad");return false;});}
  rec.id="l"+Date.now();rec.added=true;S.added=[rec].concat(S.added);ls("added",S.added);
  return Promise.resolve(true);
 })().then(function(ok){
  if(!ok)return;
  W.created=rec.n;W.step=3;saveWiz();render();syncRail();
  toast("Created",rec.n+" and one access rule. "+(W.apps.length||0)+" applications reachable.","ok");});
}

/* ---- shared floating bits ---- */
function confirmDelete(noun,names,onYes){
 var l=document.getElementById("layer");
 var title=names.length===1?"Delete "+noun+" “"+names[0]+"”?":"Delete "+names.length+" "+noun+"s?";
 l.innerHTML='<div class="scrim" id="scrim"></div><div class="modal" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
  '<div class="modalb"><h3>'+esc(title)+'</h3>'+
  '<p>This cannot be undone. Access granted through this '+esc(noun)+' stops immediately.</p>'+
  (names.length>1?'<div class="names">'+names.slice(0,8).map(function(n){return '<div>'+esc(n)+'</div>';}).join("")+
   (names.length>8?'<div class="quiet">…and '+(names.length-8)+' more</div>':"")+'</div>':"")+
  '</div><div class="modalf"><button class="btn" id="mNo">Cancel</button>'+
  '<button class="btn btn-danger" id="mYes" style="border-color:var(--rule-strong)">'+
  (names.length===1?"Delete "+esc(noun):"Delete "+names.length+" "+esc(noun)+"s")+'</button></div></div>';
 document.getElementById("scrim").onclick=closeLayer;
 document.getElementById("mNo").onclick=closeLayer;
 document.getElementById("mYes").onclick=function(){closeLayer();onYes();};
 document.getElementById("mNo").focus();
}
function rowMenu(btn,id){
 var l=document.getElementById("layer"),r=btn.getBoundingClientRect();
 var u=allUsers().filter(function(x){return x.id===id;})[0];
 l.innerHTML='<div class="menu" style="top:'+(r.bottom+6)+'px;left:'+Math.max(8,r.right-200)+'px">'+
  '<button data-m="explore">'+ic("i-compass")+'What can they reach?</button>'+
  '<button data-m="edit">'+ic("i-edit")+'Edit</button>'+
  '<hr><button data-m="off" class="dz">'+ic("i-exit")+'Offboard</button></div>';
 var close=function(e){if(!e||!e.target.closest(".menu")){closeLayer();document.removeEventListener("mousedown",close);}};
 setTimeout(function(){document.addEventListener("mousedown",close);},0);
 l.querySelectorAll("[data-m]").forEach(function(b){b.onclick=function(){
  var a=b.getAttribute("data-m");closeLayer();
  if(a==="explore"){S.exp={uid:id,mode:"user"};go("explorer");}
  else if(a==="off"&&u)offboardModal(u);
  else toast("Not in this prototype","The edit sheet is unchanged from Version A.","att");};});
}

/* ===================== state rail ===================== */
var R=document.documentElement;
function syncRail(){
 var b=document.getElementById("sr2b");
 var theme=R.getAttribute("data-theme")||"light",rail=R.getAttribute("data-rail")||"tint",
     pal=R.getAttribute("data-palette")||"violet";
 function grp(title,kind,list,cur,note){
  return '<div class="srg" data-g="'+kind+'"><div class="t">'+esc(title)+'</div><div class="opts">'+
   list.map(function(o){return '<button class="opt" data-v="'+o[0]+'"'+(cur!==null?' aria-pressed="'+(cur===o[0]?"true":"false")+'"':'')+'>'+o[1]+'</button>';}).join("")+
   '</div>'+(note?'<div class="srnote" style="margin-top:9px">'+note+'</div>':"")+'</div>';
 }
 b.innerHTML=
  grp("Theme","theme",[["light","Light"],["dark","Dark"]],theme)+
  grp("Navigation rail","rail",[["tint","Tint"],["dark","Dark"]],rail)+
  grp("Palette","palette",[["violet","Violet · coral"],["ember","Ember · house"]],pal,
    "<b>Ember</b> swaps in the InstaSafe <code>--db-*</code> tokens so both can be judged on the same screens.")+
  grp("Version B waves","page",[["approvals","B1 · Approval queue"],["onboard","B2 · Onboard wizard"],
    ["explorer","B3 · Access explorer"],["import","F5 · Import dry run"],["setup","B5 · First run"],
    ["users","B0 · List template"]],S.page)+
  grp("Other screens","page",[["dashboard","Dashboard"],["devices","Devices"],["rules","Access rules"],
    ["apps","Applications"],["groups","Groups"],["requests","Access requests"],["eventlog","Logs"],
    ["assets","Asset inventory"],["setcompany","Settings"],["filters","Empty list"],["signin","Sign in"]],S.page)+
  grp("Data state","data",[["normal","Populated"],["zero","Empty tenant"],["nomatch","Search finds nothing"]],S.data)+
  grp("Try","overlay",[["bulk","Bulk approve"],["invalid","Wizard validation"],["confirm","Delete confirm"],
    ["offb","Offboard dialog"],["toast","Toasts"]],null)+
  '<div class="srg"><div class="t">Storage</div><div class="srnote">'+esc(storeMsg)+
   '<div style="margin-top:9px"><button class="opt" id="rst">Reset created records</button>'+
   '<button class="opt" id="rstw" style="margin-left:5px">Clear wizard draft</button></div></div></div>'+
  '<div class="srg" style="border-bottom:0"><div class="t">Decisions taken</div><div class="srnote">'+
   '<b>MFA colour flipped.</b> The system says only <i>Enrolled</i> gets a green pill, but 49 of 60 users are enrolled — '+
   'which fails the handoff\'s own check that pills stay under 60% of rows. <i>Not enrolled</i> now carries the mark instead.<br><br>'+
   '<b>B3 built anyway.</b> The handoff blocks it on whether a policy-evaluation endpoint exists. A prototype is how you find out '+
   'what that endpoint must return, so it is built and the dependency is stated on the screen.<br><br>'+
   '<b>Wizard before rule builder.</b> §8.1 is unanswered; P1 is the likelier default for a mid-market tenant, so B2 leads.'+
   '</div></div>';

 b.querySelectorAll("[data-g]").forEach(function(g){
  var kind=g.getAttribute("data-g");
  g.querySelectorAll("[data-v]").forEach(function(btn){btn.onclick=function(){
   var v=btn.getAttribute("data-v");
   if(kind==="theme"){R.setAttribute("data-theme",v);ls("theme",v);}
   else if(kind==="rail"){R.setAttribute("data-rail",v);ls("rail",v);}
   else if(kind==="palette"){R.setAttribute("data-palette",v);ls("palette",v);}
   else if(kind==="page"){if(v==="onboard"&&(!S.wiz||S.wiz.created))wizInit();
     if(v==="import")S.imp={stage:"pick"};go(v);return;}
   else if(kind==="data"){S.data=v;S.q="";S.sel={};render();}
   else if(kind==="overlay"){
    closeLayer();
    if(v==="bulk"){go("approvals");setTimeout(function(){
      pendingDevs().slice(0,4).forEach(function(d){S.sel[d.id]=1;});
      failingDevs().slice(0,2).forEach(function(d){S.sel[d.id]=1;});
      S.tab="all";render();},40);}
    else if(v==="invalid"){wizInit();S.wiz.email="nope";go("onboard");setTimeout(wizNext,60);}
    else if(v==="confirm"){go("users");setTimeout(function(){
      confirmDelete("user",allUsers().slice(0,3).map(function(x){return x.n;}),function(){});},60);}
    else if(v==="offb"){go("explorer");setTimeout(function(){
      var u=allUsers()[0];if(u)offboardModal(u);},60);}
    else if(v==="toast"){toast("6 devices approved","They can connect immediately.","ok");
      setTimeout(function(){toast("2 skipped","Posture is failing on those — the owners have been emailed.","att");},350);
      setTimeout(function(){toast("Gateway unreachable","mum-gw-01 did not answer the last health check.","bad");},700);}
    syncRail();return;}
   syncRail();sync();};});
 });
 var r=document.getElementById("rst");
 if(r)r.onclick=function(){S.hidden={};ls("hidden",{});S.approved={};ls("approved",{});
  if(S.db)Promise.all(S.added.map(function(u){return S.db.collection("tenant_users").doc(u.id).delete();}))
   .then(function(){toast("Reset","Created records cleared.","ok");}).catch(function(){});
  else{S.added=[];ls("added",[]);render();toast("Reset","Created records cleared.","ok");}};
 var rw=document.getElementById("rstw");
 if(rw)rw.onclick=function(){S.wiz=null;ls("wizdraft",null);render();toast("Draft cleared","The onboarding wizard starts fresh.","ok");};
}
function sync(){
 document.getElementById("themeLbl").textContent=R.getAttribute("data-theme")==="dark"?"Light":"Dark";
 document.getElementById("railLbl").textContent=R.getAttribute("data-rail")==="dark"?"Tint rail":"Dark rail";
}
R.setAttribute("data-theme",lg("theme","light"));
R.setAttribute("data-rail",lg("rail","tint"));
R.setAttribute("data-palette",lg("palette","violet"));
S.page=lg("page","dashboard");
if(S.page==="onboard"&&!S.wiz)wizInit();
document.getElementById("themeBtn").onclick=function(){
 var n=R.getAttribute("data-theme")==="dark"?"light":"dark";R.setAttribute("data-theme",n);ls("theme",n);sync();syncRail();};
document.getElementById("railBtn").onclick=function(){
 var n=R.getAttribute("data-rail")==="dark"?"tint":"dark";R.setAttribute("data-rail",n);ls("rail",n);sync();syncRail();};
document.getElementById("fab").onclick=function(){document.getElementById("sr2").classList.add("on");};
document.getElementById("sr2x").onclick=function(){document.getElementById("sr2").classList.remove("on");};
document.getElementById("menuBtn").onclick=function(){document.getElementById("rail").classList.toggle("on");};
(function(){var m=document.getElementById("menuBtn");
 function c(){m.style.display=window.innerWidth<=920?"inline-flex":"none";}c();addEventListener("resize",c);})();
(function(){var s=2*3600+43*60+22;setInterval(function(){s=Math.max(0,s-1);
 var e=document.getElementById("clock");if(!e)return;
 e.textContent=String(Math.floor(s/3600)).padStart(2,"0")+":"+String(Math.floor(s%3600/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");},1000);})();
addEventListener("keydown",function(e){if(e.key==="Escape")closeLayer();});
sync();render();syncRail();
})();
