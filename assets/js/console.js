(function(){
"use strict";
/* ======================= nav ======================= */
var NAV=[
 {sec:"Overview",items:[
   {id:"dashboard",l:"Dashboard",i:"i-gauge"},
   {id:"assets",l:"Asset inventory",i:"i-pie"},
   {id:"graph",l:"Graph",i:"i-chart"}]},
 {sec:"Infrastructure",items:[
   {id:"infra",l:"Controllers & gateways",i:"i-cpu",kids:[["controllers","Controllers",4],["gateways","Gateways",4]]},
   {id:"general",l:"General settings",i:"i-gear",kids:[["company","Company details"],["subscription","Subscription"],["smtp","Email settings"]]}]},
 {sec:"Identity",items:[
   {id:"auth",l:"Authentication profiles",i:"i-finger",kids:[["local","Local"],["ad","Active Directory",9],["saml","SAML",2],["oauth","OAuth",1]]},
   {id:"ug",l:"Users & groups",i:"i-users",kids:[["users","Users",1820],["usergroups","User groups",46],["blocked","Blocked users",0]]},
   {id:"usets",l:"User settings",i:"i-sliders",kids:[["settings","Settings"],["shifts","Shift schedules",4],["risk","Risk profiles",3]]}]},
 {sec:"Security",items:[
   {id:"dev",l:"Devices & checks",i:"i-laptop",kids:[["devices","Devices",775],["devchecks","Device checks",150],["geo","Geofences",10]]},
   {id:"filters",l:"Filters",i:"i-funnel",kids:[["url","URL",0],["content","Content",0],["domains","Domain lists",0]]}]},
 {sec:"Access",items:[
   {id:"apps",l:"Applications",i:"i-grid",kids:[["appsvc","Application services",33],["applications","Applications",53],["appgroups","Application groups",10]]},
   {id:"rules",l:"Access rules",i:"i-key",n:57}]},
 {sec:"Monitoring",items:[
   {id:"logs",l:"Logs & reports",i:"i-chart",kids:[["live","Live users",318],["sessionlog","Session log",24],["accesslog","Access log",246],["eventlog","Event log",794]]},
   {id:"downloads",l:"Downloads",i:"i-dl"}]},
 {sec:"Administration",items:[
   {id:"subroles",l:"Sub admin roles",i:"i-card",n:3},
   {id:"support",l:"Tech support",i:"i-life"}]}
];
var CRUMB={};
NAV.forEach(function(g){g.items.forEach(function(it){
  if(it.kids){it.kids.forEach(function(k){CRUMB[k[0]]=g.sec+" › "+it.l+" › "+k[1];});}
  else CRUMB[it.id]=g.sec+" › "+it.l;});});

/* ======================= data ======================= */
var FIRST=["Alen","Debajyoti","Kavya","Rohit","Priya","Arjun","Meera","Sanjay","Nikhil","Ananya","Vikram","Shruti",
"Karan","Divya","Rahul","Neha","Aditya","Pooja","Manish","Ritu","Suresh","Tara","Imran","Lakshmi","Gaurav","Sneha",
"Varun","Anjali","Harsh","Kiran","Deepak","Swati","Naveen","Isha","Aman","Rekha","Siddharth","Nandini","Yash","Preeti"];
var LAST=["Joseph","Darshan","Menon","Nair","Sharma","Reddy","Iyer","Gupta","Bose","Kulkarni","Rao","Patel","Singh",
"Chopra","Verma","Das","Malhotra","Pillai","Shetty","Banerjee"];
var PROFILE=["Local","Active Directory","Azure AD","OpenLDAP","SAML"];
var SEEN=["just now","2 min ago","18 min ago","1 h ago","4 h ago","yesterday","3 d ago","12 d ago"];
var OS=["Windows 11","Windows 10","macOS 15","Ubuntu 24.04","Android 15","iOS 18"];
var USERS=[],DEV=[],RULES=[],GROUPS=[],APPS=[],LOGS=[],CHECKS=[];
(function(){
 for(var i=0;i<60;i++){var f=FIRST[i%FIRST.length],l=LAST[(i*7)%LAST.length];
  USERS.push({id:"u"+i,first:f,last:l,n:f+" "+l,u:(f+"."+l).toLowerCase(),p:PROFILE[(i*3)%PROFILE.length],
   mfa:!(i%7===2||i%13===5),s:(i%11===3)?"Suspended":"Active",
   ip:"10.24."+(8+(i%6))+"."+(11+(i*13)%220),seen:SEEN[(i*5)%SEEN.length],
   email:(f+"."+l).toLowerCase()+"@instasafe.com",cc:"+91",mobile:"98"+(10000000+i*1337).toString().slice(0,8),
   loc:["Bengaluru","Mumbai","Pune","Delhi","Chennai"][i%5],auth:"Password + Certs",act:"Immediately on provisioning"});}
 for(var d=0;d<48;d++){DEV.push({id:"d"+d,name:(d%2?"LT":"WS")+"-"+(1040+d*3),os:OS[(d*5)%OS.length],
  owner:FIRST[(d*3)%FIRST.length]+" "+LAST[(d*5)%LAST.length],
  mac:("A4:"+(16+d).toString(16)+":7B:"+(32+d*3).toString(16)+":C1:"+((10+d*7)%256).toString(16)).toUpperCase(),
  posture:(d%6===2)?"Failed":"Passed",state:(d%9===1||d%14===4)?"Pending":"Approved",seen:SEEN[(d*3)%SEEN.length]});}
 var ST=["User","User group","Application"],DT=["Application","Application group","URL filter","Custom application"];
 for(var r=0;r<34;r++){RULES.push({id:"r"+r,name:["finance-rdp","hr-portal","build-ssh","vpn-full","db-readonly","wiki-web"][r%6]+"-"+(r+1),
  src:ST[r%3],source:USERS[(r*3)%USERS.length].u,dst:DT[(r*2)%4],dest:["FinanceApps","payroll-web","code-server","reports-db"][r%4],
  act:(r%8===3)?"Deny":(r%13===5?"Bypass":"Allow")});}
 for(var g=0;g<22;g++){GROUPS.push({id:"g"+g,name:["Engineering","Finance","Contractors","Sales","Support","Ops"][g%6]+" "+(g+1),
  members:6+(g*13)%180,rules:1+(g%5),mfa:g%4!==1,checks:g%3!==2,auth:PROFILE[g%PROFILE.length]});}
 var TY=["WEB","RDP","SSH","DB","FQDN","VNC","WFS"];
 for(var a=0;a<28;a++){APPS.push({id:"a"+a,name:["payroll","wiki","jenkins","grafana","jira","reports"][a%6]+"-"+(a+1),
  type:TY[a%7],host:"10.6."+(2+a%8)+"."+(20+a*5),port:[443,3389,22,5432,443,5900,445][a%7],rec:(a%5===1)});}
 var ACT=["signed in","access allowed","access denied","device registered","posture failed","MFA enrolled","policy applied"];
 for(var e=0;e<40;e++){LOGS.push({id:"e"+e,t:"2026-09-20 "+String(9+(e%9)).padStart(2,"0")+":"+String((e*7)%60).padStart(2,"0")+":"+String((e*13)%60).padStart(2,"0"),
  u:USERS[(e*5)%USERS.length].u,a:ACT[e%7],ip:"49.36."+(80+e%40)+"."+(11+(e*17)%200),
  sev:(e%9===2)?"denied":(e%13===4?"warn":"ok")});}
 var CK=["Antivirus running","Disk encrypted","Firewall enabled","OS patch level","Screen lock","Domain joined","No jailbreak","MDM enrolled"];
 for(var c=0;c<18;c++){CHECKS.push({id:"c"+c,name:CK[c%8],os:["Windows","macOS","Linux","Android"][c%4],
  check:["AntiVirusStatus","BitLocker","Firewall","Hotfix","ScreenLock","DomainName"][c%6],val:["Enabled","On","true","KB5031354","300","corp.local"][c%6],
  fails:(c*7)%23});}
})();

/* ======================= state ======================= */
var S={page:"dashboard",q:"",sel:{},pageIdx:0,pageSize:50,data:"normal",sheet:null,editing:null,tab:0,
        added:[],hidden:{},db:null,menu:null};
var LSK="i365va";
function lg(k,d){try{var v=localStorage.getItem(LSK+":"+k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function ls(k,v){try{localStorage.setItem(LSK+":"+k,JSON.stringify(v));}catch(e){}}
var storeMsg="Local only — records you add stay in this browser.";

(function(){
  S.hidden=lg("hidden",{});
  if(!(window.claude&&window.claude.use)){S.added=lg("added",[]);return;}
  window.claude.use("db").then(function(db){
    if(!db){S.added=lg("added",[]);syncRail();return;}
    S.db=db;storeMsg="Shared — records you add are saved to this artifact and visible to everyone on the team.";
    db.collection("tenant_users").orderBy("createdAt","desc").limit(200).onSnapshot(function(sn){
      S.added=sn.docs.map(function(x){var o=x.data()||{};o.id=x.id;o.added=true;return o;});render();syncRail();
    },function(){storeMsg="Local only — shared storage stopped responding.";S.added=lg("added",[]);render();syncRail();});
    syncRail();
  }).catch(function(){S.added=lg("added",[]);syncRail();});
})();

/* ======================= helpers ======================= */
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
function ic(i){return '<svg><use href="#'+i+'"/></svg>';}
function init2(n){return n.split(" ").map(function(w){return w[0];}).join("").slice(0,2).toUpperCase();}
function selIds(){return Object.keys(S.sel).filter(function(k){return S.sel[k];});}
function toast(title,msg,kind){
  var w=document.getElementById("toasts");
  var col=kind==="bad"?"var(--bad)":kind==="att"?"var(--c600)":"var(--ok)";
  var el=document.createElement("div");el.className="toast";el.setAttribute("role","status");
  el.innerHTML='<span class="ti" style="color:'+col+'">'+ic(kind==="bad"||kind==="att"?"i-warn":"i-check")+'</span>'+
    '<div style="flex:1"><b>'+esc(title)+'</b><span>'+esc(msg||"")+'</span></div>'+
    '<button class="cl" aria-label="Dismiss">'+ic("i-x")+'</button>';
  el.querySelector(".cl").onclick=function(){el.remove();};
  w.appendChild(el);setTimeout(function(){el.remove();},6000);
}
function closeLayer(){document.getElementById("layer").innerHTML="";S.menu=null;}

/* ======================= rows / lists ======================= */
function userList(){
  if(S.data==="zero")return[];
  var base=S.added.concat(USERS.filter(function(u){return !S.hidden[u.id];}));
  if(S.data==="nomatch")return[];
  if(!S.q)return base;
  var q=S.q.toLowerCase();
  return base.filter(function(u){return((u.first||"")+" "+(u.last||"")+" "+u.u+" "+(u.email||"")+" "+(u.ip||"")).toLowerCase().indexOf(q)>=0;});
}
function pill(kind,txt,dot){return '<span class="pill p-'+kind+'">'+(dot?'<i></i>':'')+esc(txt)+'</span>';}
function quiet(t){return '<span class="quiet">'+esc(t)+'</span>';}

function tfoot(total,shown){
  var start=total?S.pageIdx*S.pageSize+1:0,end=Math.min(total,(S.pageIdx+1)*S.pageSize);
  var max=Math.max(0,Math.ceil(total/S.pageSize)-1);
  return '<div class="tfoot"><span>Rows per page</span>'+
   '<select id="psz">'+[25,50,100].map(function(n){return '<option'+(n===S.pageSize?" selected":"")+'>'+n+'</option>';}).join("")+'</select>'+
   '<span class="rt"><span>'+start+'–'+end+' of '+total.toLocaleString()+'</span>'+
   '<button class="pbtn" id="pprev"'+(S.pageIdx===0?" disabled":"")+' aria-label="Previous page">'+ic("i-l")+'</button>'+
   '<button class="pbtn" id="pnext"'+(S.pageIdx>=max?" disabled":"")+' aria-label="Next page">'+ic("i-r")+'</button></span></div>';
}
function zero(icon,title,body,acts){
  return '<div class="zero"><div class="zi">'+ic(icon)+'</div><h3>'+esc(title)+'</h3><p>'+body+'</p>'+
   '<div class="za">'+(acts||"")+'</div></div>';
}
function strip(inner){return '<div class="strip">'+inner+'</div>';}
function searchBox(ph){return '<span class="search">'+ic("i-search")+'<input id="q" value="'+esc(S.q)+'" placeholder="'+esc(ph)+'"></span>';}

/* ======================= generic list engine ======================= */
/* 54 production list pages share one template — so does this. */
var LISTS={
 usergroups:{title:"User groups",obj:"group",icon:"i-users",total:46,rows:GROUPS,
   sub:function(){return "46 groups · 1,820 members across all groups";},
   cols:["Group","Auth profile","Members","Access rules","2FA","Device checks"],
   chips:'<button class="chip">Auth profile <b>All</b></button>',
   row:function(g){return '<td><b style="font-weight:450">'+esc(g.name)+'</b></td>'+
     '<td class="uname">'+esc(g.auth)+'</td><td class="tech">'+g.members+'</td><td class="tech">'+g.rules+'</td>'+
     '<td>'+(g.mfa?quiet("Required"):pill("att","Not required",1))+'</td>'+
     '<td>'+(g.checks?quiet("Enforced"):pill("att","Off",1))+'</td>';},
   search:function(g,q){return g.name.toLowerCase().indexOf(q)>=0;}},
 applications:{title:"Applications",obj:"application",icon:"i-grid",total:53,rows:APPS,
   sub:function(){return "53 applications · 7 types · 5 with session recording";},
   cols:["Application","Type","Host","Port","Session recording"],
   chips:'<button class="chip">Type <b>All</b></button>',
   row:function(a){return '<td><b style="font-weight:450">'+esc(a.name)+'</b></td>'+
     '<td class="uname">'+esc(a.type)+'</td><td class="tech">'+esc(a.host)+'</td><td class="tech">'+a.port+'</td>'+
     '<td>'+(a.rec?pill("ok","Recording",1):quiet("Off"))+'</td>';},
   search:function(a,q){return (a.name+a.type+a.host).toLowerCase().indexOf(q)>=0;}},
 devchecks:{title:"Device checks",obj:"device check",icon:"i-shield",total:150,rows:CHECKS,
   sub:function(){return "150 checks · 7 devices currently failing at least one";},
   cols:["Rule","Operating system","Check","Expected value","Failing devices"],
   chips:'<button class="chip">OS <b>All</b></button>',
   row:function(c){return '<td><b style="font-weight:450">'+esc(c.name)+'</b></td>'+
     '<td class="uname">'+esc(c.os)+'</td><td class="uname">'+esc(c.check)+'</td>'+
     '<td class="tech">'+esc(c.val)+'</td>'+
     '<td>'+(c.fails?pill("att",c.fails+" failing",1):quiet("None"))+'</td>';},
   search:function(c,q){return (c.name+c.check+c.os).toLowerCase().indexOf(q)>=0;}},
 eventlog:{title:"Event log",obj:"event",icon:"i-chart",total:794,rows:LOGS,noAdd:true,
   sub:function(){return "794 events today · 4 denied · 3 warnings";},
   cols:["Time","User","Event","Source IP",""],
   chips:'<button class="chip on">Range <b>Today</b></button><button class="chip">Severity <b>Any</b></button>',
   row:function(e){return '<td class="tech">'+esc(e.t)+'</td><td class="uname">'+esc(e.u)+'</td>'+
     '<td>'+esc(e.a)+'</td><td class="tech">'+esc(e.ip)+'</td>'+
     '<td>'+(e.sev==="denied"?pill("att","Denied",1):e.sev==="warn"?pill("att","Warning",1):quiet("OK"))+'</td>';},
   search:function(e,q){return (e.u+e.a+e.ip).toLowerCase().indexOf(q)>=0;}},
 url:{title:"URL filter",obj:"URL filter",icon:"i-funnel",total:0,rows:[],
   sub:function(){return "Nothing configured yet";},
   cols:["Name","URL","Match type"],
   zeroBody:"A URL filter matches web addresses by exact string, wildcard or regular expression. Use one as the destination of an access rule to allow or block a set of sites.",
   row:function(){return"";},search:function(){return false;}},
 blocked:{title:"Blocked users",obj:"blocked user",icon:"i-shield",total:0,rows:[],noAdd:true,
   sub:function(){return "Nobody is currently blocked";},
   cols:["IP","Username","Blocked at","Blocked until"],
   zeroKind:"allclear",
   zeroBody:"Users are blocked automatically after repeated failed sign-ins. An empty list is the healthy state.",
   row:function(){return"";},search:function(){return false;}}
};

function listPage(key){
  var C=LISTS[key],rows=C.rows.slice(),q=S.q.toLowerCase();
  if(S.data==="zero")rows=[];
  else if(S.data==="nomatch")rows=[];
  else if(q)rows=rows.filter(function(r){return C.search(r,q);});
  var total=(S.data==="zero"||S.data==="nomatch")?0:(q?rows.length:(C.total||rows.length));
  var n=selIds().length;
  var html='<div class="pad phead"><div><h1>'+esc(C.title)+'</h1><p>'+esc(C.sub())+'</p></div><div class="acts">'+
    '<button class="btn">'+ic("i-dl")+'CSV</button>'+
    (C.noAdd?"":'<button class="btn btn-primary" id="addBtn">'+ic("i-plus")+'Add '+esc(C.obj)+'</button>')+'</div></div>';
  html+=strip(searchBox("Search "+C.title.toLowerCase())+(C.chips||"")+
    (n?'<span class="selnote">'+n+' selected</span>':"")+'<span class="spacer"></span>'+
    '<button class="btn btn-quiet">Bulk operations</button>'+
    '<button class="btn btn-danger" id="delBtn"'+(n?"":" disabled")+'>'+ic("i-trash")+'Delete</button>');
  if(!rows.length&&total===0){
    if(q||S.data==="nomatch")
      html+=zero("i-search","No "+C.obj+"s match “"+esc(q||"zz-no-match")+"”",
        "Try a shorter term, or clear the search to see everything.",
        '<button class="btn" id="clrBtn">Clear search</button>');
    else if(C.zeroKind==="allclear")
      html+=zero("i-shield","Nothing here, and that is correct",C.zeroBody,"");
    else
      html+=zero(C.icon,"Add your first "+C.obj,C.zeroBody||("Nothing has been configured here yet."),
        '<button class="btn btn-primary" id="addBtn2">'+ic("i-plus")+'Add '+esc(C.obj)+'</button>');
  }else{
    var slice=rows.slice(0,S.pageSize);
    html+='<table><thead><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>'+
      C.cols.map(function(c){return '<th>'+esc(c)+'</th>';}).join("")+'<th></th></tr></thead><tbody>';
    slice.forEach(function(r){
      html+='<tr data-id="'+r.id+'"'+(S.sel[r.id]?' class="sel"':'')+'>'+
        '<td class="cb"><input type="checkbox" data-cb="'+r.id+'"'+(S.sel[r.id]?" checked":"")+' aria-label="Select row"></td>'+
        C.row(r)+'<td style="text-align:right"><button class="rowbtn" data-menu="'+r.id+'" aria-label="Row actions">'+ic("i-dots")+'</button></td></tr>';
    });
    html+='</tbody></table>'+tfoot(total,slice.length);
  }
  return html;
}

/* ======================= users ======================= */
function usersPage(){
  var rows=userList(),q=S.q.toLowerCase();
  var total=(S.data==="zero"||S.data==="nomatch")?0:(q?rows.length:1820+S.added.length);
  var n=selIds().length;
  var noMfa=11,susp=4;
  var html='<div class="pad phead"><div><h1>Users</h1><p>'+
    (total?total.toLocaleString()+" total · "+noMfa+" without MFA · "+susp+" suspended":"Nothing configured yet")+
    '</p></div><div class="acts"><button class="btn">'+ic("i-dl")+'CSV</button>'+
    '<button class="btn btn-primary" id="addBtn">'+ic("i-plus")+'Add user</button></div></div>';
  html+=strip(searchBox("Search users, usernames or IPs")+
    '<button class="chip">Profile <b>All</b></button><button class="chip">Status <b>Any</b></button>'+
    (n?'<span class="selnote">'+n+' selected</span>':"")+'<span class="spacer"></span>'+
    '<button class="btn btn-quiet">Bulk operations</button>'+
    '<button class="btn btn-danger" id="delBtn"'+(n?"":" disabled")+'>'+ic("i-trash")+'Delete</button>');
  if(!rows.length){
    if(q||S.data==="nomatch")
      html+=zero("i-search","No users match “"+esc(q||"zz-no-match")+"”",
        "Try a shorter term, or clear the search to see all 1,820 users.",
        '<button class="btn" id="clrBtn">Clear search</button>');
    else
      html+=zero("i-users","Add your first user",
        "Users reach applications through access rules. Create one here, or connect a directory and let it provision people for you.",
        '<button class="btn btn-primary" id="addBtn2">'+ic("i-plus")+'Add user</button>'+
        '<button class="btn" id="dirBtn">Connect a directory</button>');
  }else{
    var slice=rows.slice(0,S.pageSize);
    html+='<table><thead><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>'+
     '<th>Name</th><th>Username</th><th>Auth profile</th><th>Last IP</th><th>MFA</th><th>Status</th><th>Last seen</th><th></th>'+
     '</tr></thead><tbody>';
    slice.forEach(function(u){
      html+='<tr class="click'+(S.sel[u.id]?" sel":"")+'" data-user="'+u.id+'">'+
       '<td class="cb"><input type="checkbox" data-cb="'+u.id+'"'+(S.sel[u.id]?" checked":"")+' aria-label="Select '+esc(u.n||(u.first+" "+u.last))+'"></td>'+
       '<td><div class="who"><span class="av">'+esc(init2(u.n||(u.first+" "+u.last)))+'</span><b>'+esc(u.n||(u.first+" "+u.last))+'</b></div></td>'+
       '<td class="uname">'+esc(u.u||u.username)+'</td><td class="uname">'+esc(u.p||"Local")+'</td>'+
       '<td class="tech">'+esc(u.ip||"—")+'</td>'+
       '<td>'+(u.mfa?pill("ok","Enrolled",1):pill("att","Not enrolled",0))+'</td>'+
       '<td>'+((u.s||"Active")==="Active"?quiet("Active"):pill("att","Suspended",1))+'</td>'+
       '<td class="quiet">'+esc(u.seen||"never")+'</td>'+
       '<td style="text-align:right"><button class="rowbtn" data-menu="'+u.id+'" aria-label="Row actions">'+ic("i-dots")+'</button></td></tr>';
    });
    html+='</tbody></table>'+tfoot(total,slice.length);
  }
  return html;
}

/* ======================= devices ======================= */
function devicesPage(){
  var rows=DEV.slice(),q=S.q.toLowerCase();
  if(S.data==="zero"||S.data==="nomatch")rows=[];
  else if(q)rows=rows.filter(function(d){return (d.name+d.os+d.owner+d.mac).toLowerCase().indexOf(q)>=0;});
  var total=rows.length?(q?rows.length:775):0;
  var n=selIds().length,pend=6;
  var html='<div class="pad phead"><div><h1>Devices</h1><p>'+
    (total?"775 total · 6 pending approval · 7 failing posture":"Nothing registered yet")+
    '</p></div><div class="acts"><button class="btn">'+ic("i-dl")+'CSV</button>'+
    '<button class="btn btn-primary" id="apprBtn">'+ic("i-check")+'Approve '+pend+' pending</button></div></div>';
  html+=strip(searchBox("Search devices, owners or MAC")+
    '<button class="chip">OS <b>All</b></button><button class="chip">Posture <b>Any</b></button>'+
    '<button class="chip">State <b>Any</b></button>'+
    (n?'<span class="selnote">'+n+' selected</span>':"")+'<span class="spacer"></span>'+
    '<button class="btn btn-quiet">Bulk operations</button>'+
    '<button class="btn btn-danger" id="delBtn"'+(n?"":" disabled")+'>'+ic("i-trash")+'Remove</button>');
  if(!rows.length){
    html+=(q||S.data==="nomatch")
      ? zero("i-search","No devices match “"+esc(q||"zz-no-match")+"”","Try a shorter term, or clear the search.",
          '<button class="btn" id="clrBtn">Clear search</button>')
      : zero("i-laptop","No devices registered yet",
          "A device appears here the first time someone signs in with the agent installed. There is nothing to do until then.",
          '<button class="btn" id="dlBtn">Download the agent</button>');
  }else{
    var slice=rows.slice(0,S.pageSize);
    html+='<table><thead><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>'+
     '<th>Device</th><th>Operating system</th><th>Owner</th><th>MAC address</th><th>Posture</th><th>State</th><th>Last seen</th><th></th>'+
     '</tr></thead><tbody>';
    slice.forEach(function(d){
      html+='<tr'+(S.sel[d.id]?' class="sel"':'')+' data-id="'+d.id+'">'+
       '<td class="cb"><input type="checkbox" data-cb="'+d.id+'"'+(S.sel[d.id]?" checked":"")+' aria-label="Select '+esc(d.name)+'"></td>'+
       '<td><b style="font-weight:450">'+esc(d.name)+'</b></td><td class="uname">'+esc(d.os)+'</td>'+
       '<td class="uname">'+esc(d.owner)+'</td><td class="tech">'+esc(d.mac)+'</td>'+
       '<td>'+(d.posture==="Passed"?quiet("Passed"):pill("att","Failed",1))+'</td>'+
       '<td>'+(d.state==="Approved"?quiet("Approved"):pill("att","Pending",1))+'</td>'+
       '<td class="quiet">'+esc(d.seen)+'</td>'+
       '<td style="text-align:right"><button class="rowbtn" data-menu="'+d.id+'" aria-label="Row actions">'+ic("i-dots")+'</button></td></tr>';
    });
    html+='</tbody></table>'+tfoot(total,slice.length);
  }
  return html;
}

/* ======================= access rules ======================= */
function rulesPage(){
  var rows=RULES.slice(),q=S.q.toLowerCase();
  if(S.data==="zero"||S.data==="nomatch")rows=[];
  else if(q)rows=rows.filter(function(r){return (r.name+r.source+r.dest).toLowerCase().indexOf(q)>=0;});
  var total=rows.length?(q?rows.length:57):0;
  var n=selIds().length;
  var html='<div class="pad phead"><div><h1>Access rules</h1><p>'+
    (total?"57 rules · 48 allow · 6 deny · 3 bypass":"No traffic is permitted yet")+
    '</p></div><div class="acts"><button class="btn">'+ic("i-dl")+'CSV</button>'+
    '<button class="btn btn-primary" id="addBtn">'+ic("i-plus")+'Add rule</button></div></div>';
  html+=strip(searchBox("Search rules, sources or destinations")+
    '<button class="chip">Action <b>Any</b></button><button class="chip">Source type <b>All</b></button>'+
    (n?'<span class="selnote">'+n+' selected</span>':"")+'<span class="spacer"></span>'+
    '<button class="btn btn-quiet">Bulk operations</button>'+
    '<button class="btn btn-danger" id="delBtn"'+(n?"":" disabled")+'>'+ic("i-trash")+'Delete</button>');
  if(!rows.length){
    html+=(q||S.data==="nomatch")
      ? zero("i-search","No rules match “"+esc(q||"zz-no-match")+"”","Try a shorter term, or clear the search.",
          '<button class="btn" id="clrBtn">Clear search</button>')
      : zero("i-key","Create your first access rule",
          "Nobody can reach anything until a rule allows it. A rule connects a source — a user, a group or an application — to a destination.",
          '<button class="btn btn-primary" id="addBtn2">'+ic("i-plus")+'Add rule</button>');
  }else{
    var slice=rows.slice(0,S.pageSize);
    html+='<table><thead><tr><th class="cb"><input type="checkbox" id="allcb" aria-label="Select all"></th>'+
     '<th>Rule</th><th>Source type</th><th>Source</th><th>Destination type</th><th>Destination</th><th>Action</th><th></th>'+
     '</tr></thead><tbody>';
    slice.forEach(function(r){
      html+='<tr'+(S.sel[r.id]?' class="sel"':'')+' data-id="'+r.id+'">'+
       '<td class="cb"><input type="checkbox" data-cb="'+r.id+'"'+(S.sel[r.id]?" checked":"")+' aria-label="Select '+esc(r.name)+'"></td>'+
       '<td><b style="font-weight:450">'+esc(r.name)+'</b></td><td class="uname">'+esc(r.src)+'</td>'+
       '<td class="uname">'+esc(r.source)+'</td><td class="uname">'+esc(r.dst)+'</td><td class="uname">'+esc(r.dest)+'</td>'+
       '<td>'+(r.act==="Allow"?quiet("Allow"):pill("att",r.act,1))+'</td>'+
       '<td style="text-align:right"><button class="rowbtn" data-menu="'+r.id+'" aria-label="Row actions">'+ic("i-dots")+'</button></td></tr>';
    });
    html+='</tbody></table>'+tfoot(total,slice.length);
  }
  return html;
}

/* ======================= dashboard ======================= */
function bars(rows){return rows.map(function(r,i){
  return '<div class="barrow"><span>'+esc(r[0])+'</span><span class="bartrack">'+
   '<span class="barfill'+(i?" s"+(i+1):"")+'" style="width:'+r[2]+'%"></span></span>'+
   '<span class="barval">'+r[1]+'</span></div>';}).join("");}
function dashboard(){
  if(S.data==="zero"){
    return '<div class="pad phead"><div><h1>Dashboard</h1><p>veno.instasafe.com · nothing configured yet</p></div></div>'+
      zero("i-gauge","Your tenant is empty",
       "Connect a gateway, add your first users and write an access rule. The dashboard fills in as each piece lands.",
       '<button class="btn btn-primary" id="qsBtn">'+ic("i-check")+'Open the setup checklist</button>');
  }
  var spark=[14,20,17,26,22,31,27,35,30,38,34,41,37,44,40,47,52,49,44,51,58,54,49,46];
  var mx=Math.max.apply(null,spark);
  return '<div class="pad phead"><div><h1>Dashboard</h1>'+
   '<p>veno.instasafe.com · 1,820 users · 775 devices · 4 gateways</p></div>'+
   '<div class="acts"><button class="btn">'+ic("i-dl")+'Export</button></div></div>'+
   '<div class="pad band"><span class="fdot"></span><div><h2>Two things need your attention</h2>'+
   '<div class="sub">Everything else is healthy. Four gateways reachable, nothing blocked today.</div></div>'+
   '<div class="bandacts">'+
   '<button class="ba" id="baDev"><span class="n">6</span><span class="l">Devices pending<span>oldest 6 days</span></span></button>'+
   '<button class="ba" id="baMfa"><span class="n">11</span><span class="l">Users without MFA<span>mostly Local profile</span></span></button>'+
   '<button class="btn" id="baBoth">Review both</button></div></div>'+
   '<div class="pad stats">'+
   '<div class="stat"><div class="sl">Online gateways</div><div class="sv">4<i>&thinsp;/&thinsp;4</i></div><div class="sm">All reachable</div></div>'+
   '<div class="stat"><div class="sl">Online users</div><div class="sv">318<i>&thinsp;/&thinsp;1,820</i></div><div class="sm">17% connected now</div></div>'+
   '<div class="stat"><div class="sl">Licences used</div><div class="sv">1,820<i>&thinsp;/&thinsp;2,000</i></div><div class="sm">180 remaining</div></div>'+
   '<div class="stat"><div class="sl">Subscription renews</div><div class="sv">31 Dec 2026</div><div class="sm">103 days</div></div>'+
   '</div>'+
   '<div class="pad cols"><div class="col">'+
   '<div class="chead"><h3>Devices by operating system</h3><span class="hint">All time</span></div>'+
   bars([["Windows 11",402,100],["macOS 15",186,46],["Ubuntu 24.04",104,26],["Android 15",83,21]])+
   '</div><div class="col">'+
   '<div class="chead"><h3>Sessions today</h3><span class="hint">Hourly · peak 58</span></div>'+
   '<div class="sparkwrap">'+spark.map(function(v,i){
     return '<span class="'+(v===mx?"hi":"")+'" style="height:'+Math.round(v/mx*100)+'%"></span>';}).join("")+'</div>'+
   '<div style="display:flex;justify-content:space-between;color:var(--mute);font-size:11px;margin-top:7px">'+
   '<span>00:00</span><span>12:00</span><span>23:00</span></div>'+
   '</div></div>'+
   '<div class="pad cols"><div class="col">'+
   '<div class="chead"><h3>Top denied destinations</h3><span class="hint">Today</span></div>'+
   bars([["reports-db",14,100],["finance-rdp",9,64],["payroll-web",5,36],["code-server",2,14]])+
   '</div><div class="col">'+
   '<div class="chead"><h3>Top blocked services</h3><span class="hint">Today</span></div>'+
   '<div class="zero" style="padding:30px 12px 6px"><div class="zi">'+ic("i-shield")+'</div>'+
   '<h3>Nothing blocked today</h3><p>No traffic hit a block rule in this window. That is the healthy state.</p></div>'+
   '</div></div>';
}

/* ======================= asset inventory ======================= */
function assetsPage(){
  if(S.data==="zero")return '<div class="pad phead"><div><h1>Asset inventory</h1><p>No devices yet</p></div></div>'+
    zero("i-pie","Nothing to inventory yet","Asset inventory summarises the devices your users register. It fills in automatically once devices appear.",
      '<button class="btn" id="dlBtn">Download the agent</button>');
  var man=[["Dell Inc.",219,100],["HP",143,65],["Apple",134,61],["LENOVO",56,26],["ASUSTeK",50,23],["realme",33,15]];
  var age=[["Under 1 year",204,100],["1–2 years",286,100],["2–3 years",171,60],["Over 3 years",114,40]];
  return '<div class="pad phead"><div><h1>Asset inventory</h1><p>775 devices · 17 manufacturers · 6 operating systems</p></div>'+
   '<div class="acts"><button class="btn">'+ic("i-dl")+'Export</button></div></div>'+
   '<div class="pad stats">'+
   '<div class="stat"><div class="sl">Devices</div><div class="sv">775</div><div class="sm">Across 4 regions</div></div>'+
   '<div class="stat"><div class="sl">Disk encrypted</div><div class="sv">712<i>&thinsp;/&thinsp;775</i></div><div class="sm">63 unencrypted</div></div>'+
   '<div class="stat"><div class="sl">Average age</div><div class="sv">2.1<i>&thinsp;yrs</i></div><div class="sm">114 over 3 years</div></div>'+
   '<div class="stat"><div class="sl">Out of support</div><div class="sv">28</div><div class="sm">OS past end-of-service</div></div>'+
   '</div>'+
   '<div class="pad cols"><div class="col"><div class="chead"><h3>By manufacturer</h3><span class="hint">765 reporting</span></div>'+
   bars(man)+'</div><div class="col"><div class="chead"><h3>By asset age</h3><span class="hint">775 devices</span></div>'+
   bars(age)+'</div></div>';
}

/* ======================= settings-style pages ======================= */
function frow(label,help,ctl,bad){
  return '<div class="frow'+(bad?" bad":"")+'"><div class="lb"><label>'+esc(label)+'</label>'+
   (help?'<div class="h">'+esc(help)+'</div>':"")+'</div><div class="ctl">'+ctl+'</div></div>';
}
function swrow(label,help,on,key){
  return '<div class="frow"><div class="lb"><label>'+esc(label)+'</label>'+
   (help?'<div class="h">'+esc(help)+'</div>':"")+'</div><div class="ctl">'+
   '<button class="sw" role="switch" aria-checked="'+(on?"true":"false")+'" data-sw="'+esc(key||label)+'" aria-label="'+esc(label)+'"></button></div></div>';
}
function settingsPage(){
  return '<div class="pad phead"><div><h1>User settings</h1><p>Tenant-wide defaults. A group or an individual user can override most of these.</p></div>'+
   '<div class="acts"><button class="btn btn-quiet">Discard</button><button class="btn btn-primary">Save changes</button></div></div>'+
   '<div class="pad">'+
   '<div class="formsec"><h3>Notifications</h3><p class="d">Who hears about provisioning and posture events.</p>'+
   swrow("Welcome email to directory users","Sent when a user is provisioned from Active Directory or Azure AD.",true,"n1")+
   swrow("Welcome email to bulk-imported users","Sent when users arrive through a CSV import.",true,"n2")+
   swrow("Notify sub-admins on device approval","Every sub-admin with Devices write access is emailed.",false,"n3")+
   swrow("Notify users on device check failure","The user is told which check failed and how to fix it.",true,"n4")+
   '</div>'+
   '<div class="formsec"><h3>Inactive users</h3><p class="d">Accounts that stop signing in are handled automatically.</p>'+
   frow("Warn after","Days of inactivity before the user is emailed.",'<div class="duo"><input type="text" value="60"><span style="align-self:center;color:var(--mute);font-size:12.5px">days</span></div>')+
   frow("Suspend after","Access is revoked. The account and its rules are kept.",'<div class="duo"><input type="text" value="90"><span style="align-self:center;color:var(--mute);font-size:12.5px">days</span></div>')+
   frow("Delete after","The account is removed. This cannot be undone.",'<div class="duo"><input type="text" value="180"><span style="align-self:center;color:var(--mute);font-size:12.5px">days</span></div>')+
   '</div>'+
   '<div class="formsec"><h3>Access controls</h3><p class="d">Where and how people may connect.</p>'+
   frow("Bypass MFA from these public IPs","One address or CIDR range per line. Leave empty to require MFA everywhere.",'<textarea placeholder="203.0.113.0/24"></textarea>')+
   frow("Limit admin access to these IPs","Administrators signing in from anywhere else are refused.",'<textarea placeholder="Leave empty to allow any address"></textarea>')+
   swrow("Require device compliance for web access","Browser sessions must come from a device that passes its checks.",true,"a1")+
   swrow("Allow web-based elevated access","Lets an administrator raise privileges from the browser rather than the agent.",false,"a2")+
   '</div>'+
   '<div class="formsec" style="border-bottom:0"><h3>Session limits</h3><p class="d">How long a connection may stay open.</p>'+
   frow("Disconnect agent after","Hard cap on a single connection, regardless of activity.",'<div class="duo"><input type="text" value="12"><span style="align-self:center;color:var(--mute);font-size:12.5px">hours</span></div>')+
   frow("Idle timeout","No traffic for this long and the tunnel closes.",'<div class="duo"><input type="text" value="30"><span style="align-self:center;color:var(--mute);font-size:12.5px">minutes</span></div>')+
   frow("Portal session timeout","Applies to this console, not to the agent.",'<div class="duo"><input type="text" value="3"><span style="align-self:center;color:var(--mute);font-size:12.5px">hours</span></div>')+
   '</div></div>';
}
function companyPage(){
  return '<div class="pad phead"><div><h1>Company details</h1><p>Shown to your users on the sign-in page and in emails.</p></div>'+
   '<div class="acts"><button class="btn btn-quiet">Discard</button><button class="btn btn-primary">Save changes</button></div></div>'+
   '<div class="pad">'+
   '<div class="formsec"><h3>Identity</h3><p class="d">How the tenant is named and reached.</p>'+
   frow("Company name",null,'<input type="text" value="Veno Technologies">')+
   frow("Secure Access URL","The address your users sign in at. Changing it invalidates existing agent configurations.",'<input type="text" value="veno.instasafe.com">')+
   frow("Registered address",null,'<textarea>4th Floor, Prestige Tech Park\nBengaluru 560103</textarea>')+
   '</div>'+
   '<div class="formsec"><h3>Branding</h3><p class="d">Applied to the sign-in page and the user portal.</p>'+
   frow("Logo","SVG or PNG, at least 200×50. Shown on a white ground.",'<button class="btn">'+ic("i-dl")+'Upload file</button>')+
   frow("Sign-in background","JPEG or PNG, at least 1920×1080.",'<button class="btn">'+ic("i-dl")+'Upload file</button>')+
   swrow("Show welcome banner","A dismissible message on the user portal.",true,"b1")+
   '</div>'+
   '<div class="formsec" style="border-bottom:0"><h3>Contacts</h3><p class="d">Where InstaSafe reaches you about renewals and incidents.</p>'+
   frow("Business contact",null,'<input type="text" value="Debajyoti Darshan · admin@example.com">')+
   frow("Technical contact",null,'<input type="text" value="Alen Joseph · alen.joseph@instasafe.com">')+
   frow("Renewal contact",null,'<input type="text" value="Not set" placeholder="Name · email">')+
   '</div></div>';
}
function rolesPage(){
  var AREAS=[
   ["Infrastructure",["Controllers","Gateways"]],
   ["Identity",["Users","User groups","Authentication profiles","User providers"]],
   ["Security",["Devices","Device policies","Device checks","Geofences","Blocked apps"]],
   ["Access",["Applications","Application groups","Access rules","Filters"]],
   ["Monitoring",["Logs & reports","Report subscriptions","Export logs"]],
   ["Administration",["Company settings","User settings","Sub admins"]]];
  var cols=AREAS.map(function(a,ai){
    return '<div class="permcol"><h4>'+esc(a[0])+'</h4>'+a[1].map(function(nm,i){
      var r=(ai+i)%3!==2,w=(ai+i)%4===0;
      return '<div class="permrow"><span>'+esc(nm)+'</span><div class="rw">'+
        '<label><input type="checkbox"'+(r?" checked":"")+'> Read</label>'+
        '<label><input type="checkbox"'+(w?" checked":"")+'> Write</label></div></div>';
    }).join("")+'</div>';}).join("");
  return '<div class="pad phead"><div><h1>Sub admin roles</h1>'+
   '<p>3 roles · rights grouped the same way the navigation is</p></div>'+
   '<div class="acts"><button class="btn btn-quiet">Discard</button><button class="btn btn-primary">Save role</button></div></div>'+
   strip('<button class="chip on">Role <b>Helpdesk tier 1</b></button>'+
     '<button class="chip">Role <b>Security analyst</b></button>'+
     '<button class="chip">Role <b>Read only</b></button><span class="spacer"></span>'+
     '<button class="btn btn-quiet">Duplicate</button><button class="btn" id="addBtn">'+ic("i-plus")+'New role</button>')+
   '<div class="pad"><div class="formsec"><h3>Role</h3><p class="d">Give the role a name a colleague would recognise on the sub-admin list.</p>'+
   frow("Role name",null,'<input type="text" value="Helpdesk tier 1">')+
   frow("Description","Optional. Shown under the name when assigning the role.",'<input type="text" value="Reset passwords, approve devices, read logs">')+
   '</div>'+
   '<div class="formsec" style="border-bottom:0"><h3>Rights</h3>'+
   '<p class="d">Write includes read. 58 individual rights, grouped by the console section they belong to — ' +
   'so a role can be reasoned about a section at a time rather than as one list.</p>'+
   '<div class="permgrid">'+cols+'</div></div></div>';
}
function downloadsPage(){
  var AG=[["Windows","i-laptop","ISA-Agent-Setup-4.8.2.exe","64.2 MB"],
          ["macOS","i-laptop","ISA-Agent-4.8.2.pkg","58.9 MB"],
          ["Linux","i-cpu","isa-agent_4.8.2_amd64.deb","41.3 MB"],
          ["Android","i-laptop","Google Play","—"],
          ["iOS","i-laptop","App Store","—"]];
  return '<div class="pad phead"><div><h1>Downloads</h1><p>Agent 4.8.2 · released 12 Sep 2026</p></div></div>'+
   '<table><thead class="nostrip"><tr><th>Platform</th><th>Package</th><th>Size</th><th>Minimum OS</th><th></th></tr></thead><tbody>'+
   AG.map(function(a,i){return '<tr><td><b style="font-weight:450">'+esc(a[0])+'</b></td>'+
     '<td class="tech">'+esc(a[2])+'</td><td class="tech">'+esc(a[3])+'</td>'+
     '<td class="uname">'+["Windows 10 1909","macOS 12","Ubuntu 20.04","Android 10","iOS 15"][i]+'</td>'+
     '<td style="text-align:right"><button class="btn btn-sm">'+ic("i-dl")+'Download</button></td></tr>';}).join("")+
   '</tbody></table>';
}
function supportPage(){
  return '<div class="pad phead"><div><h1>Tech support</h1><p>Grant InstaSafe engineers time-boxed access to this tenant</p></div>'+
   '<div class="acts"><button class="btn btn-primary" id="addBtn">'+ic("i-plus")+'Grant access</button></div></div>'+
   zero("i-life","No support access granted",
     "Nobody outside your organisation can see this tenant. Grant access only while a ticket is open — every grant expires on its own and is written to the event log.",
     '<button class="btn btn-primary" id="addBtn2">'+ic("i-plus")+'Grant access</button>');
}
function graphPage(){
  return '<div class="pad phead"><div><h1>Graph</h1><p>Relationships between users, groups, devices and applications</p></div>'+
   '<div class="acts"><button class="chip">Live users <b>On</b></button><button class="chip">Live nodes <b>On</b></button>'+
   '<button class="btn">Update graph</button></div></div>'+
   zero("i-chart","The graph renders in the browser",
     "This view draws 1,820 users, 775 devices and 57 rules as a force-directed graph. It is a WebGL canvas and is out of scope for this prototype — the surrounding chrome, filters and controls are the part being designed here.","");
}
function genericEmpty(title,obj,body){
  return '<div class="pad phead"><div><h1>'+esc(title)+'</h1><p>Nothing configured yet</p></div>'+
   '<div class="acts"><button class="btn btn-primary" id="addBtn">'+ic("i-plus")+'Add '+esc(obj)+'</button></div></div>'+
   zero("i-grid","Add your first "+esc(obj),body,
     '<button class="btn btn-primary" id="addBtn2">'+ic("i-plus")+'Add '+esc(obj)+'</button>');
}

/* ======================= user sheet ======================= */
var F={};
function resetForm(u){
  F={_id:u?u.id:"new",first:u?(u.first||""):"",last:u?(u.last||""):"",u:u?(u.u||u.username||""):"",
     email:u?(u.email||""):"",cc:u?(u.cc||"+91"):"+91",mobile:u?(u.mobile||""):"",loc:u?(u.loc||""):"",
     auth:u?(u.auth||"Password + Certs"):"Password + Certs",act:u?(u.act||"Immediately on provisioning"):"Immediately on provisioning",
     pwd:"",pwd2:"",mfa:u?!!u.mfa:true,binding:true,checks:false,geo:false,dlp:false,shift:false,risk:false,suspend:false};
}
var ERR={};
function sheetHTML(){
  var mode=S.sheet,u=S.editing;
  if(mode==="view"&&u){
    var rows=[["Name",(u.first||"")+" "+(u.last||"")||u.n],["Username",u.u||u.username],["Email",u.email],
      ["Mobile",(u.cc||"")+" "+(u.mobile||"")],["Location",u.loc],["Auth profile",u.p||"Local"],
      ["Authentication type",u.auth],["Activation",u.act],["MFA",u.mfa?"Enrolled":"Not enrolled"],
      ["Status",u.s||"Active"],["Last IP",u.ip],["Last seen",u.seen]];
    return '<div class="sheeth"><h2>'+esc(u.n||((u.first||"")+" "+(u.last||"")))+'</h2>'+
      '<button class="tbtn" id="sx" style="margin-left:auto" aria-label="Close">'+ic("i-x")+'</button></div>'+
      '<div class="sheetb"><dl style="margin:0">'+rows.map(function(r){
        return '<div class="readrow"><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1]||"—")+'</dd></div>';}).join("")+'</dl></div>'+
      '<div class="sheetf"><button class="btn btn-primary" id="sEdit">Edit user</button>'+
      '<button class="btn btn-quiet sp" id="sClose">Close</button></div>';
  }
  var editing=mode==="edit";
  var t=S.tab,body="";
  if(t===0){
    body+=frow("First name",null,'<input type="text" id="f_first" value="'+esc(F.first)+'">',ERR.first)+
      (ERR.first?'':'');
    body=body.replace('</div></div>',(ERR.first?'<div class="err">'+esc(ERR.first)+'</div>':'')+'</div></div>');
    body+=frow("Last name",null,'<input type="text" id="f_last" value="'+esc(F.last)+'">');
    body+='<div class="frow'+(ERR.u?" bad":"")+'"><div class="lb"><label>Username</label>'+
      '<div class="h">What the user signs in with. It cannot be changed later.</div></div>'+
      '<div class="ctl"><input type="text" id="f_u" value="'+esc(F.u)+'">'+
      '<div class="err">'+esc(ERR.u||"")+'</div></div></div>';
    body+='<div class="frow'+(ERR.email?" bad":"")+'"><div class="lb"><label>Email</label></div>'+
      '<div class="ctl"><input type="email" id="f_email" value="'+esc(F.email)+'">'+
      '<div class="err">'+esc(ERR.email||"")+'</div></div></div>';
    body+='<div class="frow'+(ERR.mobile?" bad":"")+'"><div class="lb"><label>Mobile number</label>'+
      '<div class="h">Used for OTP delivery when MFA is on.</div></div><div class="ctl">'+
      '<div class="duo"><select id="f_cc">'+["+91 India","+1 US","+44 UK","+61 AU","+65 SG"].map(function(c){
        var code=c.split(" ")[0];return '<option value="'+code+'"'+(F.cc===code?" selected":"")+'>'+esc(c)+'</option>';}).join("")+
      '</select><input type="tel" id="f_mobile" value="'+esc(F.mobile)+'"></div>'+
      '<div class="err">'+esc(ERR.mobile||"")+'</div></div></div>';
    body+=frow("Location",null,'<input type="text" id="f_loc" value="'+esc(F.loc)+'">');
    body+=frow("Authentication type","Certificate alone is passwordless.",
      '<select id="f_auth">'+["Password + Certs","Certificate"].map(function(o){
        return '<option'+(F.auth===o?" selected":"")+'>'+esc(o)+'</option>';}).join("")+'</select>');
    body+=frow("Activation","When the account becomes usable.",
      '<select id="f_act">'+["Immediately on provisioning","Automatically on first login","On date & time"].map(function(o){
        return '<option'+(F.act===o?" selected":"")+'>'+esc(o)+'</option>';}).join("")+'</select>');
    if(!editing){
      body+='<div class="frow'+(ERR.pwd?" bad":"")+'"><div class="lb"><label>Password</label>'+
        '<div class="h">8–32 characters with a number, an uppercase letter and one of !@#$%^&amp;* — the policy set under Authentication profiles → Local.</div></div>'+
        '<div class="ctl"><input type="password" id="f_pwd" value="'+esc(F.pwd)+'" autocomplete="new-password">'+
        '<div class="err">'+esc(ERR.pwd||"")+'</div></div></div>';
      body+='<div class="frow'+(ERR.pwd2?" bad":"")+'"><div class="lb"><label>Confirm password</label></div>'+
        '<div class="ctl"><input type="password" id="f_pwd2" value="'+esc(F.pwd2)+'" autocomplete="new-password">'+
        '<div class="err">'+esc(ERR.pwd2||"")+'</div></div></div>';
    }
  }else if(t===1){
    body+=swrow("Two-factor authentication","OTP or authenticator app at sign-in.",F.mfa,"mfa");
    body+=swrow("Device binding","Restrict this user to devices they have registered.",F.binding,"binding");
    body+=swrow("Device checks","Require posture checks to pass before access is granted.",F.checks,"checks");
    body+=swrow("Geo binding","Restrict sign-in to approved countries.",F.geo,"geo");
    body+=swrow("Device DLP","Block copy, paste and downloads inside sessions.",F.dlp,"dlp");
  }else{
    body+='<p class="d" style="color:var(--mute);font-size:12.5px;margin:16px 0 4px">'+
      'These reference objects created elsewhere in the console. A group the user belongs to can also set them.</p>';
    body+=swrow("Shift schedule","Limit access to a defined working window.",F.shift,"shift");
    body+=swrow("Risk profile","Apply an automated action when risk is detected.",F.risk,"risk");
    body+=swrow("Auto-suspend","Suspend the account after a period of inactivity.",F.suspend,"suspend");
  }
  return '<div class="sheeth"><h2>'+(editing?"Edit user":"Add user")+'</h2>'+
    '<button class="tbtn" id="sx" style="margin-left:auto" aria-label="Close">'+ic("i-x")+'</button></div>'+
    '<div class="sheetb"><div class="tabs" role="tablist">'+
    ["Profile","Options","Advanced"].map(function(n,i){
      return '<button class="tab" role="tab" data-tab="'+i+'" aria-selected="'+(t===i?"true":"false")+'">'+n+'</button>';}).join("")+
    '</div>'+body+'<div style="height:24px"></div></div>'+
    '<div class="sheetf"><button class="btn btn-primary" id="sSave">'+(editing?"Save changes":"Create user")+'</button>'+
    '<button class="btn btn-quiet" id="sReset">Reset</button>'+
    '<button class="btn btn-quiet sp" id="sCancel">Cancel</button></div>';
}
function readForm(){
  function v(id){var e=document.getElementById(id);return e?e.value:"";}
  if(S.tab===0){F.first=v("f_first");F.last=v("f_last");F.u=v("f_u");F.email=v("f_email");
    F.cc=v("f_cc")||F.cc;F.mobile=v("f_mobile");F.loc=v("f_loc");F.auth=v("f_auth")||F.auth;F.act=v("f_act")||F.act;
    F.pwd=v("f_pwd");F.pwd2=v("f_pwd2");}
}
function saveUser(){
  readForm();ERR={};
  var editing=S.sheet==="edit";
  if(!F.first.trim())ERR.first="Enter a first name.";
  if(!F.u.trim())ERR.u="Enter a username.";
  else if(userList().some(function(x){return (x.u||x.username)===F.u.trim()&&(!S.editing||x.id!==S.editing.id);}))
    ERR.u="That username is taken. Try "+F.u.trim()+"2.";
  if(!F.email.trim())ERR.email="Enter an email address.";
  else if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(F.email.trim()))ERR.email="That is not a valid email address.";
  if(!F.mobile.trim())ERR.mobile="Enter a mobile number.";
  if(!editing){
    if(!F.pwd)ERR.pwd="Enter a password.";
    else if(F.pwd.length<8)ERR.pwd="At least 8 characters.";
    else if(!/[0-9]/.test(F.pwd)||!/[A-Z]/.test(F.pwd)||!/[!@#$%^&*]/.test(F.pwd))
      ERR.pwd="Needs a number, an uppercase letter and one of !@#$%^&*";
    if(F.pwd2!==F.pwd)ERR.pwd2="The two passwords do not match.";
  }
  var bad=Object.keys(ERR);
  if(bad.length){S.tab=0;renderSheet();
    setTimeout(function(){var e=document.getElementById("f_"+(bad[0]==="u"?"u":bad[0]));if(e)e.focus();},30);
    toast("Check the form",bad.length===1?ERR[bad[0]]:bad.length+" fields need attention.","bad");return;}
  if(editing){toast("Not saved","Editing a seeded record is out of scope for Version A. Creating a user does persist.","att");
    S.sheet=null;S.editing=null;render();return;}
  var rec={first:F.first.trim(),last:F.last.trim(),n:(F.first.trim()+" "+F.last.trim()).trim(),
    u:F.u.trim(),email:F.email.trim(),cc:F.cc,mobile:F.mobile.trim(),loc:F.loc.trim(),
    auth:F.auth,act:F.act,p:"Local",s:"Active",mfa:!!F.mfa,ip:"—",seen:"never"};
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
    S.sheet=null;S.editing=null;S.pageIdx=0;render();
    toast("User created","“"+rec.n+"” was added and can sign in immediately.","ok");
  });
}
function renderSheet(){
  var l=document.getElementById("layer");
  if(!S.sheet){l.innerHTML="";return;}
  l.innerHTML='<div class="scrim" id="scrim"></div><aside class="sheet" role="dialog" aria-modal="true">'+sheetHTML()+'</aside>';
  document.getElementById("scrim").onclick=function(){S.sheet=null;S.editing=null;render();};
  var q=function(id){return document.getElementById(id);};
  if(q("sx"))q("sx").onclick=function(){S.sheet=null;S.editing=null;render();};
  if(q("sClose"))q("sClose").onclick=function(){S.sheet=null;S.editing=null;render();};
  if(q("sCancel"))q("sCancel").onclick=function(){S.sheet=null;S.editing=null;render();};
  if(q("sEdit"))q("sEdit").onclick=function(){resetForm(S.editing);S.sheet="edit";S.tab=0;renderSheet();};
  if(q("sSave"))q("sSave").onclick=saveUser;
  if(q("sReset"))q("sReset").onclick=function(){resetForm(S.sheet==="edit"?S.editing:null);ERR={};renderSheet();
    toast("Form cleared","All entered values were reset.","att");};
  l.querySelectorAll("[data-tab]").forEach(function(b){
    b.onclick=function(){readForm();S.tab=+b.getAttribute("data-tab");renderSheet();};});
  l.querySelectorAll("[data-sw]").forEach(function(b){
    b.onclick=function(){var k=b.getAttribute("data-sw");F[k]=!F[k];b.setAttribute("aria-checked",F[k]?"true":"false");};});
}

/* ======================= modals / menus ======================= */
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
  var l=document.getElementById("layer");
  var r=btn.getBoundingClientRect();
  l.innerHTML='<div class="menu" style="top:'+(r.bottom+6)+'px;left:'+Math.max(8,r.right-190)+'px">'+
   '<button data-m="view">'+ic("i-edit")+'View details</button>'+
   '<button data-m="edit">'+ic("i-edit")+'Edit</button>'+
   '<hr><button data-m="del" class="dz">'+ic("i-trash")+'Delete</button></div>';
  S.menu=id;
  var close=function(e){if(!e||!e.target.closest(".menu")){closeLayer();document.removeEventListener("mousedown",close);}};
  setTimeout(function(){document.addEventListener("mousedown",close);},0);
  l.querySelectorAll("[data-m]").forEach(function(b){
    b.onclick=function(){
      var act=b.getAttribute("data-m");closeLayer();
      var u=userList().filter(function(x){return x.id===id;})[0];
      if(act==="view"&&u){S.editing=u;S.sheet="view";renderSheet();}
      else if(act==="edit"&&u){S.editing=u;resetForm(u);S.sheet="edit";S.tab=0;renderSheet();}
      else if(act==="del"){
        var nm=u?(u.n||(u.first+" "+u.last)):id;
        confirmDelete("user",[nm],function(){doDelete([id]);});
      }};});
}
function doDelete(ids){
  var seeds=ids.filter(function(i){return S.db?String(i).charAt(0)==="u":true;});
  ids.forEach(function(i){if(String(i).charAt(0)==="u")S.hidden[i]=1;});
  ls("hidden",S.hidden);
  var mine=ids.filter(function(i){return String(i).charAt(0)!=="u";});
  var done=function(){S.sel={};render();toast("Deleted",ids.length===1?"The record was removed.":ids.length+" records were removed.","ok");};
  if(mine.length&&S.db)Promise.all(mine.map(function(i){return S.db.collection("tenant_users").doc(i).delete();})).then(done).catch(done);
  else{S.added=S.added.filter(function(u){return mine.indexOf(u.id)<0;});ls("added",S.added);done();}
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

/* ======================= render ======================= */
var PAGES={dashboard:dashboard,assets:assetsPage,graph:graphPage,users:usersPage,devices:devicesPage,
  rules:rulesPage,settings:settingsPage,company:companyPage,subroles:rolesPage,downloads:downloadsPage,support:supportPage};
function pageHTML(){
 if(S.page==="signin")return signinPage();
  if(PAGES[S.page])return PAGES[S.page]();
  if(LISTS[S.page])return listPage(S.page);
  var M={controllers:["Controllers","controller","A controller is the policy engine that decides whether a session is allowed. Most tenants run one per region."],
   gateways:["Gateways","gateway","A gateway is the data-plane node your users connect through. Deploy one close to the applications it fronts."],
   local:["Local profile","setting","Local accounts are created directly in this console rather than coming from a directory."],
   ad:["Active Directory","directory","Connect an Active Directory forest and let it provision users and groups automatically."],
   saml:["SAML","profile","Let users sign in with an external identity provider over SAML 2.0."],
   oauth:["OAuth","profile","Let users sign in with an OAuth 2.0 provider such as Google or Azure."],
   subscription:["Subscription","plan","Licence count, renewal date and usage history for this tenant."],
   smtp:["Email settings","server","The SMTP server InstaSafe uses to send welcome emails, OTPs and alerts on your behalf."],
   shifts:["Shift schedules","schedule","A shift schedule limits when a user or group may connect — nights, weekdays, a maintenance window."],
   risk:["Risk profiles","risk profile","A risk profile watches for anomalies and applies an action automatically: email an admin, deny access, suspend the user."],
   geo:["Geofences","geofence","A geofence is a mapped area. Combine it with geo binding to limit where a user may connect from."],
   content:["Content filter","content filter","Block whole categories of destination rather than naming individual sites."],
   domains:["Domain lists","domain list","A reusable list of domains you can point several access rules at."],
   appsvc:["Application services","application service","A service is a protocol and port pairing — the transport half of an application definition."],
   appgroups:["Application groups","application group","Bundle applications so an access rule can grant all of them at once."],
   live:["Live users","",""],sessionlog:["Session log","",""],accesslog:["Access log","",""]};
  var m=M[S.page];
  if(!m)return genericEmpty("Not built","item","This page is not part of Version A.");
  if(!m[1])return '<div class="pad phead"><div><h1>'+esc(m[0])+'</h1><p>Rendered through the shared log template</p></div>'+
    '<div class="acts"><button class="btn">'+ic("i-dl")+'CSV</button></div></div>'+
    strip(searchBox("Search "+m[0].toLowerCase())+'<button class="chip on">Range <b>Today</b></button><span class="spacer"></span>')+
    zero("i-chart","This log uses the Event log layout",
      "Every log and report in the console renders through one template. Open Monitoring → Event log to see it with rows.",
      '<button class="btn" id="elBtn">Open Event log</button>');
  return genericEmpty(m[0],m[1],m[2]);
}
function renderNav(){
  var w=document.getElementById("nav");w.innerHTML="";
  NAV.forEach(function(g){
    var s=document.createElement("div");s.className="navsec";s.textContent=g.sec;w.appendChild(s);
    g.items.forEach(function(it){
      if(!it.kids){
        var b=document.createElement("button");b.className="navitem";
        b.innerHTML=ic(it.i)+"<span>"+esc(it.l)+"</span>"+(it.n?'<span class="cnt">'+it.n.toLocaleString()+'</span>':"");
        if(S.page===it.id)b.setAttribute("aria-current","page");
        b.onclick=function(){go(it.id);};w.appendChild(b);return;
      }
      var open=it.kids.some(function(k){return k[0]===S.page;})||lg("op:"+it.id,false);
      var t=document.createElement("button");t.className="navitem";
      t.setAttribute("aria-expanded",open?"true":"false");
      t.innerHTML=ic(it.i)+"<span>"+esc(it.l)+"</span>"+'<svg class="car"><use href="#i-r"/></svg>';
      var sub=document.createElement("div");sub.style.display=open?"block":"none";
      t.onclick=function(){var o=t.getAttribute("aria-expanded")==="true";
        t.setAttribute("aria-expanded",o?"false":"true");sub.style.display=o?"none":"block";ls("op:"+it.id,!o);};
      w.appendChild(t);
      it.kids.forEach(function(k){
        var b2=document.createElement("button");b2.className="subitem";
        b2.innerHTML="<span>"+esc(k[1])+"</span>"+(k[2]!==undefined?'<span class="cnt">'+k[2].toLocaleString()+'</span>':"");
        if(S.page===k[0])b2.setAttribute("aria-current","page");
        b2.onclick=function(){go(k[0]);};sub.appendChild(b2);});
      w.appendChild(sub);
    });
  });
}
function go(id){S.page=id;S.q="";S.sel={};S.pageIdx=0;S.sheet=null;S.editing=null;
  ls("page",id);document.getElementById("rail").classList.remove("on");render();syncRail();}

function render(){
  if(S.page==="signin")document.documentElement.setAttribute("data-signin","1");else document.documentElement.removeAttribute("data-signin");
  renderNav();
  document.getElementById("crumb").innerHTML=(CRUMB[S.page]||"").split("›").map(function(p,i,a){
    return i===a.length-1?esc(p.trim()):esc(p.trim());}).join(' <b>›</b> ');
 var p=document.getElementById("page");
  p.innerHTML=pageHTML();
  var q=function(id){return document.getElementById(id);};
  if(q("q")){q("q").oninput=function(e){S.q=e.target.value;S.pageIdx=0;S.data="normal";
    var pos=e.target.selectionStart;render();var n=document.getElementById("q");
    if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(x){}}};}
  if(q("clrBtn"))q("clrBtn").onclick=function(){S.q="";S.data="normal";render();syncRail();};
  if(q("addBtn"))q("addBtn").onclick=onAdd;
  if(q("addBtn2"))q("addBtn2").onclick=onAdd;
  if(q("dirBtn"))q("dirBtn").onclick=function(){go("ad");};
  if(q("dlBtn"))q("dlBtn").onclick=function(){go("downloads");};
  if(q("elBtn"))q("elBtn").onclick=function(){go("eventlog");};
  if(q("qsBtn"))q("qsBtn").onclick=function(){toast("Setup checklist","Four steps remain: gateway, directory, applications, first rule.","att");};
  if(q("apprBtn"))q("apprBtn").onclick=function(){
    toast("6 devices approved","They can connect immediately. The action is in the event log.","ok");};
  if(q("baDev"))q("baDev").onclick=function(){go("devices");};
  if(q("baMfa"))q("baMfa").onclick=function(){go("users");};
  if(q("baBoth"))q("baBoth").onclick=function(){go("devices");};
  if(q("psz"))q("psz").onchange=function(e){S.pageSize=+e.target.value;S.pageIdx=0;render();};
  if(q("pprev"))q("pprev").onclick=function(){S.pageIdx--;render();};
  if(q("pnext"))q("pnext").onclick=function(){S.pageIdx++;render();};
  if(q("delBtn"))q("delBtn").onclick=function(){
    var ids=selIds();if(!ids.length)return;
    var noun=S.page==="users"?"user":S.page==="devices"?"device":S.page==="rules"?"access rule":"record";
    var names=ids.map(function(i){
      var u=userList().filter(function(x){return x.id===i;})[0];if(u)return u.n||(u.first+" "+u.last);
      var d=DEV.filter(function(x){return x.id===i;})[0];if(d)return d.name;
      var r=RULES.filter(function(x){return x.id===i;})[0];if(r)return r.name;
      return i;});
    confirmDelete(noun,names,function(){
      if(S.page==="users")doDelete(ids);
      else{S.sel={};render();toast("Deleted",names.length+" "+noun+(names.length>1?"s":"")+" removed.","ok");}});};
  if(q("allcb"))q("allcb").onchange=function(e){
    p.querySelectorAll("[data-cb]").forEach(function(c){S.sel[c.getAttribute("data-cb")]=e.target.checked;});render();};
  p.querySelectorAll("[data-cb]").forEach(function(c){
    c.onchange=function(e){e.stopPropagation();S.sel[c.getAttribute("data-cb")]=c.checked;render();};});
  p.querySelectorAll("[data-menu]").forEach(function(b){
    b.onclick=function(e){e.stopPropagation();rowMenu(b,b.getAttribute("data-menu"));};});
  p.querySelectorAll("[data-user]").forEach(function(tr){
    tr.onclick=function(e){if(e.target.closest("input,button"))return;
      var u=userList().filter(function(x){return x.id===tr.getAttribute("data-user");})[0];
      if(u){S.editing=u;S.sheet="view";renderSheet();}};});
  p.querySelectorAll("[data-sw]").forEach(function(b){
    b.onclick=function(){var on=b.getAttribute("aria-checked")==="true";b.setAttribute("aria-checked",on?"false":"true");};});
  if(document.getElementById("si_go"))document.getElementById("si_go").onclick=function(){go("dashboard");toast("Signed in","Welcome back, Debajyoti.","ok");};
 document.getElementById("main").scrollTop=0;
  renderSheet();
}
function onAdd(){
  if(S.page==="users"){resetForm(null);ERR={};S.sheet="add";S.tab=0;renderSheet();return;}
  toast("Not in Version A","The "+(LISTS[S.page]?LISTS[S.page].obj:"add")+" form is unchanged from production and is out of scope for this reskin. The Users flow is fully working.","att");
}

/* ======================= state rail ======================= */
var R=document.documentElement;
function chipRow(title,list,get,set){
  return '<div class="srg"><div class="t">'+esc(title)+'</div><div class="opts">'+
   list.map(function(o){return '<button class="opt" data-set="'+esc(o[0])+'" aria-pressed="'+(get()===o[0]?"true":"false")+'">'+esc(o[1])+'</button>';}).join("")+
   '</div></div>';
}
function syncRail(){
  var b=document.getElementById("sr2b");
  var theme=R.getAttribute("data-theme")||"light",rail=R.getAttribute("data-rail")||"tint",
      pal=R.getAttribute("data-palette")||"violet";
  b.innerHTML=
   '<div class="srg" data-g="theme"><div class="t">Theme</div><div class="opts">'+
     [["light","Light"],["dark","Dark"]].map(function(o){return '<button class="opt" data-v="'+o[0]+'" aria-pressed="'+(theme===o[0]?"true":"false")+'">'+o[1]+'</button>';}).join("")+'</div></div>'+
   '<div class="srg" data-g="rail"><div class="t">Navigation rail</div><div class="opts">'+
     [["tint","Tint"],["dark","Dark"]].map(function(o){return '<button class="opt" data-v="'+o[0]+'" aria-pressed="'+(rail===o[0]?"true":"false")+'">'+o[1]+'</button>';}).join("")+'</div></div>'+
   '<div class="srg" data-g="palette"><div class="t">Palette</div><div class="opts">'+
     [["violet","Violet · coral"],["ember","Ember · house"]].map(function(o){return '<button class="opt" data-v="'+o[0]+'" aria-pressed="'+(pal===o[0]?"true":"false")+'">'+o[1]+'</button>';}).join("")+'</div>'+
     '<div class="srnote" style="margin-top:9px"><b>Violet · coral</b> is Direction G: violet is interactive, coral is attention. <b>Ember · house</b> swaps in the InstaSafe <code>--db-*</code> black and orange tokens so the two can be compared on the same screens.</div></div>'+
   '<div class="srg" data-g="page"><div class="t">Screen</div><div class="opts">'+
     [["dashboard","Dashboard"],["assets","Asset inventory"],["users","Users"],["devices","Devices"],["rules","Access rules"],
      ["usergroups","User groups"],["applications","Applications"],["devchecks","Device checks"],["eventlog","Event log"],
      ["settings","User settings"],["company","Company details"],["subroles","Sub admin roles"],["downloads","Downloads"],
      ["url","URL filter"],["signin","Sign in"],["blocked","Blocked users"],["support","Tech support"],["graph","Graph"]]
     .map(function(o){return '<button class="opt" data-v="'+o[0]+'" aria-pressed="'+(S.page===o[0]?"true":"false")+'">'+o[1]+'</button>';}).join("")+'</div></div>'+
   '<div class="srg" data-g="data"><div class="t">Data state</div><div class="opts">'+
     [["normal","Populated"],["zero","Nothing configured"],["nomatch","Search finds nothing"]]
     .map(function(o){return '<button class="opt" data-v="'+o[0]+'" aria-pressed="'+(S.data===o[0]?"true":"false")+'">'+o[1]+'</button>';}).join("")+'</div></div>'+
   '<div class="srg" data-g="overlay"><div class="t">Overlay</div><div class="opts">'+
     [["none","None"],["add","Add user"],["view","View user"],["invalid","Validation errors"],["confirm","Delete confirm"],
      ["menu","Row menu"],["toast","Toasts"]]
     .map(function(o){return '<button class="opt" data-v="'+o[0]+'">'+o[1]+'</button>';}).join("")+'</div></div>'+
   '<div class="srg" style="border-bottom:0"><div class="t">Storage</div><div class="srnote">'+esc(storeMsg)+
     '<div style="margin-top:9px"><button class="opt" id="rst">Reset added records</button></div></div></div>';

  b.querySelectorAll("[data-g]").forEach(function(g){
    var kind=g.getAttribute("data-g");
    g.querySelectorAll("[data-v]").forEach(function(btn){
      btn.onclick=function(){
        var v=btn.getAttribute("data-v");
        if(kind==="theme"){R.setAttribute("data-theme",v);ls("theme",v);}
        else if(kind==="rail"){R.setAttribute("data-rail",v);ls("rail",v);}
        else if(kind==="palette"){R.setAttribute("data-palette",v);ls("palette",v);}
        else if(kind==="page"){go(v);return;}
        else if(kind==="data"){S.data=v;S.q="";S.sel={};S.pageIdx=0;render();}
        else if(kind==="overlay"){
          closeLayer();
          if(v==="add"){if(S.page!=="users")S.page="users";resetForm(null);ERR={};S.sheet="add";S.tab=0;render();}
          else if(v==="view"){S.page="users";var u=userList()[0];if(u){S.editing=u;S.sheet="view";}render();}
          else if(v==="invalid"){S.page="users";resetForm(null);F.email="nope";F.pwd="abc";F.pwd2="xyz";
            S.sheet="add";S.tab=0;render();setTimeout(saveUser,60);}
          else if(v==="confirm"){S.page="users";render();
            setTimeout(function(){confirmDelete("user",userList().slice(0,3).map(function(x){return x.n;}),function(){});},60);}
          else if(v==="menu"){S.page="users";render();
            setTimeout(function(){var b2=document.querySelector("[data-menu]");if(b2)rowMenu(b2,b2.getAttribute("data-menu"));},60);}
          else if(v==="toast"){toast("User created","“Priya Nair” was added and can sign in immediately.","ok");
            setTimeout(function(){toast("Gateway unreachable","mum-gw-01 did not answer the last health check.","bad");},350);
            setTimeout(function(){toast("6 devices pending","The oldest has been waiting 6 days.","att");},700);}
          else render();
          syncRail();return;
        }
        syncRail();sync();
      };});
  });
  var r=document.getElementById("rst");
  if(r)r.onclick=function(){
    S.hidden={};ls("hidden",{});
    if(S.db)Promise.all(S.added.map(function(u){return S.db.collection("tenant_users").doc(u.id).delete();}))
      .then(function(){toast("Reset","Added records cleared.","ok");}).catch(function(){});
    else{S.added=[];ls("added",[]);render();toast("Reset","Added records cleared.","ok");}};
}
function sync(){
  document.getElementById("themeLbl").textContent=R.getAttribute("data-theme")==="dark"?"Light":"Dark";
  document.getElementById("railLbl").textContent=R.getAttribute("data-rail")==="dark"?"Tint rail":"Dark rail";
}

/* ======================= wiring ======================= */
R.setAttribute("data-theme",lg("theme","light"));
R.setAttribute("data-rail",lg("rail","tint"));
R.setAttribute("data-palette",lg("palette","violet"));
S.page=lg("page","dashboard");
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
addEventListener("keydown",function(e){if(e.key==="Escape"){if(S.sheet){S.sheet=null;S.editing=null;render();}else closeLayer();}});
sync();render();syncRail();
})();
