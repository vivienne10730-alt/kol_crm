import { useState, useMemo, useCallback } from "react";

// ─── Design Tokens ──────────────────────────────────────────────
const T = {
  bg:"#F5F2EE", bgCard:"#FAFAF8", bgWhite:"#FFFFFF", bgGray:"#EFECE8",
  bgSide:"#2C2825",
  text:"#1A1A1A", muted:"#7A7067", muted2:"#A89F95",
  border:"#DDD8D1", border2:"#C8C1B8",
  accent:"#C8622A", accentL:"#FBF0E8",
  yellow:"#F5D547", yellowL:"#FFFBDE",
  green:"#1F7A4A", greenL:"#E8F5EE",
  amber:"#B86A0A", amberL:"#FBF3E0", amberM:"#FDE68A",
  red:"#C02020",   redL:"#FCEAEA",
  blue:"#2B5BB8",  blueL:"#EEF2FB",
};

const BRANDS = ["KNKA","MULISOFT","7MAGIC"];

const STATUS_CFG = {
  "待开发":{color:T.muted, light:T.bgGray,  dot:"#A89F95"},
  "已联系":{color:T.blue,  light:T.blueL,   dot:T.blue},
  "洽谈中":{color:T.amber, light:T.amberL,  dot:T.amber},
  "已合作":{color:T.green, light:T.greenL,  dot:T.green},
  "不合作":{color:T.red,   light:T.redL,    dot:T.red},
};

const STAGE_LIST = [
  "New","Contacted","Negotiating","Deal Confirmed","Product Sent",
  "Draft Pending","Draft Submitted","Ready to Post","Posted","Completed","Cancelled"
];
const STAGE_CFG = {
  "New":            {color:T.muted,  light:T.bgGray},
  "Contacted":      {color:T.blue,   light:T.blueL},
  "Negotiating":    {color:"#7C3AED",light:"#F5F3FF"},
  "Deal Confirmed": {color:T.green,  light:T.greenL},
  "Product Sent":   {color:"#0891B2",light:"#F0FDFA"},
  "Draft Pending":  {color:T.amber,  light:T.amberL},
  "Draft Submitted":{color:"#D97706",light:"#FEF3C7"},
  "Ready to Post":  {color:"#059669",light:"#D1FAE5"},
  "Posted":         {color:T.green,  light:T.greenL},
  "Completed":      {color:"#065F46",light:"#D1FAE5"},
  "Cancelled":      {color:T.red,    light:T.redL},
};

// ─── Global shared state (single source of truth) ───────────────
// collabs: { id, creatorId, projectId, stage, amount, currency, paid, publishDate, contacted, replied, notes }
// creators and projects reference collabs by id

const INIT_COLLABS = [
  {id:"COL001",creatorId:"UC001",projectId:1,stage:"Negotiating",   amount:2800,currency:"USD",paid:0,    publishDate:"",           contacted:"2025-05-10",replied:"2025-05-12",notes:"Interested in APH3000"},
  {id:"COL002",creatorId:"UC002",projectId:1,stage:"Posted",        amount:2200,currency:"EUR",paid:2200, publishDate:"2025-06-01", contacted:"2025-04-20",replied:"2025-04-22",notes:"Great Q2 performance"},
  {id:"COL003",creatorId:"UC006",projectId:1,stage:"Contacted",     amount:0,   currency:"USD",paid:0,    publishDate:"",           contacted:"2025-05-20",replied:"",         notes:""},
  {id:"COL004",creatorId:"UC004",projectId:2,stage:"New",           amount:1200,currency:"USD",paid:0,    publishDate:"",           contacted:"",          replied:"",         notes:""},
  {id:"COL005",creatorId:"UC008",projectId:2,stage:"Cancelled",     amount:0,   currency:"USD",paid:0,    publishDate:"",           contacted:"2025-05-05",replied:"",         notes:"Declined"},
  {id:"COL006",creatorId:"UC003",projectId:3,stage:"Negotiating",   amount:8500,currency:"USD",paid:0,    publishDate:"",           contacted:"2025-05-15",replied:"2025-05-18",notes:"Premium UK creator"},
  {id:"COL007",creatorId:"UC007",projectId:3,stage:"New",           amount:0,   currency:"USD",paid:0,    publishDate:"",           contacted:"",          replied:"",         notes:""},
  {id:"COL008",creatorId:"UC005",projectId:4,stage:"Deal Confirmed",amount:1500,currency:"USD",paid:1500, publishDate:"2025-06-18", contacted:"2025-05-01",replied:"2025-05-03",notes:""},
];

const INIT_CREATORS = [
  {id:"UC001",name:"TechMom Daily",      country:"US",subs:284000,avgViews:42000,score:92,brand:"KNKA",    email:"collab@techmomdaily.com",status:"洽谈中",u7:3,u30:11,notes:"Very engaged audience."},
  {id:"UC002",name:"FreshAirFamily",     country:"DE",subs:156000,avgViews:28000,score:87,brand:"KNKA",    email:"info@freshairfamily.de", status:"已合作",u7:2,u30:8, notes:"Completed Q2 campaign."},
  {id:"UC003",name:"GlamHairStudio",     country:"UK",subs:521000,avgViews:98000,score:84,brand:"7MAGIC",  email:"",                      status:"已联系",u7:5,u30:18,notes:"Top beauty creator in UK."},
  {id:"UC004",name:"MoistureFreeLiving", country:"CA",subs:93000, avgViews:15000,score:79,brand:"MULISOFT",email:"hello@moisturefree.ca", status:"待开发",u7:1,u30:5, notes:""},
  {id:"UC005",name:"CleanAirKids",       country:"US",subs:47000, avgViews:8200, score:71,brand:"KNKA",    email:"cleanair@kids.com",     status:"已合作",u7:2,u30:9, notes:"Family-focused creator."},
  {id:"UC006",name:"HomePureLife",       country:"AU",subs:312000,avgViews:55000,score:68,brand:"KNKA",    email:"",                      status:"洽谈中",u7:4,u30:14,notes:""},
  {id:"UC007",name:"BeautyByNia",        country:"FR",subs:189000,avgViews:31000,score:58,brand:"7MAGIC",  email:"nia@beautybynia.fr",    status:"待开发",u7:3,u30:10,notes:""},
  {id:"UC008",name:"BasementDryPro",     country:"US",subs:28000, avgViews:4100, score:45,brand:"MULISOFT",email:"",                      status:"不合作",u7:0,u30:2, notes:"Declined collaboration."},
];

const INIT_PROJECTS = [
  {id:1,name:"APH3000 Q3 Germany",    brand:"KNKA",    platform:"YouTube",        owner:"Vivi",  budget:60000,currency:"EUR"},
  {id:2,name:"DH500 Summer Campaign", brand:"MULISOFT",platform:"YouTube",        owner:"Jason", budget:30000,currency:"USD"},
  {id:3,name:"Hair Styler Launch",    brand:"7MAGIC",  platform:"YouTube+TikTok", owner:"Vivi",  budget:80000,currency:"USD"},
  {id:4,name:"APH5000 US Launch",     brand:"KNKA",    platform:"YouTube",        owner:"Jason", budget:40000,currency:"USD"},
];

const INIT_BRANDS = [
  {id:1,name:"KNKA",    audience:"Families with kids and pets",products:"Air purifiers & air quality",  keywords:["Air Quality","Family","Kids","Pet","Home","HEPA"]},
  {id:2,name:"MULISOFT",audience:"Homeowners in humid regions",products:"Dehumidifiers & moisture ctrl",keywords:["Humidity","Basement","Mold","Allergy","Moisture"]},
  {id:3,name:"7MAGIC",  audience:"Beauty enthusiasts",         products:"Hair styling tools",            keywords:["Beauty","Hair","Fashion","Styling","Glamour"]},
];

const INIT_REMINDERS = [
  {id:1,creatorId:"UC001",creatorName:"TechMom Daily",  date:"2025-06-17",note:"Follow up on Q3 pricing",   project:"APH3000 Q3 Germany",   done:false},
  {id:2,creatorId:"UC005",creatorName:"CleanAirKids",   date:"2025-06-17",note:"Confirm publish date Jun 18",project:"APH5000 US Launch",     done:false},
  {id:3,creatorId:"UC006",creatorName:"HomePureLife",    date:"2025-06-16",note:"Send product sample",       project:"APH3000 Q3 Germany",   done:false},
  {id:4,creatorId:"UC003",creatorName:"GlamHairStudio", date:"2025-06-20",note:"Review contract terms",     project:"Hair Styler Launch",    done:false},
  {id:5,creatorId:"UC004",creatorName:"MoistureFreeLiving",date:"2025-06-22",note:"Initial outreach follow-up",project:"DH500 Summer Campaign",done:true},
];

const SEARCH_POOL = [
  {id:"UC101",name:"AirQualityMom",  country:"US",subs:73000, avgViews:11000,score:88,brand:"KNKA",   email:"contact@aqmom.com",         u7:2,u30:7, exists:false},
  {id:"UC102",name:"CleanHomeGuide", country:"DE",subs:41000, avgViews:6200, score:75,brand:"KNKA",   email:"",                           u7:1,u30:5, exists:false},
  {id:"UC103",name:"FamilyHealthHub",country:"UK",subs:128000,avgViews:22000,score:71,brand:"KNKA",   email:"hello@familyhealthhub.co.uk",u7:3,u30:11,exists:true},
  {id:"UC104",name:"PetFriendlyHome",country:"CA",subs:55000, avgViews:9100, score:65,brand:"KNKA",   email:"",                           u7:1,u30:4, exists:false},
];

// ─── Helpers ────────────────────────────────────────────────────
const fmt     = n=>!n?"—":n>=1e6?(n/1e6).toFixed(1)+"M":n>=1000?(n/1000).toFixed(1)+"K":String(n);
const fmtM    = (n,c="$")=>c+Number(n||0).toLocaleString("en",{maximumFractionDigits:0});
const scColor = s=>s>=80?T.green:s>=60?T.amber:T.red;
const scLight = s=>s>=80?T.greenL:s>=60?T.amberL:T.redL;
const avBg    = name=>["#5C4A3A","#3A5C4A","#4A3A5C","#5C3A3A","#3A4A5C","#5C5A3A","#3A5C5A","#5C3A5A"][name.charCodeAt(0)%8];
const TODAY   = "2025-06-17";
const isToday = d=>d===TODAY;
const isPast  = d=>d&&d<TODAY;
const nextWeek= "2025-06-24";
const uid     = ()=>"id"+Date.now()+Math.random().toString(36).slice(2,6);

