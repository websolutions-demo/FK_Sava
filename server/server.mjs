import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 3000);
const OWNER = process.env.GITHUB_OWNER || 'websolutions-demo';
const REPO = process.env.GITHUB_REPO || 'FK_Sava';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const DATA_PATH = process.env.GITHUB_DATA_PATH || 'club-data.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || ADMIN_PASSWORD || 'change-me';
const ALLOWED = new Set((process.env.ALLOWED_ORIGINS || 'https://websolutions-demo.github.io,http://localhost:8000,http://127.0.0.1:8000,null').split(',').map(x=>x.trim()).filter(Boolean));
const MAX_BODY = 8 * 1024 * 1024;
const loginAttempts = new Map();
const LOGIN_WINDOW = 10 * 60 * 1000;
const LOGIN_MAX = 6;

function cors(req,res){
  const origin=req.headers.origin;
  if(origin && ALLOWED.has(origin)) res.setHeader('Access-Control-Allow-Origin',origin);
  else if(!origin) res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,OPTIONS');
  res.setHeader('Cache-Control','no-store');
}
function send(req,res,status,obj){cors(req,res);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));}
function readJson(req){return new Promise((resolve,reject)=>{let chunks=[],size=0;req.on('data',c=>{size+=c.length;if(size>MAX_BODY){reject(new Error('BODY_TOO_LARGE'));req.destroy();return;}chunks.push(c);});req.on('end',()=>{try{const text=Buffer.concat(chunks).toString('utf8');resolve(text?JSON.parse(text):{});}catch{reject(new Error('INVALID_JSON'));}});req.on('error',reject);});}
function sha(s){return crypto.createHash('sha256').update(String(s)).digest();}
function passwordOk(input){if(!ADMIN_PASSWORD)return false;return crypto.timingSafeEqual(sha(input),sha(ADMIN_PASSWORD));}
function clientIp(req){return String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();}
function loginBlocked(ip){const now=Date.now();const x=loginAttempts.get(ip);if(!x||now-x.start>LOGIN_WINDOW){loginAttempts.set(ip,{start:now,count:0});return false;}return x.count>=LOGIN_MAX;}
function noteLoginFail(ip){const now=Date.now();let x=loginAttempts.get(ip);if(!x||now-x.start>LOGIN_WINDOW)x={start:now,count:0};x.count+=1;loginAttempts.set(ip,x);}
function clearLoginFails(ip){loginAttempts.delete(ip);}
function b64url(input){return Buffer.from(input).toString('base64url');}
function sign(payload){return crypto.createHmac('sha256',SESSION_SECRET).update(payload).digest('base64url');}
function createSession(){const payload=b64url(JSON.stringify({exp:Date.now()+12*60*60*1000}));return `${payload}.${sign(payload)}`;}
function verifySession(token){try{const [p,s]=String(token||'').split('.');if(!p||!s)return false;const expected=sign(p);if(s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected)))return false;const obj=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));return Number(obj.exp)>Date.now();}catch{return false;}}
function authorized(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')&&verifySession(h.slice(7));}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function ghHeaders(){return {'Accept':'application/vnd.github+json','Authorization':`Bearer ${GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'fk-sava-admin-api','Content-Type':'application/json'};}
async function ghGet(path){
  const url=`https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${encodePath(path)}?ref=${encodeURIComponent(BRANCH)}`;
  const r=await fetch(url,{headers:ghHeaders()});
  if(!r.ok){const t=await r.text();throw new Error(`GitHub GET ${r.status}: ${t.slice(0,300)}`);}return r.json();
}
async function ghPut(path,contentBase64,message,shaValue=''){
  const url=`https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${encodePath(path)}`;
  const payload={message,content:contentBase64,branch:BRANCH};if(shaValue)payload.sha=shaValue;
  const r=await fetch(url,{method:'PUT',headers:ghHeaders(),body:JSON.stringify(payload)});
  if(!r.ok){const t=await r.text();throw new Error(`GitHub PUT ${r.status}: ${t.slice(0,500)}`);}return r.json();
}
function validateData(d){
  if(!d||typeof d!=='object'||!Array.isArray(d.years)||!Array.isArray(d.matches)||!Array.isArray(d.gallery))return 'Neispravan club-data.json.';
  if(d.years.length<1||d.years.length>30)return 'Neispravan broj godišta.';
  return '';
}
function safeExt(name){const m=String(name||'').toLowerCase().match(/\.(jpe?g|png|webp)$/);return m?m[0].replace('.jpeg','.jpg'):'';}

const server=http.createServer(async(req,res)=>{
  try{
    cors(req,res);
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health')return send(req,res,200,{ok:true,repo:`${OWNER}/${REPO}`,branch:BRANCH});
    if(url.pathname==='/')return send(req,res,200,{ok:true,name:'FK Sava Admin API'});

    if(url.pathname==='/api/login'&&req.method==='POST'){
      const ip=clientIp(req);
      if(loginBlocked(ip))return send(req,res,429,{error:'Previše neuspešnih prijava. Pokušaj ponovo za nekoliko minuta.'});
      const body=await readJson(req);
      if(!passwordOk(body.password||'')){noteLoginFail(ip);return send(req,res,401,{error:'Pogrešna admin lozinka.'});}
      clearLoginFails(ip);
      return send(req,res,200,{token:createSession(),expiresHours:12});
    }
    if(!url.pathname.startsWith('/api/'))return send(req,res,404,{error:'Not found'});
    if(!authorized(req))return send(req,res,401,{error:'Sesija je istekla. Prijavi se ponovo.'});
    if(!GITHUB_TOKEN)return send(req,res,500,{error:'GITHUB_TOKEN nije podešen na serveru.'});

    if(url.pathname==='/api/club-data'&&req.method==='GET'){
      const file=await ghGet(DATA_PATH);
      const json=JSON.parse(Buffer.from(String(file.content||'').replace(/\n/g,''),'base64').toString('utf8'));
      return send(req,res,200,{data:json,sha:file.sha});
    }
    if(url.pathname==='/api/club-data'&&req.method==='PUT'){
      const body=await readJson(req); const d=body.data; const err=validateData(d);if(err)return send(req,res,400,{error:err});
      const current=await ghGet(DATA_PATH);
      d.meta=d.meta||{};d.meta.updatedAt=new Date().toISOString();d.meta.schemaVersion=3;
      const content=Buffer.from(JSON.stringify(d,null,2),'utf8').toString('base64');
      const out=await ghPut(DATA_PATH,content,`FK Sava CMS: update ${new Date().toISOString()}`,current.sha);
      return send(req,res,200,{ok:true,commitSha:out.commit?.sha||'',contentSha:out.content?.sha||''});
    }
    if(url.pathname==='/api/upload-image'&&req.method==='POST'){
      const body=await readJson(req);const ext=safeExt(body.name);if(!ext)return send(req,res,400,{error:'Dozvoljeni su JPG, PNG i WEBP.'});
      const base64=String(body.contentBase64||'').replace(/^data:[^;]+;base64,/, '');
      const bytes=Math.floor(base64.length*3/4);if(!base64||bytes>5*1024*1024)return send(req,res,400,{error:'Slika mora biti manja od 5 MB.'});
      const year=String(body.year||'misc').replace(/[^0-9a-z_-]/gi,'').slice(0,20)||'misc';
      const rnd=crypto.randomBytes(4).toString('hex');const path=`assets/uploads/${year}/${Date.now()}-${rnd}${ext}`;
      const out=await ghPut(path,base64,`FK Sava CMS: upload ${path}`);
      return send(req,res,200,{ok:true,path,contentSha:out.content?.sha||''});
    }
    return send(req,res,404,{error:'API ruta ne postoji.'});
  }catch(e){
    console.error(e);
    if(e.message==='BODY_TOO_LARGE')return send(req,res,413,{error:'Zahtev je prevelik.'});
    if(e.message==='INVALID_JSON')return send(req,res,400,{error:'Neispravan JSON.'});
    return send(req,res,500,{error:e.message||'Server error'});
  }
});
server.listen(PORT,()=>console.log(`FK Sava Admin API listening on ${PORT}`));