const exportCSV = (rows,cols,filename)=>{
  const hdr=cols.map(c=>c.label).join(",");
  const body=rows.map(r=>cols.map(c=>`"${(r[c.key]||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([hdr+"\n"+body],{type:"text/csv"}));a.download=filename;a.click();
};

// ─── UI Primitives ───────────────────────────────────────────────
const Btn=({children,variant="dark",sm,onClick,style={},disabled})=>{
  const sz=sm?{padding:"5px 13px",fontSize:12}:{padding:"9px 20px",fontSize:13};
  const vs={
    dark:   {background:T.text,    color:"#fff",  border:"none",              borderRadius:22},
    outline:{background:"transparent",color:T.text,border:`1.5px solid ${T.text}`,borderRadius:22},
    accent: {background:T.accent,  color:"#fff",  border:"none",              borderRadius:22},
    ghost:  {background:"transparent",color:T.muted,border:`1.5px solid ${T.border}`,borderRadius:7},
    danger: {background:T.redL,    color:T.red,   border:`1.5px solid ${T.red}44`,   borderRadius:7},
    yellow: {background:T.yellow,  color:T.text,  border:"none",              borderRadius:22},
    green:  {background:T.greenL,  color:T.green, border:`1.5px solid ${T.green}44`, borderRadius:7},
    blue:   {background:T.blueL,   color:T.blue,  border:`1.5px solid ${T.blue}44`,  borderRadius:7},
  };
  return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:6,fontFamily:"inherit",fontWeight:700,cursor:disabled?"not-allowed":"pointer",whiteSpace:"nowrap",letterSpacing:".2px",transition:"all .15s",opacity:disabled?.55:1,...sz,...(vs[variant]||vs.dark),...style}}>{children}</button>;
};

const Badge=({children,color,light,dot,style={}})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"2px 9px",borderRadius:20,fontSize:11,fontWeight:700,background:light||T.bgGray,color:color||T.muted,...style}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:dot,flexShrink:0}}/>}
    {children}
  </span>
);
const BrandBadge=({brand})=><Badge color={T.text} light={T.bgGray}>{brand}</Badge>;
const StatusBadge=({status})=>{const c=STATUS_CFG[status]||{color:T.muted,light:T.bgGray,dot:T.muted};return <Badge color={c.color} light={c.light} dot={c.dot}>{status}</Badge>;};
const StageBadge=({stage})=>{const c=STAGE_CFG[stage]||{color:T.muted,light:T.bgGray};return <Badge color={c.color} light={c.light}>{stage||"—"}</Badge>;};

const ScoreRing=({score,size=36})=>(
  <div style={{width:size,height:size,borderRadius:"50%",border:`2.5px solid ${scColor(score)}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size<40?11:14,fontWeight:800,color:scColor(score),flexShrink:0,background:scLight(score)}}>{score}</div>
);
const Avatar=({name,size=32})=>(
  <div style={{width:size,height:size,borderRadius:"50%",background:avBg(name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.38,fontWeight:800,color:"#fff",flexShrink:0}}>{name.charAt(0).toUpperCase()}</div>
);
const MiniBar=({value,max,height=4})=>(
  <div style={{flex:1,height,background:T.border,borderRadius:3,overflow:"hidden",minWidth:50}}>
    <div style={{height:"100%",width:`${Math.min(100,Math.round((value/Math.max(max,1))*100))}%`,background:T.text,borderRadius:3}}/>
  </div>
);

const Card=({title,badge,action,children,style={}})=>(
  <div style={{background:T.bgCard,border:`1.5px solid ${T.border}`,borderRadius:12,overflow:"hidden",...style}}>
    {title&&<div style={{padding:"12px 20px",borderBottom:`1.5px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:T.bgCard}}>
      <span style={{fontSize:11.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"1px",flex:1}}>{title}</span>
      {badge}{action&&<div style={{display:"flex",gap:6}}>{action}</div>}
    </div>}
    {children}
  </div>
);

const StatN=({label,value,sub,accent})=>(
  <div style={{padding:"16px 18px",background:T.bgCard,border:`1.5px solid ${T.border}`,borderRadius:10}}>
    <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:7}}>{label}</div>
    <div style={{fontSize:28,fontWeight:900,color:accent||T.text,fontFamily:"Georgia,serif",lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:T.muted2,marginTop:5}}>{sub}</div>}
  </div>
);

const Input=({style={},textarea,rows=3,...props})=>{
  const base={padding:"8px 12px",borderRadius:7,border:`1.5px solid ${T.border}`,fontSize:13,fontFamily:"inherit",outline:"none",background:T.bgWhite,width:"100%",boxSizing:"border-box",color:T.text};
  return textarea?<textarea style={{...base,resize:"vertical",minHeight:rows*24,...style}} {...props}/>:<input style={{...base,...style}} {...props}/>;
};
const Sel=({children,style={},...props})=>(
  <select style={{padding:"8px 12px",borderRadius:7,border:`1.5px solid ${T.border}`,fontSize:13,fontFamily:"inherit",outline:"none",background:T.bgWhite,color:T.text,cursor:"pointer",width:"100%",boxSizing:"border-box",...style}} {...props}>{children}</select>
);

const Modal=({open,onClose,title,children,wide,extraWide})=>{
  if(!open)return null;
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(26,26,26,.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(3px)"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.bgCard,borderRadius:14,width:"100%",maxWidth:extraWide?980:wide?720:540,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 32px 80px rgba(0,0,0,.22)",margin:16,border:`1.5px solid ${T.border2}`}}>
        <div style={{padding:"18px 24px",borderBottom:`1.5px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.bg,borderRadius:"14px 14px 0 0",position:"sticky",top:0,zIndex:10}}>
          <span style={{fontWeight:900,fontSize:15,color:T.text,fontFamily:"Georgia,serif"}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:T.muted,cursor:"pointer",lineHeight:1}}>×</button>
        </div>
        <div style={{padding:"22px 24px"}}>{children}</div>
      </div>
    </div>
  );
};

const FLabel=({children})=><label style={{display:"block",fontSize:10.5,fontWeight:800,color:T.muted,marginBottom:5,textTransform:"uppercase",letterSpacing:".8px"}}>{children}</label>;
const FRow=({label,children,mb=14})=><div style={{marginBottom:mb}}>{label&&<FLabel>{label}</FLabel>}{children}</div>;
const Grid=({cols="1fr 1fr",children,gap=12})=><div style={{display:"grid",gridTemplateColumns:cols,gap}}>{children}</div>;
const Hr=()=><div style={{height:"1.5px",background:T.border,margin:"16px 0"}}/>;
const SectionLabel=({children})=><div style={{fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"1px",marginBottom:10,marginTop:4}}>{children}</div>;

const Toast=({msg,onClose})=>(
  <div style={{position:"fixed",top:20,right:24,zIndex:3000,background:T.text,color:"#fff",padding:"12px 18px",borderRadius:10,fontSize:13,fontWeight:700,borderLeft:`4px solid ${T.yellow}`,boxShadow:"0 8px 28px rgba(0,0,0,.25)",display:"flex",alignItems:"center",gap:10}}>
    <span style={{color:T.yellow}}>✓</span>{msg}
    <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,.4)",cursor:"pointer",fontSize:16,marginLeft:6}}>×</button>
  </div>
);

const TH=({children,w})=>(
  <th style={{padding:"9px 14px",textAlign:"left",fontSize:10,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"1px",borderBottom:`1.5px solid ${T.border}`,background:T.bg,whiteSpace:"nowrap",...(w?{width:w}:{})}}>{children}</th>
);
const TD=({children,style={}})=>(
  <td style={{padding:"10px 14px",borderBottom:`1px solid ${T.bgGray}`,verticalAlign:"middle",...style}}>{children}</td>
);

const PageHead=({vol,headline,accent,sub,action})=>(
  <div style={{marginBottom:22,borderBottom:`2px solid ${T.text}`,paddingBottom:14,display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
    <div>
      {vol&&<div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"2px",marginBottom:4}}>{vol}</div>}
      <div style={{fontFamily:"Georgia,serif",fontSize:30,fontWeight:900,color:T.text,letterSpacing:"-0.5px",lineHeight:1.1}}>
        {headline}{accent&&<span style={{color:T.accent}}> {accent}</span>}
      </div>
      {sub&&<div style={{fontSize:12,color:T.muted,marginTop:5,fontStyle:"italic"}}>{sub}</div>}
    </div>
    {action}
  </div>
);

// ─── Collab Edit Form (reused in Detail modal + Projects) ────────
function CollabForm({collab,projects,onSave,onDelete,onCancel}){
  const [f,setF]=useState({...collab});
  const up=k=>e=>setF(p=>({...p,[k]:e.target.type==="number"?parseFloat(e.target.value)||0:e.target.value}));
  return(
    <div style={{background:T.bg,borderRadius:10,padding:"16px",border:`1.5px solid ${T.border}`}}>
      <SectionLabel>Project & Stage</SectionLabel>
      <Grid cols="1fr 1fr" gap={10}>
        <FRow label="Project" mb={10}>
          <Sel value={f.projectId} onChange={e=>setF(p=>({...p,projectId:parseInt(e.target.value)}))}>
            {projects.map(p=><option key={p.id} value={p.id}>{p.brand} · {p.name}</option>)}
          </Sel>
        </FRow>
        <FRow label="Stage" mb={10}>
          <Sel value={f.stage} onChange={up("stage")}>
            {STAGE_LIST.map(s=><option key={s}>{s}</option>)}
          </Sel>
        </FRow>
      </Grid>

      <SectionLabel>Pricing</SectionLabel>
      <Grid cols="1fr 80px 1fr 80px" gap={10}>
        <FRow label="Contracted Amount" mb={10}><Input value={f.amount} onChange={up("amount")} type="number" placeholder="0"/></FRow>
        <FRow label="Currency" mb={10}><Sel value={f.currency} onChange={up("currency")}>{["USD","EUR","HKD","GBP"].map(x=><option key={x}>{x}</option>)}</Sel></FRow>
        <FRow label="Paid Amount" mb={10}><Input value={f.paid} onChange={up("paid")} type="number" placeholder="0"/></FRow>
        <FRow label="Paid Cur." mb={10}><Sel value={f.paidCurrency||f.currency} onChange={up("paidCurrency")}>{["USD","EUR","HKD","GBP"].map(x=><option key={x}>{x}</option>)}</Sel></FRow>
      </Grid>

      <SectionLabel>Key Dates</SectionLabel>
      <Grid cols="1fr 1fr 1fr 1fr" gap={10}>
        <FRow label="Contacted" mb={10}><Input type="date" value={f.contacted||""} onChange={up("contacted")}/></FRow>
        <FRow label="Replied" mb={10}><Input type="date" value={f.replied||""} onChange={up("replied")}/></FRow>
        <FRow label="Publish Date" mb={10}><Input type="date" value={f.publishDate||""} onChange={up("publishDate")}/></FRow>
        <FRow label="Payment Date" mb={10}><Input type="date" value={f.paymentDate||""} onChange={up("paymentDate")}/></FRow>
      </Grid>

      <FRow label="Notes" mb={12}><Input textarea rows={2} value={f.notes||""} onChange={up("notes")}/></FRow>

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        {onDelete&&<Btn sm variant="danger" onClick={()=>onDelete(f.id)}>Delete</Btn>}
        <Btn sm variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn sm variant="dark" onClick={()=>onSave(f)}>Save</Btn>
      </div>
    </div>
  );
}

// ─── Creator Detail Modal ────────────────────────────────────────
function CreatorDetailModal({creator,collabs,projects,onClose,onSaveCreator,onSaveCollab,onDeleteCollab,onAddCollab}){
  const [tab,setTab]=useState("info"); // "info" | "collabs"
  const [editCollab,setEditCollab]=useState(null); // collab being edited
  const [addingCollab,setAddingCollab]=useState(false);
  const [form,setForm]=useState({...creator});
  if(!creator)return null;

  const myCollabs=collabs.filter(c=>c.creatorId===creator.id);
  const up=k=>e=>setForm(p=>({...p,[k]:e.target.value}));

  const totalAmount=myCollabs.reduce((a,c)=>a+(c.amount||0),0);
  const totalPaid  =myCollabs.reduce((a,c)=>a+(c.paid||0),0);

  return(
    <Modal open={true} onClose={onClose} title={`${creator.name}`} extraWide>
      {/* Tab bar */}
      <div style={{display:"flex",gap:6,marginBottom:20,background:T.bg,padding:"4px",borderRadius:9,border:`1px solid ${T.border}`}}>
        {[["info","👤 Info & Stats"],["collabs","🤝 Collaborations ("+myCollabs.length+")"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"8px 12px",borderRadius:7,fontSize:12.5,cursor:"pointer",fontWeight:800,border:"none",background:tab===id?T.text:"transparent",color:tab===id?"#fff":T.muted,transition:"all .15s"}}>{label}</button>
        ))}
      </div>

      {tab==="info"&&(
        <div>
          {/* Header card */}
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,padding:"16px",background:T.bg,borderRadius:10}}>
            <Avatar name={creator.name} size={54}/>
            <div style={{flex:1}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:19,fontWeight:900}}>{creator.name}</div>
              <div style={{fontSize:11,color:T.muted,marginTop:2}}>{creator.country} · {creator.id}</div>
              <div style={{display:"flex",gap:6,marginTop:7,flexWrap:"wrap"}}>
                <ScoreRing score={creator.score} size={32}/>
                <StatusBadge status={creator.status}/>
                <BrandBadge brand={creator.brand}/>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px"}}>Total Contracted</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:900,color:T.accent}}>{totalAmount>0?fmtM(totalAmount):"—"}</div>
              <div style={{fontSize:11,color:totalPaid>=totalAmount&&totalAmount>0?T.green:T.amber}}>paid {fmtM(totalPaid)}</div>
            </div>
          </div>

          {/* Stats */}
          <Grid cols="repeat(4,1fr)" gap={8}>
            {[["Subscribers",fmt(creator.subs)],["Avg Views",fmt(creator.avgViews)],["7d Posts",creator.u7||0],["30d Posts",creator.u30||0]].map(([l,v])=>(
              <div key={l} style={{padding:"10px 12px",background:T.bg,borderRadius:8,textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:4}}>{l}</div>
                <div style={{fontSize:20,fontWeight:900,fontFamily:"Georgia,serif"}}>{v}</div>
              </div>
            ))}
          </Grid>

          <Hr/>
          <Grid cols="1fr 1fr" gap={14}>
            <div>
              <FRow label="Status">
                <Sel value={form.status} onChange={up("status")}>{Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}</Sel>
              </FRow>
              <FRow label="Best Brand">
                <Sel value={form.brand} onChange={up("brand")}>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel>
              </FRow>
              <FRow label="Email">
                <Input value={form.email||""} onChange={up("email")} type="email"/>
              </FRow>
              <FRow label="Country">
                <Input value={form.country||""} onChange={up("country")}/>
              </FRow>
            </div>
            <div>
              <FRow label="Notes">
                <Input textarea rows={7} value={form.notes||""} onChange={up("notes")}/>
              </FRow>
            </div>
          </Grid>
          <Hr/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="dark" onClick={()=>{onSaveCreator(form);onClose();}}>Save Info</Btn>
          </div>
        </div>
      )}

      {tab==="collabs"&&(
        <div>
          {/* Summary strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
            <StatN label="Collabs"    value={String(myCollabs.length)}/>
            <StatN label="Contracted" value={totalAmount>0?fmtM(totalAmount):"—"} accent={T.accent}/>
            <StatN label="Paid"       value={fmtM(totalPaid)} accent={T.green}/>
            <StatN label="Owed"       value={fmtM(Math.max(0,totalAmount-totalPaid))} accent={totalAmount-totalPaid>0?T.red:T.green}/>
          </div>

          {/* Collab list */}
          {myCollabs.map(col=>{
            const proj=projects.find(p=>p.id===col.projectId);
            const isEditing=editCollab?.id===col.id;
            return(
              <div key={col.id} style={{marginBottom:12}}>
                {!isEditing?(
                  <div style={{background:T.bg,borderRadius:10,padding:"14px 16px",border:`1.5px solid ${T.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,fontSize:13,marginBottom:3}}>{proj?`${proj.brand} · ${proj.name}`:"Unknown Project"}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <StageBadge stage={col.stage}/>
                          {col.publishDate&&<span style={{fontSize:11,color:T.blue,fontWeight:700}}>📅 {col.publishDate}</span>}
                        </div>
                      </div>
                      <div style={{textAlign:"right",marginRight:8}}>
                        <div style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:900,color:T.accent}}>{col.amount>0?`${col.currency} ${col.amount.toLocaleString()}`:"—"}</div>
                        <div style={{fontSize:11,color:col.paid>0?T.green:T.muted}}>paid {col.currency} {(col.paid||0).toLocaleString()}</div>
                        {col.amount>0&&col.paid<col.amount&&<div style={{fontSize:10,color:T.red,fontWeight:700}}>owed {col.currency} {(col.amount-col.paid).toLocaleString()}</div>}
                      </div>
                      <Btn sm variant="ghost" onClick={()=>setEditCollab(col)}>Edit</Btn>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:11,color:T.muted,flexWrap:"wrap"}}>
                      {col.contacted&&<span>Contacted: <strong style={{color:T.text}}>{col.contacted}</strong></span>}
                      {col.replied&&<span>Replied: <strong style={{color:T.text}}>{col.replied}</strong></span>}
                      {col.paymentDate&&<span>Payment: <strong style={{color:T.text}}>{col.paymentDate}</strong></span>}
                      {col.notes&&<span style={{color:T.muted,fontStyle:"italic"}}>"{col.notes}"</span>}
                    </div>
                  </div>
                ):(
                  <CollabForm
                    collab={editCollab}
                    projects={projects}
                    onSave={updated=>{onSaveCollab(updated);setEditCollab(null);}}
                    onDelete={id=>{onDeleteCollab(id);setEditCollab(null);}}
                    onCancel={()=>setEditCollab(null)}
                  />
                )}
              </div>
            );
          })}

          {myCollabs.length===0&&!addingCollab&&(
            <div style={{padding:"32px",textAlign:"center",color:T.muted,fontStyle:"italic",background:T.bg,borderRadius:10,border:`1.5px solid ${T.border}`,marginBottom:14}}>
              No collaboration records yet
            </div>
          )}

          {/* Add new collab */}
          {addingCollab?(
            <CollabForm
              collab={{id:uid(),creatorId:creator.id,projectId:projects[0]?.id,stage:"New",amount:0,currency:"USD",paid:0,paidCurrency:"USD",publishDate:"",contacted:"",replied:"",paymentDate:"",notes:""}}
              projects={projects}
              onSave={col=>{onAddCollab(col);setAddingCollab(false);}}
              onDelete={null}
              onCancel={()=>setAddingCollab(false)}
            />
          ):(
            <div style={{marginTop:14}}>
              <Btn variant="dark" onClick={()=>setAddingCollab(true)}>+ Add Collaboration Record</Btn>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────
function Nav({active,setActive}){
  const sections=[
    {group:"Overview",   items:[{id:"dashboard",label:"Dashboard",icon:"◈"}]},
    {group:"Creators",   items:[{id:"discover",label:"Discover",icon:"⊕"},{id:"creators",label:"Creator Library",icon:"⊞"}]},
    {group:"Management", items:[{id:"projects",label:"Projects",icon:"⊟"},{id:"reminders",label:"Reminders",icon:"◎"}]},
    {group:"Config",     items:[{id:"brands",label:"Brands",icon:"◇"},{id:"settings",label:"API Settings",icon:"⚙"}]},
  ];
  return(
    <div style={{width:218,minHeight:"100vh",background:T.bgSide,display:"flex",flexDirection:"column",flexShrink:0}}>
      <div style={{padding:"28px 22px 20px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:20,fontWeight:900,color:"#F5F2EE",letterSpacing:"-0.3px"}}>
          KOL<span style={{color:T.yellow}}>.</span>CRM
        </div>
        <div style={{fontSize:9,color:"rgba(245,242,238,.28)",marginTop:6,letterSpacing:"1.2px",textTransform:"uppercase",lineHeight:1.6}}>
          VOL. I · EST. 2024<br/>
          <span style={{color:"rgba(245,242,238,.18)"}}>"We find the creators."</span>
        </div>
      </div>
      {sections.map(({group,items})=>(
        <div key={group} style={{padding:"14px 12px 4px"}}>
          <div style={{fontSize:8.5,fontWeight:800,color:"rgba(245,242,238,.2)",textTransform:"uppercase",letterSpacing:"1.5px",padding:"0 10px 7px"}}>{group}</div>
          {items.map(item=>{
            const on=active===item.id;
            return(
              <button key={item.id} onClick={()=>setActive(item.id)} style={{
                display:"flex",alignItems:"center",gap:9,padding:"8px 12px",borderRadius:7,
                color:on?"#F5F2EE":"rgba(245,242,238,.38)",
                background:on?"rgba(245,242,238,.1)":"transparent",
                border:"none",cursor:"pointer",width:"100%",fontSize:13,fontWeight:on?700:400,
                marginBottom:2,letterSpacing:".1px",transition:"all .15s",
              }}>
                <span style={{width:5,height:5,borderRadius:"50%",background:on?T.yellow:"rgba(245,242,238,.15)",flexShrink:0}}/>
                <span style={{opacity:.7}}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
      <div style={{margin:"16px 14px 0",padding:"12px 14px",borderRadius:9,border:"1px solid rgba(245,242,238,.07)"}}>
        <div style={{fontSize:8.5,fontWeight:800,color:"rgba(245,242,238,.2)",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:9}}>Brands</div>
        {BRANDS.map(n=>(
          <div key={n} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:"rgba(245,242,238,.35)",flexShrink:0}}/>
            <span style={{fontSize:12,color:"rgba(245,242,238,.32)",fontWeight:600}}>{n}</span>
          </div>
        ))}
      </div>
      <div style={{marginTop:"auto",padding:"16px 22px",borderTop:"1px solid rgba(245,242,238,.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:"#4ADE80"}}/>
          <span style={{fontSize:9.5,color:"rgba(245,242,238,.2)",fontWeight:700,letterSpacing:".7px",textTransform:"uppercase"}}>System Online</span>
        </div>
      </div>
    </div>
  );
}

// ─── App root with shared state ──────────────────────────────────
export default function App(){
  const [active,setActive]=useState("dashboard");
  // Global shared state
  const [creators,setCreators]=useState(INIT_CREATORS);
  const [collabs,setCollabs]=useState(INIT_COLLABS);
  const [projects,setProjects]=useState(INIT_PROJECTS);
  const [reminders,setReminders]=useState(INIT_REMINDERS);

  // Shared collab operations (passed down to all pages)
  const saveCollab  =useCallback(col=>setCollabs(p=>p.map(c=>c.id===col.id?col:c)),[]);
  const addCollab   =useCallback(col=>setCollabs(p=>[...p,col]),[]);
  const deleteCollab=useCallback(id=>setCollabs(p=>p.filter(c=>c.id!==id)),[]);
  const saveCreator =useCallback(cr=>setCreators(p=>p.map(c=>c.id===cr.id?{...c,...cr}:c)),[]);

  const sharedProps={creators,collabs,projects,saveCollab,addCollab,deleteCollab,saveCreator,reminders,setReminders};

  const meta={
    dashboard:{title:"Dashboard",      sub:"KOL CRM · Q3 2025 · \"We find the creators.\""},
    discover: {title:"Discover",        sub:"Search YouTube creators by keyword, video or channel"},
    creators: {title:"Creator Library", sub:"Manage, filter and score all enrolled creators"},
    projects: {title:"Projects",        sub:"Track multi-brand campaigns, spend and progress"},
    reminders:{title:"Reminders",       sub:"Follow-up schedule across all creators and projects"},
    brands:   {title:"Brands",           sub:"KNKA · MULISOFT · 7MAGIC"},
    settings: {title:"API Settings",     sub:"YouTube API · AI Provider · Keys stored locally"},
  }[active];

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"Inter,-apple-system,sans-serif",background:T.bg,fontSize:14,color:T.text}}>
      <Nav active={active} setActive={setActive}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",overflow:"hidden"}}>
        <div style={{background:T.bgCard,borderBottom:`2px solid ${T.text}`,flexShrink:0}}>
          <div style={{padding:"0 28px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",height:36}}>
            <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px"}}>{meta.sub}</div>
          </div>
          <div style={{padding:"0 28px",height:46,display:"flex",alignItems:"center"}}>
            <span style={{fontFamily:"Georgia,serif",fontSize:17,fontWeight:900,color:T.text}}>{meta.title}</span>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#4ADE80"}}/>
              <span style={{fontSize:9.5,color:T.muted,fontWeight:800,letterSpacing:".8px",textTransform:"uppercase"}}>Live</span>
            </div>
          </div>
        </div>
        <div style={{padding:"24px 28px",flex:1,overflowY:"auto"}}>
          {active==="dashboard" &&<Dashboard {...sharedProps} setActive={setActive}/>}
          {active==="discover"  &&<Discover  {...sharedProps}/>}
          {active==="creators"  &&<CreatorLibrary {...sharedProps} setProjects={setProjects}/>}
          {active==="projects"  &&<Projects  {...sharedProps} setProjects={setProjects}/>}
          {active==="reminders" &&<Reminders {...sharedProps}/>}
          {active==="brands"    &&<Brands/>}
          {active==="settings"  &&<Settings/>}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────
function Dashboard({creators,collabs,projects,reminders,setReminders,setActive}){
  const todayDue=reminders.filter(r=>!r.done&&(isToday(r.date)||isPast(r.date)));
  const publishing=collabs.filter(c=>c.publishDate&&c.publishDate>=TODAY&&c.publishDate<=nextWeek).map(c=>{
    const cr=creators.find(x=>x.id===c.creatorId);
    const pr=projects.find(x=>x.id===c.projectId);
    return{...c,creatorName:cr?.name||"Unknown",projectName:pr?.name||"Unknown",brand:pr?.brand||""};
  });
  const allC=collabs;
  const totalSpend=allC.reduce((a,c)=>a+(c.amount||0),0);
  const totalPaid =allC.reduce((a,c)=>a+(c.paid||0),0);
  const posted    =allC.filter(c=>c.stage==="Posted"||c.stage==="Completed").length;

  const brandSummary=BRANDS.map(brand=>{
    const pids=projects.filter(p=>p.brand===brand).map(p=>p.id);
    const cs=collabs.filter(c=>pids.includes(c.projectId));
    return{brand,projects:pids.length,creators:new Set(cs.map(c=>c.creatorId)).size,spend:cs.reduce((a,c)=>a+(c.amount||0),0),posted:cs.filter(c=>c.stage==="Posted"||c.stage==="Completed").length};
  });

  return(
    <div>
      <PageHead vol={`KOL CRM · Jun 2025`} headline={`${creators.length} Creators.`} accent={`$${Math.round(totalSpend/1000)}K Contracted.`} sub="because great content doesn't book itself"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:12,marginBottom:20}}>
        <StatN label="Creators"   value={creators.length} sub="in library"/>
        <StatN label="Collabs"    value={collabs.length}  sub="total records"/>
        <StatN label="Published"  value={posted}          sub="posts live"   accent={T.green}/>
        <StatN label="Due Today"  value={todayDue.length} sub="follow-ups"   accent={todayDue.length>0?T.red:T.green}/>
        <StatN label="Contracted" value={fmtM(totalSpend)}sub="total"        accent={T.accent}/>
        <StatN label="Paid Out"   value={fmtM(totalPaid)} sub={`Owed ${fmtM(totalSpend-totalPaid)}`}/>
      </div>

      <Card title="Brand Summary" style={{marginBottom:16}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr><TH>Brand</TH><TH>Projects</TH><TH>Creators</TH><TH>Published</TH><TH>Contracted</TH><TH>Progress</TH></tr></thead>
          <tbody>{brandSummary.map(b=>(
            <tr key={b.brand}>
              <TD><strong style={{fontFamily:"Georgia,serif"}}>{b.brand}</strong></TD>
              <TD>{b.projects}</TD><TD><strong>{b.creators}</strong></TD>
              <TD><span style={{color:T.green,fontWeight:700}}>{b.posted}</span></TD>
              <TD><strong style={{color:T.accent}}>{fmtM(b.spend)}</strong></TD>
              <TD style={{minWidth:140}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <MiniBar value={b.posted} max={b.creators}/>
                  <span style={{fontSize:11,color:T.muted,whiteSpace:"nowrap"}}>{b.posted}/{b.creators}</span>
                </div>
              </TD>
            </tr>
          ))}</tbody>
        </table>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card title="🔔 Follow-ups Due" badge={<Badge color={T.red} light={T.redL}>{todayDue.length}</Badge>}
          action={<Btn sm variant="ghost" onClick={()=>setActive("reminders")}>View All →</Btn>}>
          {todayDue.length===0
            ?<div style={{padding:"28px",textAlign:"center",color:T.muted,fontStyle:"italic",fontSize:13}}>All caught up! 🎉</div>
            :<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr><TH>Creator</TH><TH>Note</TH><TH>Project</TH></tr></thead>
              <tbody>{todayDue.slice(0,5).map(r=>(
                <tr key={r.id}>
                  <TD><strong style={{color:T.accent}}>{r.creatorName}</strong></TD>
                  <TD style={{color:T.muted,fontSize:12}}>{r.note}</TD>
                  <TD style={{fontSize:11,color:T.muted2}}>{r.project}</TD>
                </tr>
              ))}</tbody>
            </table>}
        </Card>

        <Card title="📅 Publishing This Week" badge={<Badge>{publishing.length}</Badge>}>
          {publishing.length===0
            ?<div style={{padding:"28px",textAlign:"center",color:T.muted,fontStyle:"italic",fontSize:13}}>No publish dates in next 7 days</div>
            :<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr><TH>Creator</TH><TH>Project</TH><TH>Brand</TH><TH>Date</TH></tr></thead>
              <tbody>{publishing.map((p,i)=>(
                <tr key={i}>
                  <TD><strong>{p.creatorName}</strong></TD>
                  <TD style={{fontSize:12,color:T.muted}}>{p.projectName}</TD>
                  <TD><BrandBadge brand={p.brand}/></TD>
                  <TD><strong style={{color:T.blue,fontSize:12}}>{p.publishDate}</strong></TD>
                </tr>
              ))}</tbody>
            </table>}
        </Card>
      </div>
    </div>
  );
}

// ─── Creator Library ──────────────────────────────────────────────
function CreatorLibrary({creators,collabs,projects,saveCollab,addCollab,deleteCollab,saveCreator,setProjects}){
  const [q,setQ]=useState("");
  const [filterCountry,setFC]=useState("");
  const [filterBrand,setFB]=useState("");
  const [filterStatus,setFS]=useState("");
  const [minScore,setMS]=useState("");
  const [selected,setSelected]=useState(new Set());
  const [showAdd,setShowAdd]=useState(false);
  const [detailCreator,setDetail]=useState(null);
  const [toast,setToast]=useState(null);
  const [localCreators,setLocalCreators]=useState(creators);
  const [form,setForm]=useState({name:"",email:"",country:"US",status:"待开发",brand:"KNKA",score:0,subs:0,avgViews:0,u7:0,u30:0,notes:"",amount:0,currency:"USD",projectId:""});

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const allCreators=[...localCreators,...creators.filter(c=>!localCreators.find(l=>l.id===c.id))];

  const filtered=useMemo(()=>allCreators.filter(c=>
    (!q||(c.name+(c.email||"")).toLowerCase().includes(q.toLowerCase()))&&
    (!filterCountry||c.country===filterCountry)&&
    (!filterBrand||c.brand===filterBrand)&&
    (!filterStatus||c.status===filterStatus)&&
    (!minScore||c.score>=parseInt(minScore))
  ),[allCreators,q,filterCountry,filterBrand,filterStatus,minScore]);

  const countries=[...new Set(allCreators.map(c=>c.country))].sort();
  const toggleSel=id=>setSelected(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);return s;});
  const toggleAll=()=>selected.size===filtered.length?setSelected(new Set()):setSelected(new Set(filtered.map(c=>c.id)));

  const handleSaveCreator=cr=>{saveCreator(cr);setLocalCreators(p=>p.map(c=>c.id===cr.id?{...c,...cr}:c));showToast("Creator updated ✓");};

  const saveNew=()=>{
    if(!form.name.trim())return;
    const newId="UC"+Date.now();
    const newCr={id:newId,name:form.name,email:form.email,country:form.country,status:form.status,brand:form.brand,score:form.score,subs:form.subs,avgViews:form.avgViews,u7:form.u7,u30:form.u30,notes:form.notes};
    setLocalCreators(p=>[...p,newCr]);
    saveCreator(newCr);
    if(form.projectId&&form.amount>0){
      addCollab({id:uid(),creatorId:newId,projectId:parseInt(form.projectId),stage:"New",amount:form.amount,currency:form.currency,paid:0,paidCurrency:form.currency,publishDate:"",contacted:"",replied:"",paymentDate:"",notes:""});
    }
    setShowAdd(false);showToast("Creator added ✓");
  };
  const del=id=>{if(!window.confirm("Delete?"))return;setLocalCreators(p=>p.filter(c=>c.id!==id));showToast("Removed");};

  const doExport=()=>{
    exportCSV(filtered,[
      {label:"ID",key:"id"},{label:"Name",key:"name"},{label:"Country",key:"country"},
      {label:"Subscribers",key:"subs"},{label:"Avg Views",key:"avgViews"},
      {label:"Score",key:"score"},{label:"Brand",key:"brand"},{label:"Email",key:"email"},{label:"Status",key:"status"},
    ],"creators.csv");showToast("CSV exported ✓");
  };

  return(
    <div>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      {detailCreator&&(
        <CreatorDetailModal
          creator={detailCreator} collabs={collabs} projects={projects}
          onClose={()=>setDetail(null)}
          onSaveCreator={handleSaveCreator}
          onSaveCollab={col=>{saveCollab(col);showToast("Collab updated ✓");}}
          onAddCollab={col=>{addCollab(col);showToast("Collab added ✓");}}
          onDeleteCollab={id=>{deleteCollab(id);showToast("Collab removed");}}
        />
      )}

      <PageHead vol="Creator Library" headline={`${filtered.length} Creators`} accent={filterBrand?`· ${filterBrand}`:""}
        sub="Click a row to open detail — edit info, collaborations, pricing & publish dates"
        action={<div style={{display:"flex",gap:8}}><Btn sm variant="ghost" onClick={doExport}>↓ Export CSV</Btn><Btn variant="dark" sm onClick={()=>setShowAdd(true)}>+ Add Creator</Btn></div>}/>

      {(()=>{
        const setSpend  =filtered.flatMap(c=>collabs.filter(col=>col.creatorId===c.id)).reduce((a,c)=>a+(c.amount||0),0);
        const setPaid   =filtered.flatMap(c=>collabs.filter(col=>col.creatorId===c.id)).reduce((a,c)=>a+(c.paid||0),0);
        const setPosted =filtered.flatMap(c=>collabs.filter(col=>col.creatorId===c.id)).filter(c=>c.stage==="Posted"||c.stage==="Completed").length;
        const setPending=filtered.flatMap(c=>collabs.filter(col=>col.creatorId===c.id)).filter(c=>c.stage&&c.stage!=="Posted"&&c.stage!=="Completed"&&c.stage!=="Cancelled").length;
        return(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            <StatN label="Results"    value={String(filtered.length)}/>
            <StatN label="Published"  value={String(setPosted)}  accent={T.green}/>
            <StatN label="Pending"    value={String(setPending)} accent={T.amber}/>
            <StatN label="Set Spend"  value={setSpend>0?fmtM(setSpend):"—"} sub={setPaid>0?`paid ${fmtM(setPaid)}`:""} accent={T.accent}/>
          </div>
        );
      })()}

      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center",background:T.bgCard,padding:"10px 14px",borderRadius:10,border:`1.5px solid ${T.border}`}}>
        <Input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Search name / email" style={{width:190}}/>
        <Sel value={filterCountry} onChange={e=>setFC(e.target.value)} style={{width:100}}><option value="">All Countries</option>{countries.map(c=><option key={c}>{c}</option>)}</Sel>
        <Sel value={filterBrand}   onChange={e=>setFB(e.target.value)} style={{width:120}}><option value="">All Brands</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel>
        <Sel value={filterStatus}  onChange={e=>setFS(e.target.value)} style={{width:120}}><option value="">All Statuses</option>{Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}</Sel>
        <Input value={minScore} onChange={e=>setMS(e.target.value)} placeholder="Score ≥" style={{width:80}}/>
        <Btn sm variant="ghost" onClick={()=>{setQ("");setFC("");setFB("");setFS("");setMS("");}}>Reset</Btn>
        {selected.size>0&&<div style={{marginLeft:"auto",display:"flex",gap:6}}><Btn sm variant="yellow">🤖 AI Score ({selected.size})</Btn><Btn sm variant="ghost" onClick={doExport}>↓ Export ({selected.size})</Btn></div>}
      </div>

      <Card title="All Creators" badge={<Badge>{filtered.length}</Badge>}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>
              <TH w="36px"><input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll}/></TH>
              <TH>Creator</TH><TH>Country</TH><TH>Subscribers</TH><TH>Avg Views</TH><TH>7d Posts</TH><TH>30d Posts</TH>
              <TH>Email</TH><TH>Price</TH><TH>Projects</TH><TH>AI Score</TH><TH>Status</TH><TH w="60px"></TH>
            </tr></thead>
            <tbody>
              {filtered.map(c=>{
                const myC=collabs.filter(col=>col.creatorId===c.id);
                const totalAmt=myC.reduce((a,col)=>a+(col.amount||0),0);
                const totalPd =myC.reduce((a,col)=>a+(col.paid||0),0);
                const myProjs=[...new Set(myC.map(col=>projects.find(p=>p.id===col.projectId)?.name).filter(Boolean))];
                // inline edit: field → value patcher
                const patch=(field,val)=>{
                  const parsed=["subs","avgViews","u7","u30","score"].includes(field)?parseInt(val)||0:val;
                  const updated={...allCreators.find(x=>x.id===c.id),[field]:parsed};
                  handleSaveCreator(updated);
                };
                const InlineNum=({field,value,width=70})=>{
                  const [editing,setEditing]=useState(false);
                  const [v,setV]=useState(String(value??0));
                  if(editing) return(
                    <input autoFocus value={v}
                      onChange={e=>setV(e.target.value)}
                      onBlur={()=>{patch(field,v);setEditing(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){patch(field,v);setEditing(false);}}}
                      onClick={e=>e.stopPropagation()}
                      style={{width,padding:"3px 6px",borderRadius:5,border:`1.5px solid ${T.accent}`,fontSize:12,fontFamily:"inherit",fontWeight:700,outline:"none",background:"#fff",color:T.text}}/>
                  );
                  return(
                    <span onClick={e=>{e.stopPropagation();setEditing(true);}} title="Click to edit"
                      style={{cursor:"text",borderBottom:`1.5px dashed ${T.border2}`,paddingBottom:1,fontFamily:"Georgia,serif",fontWeight:700}}>
                      {field==="subs"||field==="avgViews"?fmt(value??0):value??0}
                    </span>
                  );
                };
                const InlineTxt=({field,value,width=100,placeholder=""})=>{
                  const [editing,setEditing]=useState(false);
                  const [v,setV]=useState(value||"");
                  if(editing) return(
                    <input autoFocus value={v}
                      onChange={e=>setV(e.target.value)}
                      onBlur={()=>{patch(field,v);setEditing(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){patch(field,v);setEditing(false);}}}
                      onClick={e=>e.stopPropagation()}
                      style={{width,padding:"3px 6px",borderRadius:5,border:`1.5px solid ${T.accent}`,fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff",color:T.text}}/>
                  );
                  return(
                    <span onClick={e=>{e.stopPropagation();setEditing(true);}} title="Click to edit"
                      style={{cursor:"text",borderBottom:`1.5px dashed ${T.border2}`,paddingBottom:1,color:value?T.blue:T.muted2,fontWeight:value?600:400,fontSize:12}}>
                      {value||placeholder||"—"}
                    </span>
                  );
                };
                return(
                  <tr key={c.id} style={{background:selected.has(c.id)?"#FFFBDE":"transparent",transition:"background .1s"}}
                    onClick={()=>setDetail({...allCreators.find(x=>x.id===c.id)})}>
                    <TD><input type="checkbox" checked={selected.has(c.id)} onChange={e=>{e.stopPropagation();toggleSel(c.id);}}/></TD>
                    <TD>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <Avatar name={c.name}/>
                        <div><div style={{fontWeight:700}}>{c.name}</div><div style={{fontSize:10,color:T.muted2}}>{c.id}</div></div>
                      </div>
                    </TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineTxt field="country" value={c.country} width={52}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineNum field="subs" value={c.subs} width={80}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineNum field="avgViews" value={c.avgViews} width={72}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineNum field="u7" value={c.u7} width={44}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineNum field="u30" value={c.u30} width={44}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><InlineTxt field="email" value={c.email} width={160} placeholder="add email"/></TD>
                    <TD>
                      {totalAmt>0
                        ?<div><div style={{fontWeight:800,fontFamily:"Georgia,serif",fontSize:13,color:T.accent}}>{fmtM(totalAmt)}</div><div style={{fontSize:10,color:totalPd>=totalAmt?T.green:T.amber}}>paid {fmtM(totalPd)}</div></div>
                        :<span style={{color:T.muted2,fontSize:12}}>—</span>}
                    </TD>
                    <TD>
                      {myProjs.length>0
                        ?<div style={{display:"flex",flexDirection:"column",gap:2}}>
                          {myProjs.slice(0,2).map((p,i)=><span key={i} style={{fontSize:10,fontWeight:700,color:T.muted,background:T.bgGray,padding:"1px 6px",borderRadius:4,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{p}</span>)}
                          {myProjs.length>2&&<span style={{fontSize:10,color:T.muted2}}>+{myProjs.length-2} more</span>}
                        </div>
                        :<span style={{color:T.muted2,fontSize:12}}>—</span>}
                    </TD>
                    <TD><div style={{display:"flex",alignItems:"center",gap:7}}><ScoreRing score={c.score}/><div style={{fontSize:11,fontWeight:700,color:scColor(c.score)}}>{c.brand}</div></div></TD>
                    <TD><StatusBadge status={c.status}/></TD>
                    <TD onClick={e=>e.stopPropagation()}><Btn sm variant="danger" onClick={()=>del(c.id)}>✕</Btn></TD>
                  </tr>
                );
              })}
              {filtered.length===0&&<tr><td colSpan={13} style={{padding:"40px",textAlign:"center",color:T.muted,fontStyle:"italic"}}>No creators match filters</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Creator Modal */}
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Add Creator" wide>
        <SectionLabel>Basic Info</SectionLabel>
        <Grid cols="1fr 1fr" gap={12}>
          <FRow label="Channel Name *"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. TechMom Daily"/></FRow>
          <FRow label="Email"><Input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} type="email" placeholder="collab@example.com"/></FRow>
          <FRow label="Country"><Input value={form.country} onChange={e=>setForm(f=>({...f,country:e.target.value}))} placeholder="US"/></FRow>
          <FRow label="Status"><Sel value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}</Sel></FRow>
          <FRow label="Best Brand"><Sel value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))}>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel></FRow>
          <FRow label="AI Score (0–100)"><Input value={form.score} onChange={e=>setForm(f=>({...f,score:parseInt(e.target.value)||0}))} type="number" min="0" max="100"/></FRow>
        </Grid>
        <Hr/>
        <SectionLabel>Channel Stats</SectionLabel>
        <Grid cols="1fr 1fr 1fr 1fr" gap={12}>
          <FRow label="Subscribers"><Input value={form.subs} onChange={e=>setForm(f=>({...f,subs:parseInt(e.target.value)||0}))} type="number"/></FRow>
          <FRow label="Avg Views"><Input value={form.avgViews} onChange={e=>setForm(f=>({...f,avgViews:parseInt(e.target.value)||0}))} type="number"/></FRow>
          <FRow label="7d Posts"><Input value={form.u7} onChange={e=>setForm(f=>({...f,u7:parseInt(e.target.value)||0}))} type="number"/></FRow>
          <FRow label="30d Posts"><Input value={form.u30} onChange={e=>setForm(f=>({...f,u30:parseInt(e.target.value)||0}))} type="number"/></FRow>
        </Grid>
        <Hr/>
        <SectionLabel>Initial Collaboration (optional)</SectionLabel>
        <Grid cols="1fr 80px 1fr" gap={12}>
          <FRow label="Assign to Project"><Sel value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))}><option value="">No project yet</option>{projects.map(p=><option key={p.id} value={p.id}>{p.brand} · {p.name}</option>)}</Sel></FRow>
          <FRow label="Amount"><Input value={form.amount} onChange={e=>setForm(f=>({...f,amount:parseFloat(e.target.value)||0}))} type="number" placeholder="0"/></FRow>
          <FRow label="Currency"><Sel value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>{["USD","EUR","HKD","GBP"].map(x=><option key={x}>{x}</option>)}</Sel></FRow>
        </Grid>
        <Hr/>
        <SectionLabel>Notes</SectionLabel>
        <FRow label=""><Input textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Channel observations, negotiation notes..."/></FRow>
        <Hr/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={()=>setShowAdd(false)}>Cancel</Btn>
          <Btn variant="dark" onClick={saveNew}>Add Creator</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── Projects ─────────────────────────────────────────────────────
function Projects({creators,collabs,projects,saveCollab,addCollab,deleteCollab,setProjects}){
  const [filterBrand,setFB]=useState("");
  const [expanded,setExpanded]=useState(new Set([1]));
  const [showModal,setShowModal]=useState(false);
  const [editId,setEditId]=useState(null);
  const [toast,setToast]=useState(null);
  const [form,setForm]=useState({name:"",brand:"KNKA",platform:"YouTube",owner:"",budget:0,currency:"USD"});
  const [editCollab,setEditCollab]=useState(null);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const filtered=projects.filter(p=>!filterBrand||p.brand===filterBrand);
  const allC=collabs.filter(c=>filtered.some(p=>p.id===c.projectId));
  const totalSpend=allC.reduce((a,c)=>a+(c.amount||0),0);
  const totalPaid =allC.reduce((a,c)=>a+(c.paid||0),0);
  const posted    =allC.filter(c=>c.stage==="Posted"||c.stage==="Completed").length;

  const toggleExpand=id=>setExpanded(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);return s;});
  const openAdd=()=>{setEditId(null);setForm({name:"",brand:"KNKA",platform:"YouTube",owner:"",budget:0,currency:"USD"});setShowModal(true);};
  const openEdit=p=>{setEditId(p.id);setForm({name:p.name,brand:p.brand,platform:p.platform,owner:p.owner,budget:p.budget,currency:p.currency});setShowModal(true);};
  const save=()=>{
    if(!form.name.trim())return;
    if(editId)setProjects(p=>p.map(x=>x.id===editId?{...x,...form}:x));
    else setProjects(p=>[...p,{id:Date.now(),...form}]);
    setShowModal(false);showToast(editId?"Project updated ✓":"Project created ✓");
  };
  const del=id=>{if(!window.confirm("Delete project?"))return;setProjects(p=>p.filter(x=>x.id!==id));showToast("Deleted");};

  const brandSums=BRANDS.map(brand=>{
    const pids=filtered.filter(p=>p.brand===brand).map(p=>p.id);
    const cs=collabs.filter(c=>pids.includes(c.projectId));
    return{brand,spend:cs.reduce((a,c)=>a+(c.amount||0),0),paid:cs.reduce((a,c)=>a+(c.paid||0),0),count:cs.length,posted:cs.filter(c=>c.stage==="Posted"||c.stage==="Completed").length};
  }).filter(b=>b.count>0);

  return(
    <div>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      {editCollab&&(
        <Modal open={true} onClose={()=>setEditCollab(null)} title="Edit Collaboration Record" wide>
          <CollabForm collab={editCollab} projects={projects}
            onSave={col=>{saveCollab(col);setEditCollab(null);showToast("Updated ✓");}}
            onDelete={id=>{deleteCollab(id);setEditCollab(null);showToast("Deleted");}}
            onCancel={()=>setEditCollab(null)}/>
        </Modal>
      )}

      <PageHead vol="Campaign Projects" headline={`${filtered.length} Projects`} accent={`· ${fmtM(totalSpend)} contracted`}
        action={<div style={{display:"flex",gap:8}}>
          <Sel value={filterBrand} onChange={e=>setFB(e.target.value)} style={{width:140}}><option value="">All Brands</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel>
          <Btn variant="dark" sm onClick={openAdd}>+ New Project</Btn>
        </div>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10,marginBottom:18}}>
        <StatN label="Projects"   value={String(filtered.length)}/>
        <StatN label="Collabs"    value={String(allC.length)}/>
        <StatN label="Published"  value={String(posted)} accent={T.green}/>
        <StatN label="Contracted" value={fmtM(totalSpend)} accent={T.accent}/>
        <StatN label="Paid / Owed" value={fmtM(totalPaid)} sub={`Owed ${fmtM(totalSpend-totalPaid)}`}/>
      </div>

      {brandSums.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:`repeat(${brandSums.length},1fr)`,gap:12,marginBottom:18}}>
          {brandSums.map(b=>(
            <div key={b.brand} style={{padding:"14px 18px",background:T.bgCard,border:`1.5px solid ${T.border}`,borderRadius:10}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:14,fontWeight:900,marginBottom:10}}>{b.brand}</div>
              <Grid cols="1fr 1fr" gap={6}>
                {[["Creators",b.count],["Published",b.posted],["Spend",fmtM(b.spend)],["Paid",fmtM(b.paid)]].map(([l,v])=>(
                  <div key={l}><div style={{fontSize:9,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".7px"}}>{l}</div><div style={{fontSize:14,fontWeight:800,color:l==="Spend"?T.accent:l==="Published"?T.green:T.text}}>{v}</div></div>
                ))}
              </Grid>
            </div>
          ))}
        </div>
      )}

      {filtered.map(p=>{
        const isOpen=expanded.has(p.id);
        const pCollabs=collabs.filter(c=>c.projectId===p.id);
        const spend=pCollabs.reduce((a,c)=>a+(c.amount||0),0);
        const paid =pCollabs.reduce((a,c)=>a+(c.paid||0),0);
        const owed =spend-paid;
        const posted=pCollabs.filter(c=>c.stage==="Posted"||c.stage==="Completed").length;
        return(
          <div key={p.id} style={{background:T.bgCard,border:`1.5px solid ${T.border}`,borderRadius:12,marginBottom:12,overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 20px",cursor:"pointer",background:isOpen?T.bg:T.bgCard,borderBottom:isOpen?`1.5px solid ${T.border}`:"none"}} onClick={()=>toggleExpand(p.id)}>
              <span style={{fontSize:13,color:T.muted,flexShrink:0}}>{isOpen?"▾":"▸"}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:15,fontWeight:900}}>{p.name}</div>
                <div style={{display:"flex",gap:10,marginTop:3}}><BrandBadge brand={p.brand}/><span style={{fontSize:11,color:T.muted}}>{p.platform}</span><span style={{fontSize:11,color:T.muted}}>Owner: <strong>{p.owner}</strong></span></div>
              </div>
              <div style={{display:"flex",gap:18,textAlign:"right"}}>
                {[["Creators",pCollabs.length,T.text],["Published",posted,T.green],["Spend",fmtM(spend),T.accent],["Owed",fmtM(owed),owed>0?T.red:T.green]].map(([l,v,c])=>(
                  <div key={l}><div style={{fontSize:9,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px"}}>{l}</div><div style={{fontSize:15,fontWeight:900,fontFamily:"Georgia,serif",color:c}}>{v}</div></div>
                ))}
              </div>
              <div style={{display:"flex",gap:5,marginLeft:12}} onClick={e=>e.stopPropagation()}>
                <Btn sm variant="ghost" onClick={()=>openEdit(p)}>Edit</Btn>
                <Btn sm variant="danger" onClick={()=>del(p.id)}>✕</Btn>
              </div>
            </div>

            {isOpen&&(
              <div>
                <div style={{display:"flex",gap:0,borderBottom:`1px solid ${T.bgGray}`}}>
                  {[["Budget",fmtM(p.budget,p.currency+" ")],["Contracted",fmtM(spend,p.currency+" ")],["Paid",fmtM(paid,p.currency+" ")],["Owed",fmtM(owed,p.currency+" ")]].map(([l,v],i)=>(
                    <div key={l} style={{flex:1,padding:"10px 18px",borderRight:i<3?`1px solid ${T.bgGray}`:"none",background:T.bgGray}}>
                      <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:3}}>{l}</div>
                      <div style={{fontSize:15,fontWeight:900,fontFamily:"Georgia,serif",color:l==="Owed"&&owed>0?T.red:T.text}}>{v}</div>
                    </div>
                  ))}
                  <div style={{flex:2,padding:"10px 18px",background:T.bgGray}}>
                    <div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:5}}>Progress</div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}><MiniBar value={posted} max={pCollabs.length} height={6}/><span style={{fontSize:11,fontWeight:800,whiteSpace:"nowrap"}}>{posted}/{pCollabs.length} posted</span></div>
                  </div>
                </div>

                {pCollabs.length===0
                  ?<div style={{padding:"24px",textAlign:"center",color:T.muted,fontStyle:"italic"}}>No creators in this project yet</div>
                  :<table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead><tr><TH>Creator</TH><TH>Stage</TH><TH>Amount</TH><TH>Paid</TH><TH>Owed</TH><TH>Publish Date</TH><TH>Contacted</TH><TH w="70px"></TH></tr></thead>
                    <tbody>{pCollabs.map(c=>{
                      const cr=creators.find(x=>x.id===c.creatorId);
                      const ow=(c.amount||0)-(c.paid||0);
                      return(
                        <tr key={c.id}>
                          <TD><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={cr?.name||"?"} size={26}/><strong>{cr?.name||c.creatorId}</strong></div></TD>
                          <TD><StageBadge stage={c.stage}/></TD>
                          <TD><strong style={{color:T.text}}>{c.currency} {(c.amount||0).toLocaleString()}</strong></TD>
                          <TD><span style={{color:c.paid>0?T.green:T.muted,fontWeight:600}}>{c.currency} {(c.paid||0).toLocaleString()}</span></TD>
                          <TD><span style={{color:ow>0?T.red:T.green,fontWeight:700}}>{c.currency} {ow.toLocaleString()}</span></TD>
                          <TD style={{fontSize:12}}>
                            {c.publishDate
                              ?<span style={{color:T.blue,fontWeight:700}}>{c.publishDate}</span>
                              :<span style={{color:T.muted2}}>—</span>}
                          </TD>
                          <TD style={{fontSize:12,color:T.muted2}}>{c.contacted||"—"}</TD>
                          <TD><Btn sm variant="ghost" onClick={()=>setEditCollab(c)}>Edit</Btn></TD>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                }
              </div>
            )}
          </div>
        );
      })}

      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?"Edit Project":"New Project"} wide>
        <FRow label="Project Name *"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. KNKA APH3000 Q3 Germany"/></FRow>
        <Grid cols="1fr 1fr" gap={12}>
          <FRow label="Brand"><Sel value={form.brand} onChange={e=>setForm(f=>({...f,brand:e.target.value}))}>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel></FRow>
          <FRow label="Platform"><Sel value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))}>{["YouTube","TikTok","Instagram","YouTube+TikTok","Multi"].map(x=><option key={x}>{x}</option>)}</Sel></FRow>
          <FRow label="Owner"><Input value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))} placeholder="e.g. Vivi"/></FRow>
          <FRow label="Currency"><Sel value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}>{["USD","EUR","HKD","GBP"].map(x=><option key={x}>{x}</option>)}</Sel></FRow>
          <FRow label="Budget"><Input value={form.budget} onChange={e=>setForm(f=>({...f,budget:parseFloat(e.target.value)||0}))} type="number"/></FRow>
        </Grid>
        <Hr/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn variant="dark" onClick={save}>Save Project</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── Reminders ────────────────────────────────────────────────────
function Reminders({reminders,setReminders,projects}){
  const [showDone,setShowDone]=useState(false);
  const [showModal,setShowModal]=useState(false);
  const [toast,setToast]=useState(null);
  const [form,setForm]=useState({creatorName:"",creatorId:"",date:TODAY,note:"",project:""});

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const visible=reminders.filter(r=>showDone?r.done:!r.done);
  const overdue =visible.filter(r=>!r.done&&isPast(r.date));
  const dueToday=visible.filter(r=>!r.done&&isToday(r.date));
  const upcoming=visible.filter(r=>!r.done&&r.date>TODAY);
  const markDone=id=>{setReminders(p=>p.map(r=>r.id===id?{...r,done:true}:r));showToast("Done ✓");};
  const del     =id=>{if(!window.confirm("Delete?"))return;setReminders(p=>p.filter(r=>r.id!==id));};
  const addNew  =()=>{
    if(!form.creatorName.trim()||!form.note.trim())return;
    setReminders(p=>[...p,{id:Date.now(),...form,done:false}]);
    setShowModal(false);showToast("Reminder added ✓");
    setForm({creatorName:"",creatorId:"",date:TODAY,note:"",project:""});
  };

  const RRow=({r})=>(
    <tr style={{background:r.done?"transparent":isPast(r.date)?T.redL:isToday(r.date)?T.amberL+"88":"transparent"}}>
      <TD><strong style={{color:r.done?T.muted:T.accent}}>{r.creatorName}</strong></TD>
      <TD style={{fontSize:13}}>{r.note}</TD>
      <TD style={{fontSize:12,color:T.muted}}>{r.project||"—"}</TD>
      <TD>
        <span style={{background:r.done?T.bgGray:isPast(r.date)?T.redL:isToday(r.date)?T.amberL:T.greenL,color:r.done?T.muted:isPast(r.date)?T.red:isToday(r.date)?T.amber:T.green,fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:5}}>
          {r.done?"Done":isPast(r.date)?"Overdue":isToday(r.date)?"Today":r.date}
        </span>
      </TD>
      <TD>
        <div style={{display:"flex",gap:5}}>
          {!r.done&&<Btn sm variant="green" onClick={()=>markDone(r.id)}>Done ✓</Btn>}
          <Btn sm variant="danger" onClick={()=>del(r.id)}>✕</Btn>
        </div>
      </TD>
    </tr>
  );

  const Sec=({label,items,accent})=>{
    if(!items.length)return null;
    return(<>
      <tr><td colSpan={5} style={{padding:"10px 14px 4px",background:T.bg}}><span style={{fontSize:10,fontWeight:800,color:accent||T.muted,textTransform:"uppercase",letterSpacing:"1px"}}>{label} — {items.length}</span></td></tr>
      {items.map(r=><RRow key={r.id} r={r}/>)}
    </>);
  };

  return(
    <div>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      <PageHead vol="Follow-up Reminders" headline="Stay on track."
        accent={overdue.length>0?`${overdue.length} Overdue`:dueToday.length>0?`${dueToday.length} Due Today`:"All good!"}
        sub="Manage follow-up reminders across all creators and projects"
        action={<Btn variant="dark" sm onClick={()=>setShowModal(true)}>+ Add Reminder</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        <StatN label="Overdue"   value={String(overdue.length)}  accent={overdue.length>0?T.red:T.green}/>
        <StatN label="Due Today" value={String(dueToday.length)} accent={dueToday.length>0?T.amber:T.green}/>
        <StatN label="Upcoming"  value={String(upcoming.length)} accent={T.blue}/>
        <StatN label="Completed" value={String(reminders.filter(r=>r.done).length)} accent={T.muted}/>
      </div>

      <Card title={showDone?"Completed":"Active Reminders"} badge={<Badge>{visible.length}</Badge>}
        action={<Btn sm variant="ghost" onClick={()=>setShowDone(p=>!p)}>{showDone?"← Active":"View Completed"}</Btn>}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr><TH>Creator</TH><TH>Note</TH><TH>Project</TH><TH>Due</TH><TH w="130px"></TH></tr></thead>
            <tbody>
              {showDone?reminders.filter(r=>r.done).map(r=><RRow key={r.id} r={r}/>)
                :<><Sec label="Overdue" items={overdue} accent={T.red}/><Sec label="Due Today" items={dueToday} accent={T.amber}/><Sec label="Upcoming" items={upcoming} accent={T.blue}/></>}
              {visible.length===0&&<tr><td colSpan={5} style={{padding:"40px",textAlign:"center",color:T.muted,fontStyle:"italic"}}>No reminders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={showModal} onClose={()=>setShowModal(false)} title="Add Reminder">
        <FRow label="Creator Name *"><Input value={form.creatorName} onChange={e=>setForm(f=>({...f,creatorName:e.target.value}))} placeholder="e.g. TechMom Daily"/></FRow>
        <FRow label="Due Date *"><Input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></FRow>
        <FRow label="Note *"><Input value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="e.g. Follow up on pricing"/></FRow>
        <FRow label="Related Project"><Sel value={form.project} onChange={e=>setForm(f=>({...f,project:e.target.value}))}><option value="">Not linked</option>{projects.map(p=><option key={p.id}>{p.name}</option>)}</Sel></FRow>
        <Hr/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn>
          <Btn variant="dark" onClick={addNew}>Add Reminder</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── Discover ─────────────────────────────────────────────────────
function Discover({projects,addCollab}){
  const [mode,setMode]=useState("keyword");
  const [searched,setSearched]=useState(false);
  const [loading,setLoading]=useState(false);
  const [kw,setKw]=useState("air purifier\nfamily home\nkids lifestyle");
  const [vidUrl,setVid]=useState("");
  const [chanUrl,setChan]=useState("");
  const [results,setResults]=useState(SEARCH_POOL.map(r=>({...r})));
  const [selected,setSelected]=useState(new Set());
  const [imported,setImported]=useState(new Set());
  const [toast,setToast]=useState(null);

  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const doSearch=()=>{const has=mode==="keyword"?kw.trim():mode==="video"?vidUrl.trim():chanUrl.trim();if(!has)return;setLoading(true);setTimeout(()=>{setLoading(false);setSearched(true);},1400);};
  const toggleSel=id=>{if(results.find(r=>r.id===id)?.exists)return;setSelected(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);return s;});};
  const doImport=()=>{if(!selected.size)return;const ids=[...selected];setImported(p=>new Set([...p,...ids]));setResults(p=>p.map(r=>ids.includes(r.id)?{...r,exists:true}:r));setSelected(new Set());showToast(`Added ${ids.length} to library ✓`);};
  const modes=[{id:"keyword",label:"🔑 Keywords"},{id:"video",label:"🎬 Video URL"},{id:"channel",label:"📡 Channel URL"}];

  return(
    <div>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      <PageHead vol="Creator Discovery" headline="Find. Score." accent="Partner." sub="Search YouTube for creators matching your brand keywords"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <Card title="Search Mode">
          <div style={{padding:"18px"}}>
            <div style={{display:"flex",gap:5,marginBottom:16,background:T.bg,padding:"4px",borderRadius:8,border:`1px solid ${T.border}`}}>
              {modes.map(m=><button key={m.id} onClick={()=>setMode(m.id)} style={{flex:1,padding:"6px 8px",borderRadius:6,fontSize:11.5,cursor:"pointer",fontWeight:800,border:"none",background:mode===m.id?T.text:"transparent",color:mode===m.id?"#fff":T.muted}}>{m.label}</button>)}
            </div>
            {mode==="keyword"&&<FRow label="Keywords — one per line"><Input textarea rows={5} value={kw} onChange={e=>setKw(e.target.value)}/></FRow>}
            {mode==="video"&&<FRow label="YouTube Video URL"><Input value={vidUrl} onChange={e=>setVid(e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/></FRow>}
            {mode==="channel"&&<FRow label="YouTube Channel URL"><Input value={chanUrl} onChange={e=>setChan(e.target.value)} placeholder="https://www.youtube.com/@handle"/></FRow>}
            <Btn onClick={doSearch} disabled={loading} style={{width:"100%",justifyContent:"center",marginTop:4}}>{loading?"⏳ Searching…":"🔍 Search Creators"}</Btn>
          </div>
        </Card>
        <Card title="AI Matching Config">
          <div style={{padding:"18px"}}>
            <FRow label="Target Brand"><Sel><option value="">All Brands</option>{BRANDS.map(b=><option key={b}>{b}</option>)}</Sel></FRow>
            <FRow label="Target Product"><Sel><option>No specific product</option><option>KNKA · APH3000</option><option>MULISOFT · DH500</option><option>7MAGIC · Pro Styler</option></Sel></FRow>
            <FRow label="Add to Project"><Sel><option value="">Don't add yet</option>{projects.map(p=><option key={p.id}>{p.brand} · {p.name}</option>)}</Sel></FRow>
            <Hr/>
            <SectionLabel>Score Guide</SectionLabel>
            {[[T.green,T.greenL,"80–100","Highly recommended"],[T.amber,T.amberL,"60–79","Worth considering"],[T.red,T.redL,"0–59","Low match"]].map(([c,l,r,label])=>(
              <div key={r} style={{display:"flex",alignItems:"center",gap:9,marginBottom:6,padding:"7px 10px",background:l,borderRadius:7}}>
                <div style={{width:26,height:26,borderRadius:"50%",border:`2px solid ${c}`,background:l,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:c,flexShrink:0}}>{r.split("–")[0]}+</div>
                <div><div style={{fontSize:11,fontWeight:800,color:c}}>{r}</div><div style={{fontSize:10,color:T.muted}}>{label}</div></div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {loading&&<div style={{textAlign:"center",padding:"48px",background:T.bgCard,borderRadius:12,border:`1.5px solid ${T.border}`,marginBottom:20}}><div style={{fontFamily:"Georgia,serif",fontSize:26,fontWeight:900,color:T.text,marginBottom:6}}>Searching creators…</div><div style={{fontSize:13,color:T.muted,fontStyle:"italic"}}>Via YouTube Data API v3</div></div>}
      {searched&&!loading&&(
        <Card title="Search Results" badge={<Badge color={T.blue} light={T.blueL}>{results.length} channels</Badge>}
          action={<div style={{display:"flex",gap:6}}><Btn sm variant="ghost" onClick={()=>setSelected(new Set(results.filter(r=>!r.exists).map(r=>r.id)))}>Select New</Btn>{selected.size>0&&<Btn sm variant="dark" onClick={doImport}>Add {selected.size} to Library</Btn>}<Btn sm variant="yellow">🤖 AI Score</Btn></div>}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr><TH w="36px"></TH><TH>Creator</TH><TH>Country</TH><TH>Subs</TH><TH>Avg Views</TH><TH>7d</TH><TH>30d</TH><TH>Email</TH><TH>AI Score</TH><TH>Status</TH></tr></thead>
              <tbody>{results.map(c=>{
                const isSel=selected.has(c.id);
                // patch a discover result field locally
                const patchR=(field,val)=>{
                  const parsed=["subs","avgViews","u7","u30","score"].includes(field)?parseInt(val)||0:val;
                  setResults(p=>p.map(r=>r.id===c.id?{...r,[field]:parsed}:r));
                };
                const InlineNum=({field,value,width=68})=>{
                  const [editing,setEditing]=useState(false);
                  const [v,setV]=useState(String(value??0));
                  if(editing) return(
                    <input autoFocus value={v}
                      onChange={e=>setV(e.target.value)}
                      onBlur={()=>{patchR(field,v);setEditing(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){patchR(field,v);setEditing(false);}}}
                      style={{width,padding:"3px 6px",borderRadius:5,border:`1.5px solid ${T.accent}`,fontSize:12,fontFamily:"inherit",fontWeight:700,outline:"none",background:"#fff",color:T.text}}/>
                  );
                  return(
                    <span onClick={()=>setEditing(true)} title="Click to edit"
                      style={{cursor:"text",borderBottom:`1.5px dashed ${T.border2}`,paddingBottom:1,fontFamily:"Georgia,serif",fontWeight:700}}>
                      {field==="subs"||field==="avgViews"?fmt(value??0):value??0}
                    </span>
                  );
                };
                const InlineTxt=({field,value,width=90,placeholder=""})=>{
                  const [editing,setEditing]=useState(false);
                  const [v,setV]=useState(value||"");
                  if(editing) return(
                    <input autoFocus value={v}
                      onChange={e=>setV(e.target.value)}
                      onBlur={()=>{patchR(field,v);setEditing(false);}}
                      onKeyDown={e=>{if(e.key==="Enter"||e.key==="Escape"){patchR(field,v);setEditing(false);}}}
                      style={{width,padding:"3px 6px",borderRadius:5,border:`1.5px solid ${T.accent}`,fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff",color:T.text}}/>
                  );
                  return(
                    <span onClick={()=>setEditing(true)} title="Click to edit"
                      style={{cursor:"text",borderBottom:`1.5px dashed ${T.border2}`,paddingBottom:1,color:value?T.blue:T.muted2,fontWeight:value?600:400,fontSize:12}}>
                      {value||placeholder||"—"}
                    </span>
                  );
                };
                return(
                  <tr key={c.id} style={{background:isSel?"#FFFBDE":c.exists?T.bg:"transparent",opacity:c.exists?.7:1}}>
                    <TD><input type="checkbox" checked={isSel} disabled={c.exists} onChange={()=>toggleSel(c.id)}/></TD>
                    <TD><div style={{display:"flex",alignItems:"center",gap:9}}><Avatar name={c.name}/><div><div style={{fontWeight:700}}>{c.name}</div><a href={`https://youtube.com/channel/${c.id}`} target="_blank" rel="noreferrer" style={{fontSize:10,color:T.muted,textDecoration:"none"}}>↗ YouTube</a></div></div></TD>
                    <TD><InlineTxt field="country" value={c.country} width={50}/></TD>
                    <TD><InlineNum field="subs" value={c.subs} width={76}/></TD>
                    <TD><InlineNum field="avgViews" value={c.avgViews} width={68}/></TD>
                    <TD><InlineNum field="u7" value={c.u7} width={40}/></TD>
                    <TD><InlineNum field="u30" value={c.u30} width={40}/></TD>
                    <TD><InlineTxt field="email" value={c.email} width={150} placeholder="add email"/></TD>
                    <TD style={{fontSize:12}}>{c.email?<a href={`mailto:${c.email}`} style={{color:T.blue,textDecoration:"none",fontWeight:600}}>{c.email}</a>:<span style={{color:T.muted2}}>—</span>}</TD>
                    <TD><div style={{display:"flex",alignItems:"center",gap:7}}><ScoreRing score={c.score}/><span style={{fontSize:11,fontWeight:700,color:scColor(c.score)}}>{c.brand}</span></div></TD>
                    <TD>{c.exists?<Badge color={T.amber} light={T.amberL}>In Library</Badge>:imported.has(c.id)?<Badge color={T.green} light={T.greenL}>Added ✓</Badge>:<Badge color={T.blue} light={T.blueL}>New</Badge>}</TD>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────
const LS_KEY = "kol_crm_settings";
const loadSettings = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY)||"{}"); } catch { return {}; }
};

function Settings(){
  const saved = loadSettings();
  const [form,setForm]=useState({
    yt_api_key:     saved.yt_api_key||"",
    ai_provider:    saved.ai_provider||"claude",
    ai_model:       saved.ai_model||"claude-sonnet-4-6",
    ai_base_url:    saved.ai_base_url||"https://api.anthropic.com",
    ai_api_key:     saved.ai_api_key||"",
    remember:       saved.remember!==false, // default true
  });
  const [toast,setToast]=useState(null);
  const [showKey,setShowKey]=useState(false);
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const up=k=>e=>setForm(f=>({...f,[k]:e.target.type==="checkbox"?e.target.checked:e.target.value}));

  const save=()=>{
    if(form.remember){
      localStorage.setItem(LS_KEY,JSON.stringify(form));
    } else {
      localStorage.removeItem(LS_KEY);
    }
    showToast("Settings saved ✓");
  };
  const clear=()=>{
    localStorage.removeItem(LS_KEY);
    setForm({yt_api_key:"",ai_provider:"claude",ai_model:"claude-sonnet-4-6",ai_base_url:"https://api.anthropic.com",ai_api_key:"",remember:true});
    showToast("Cleared from local storage");
  };

  const providers=[
    {id:"claude",   label:"Claude (Anthropic)",   model:"claude-sonnet-4-6",      url:"https://api.anthropic.com"},
    {id:"openai",   label:"OpenAI",                model:"gpt-4o",                  url:"https://api.openai.com"},
    {id:"deepseek", label:"DeepSeek",              model:"deepseek-chat",           url:"https://api.deepseek.com"},
    {id:"gemini",   label:"Gemini (Google)",       model:"gemini-1.5-pro",          url:"https://generativelanguage.googleapis.com"},
  ];

  const selectProvider=id=>{
    const p=providers.find(x=>x.id===id);
    if(p) setForm(f=>({...f,ai_provider:id,ai_model:p.model,ai_base_url:p.url}));
  };

  return(
    <div style={{maxWidth:640}}>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      <PageHead vol="System Settings" headline="API Keys." accent="Stored Locally." sub="Keys are saved in your browser's localStorage — never sent to any server other than the API you configure"/>

      {/* Memory toggle notice */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:form.remember?T.greenL:T.amberL,borderRadius:10,border:`1.5px solid ${form.remember?T.green:T.amber}`,marginBottom:22}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",flex:1}}>
          <input type="checkbox" checked={form.remember} onChange={up("remember")} style={{width:16,height:16,accentColor:T.green,cursor:"pointer"}}/>
          <div>
            <div style={{fontSize:13,fontWeight:800,color:form.remember?T.green:T.amber}}>{form.remember?"🔒 Remember Mode ON":"⚠ Remember Mode OFF"}</div>
            <div style={{fontSize:11,color:T.muted,marginTop:2}}>{form.remember?"Keys will persist across browser sessions via localStorage":"Keys cleared when you close this tab"}</div>
          </div>
        </label>
        {form.remember&&<Btn sm variant="ghost" onClick={clear}>Clear Saved</Btn>}
      </div>

      {/* YouTube API */}
      <Card title="🎬 YouTube Data API v3" style={{marginBottom:16}}>
        <div style={{padding:"18px"}}>
          <FRow label="API Key">
            <div style={{display:"flex",gap:8}}>
              <Input value={form.yt_api_key} onChange={up("yt_api_key")} type={showKey?"text":"password"} placeholder="AIza..."/>
              <Btn sm variant="ghost" onClick={()=>setShowKey(p=>!p)} style={{flexShrink:0}}>{showKey?"Hide":"Show"}</Btn>
            </div>
          </FRow>
          <div style={{fontSize:12,color:T.muted,marginTop:-8,lineHeight:1.7}}>
            Get your key at <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" style={{color:T.blue,fontWeight:700}}>console.cloud.google.com</a> →  New Project → Enable YouTube Data API v3 → Credentials → API Key.<br/>
            <span style={{color:T.amber,fontWeight:600}}>Free quota: 10,000 units/day</span> (search costs 100/call, channel detail costs 1/call).
          </div>
        </div>
      </Card>

      {/* AI Provider */}
      <Card title="🤖 AI Provider" style={{marginBottom:16}}>
        <div style={{padding:"18px"}}>
          <FRow label="Provider">
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
              {providers.map(p=>(
                <button key={p.id} onClick={()=>selectProvider(p.id)} style={{
                  padding:"7px 14px",borderRadius:22,fontSize:12,cursor:"pointer",fontWeight:700,
                  border:`1.5px solid ${form.ai_provider===p.id?T.text:T.border}`,
                  background:form.ai_provider===p.id?T.text:"transparent",
                  color:form.ai_provider===p.id?"#fff":T.muted,
                  transition:"all .15s"
                }}>{p.label}</button>
              ))}
            </div>
          </FRow>

          <Grid cols="1fr 1fr" gap={12}>
            <FRow label="Model">
              <Input value={form.ai_model} onChange={up("ai_model")} placeholder="e.g. claude-sonnet-4-6"/>
            </FRow>
            <FRow label="Base URL">
              <Input value={form.ai_base_url} onChange={up("ai_base_url")} placeholder="https://api.anthropic.com"/>
            </FRow>
          </Grid>

          <FRow label="API Key">
            <div style={{display:"flex",gap:8}}>
              <Input value={form.ai_api_key} onChange={up("ai_api_key")} type={showKey?"text":"password"} placeholder="sk-..."/>
              <Btn sm variant="ghost" onClick={()=>setShowKey(p=>!p)} style={{flexShrink:0}}>{showKey?"Hide":"Show"}</Btn>
            </div>
          </FRow>

          {/* Provider quick-ref */}
          <div style={{marginTop:6,padding:"12px 14px",background:T.bg,borderRadius:8,fontSize:12,color:T.muted,lineHeight:1.8}}>
            <strong style={{color:T.text}}>Model reference:</strong><br/>
            Claude: <code>claude-sonnet-4-6</code> · OpenAI: <code>gpt-4o</code> · DeepSeek: <code>deepseek-chat</code> · Gemini: <code>gemini-1.5-pro</code>
          </div>
        </div>
      </Card>

      <div style={{display:"flex",gap:10}}>
        <Btn variant="dark" onClick={save}>Save Settings</Btn>
        <Btn variant="ghost" onClick={clear}>Clear All Keys</Btn>
      </div>
    </div>
  );
}


function Brands(){
  const [brands,setBrands]=useState(INIT_BRANDS);
  const [showModal,setShowModal]=useState(false);
  const [editId,setEditId]=useState(null);
  const [toast,setToast]=useState(null);
  const [form,setForm]=useState({name:"",audience:"",products:"",keywords:""});
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3000);};
  const openAdd=()=>{setEditId(null);setForm({name:"",audience:"",products:"",keywords:""});setShowModal(true);};
  const openEdit=b=>{setEditId(b.id);setForm({name:b.name,audience:b.audience,products:b.products,keywords:b.keywords.join(", ")});setShowModal(true);};
  const save=()=>{if(!form.name.trim())return;const kws=form.keywords.split(",").map(k=>k.trim()).filter(Boolean);if(editId)setBrands(p=>p.map(b=>b.id===editId?{...b,...form,keywords:kws}:b));else setBrands(p=>[...p,{id:Date.now(),...form,keywords:kws}]);setShowModal(false);showToast(editId?"Updated ✓":"Added ✓");};
  const del=id=>{if(!window.confirm("Delete?"))return;setBrands(p=>p.filter(b=>b.id!==id));showToast("Deleted");};
  const BSTATS={KNKA:{projects:4,creators:64,spend:168000},MULISOFT:{projects:2,creators:28,spend:58000},"7MAGIC":{projects:1,creators:50,spend:58500}};
  return(
    <div>
      {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
      <PageHead vol="Brand Portfolio" headline={`${brands.length} Brands. 3 Markets.`} action={<Btn variant="dark" sm onClick={openAdd}>+ New Brand</Btn>}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:18}}>
        {brands.map(b=>{
          const st=BSTATS[b.name]||{projects:0,creators:0,spend:0};
          return(
            <div key={b.id} style={{background:T.bgCard,border:`1.5px solid ${T.border}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{padding:"18px 22px",background:T.bgGray,borderBottom:`2px solid ${T.border2}`,display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:10,background:T.text,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",flexShrink:0,fontFamily:"Georgia,serif",fontWeight:900}}>{b.name.charAt(0)}</div>
                <div style={{flex:1}}><div style={{fontFamily:"Georgia,serif",fontSize:18,fontWeight:900}}>{b.name}</div><div style={{fontSize:11,color:T.muted,fontWeight:600}}>{b.products}</div></div>
                <div style={{display:"flex",gap:6}}><Btn sm variant="ghost" onClick={()=>openEdit(b)}>Edit</Btn><Btn sm variant="danger" onClick={()=>del(b.id)}>✕</Btn></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:`1.5px solid ${T.border}`}}>
                {[["Projects",st.projects],["Creators",st.creators],["Spend",fmtM(st.spend)]].map(([l,v],i)=>(
                  <div key={l} style={{padding:"12px 16px",borderRight:i<2?`1px solid ${T.border}`:"none"}}>
                    <div style={{fontSize:9,fontWeight:800,color:T.muted2,textTransform:"uppercase",letterSpacing:".8px",marginBottom:3}}>{l}</div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:16,fontWeight:900}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{padding:"16px 22px"}}>
                <div style={{marginBottom:12}}><div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:4}}>Target Audience</div><div style={{fontSize:13}}>{b.audience}</div></div>
                <div><div style={{fontSize:9.5,fontWeight:800,color:T.muted,textTransform:"uppercase",letterSpacing:".8px",marginBottom:7}}>Keywords</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{b.keywords.map(k=><span key={k} style={{padding:"3px 10px",borderRadius:20,background:T.bgGray,color:T.muted,fontSize:11,fontWeight:700,border:`1px solid ${T.border2}`}}>{k}</span>)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal open={showModal} onClose={()=>setShowModal(false)} title={editId?"Edit Brand":"New Brand"}>
        <FRow label="Brand Name *"><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. KNKA"/></FRow>
        <FRow label="Target Audience"><Input value={form.audience} onChange={e=>setForm(f=>({...f,audience:e.target.value}))} placeholder="e.g. Families with kids and pets"/></FRow>
        <FRow label="Products"><Input value={form.products} onChange={e=>setForm(f=>({...f,products:e.target.value}))} placeholder="e.g. Air purifiers & air quality"/></FRow>
        <FRow label="Keywords (comma-separated)"><Input value={form.keywords} onChange={e=>setForm(f=>({...f,keywords:e.target.value}))} placeholder="Air Quality, Family, Kids"/></FRow>
        <Hr/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn variant="ghost" onClick={()=>setShowModal(false)}>Cancel</Btn><Btn variant="dark" onClick={save}>Save Brand</Btn></div>
      </Modal>
    </div>
  );
}
