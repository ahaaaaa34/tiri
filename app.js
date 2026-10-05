/* 問題アプリの画面と判定のしくみ。数学・物理で共通して使う。
   科目ごとの中身（SUBJECT・TOPICS・SIDES・GROUPS・SETS）は data-*.js 側にある。 */
"use strict";

/* このアプリの版。tex.js にも同じものを持たせてある。
   キャッシュに古い tex.js が残っていると、数式だけが崩れて出る
   （index.html はネットワーク優先なので新しく、tex.js だけ古い、という食い違い）。
   実機でそれが起きたので、食い違いを見つけたら一度だけ捨てて読み直す。 */
const APP_V = '7.7';

/* 画面のいちばん上と「ほかの科目」は、科目ごとの決めごとから作る。
   HTML は数学と物理で同じものを使うため。 */
document.title = SUBJECT.title + ' ｜ ' + SUBJECT.cap.replace(/\u3000/g, ' ');
addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('hTitle').textContent = SUBJECT.title;
  document.getElementById('hCap').textContent   = SUBJECT.cap;
  const link = (o)=>'<a class="statlink feedlink" href="'+o.href+'">'+
      '<span class="sl">'+esc(o.name)+'</span>'+
      '<span class="sr">'+esc(o.note)+'</span><span class="arw">\u203a</span></a>';
  const fd = document.getElementById('feedBox');
  if(fd) fd.innerHTML = SUBJECT.feed ? '<p class="sec">別のかたちで</p>'+link(SUBJECT.feed) : '';
  const ot = document.getElementById('otherBox');
  if(ot) ot.innerHTML = (SUBJECT.others && SUBJECT.others.length)
      ? '<p class="sec">ほかの科目</p>' + SUBJECT.others.map(link).join('') : '';
  /* 有効数字を見る科目では、書き方の早見表にもそのことを出す */
  const how = document.getElementById('how');
  if(how && SUBJECT.sigfig){
    const li = document.createElement('span');
    li.innerHTML = '<b>2.0</b><span>けた（有効数字）もそのとおりに。2 は不正解</span>';
    how.insertBefore(li, how.querySelector('.hb'));
  }
});
(function(){
  if(typeof TEX_V !== 'undefined' && TEX_V === APP_V) return;
  try{
    if(sessionStorage.getItem('texfix')) return;   /* 読み直しは1回だけ。堂々めぐりを防ぐ */
    sessionStorage.setItem('texfix', '1');
  }catch(e){ return; }
  const again = ()=>location.reload();
  if(window.caches) caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))).then(again, again);
  else again();
})();

/* =======================================================================
   問題データ
   q   : 問題文（^{} _{} √{} √[n]{} のマークアップが使える）
   g   : 前提として与えられる値（任意）
   a   : 正解として受理する表記の配列
   h   : 入力欄に出すヒント
   e   : 解説
   ======================================================================= */

/* 問題文から固定のIDを作る。
   添字を使うと問題を1問足したり並べ替えるだけで以降のIDがずれて、
   保存済みの間違い記録が別の問題に付いてしまうため。 */
function qhash(s){
  let h = 5381;
  for(let i=0;i<s.length;i++) h = ((h*33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/* すべての問題にIDを付けてフラット化 */
const ALL = [];
TOPICS.forEach(t=>{
  t.qs.forEach(q=>{
    /* IDは各問に書いてある。問題文を直しても記録が迷子にならないようにするため。
       書いていないもの（新しく足した問題）だけ、これまでどおり問題文から作る。 */
    q.id = q.id || (t.id+'-'+qhash(q.q));
    q.topic = t.id;
    q.tname = t.name;
    ALL.push(q);
  });
});
const BYID = {};
ALL.forEach(q=>BYID[q.id]=q);

SETS.forEach(s=>{
  s.qs = s.ids.map(id=>BYID[id]).filter(Boolean);
  s.has = {}; s.qs.forEach(q=>s.has[q.id]=true);
});
/* 範囲は TOPICS と SETS のどちらにあってもよい */
function topicById(id){
  return TOPICS.find(t=>t.id===id) || SETS.find(t=>t.id===id) || null;
}

/* =======================================================================
   数式マークアップ → HTML
   ======================================================================= */
/* a/b を横棒の分数に組み直す。
   1/a^3 の分母は a^3 なので、組み立て済みの <sup>…</sup> や根号のかたまりも
   まとめて分母・分子として拾う。ここを取りこぼすと (1/a)^3 に見えてしまう。 */
const FR_RT  = '<span class="rt">(?:<span class="ri">[^<]*<\\/span>)?&radic;<span class="rb">[^<]*<\\/span><\\/span>';
const FR_TOK = '(?:\\([^()]*\\)|' + FR_RT + '|[0-9a-z.□\\u0001]+)'
             + '(?:<sup>[^<]*<\\/sup>|<sub>[^<]*<\\/sub>)?';
const FR_RE  = new RegExp('('+FR_TOK+')\\/('+FR_TOK+')', 'g');
function fmt(s){
  /* まず KaTeX で組む。読み込めていないときだけ、下の昔の組み方に落ちる。 */
  const k = texHTML(s, esc);
  if(k !== null) return k;
  return fmtOld(s);
}
function fmtOld(s){
  return esc(String(s))
    /* 答えは a^(5/3) のように括弧で書くので、これも上付きとして扱う */
    .replace(/\^\(([^()]*)\)/g,'^{$1}')
    .replace(/√\[(.+?)\]\{(.+?)\}/g,'<span class="rt"><span class="ri">$1</span>&radic;<span class="rb">$2</span></span>')
    .replace(/√\{(.+?)\}/g,'<span class="rt">&radic;<span class="rb">$1</span></span>')
    .replace(/\^\{(.+?)\}/g,'<sup>$1</sup>')
    .replace(/_\{(.+?)\}/g,'<sub>$1</sub>')
    .replace(/\^(-?[0-9a-zA-Z])/g,'<sup>$1</sup>')
    .replace(/_(-?[0-9a-zA-Z])/g,'<sub>$1</sub>')
    .replace(FR_RE, (m,a,b)=>'<span class="fr"><span class="fn">'+a+'</span><span class="fd">'+b+'</span></span>');
}
function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* =======================================================================
   解答の正規化と判定
   ======================================================================= */

/* 不等式は向きを裏返しても同じ意味。
   "0<x<8" ⇔ "8>x>0"、"x≧10" ⇔ "10≦x" を機械的に作って照合する。 */
const FLIP = {'<':'>','>':'<','≦':'≧','≧':'≦'};
function flipIneq(s){
  if(!/[<>≦≧]/.test(s)) return s;
  const parts = s.split(/([<>≦≧])/);          // 項と不等号を交互に取り出す
  return parts.reverse().map(p=>FLIP[p]||p).join('');
}

function nz(s){
  let t = String(s==null?'':s);
  t = t.replace(/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
  t = t.replace(/（/g,'(').replace(/）/g,')');
  t = t.replace(/[，、]/g,',').replace(/．/g,'.');
  t = t.replace(/[①②③④⑤]/g, c=>String('①②③④⑤'.indexOf(c)+1));   // 丸数字で答えても通す
  t = t.replace(/[−–—‐ー]/g,'-');
  t = t.replace(/[\s　]/g,'');
  t = t.toLowerCase();
  t = t.replace(/sqrt/g,'√').replace(/cbrt/g,'∛');
  t = t.replace(/log_/g,'log');   // log_2(3) / log2(3) / log_2 3 を同じ形に寄せる
  /* 3乗根は ∛8 とも √[3]{8} とも書ける。n乗根の形に寄せて同じものとして扱う。 */
  t = t.replace(/∛\(([^()]*)\)/g,'√[3]{$1}').replace(/∛([0-9a-z.]+)/g,'√[3]{$1}');
  /* √2 と √{2}、√[3]{8} と √[3]8 のような書き方の揺れも吸収する */
  t = t.replace(/√\[([^\]]+)\]([0-9a-z.]+)/g,'√[$1]{$2}');
  t = t.replace(/√(?!\[|\{)([0-9a-z.]+)/g,'√{$1}');
  t = t.replace(/√\[2\]\{/g,'√{');    // ⁿ√キーで打った √[2]{2} も ただの √2 と同じ
  t = t.replace(/＜/g,'<').replace(/＞/g,'>').replace(/＝/g,'=').replace(/／/g,'/');
  if(t.indexOf(FBAR)>=0) t = unfrac(t);   /* 4⁄1 → 1/4 */
  t = t.replace(/>=|≥/g,'≧').replace(/<=|≤/g,'≦');
  t = t.replace(/[*・×⋅･]/g,'');
  /* 「分の」キーで 3分の1 を打ってから x を足すと 1x/3 になる。
     -1x や 1(x+1) のような「係数の1」は、書いても書かなくても同じものとして扱う。 */
  t = t.replace(/(^|[+\-(,\/])1(?=[a-z(])/g, '$1');
  t = t.replace(/÷/g,'/');
  t = t.replace(/桁$/,'').replace(/位$/,'').replace(/^小数第/,'');
  if(/^[xyn]=/.test(t) && !/[<>≦≧]/.test(t)) t = t.slice(2);
  /* 「x<-1, 2<x」のように解が2つに分かれる答えは、書く順番も
     不等号の向きも人によって違う。各項を裏返しも含めて一意に決めてから並べ直す。 */
  if(t.indexOf(',')>=0){
    t = t.split(',').filter(v=>v!=='').map(v=>{
      const f = flipIneq(v);
      return f<v ? f : v;
    }).sort().join(',');
  }
  return t;
}
function noParen(s){ return s.replace(/[()]/g,''); }

/* 「分の」キーは 分母 → 分子 の順に打つ（4 分の 1 で 1/4）。
   照合や計算のために A⁄B を B/A に直しておく。 */
const FBAR = '⁄';
const CARET = '\u0001';        // 入力欄のカーソル位置を示す目印
const TOKCH = '[0-9a-zπ.^\u0001]';   // 分数の分母・分子として1かたまりに扱う文字
/* π を入れてあるのは、3 → 分の → 32π と打ったときに 32π をひとかたまりに
   見てほしいため。入れないと 32 だけが分子になり、32/3·π と出てしまう。 */
function tokenL(s, i){          // i の直前にある「ひとかたまり」の開始位置
  /* カーソルの目印は、かたまりの切れ目にしない。
     目印があると (a+b) のようなかっこのかたまりを見落として分数が崩れる。 */
  let k = i-1;
  while(k>=0 && s[k]===CARET) k--;
  if(s[k]===')'){
    let d=0;
    for(let j=k;j>=0;j--){
      if(s[j]===')') d++;
      else if(s[j]==='('){ d--; if(d===0) return j; }
    }
    return k;
  }
  let j=i-1;
  while(j>=0 && new RegExp(TOKCH).test(s[j])) j--;
  return j+1;
}
function tokenR(s, i){          // i の直後にある「ひとかたまり」の終了位置（含まない）
  let k = i+1;
  while(k<s.length && s[k]===CARET) k++;
  if(s[k]==='('){
    let d=0;
    for(let j=k;j<s.length;j++){
      if(s[j]==='(') d++;
      else if(s[j]===')'){ d--; if(d===0) return j+1; }
    }
    return k+1;
  }
  let j=i+1;
  while(j<s.length && new RegExp(TOKCH).test(s[j])) j++;
  return j;
}
function unfrac(t){
  for(let guard=0; guard<40; guard++){
    const i = t.indexOf(FBAR);
    if(i<0) break;
    const a = tokenL(t, i), bEnd = tokenR(t, i);
    const den = t.slice(a, i), num = t.slice(i+1, bEnd);
    if(den==='' || num===''){ t = t.slice(0,i) + '/' + t.slice(i+1); continue; }
    t = t.slice(0,a) + num + '/' + den + t.slice(bEnd);
  }
  return t;
}
function numOf(s){
  const m = /^(-?\d+(?:\.\d+)?)(?:\/(-?\d+(?:\.\d+)?))?$/.exec(s);
  if(!m) return null;
  const d = m[2]!==undefined ? parseFloat(m[2]) : 1;
  if(d===0) return null;
  return parseFloat(m[1])/d;
}
/* 多項式は足す順番を変えても同じ式。x^2-2x と -2x+x^2 のどちらで書いても
   正解になるように、いちばん外側の + と - で項に切り分けて並べ替える。
   かっこや上付きの中にある符号では切らない（x^(n-1) を割らないため）。
   等号・不等号・カンマが入っているものは、順番に意味があるので対象外。 */
function termKey(s){
  if(/[=<>≦≧,]/.test(s)) return null;
  const t = [];
  let d = 0, st = 0, sg = '+', i0 = 0;
  if(s[0]==='+' || s[0]==='-'){ sg = s[0]; i0 = 1; st = 1; }
  for(let i=i0; i<s.length; i++){
    const c = s[i];
    if(c==='(' || c==='{' || c==='[') d++;
    else if(c===')' || c==='}' || c===']') d--;
    else if(d===0 && (c==='+' || c==='-') && '+-*/^_({[,'.indexOf(s[i-1])<0){
      t.push(sg + s.slice(st, i)); sg = c; st = i+1;
    }
  }
  t.push(sg + s.slice(st));
  return t.length > 1 ? t.sort().join('') : null;
}

/* 書き方が違うだけで中身は同じ式、というのを取りこぼさないための保険。
   -3(x-3)^2 と -3x^2+18x-27、4x^2-(1/3)x+2/3 と (12x^2-x+2)/3 のように、
   人によって書き方が分かれるものを、実際に数を入れて計算して見くらべる。
   いくつもの数で必ず一致したときだけ「同じ式」とみなす。
   等号・不等号・カンマが入っているものは値では比べられないので対象外。 */
/* 物理の式も見分けられるように、大文字・添え字（v_0）・μ も通す */
const EVCH = /^[0-9A-Za-z.+\-\/^()√{}\[\]π_μ]+$/;
const RE_NAME = /[A-Za-zμ](?:_[0-9A-Za-z])?/g;
const EVPT = [1.31, 1.87, 2.43, 0.57, 3.11, 4.29];

function evalExpr(s, env){
  let i = 0;
  function atom(){
    const c = s[i];
    if(c === undefined) throw 0;
    if(c === '('){ i++; const v = expr(); if(s[i] !== ')') throw 0; i++; return v; }
    if(c === '{'){ i++; const v = expr(); if(s[i] !== '}') throw 0; i++; return v; }
    if(c === '√'){
      i++;
      let n = 2;
      if(s[i] === '['){ i++; n = expr(); if(s[i] !== ']') throw 0; i++; }
      const v = atom();
      if(v < 0 || n === 0) throw 0;
      return Math.pow(v, 1/n);
    }
    if(c === 'π'){ i++; return Math.PI; }
    if(/[0-9.]/.test(c)){
      const st = i;
      while(i < s.length && /[0-9.]/.test(s[i])) i++;
      const v = parseFloat(s.slice(st, i));
      if(isNaN(v)) throw 0;
      return v;
    }
    if(/[A-Za-zμ]/.test(c)){
      let n = c; i++;
      /* v_0 や v_A のような添え字つきは、まとめて1つの文字として読む */
      if(s[i] === '_' && s[i+1] !== undefined && /[0-9A-Za-z]/.test(s[i+1])){ n += '_' + s[i+1]; i += 2; }
      if(!(n in env)) throw 0;
      return env[n];
    }
    throw 0;
  }
  function power(){
    const b = atom();
    if(s[i] === '^'){ i++; return Math.pow(b, unary()); }
    return b;
  }
  function unary(){
    if(s[i] === '-'){ i++; return -unary(); }
    if(s[i] === '+'){ i++; return unary(); }
    return power();
  }
  function term(){
    let v = unary();
    for(;;){
      if(s[i] === '/'){ i++; const d = unary(); if(d === 0) throw 0; v /= d; }
      else if(s[i] !== undefined && /[0-9A-Za-z.(√{πμ]/.test(s[i])) v *= unary();  /* 4x のような省略した掛け算 */
      else break;
    }
    return v;
  }
  function expr(){
    let v = term();
    while(s[i] === '+' || s[i] === '-'){
      const op = s[i]; i++;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  const out = expr();
  if(i !== s.length || !isFinite(out)) throw 0;
  return out;
}

/* 式に出てくる文字の一覧。v と v_0 は別の文字として数える。 */
function letterSet(s){
  const m = s.match(RE_NAME);
  return m ? Array.from(new Set(m)).sort() : [];
}

function sameValue(a, b){
  if(!EVCH.test(a) || !EVCH.test(b)) return false;
  const ls = letterSet(a);
  if(ls.join(',') !== letterSet(b).join(',')) return false;   /* 使っている文字が違えば別の式 */
  for(let k = 0; k < EVPT.length; k++){
    const env = {};
    for(let j = 0; j < ls.length; j++) env[ls[j]] = EVPT[k] + (j + 1) * 0.137;
    let va, vb;
    try{ va = evalExpr(a, env); vb = evalExpr(b, env); }catch(e){ return false; }
    if(!(Math.abs(va - vb) <= 1e-7 * Math.max(1, Math.abs(va), Math.abs(vb)))) return false;
  }
  return true;
}

/* 有効数字。物理のように「けたまで答えのうち」の科目では、
   数どうしを見くらべるときだけ、書かれたけたもそろっていないと正解にしない。
   2.0 を 2、0.80 を 0.8 と書いたものは不正解になる。
   分数や √ の形で答えたときは、これまでどおり値で見くらべる。 */
const SIGFIG   = !!SUBJECT.sigfig;
const RE_NUMLIT = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:10\^[+-]?\d+)?$/;
function decKey(t){
  t = t.replace(/^\+/, '');
  if(t.charAt(0) === '.') t = '0' + t;
  else if(t.charAt(0) === '-' && t.charAt(1) === '.') t = '-0' + t.slice(1);
  return t.replace(/\.(?![0-9])/g, '');      /* 末尾の「3.」は 3 と同じにする */
}

function judge(input, list){
  const a = nz(input);
  if(a==='') return false;
  const av = [a, flipIneq(a)];
  const at = termKey(a);
  for(let i=0;i<list.length;i++){
    const b = nz(list[i]);
    for(let j=0;j<av.length;j++){
      if(av[j]===b) return true;
      if(noParen(av[j])===noParen(b)) return true;
    }
    if(SIGFIG && RE_NUMLIT.test(b)){
      if(decKey(a) === decKey(b)) return true;
      continue;     /* 数で答える問題。値が同じでも、けたが違えば次の候補へ */
    }
    const bt = termKey(b);
    if(at && bt && (at===bt || noParen(at)===noParen(bt))) return true;
    if(sameValue(a, b)) return true;
    const na=numOf(a), nb=numOf(b);
    if(na!==null && nb!==null && Math.abs(na-nb)<1e-9) return true;
  }
  return false;
}

/* =======================================================================
   学習記録（localStorage）
   ST[qid] = { w: 累計の間違い回数, p: 復習対象フラグ, c: 正解回数 }
   ======================================================================= */
const SKEY = SUBJECT.key + '_stats_v1';
let ST = {};
function loadST(){
  try{
    const r = localStorage.getItem(SKEY);
    ST = r ? JSON.parse(r) : {};
  }catch(e){ ST = {}; }
  if(!ST || typeof ST !== 'object') ST = {};
  /* 差し替えられた問題の記録が残り続けないよう、現在ない問題は捨てる */
  let dropped = false;
  for(const k in ST){
    if(!BYID[k] || !ST[k] || typeof ST[k] !== 'object'){ delete ST[k]; dropped = true; }
  }
  if(dropped) saveST();
}
function saveST(){
  try{ localStorage.setItem(SKEY, JSON.stringify(ST)); }catch(e){}
}
function rec(id){
  if(!ST[id]) ST[id] = {w:0,p:0,c:0};
  return ST[id];
}
function markWrong(id){ const r=rec(id); r.w++; r.p=1; saveST(); }
function markRight(id){ const r=rec(id); r.c++; r.p=0; saveST(); }
function wcount(id){ return ST[id] ? (ST[id].w||0) : 0; }
function isPending(id){ return ST[id] ? ST[id].p===1 : false; }

loadST();

/* =======================================================================
   状態
   ======================================================================= */
const S = {
  mode:'normal',
  shuffle:false,
  topic:null,
  queue:[],
  idx:0,
  okCount:0,
  wrongList:[],
  scored:{},      // このセッションで既に記録した問題
  locked:false    // 判定表示中
};

const $ = id => document.getElementById(id);

/* =======================================================================
   範囲ごとの続き（通常モード）

   同じ範囲をまた選んだとき、前に見ていたところから始められるようにする。
   「続きから」は中断した1件だけを丸ごと戻すもので、こちらは範囲ごとに
   「何問目まで進んだか」だけを覚えておくもの。
   ======================================================================= */
const POSKEY = SUBJECT.key + '_pos_v1';
let POS = {};
function loadPOS(){
  try{ const r = localStorage.getItem(POSKEY); POS = r ? JSON.parse(r) : {}; }catch(e){ POS = {}; }
  if(!POS || typeof POS !== 'object') POS = {};
}
function savePOS(){ try{ localStorage.setItem(POSKEY, JSON.stringify(POS)); }catch(e){} }
/* 並べ替えたときの位置は次に開くと意味が変わるので覚えない */
function posTrackable(){ return S.mode==='normal' && !S.shuffle; }
function setPos(topic, idx){
  if(!topic) return;
  if(idx<=0){ if(POS[topic]!==undefined){ delete POS[topic]; savePOS(); } return; }
  if(POS[topic]===idx) return;
  POS[topic] = idx; savePOS();
}
function getPos(topic, len){
  const v = POS[topic];
  if(typeof v !== 'number' || !(v>0)) return 0;
  return v < len ? v : 0;        /* 問題が減っていたら最初から */
}
function clearPos(topic){ if(POS[topic]!==undefined){ delete POS[topic]; savePOS(); } }
loadPOS();

/* =======================================================================
   出題プール
   ======================================================================= */
function poolOf(topicId, mode){
  let list = SCOPES[topicId] ? scopeList(topicId) : ALL.filter(q=>q.topic===topicId);
  if(mode==='wrong'){
    list = list.filter(q=>isPending(q.id));
    list.sort((a,b)=>wcount(b.id)-wcount(a.id));
  }else if(mode==='freq'){
    list = list.filter(q=>wcount(q.id)>0);
    list.sort((a,b)=>wcount(b.id)-wcount(a.id));
  }
  return list;
}
function shuffled(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const t=a[i]; a[i]=a[j]; a[j]=t;
  }
  return a;
}

/* =======================================================================
   メニュー描画
   ======================================================================= */
const MODE_NOTE = {
  normal:'すべての問題を順番に出題します。',
  wrong:'間違えたまま「まだ正解していない」問題だけを出題します。正解すると次からは出ません。',
  freq:'これまでに間違えた回数が多い問題から順に出題します。正解しても回数は減りません。'
};

/* 範囲を区分けして並べる（範囲を素通しにすると探しにくいため） */

/* 教科書から起こした問題と、こちらで用意した問題は別ものなので、
   まずどれを解くかを選んでもらい、そのあと範囲を選ぶ。
   ここの id は範囲IDの代わりに「まとめて出題」の指定としても使える。 */
/* 旧バージョンで保存されたセッション（両方まとめて）も開けるように残しておく */
const SCOPES = Object.assign({'__all__':{name:'すべての範囲', test:()=>true}}, SIDES);
SETS.forEach(s=>{ SCOPES[s.id] = {name:s.name, qs:s.qs, test:q=>!!s.has[q.id]}; });
/* 組み合わせの範囲は、並べた順そのものが出題順になる */
function scopeList(id){
  const sc = SCOPES[id];
  return sc.qs ? sc.qs.slice() : ALL.filter(sc.test);
}

/* いま選んでいる側。閉じても覚えておく。 */
const SIDEKEY = SUBJECT.key + '_side_v1';
let SIDE = Object.keys(SIDES)[0];
try{ const v = localStorage.getItem(SIDEKEY); if(SIDES[v]) SIDE = v; }catch(e){}
function setSide(id){ SIDE = id; try{ localStorage.setItem(SIDEKEY, id); }catch(e){} }
/* その範囲がどの側に属するか。科目ごとに側の分け方が違うので、
   その範囲の1問目がどの側の条件に合うかで決める。 */
function sideOfTopic(id){
  if(SIDES[id]) return id;
  const t = topicById(id), q = t && t.qs && t.qs[0];
  if(q) for(const k in SIDES) if(SIDES[k].test(q)) return k;
  return Object.keys(SIDES)[0];
}

/* 一度でも正解した問題の割合（範囲ごとの手応えの目安） */
function doneRate(list){
  if(!list.length) return 0;
  let n = 0;
  list.forEach(q=>{ if(ST[q.id] && ST[q.id].c>0) n++; });
  return n/list.length;
}

function renderResume(){
  const box = $('resume');
  const r = readSession();
  if(!r){ box.classList.add('hide'); box.innerHTML=''; return; }
  const t = SCOPES[r.topic] ? SCOPES[r.topic].name : ((topicById(r.topic)||{}).name||'');
  box.classList.remove('hide');
  box.innerHTML =
    '<p class="sec">続きから</p>'+
    '<button class="titem rsm" id="resumeBtn">'+
      '<span class="nm"><b>'+esc(t)+'</b><span>'+(r.idx+1)+'問目から再開 ／ 全'+r.ids.length+'問</span></span>'+
      '<span class="rt2"><span class="arw">›</span></span>'+
    '</button>'+
    '<div class="mfoot" style="padding:2px 0 14px"><button class="lnk" id="dropResume">この続きを破棄する</button></div>';
  $('resumeBtn').addEventListener('click', ()=>resumeSession(r));
  $('dropResume').addEventListener('click', ()=>{ clearSession(); renderResume(); });
}

/* 1枚のカードを作る。範囲カードもトップの2枚もこれで作る。
   前に途中でやめている範囲には、右に「途中から」の小さいボタンを添える。
   カード本体を押せば1問目から、そこを押したときだけ続きから。 */
function mkItem(id, name, desc, n, wsum, rate, isAll, onTap, cont){
  const b = document.createElement('button');
  b.className = 'titem' + (isAll?' all':'');
  if(n===0){ b.disabled = true; }
  let badge = '';
  if(!isAll && S.mode!=='normal' && wsum>0) badge = '<span class="badge">×'+wsum+'</span>';
  /* 通常モードでは、一度でも正解した割合を細い線で示す */
  const bar = (rate>0) ? '<span class="mini-bar"><i style="width:'+Math.round(rate*100)+'%"></i></span>' : '';
  b.innerHTML =
    '<span class="nm"><b>'+esc(name)+'</b><span>'+esc(desc)+'</span>'+bar+'</span>'+
    '<span class="rt2">'+badge+'<span class="num">'+n+'</span><span class="arw">›</span></span>';
  b.addEventListener('click', ()=>{ if(n>0) onTap(); });
  if(!cont) return b;

  const row = document.createElement('div');
  row.className = 'trow';
  const c = document.createElement('button');
  c.className = 'tcont';
  c.innerHTML = '<span class="cl">途中から</span><b>'+cont.at+'問目</b>';
  c.setAttribute('aria-label', name+' の続き、'+cont.at+'問目から');
  c.addEventListener('click', cont.onTap);
  row.appendChild(b); row.appendChild(c);
  return row;
}

/* トップ画面 ── 教科書かオリジナルかを選ぶ */
function renderHome(){
  renderResume();
  const st = tally(ALL);
  $('statPeek').textContent = st.tries
    ? '正解済み '+st.done+'/'+st.n + (st.todo? '　要復習 '+st.todo : '')
    : 'まだ記録がありません';
  const box = $('sidelist');
  box.innerHTML = '';
  Object.keys(SIDES).forEach(sid=>{
    const sd = SIDES[sid];
    const list = scopeList(sid);
    const s = tally(list);
    const desc = s.tries
      ? sd.desc+'　正解済み '+s.done+'/'+s.n+(s.todo? '　要復習 '+s.todo : '')
      : sd.desc;
    box.appendChild(mkItem(sid, sd.name, desc, list.length, 0, doneRate(list), false,
      ()=>{ setSide(sid); renderMenu(); show('menu'); }));
  });
}

function renderMenu(){
  const sd = SIDES[SIDE];
  $('sideTtl').textContent = sd.name;
  $('modeNote').textContent = MODE_NOTE[S.mode];
  Array.prototype.forEach.call($('modeSeg').children, b=>{
    b.classList.toggle('on', b.dataset.m===S.mode);
  });
  /* 復習モードは出題順そのものに意味があるのでシャッフルは無効 */
  $('shufBtn').disabled = S.mode!=='normal';
  $('shufBtn').setAttribute('aria-pressed', (S.shuffle && S.mode==='normal')?'true':'false');

  const box = $('tlist');
  box.innerHTML = '';

  const sideN = poolOf(SIDE, S.mode).length;
  $('sideCap').textContent = S.mode==='normal' ? '全'+scopeList(SIDE).length+'問' : sideN+'問';
  if(sideN===0){
    const d = document.createElement('div');
    d.className = 'empty';
    d.innerHTML = S.mode==='wrong'
      ? 'この区分に復習が必要な問題はありません。<br>通常モードで問題を解くと、間違えた問題がここに集まります。'
      : 'この区分にはまだ間違えた記録がありません。<br>通常モードで問題を解いてみましょう。';
    box.appendChild(d);
    return;
  }

  const mk = (id, name, desc, n, wsum, rate, isAll)=>{
    /* 前に途中でやめた範囲には「途中から」を添える。押さなければ1問目から。 */
    const at = (S.mode==='normal' && !S.shuffle) ? getPos(id, n) : 0;
    const cont = at>0 ? {at:at+1, onTap:()=>startSession(id)} : null;
    return mkItem(id, name, desc, n, wsum, (S.mode==='normal'?rate:0), isAll,
                  ()=>startSession(id, true), cont);
  };

  /* いちばん上は「この区分をまとめて」 */
  const sideRate = doneRate(scopeList(SIDE));
  box.appendChild(mk(SIDE, sd.allName,
    S.mode==='normal'
      ? '通して演習'+(sideRate>0 ? '　正解済み '+Math.round(sideRate*100)+'%' : '')
      : '対象すべて',
    sideN, 0, 0, true));

  /* この区分に属する区切りだけを出す */
  GROUPS.forEach(g=>{
    const ts = g.ids.map(topicById)
                    .filter(t=>t && sideOfTopic(t.id)===SIDE);
    if(!ts.length) return;
    const pools = ts.map(t=>poolOf(t.id, S.mode));
    /* 復習モードで対象0の区分は見出しごと出さない */
    if(pools.every(p=>p.length===0)) return;
    const h = document.createElement('p');
    h.className = 'gsec';
    h.textContent = g.name;
    box.appendChild(h);
    ts.forEach((t,i)=>{
      const p = pools[i];
      const wsum = p.reduce((s,q)=>s+wcount(q.id),0);
      const nm = t.name.replace(/^(教科書|チェック)｜/, '');
      box.appendChild(mk(t.id, nm, t.desc, p.length, wsum, doneRate(t.qs), false));
    });
  });
}

/* =======================================================================
   画面切り替え
   ======================================================================= */
function show(which){
  $('home').classList.toggle('hide', which!=='home');
  $('menu').classList.toggle('hide', which!=='menu');
  $('play').classList.toggle('hide', which!=='play');
  $('done').classList.toggle('hide', which!=='done');
  $('stats').classList.toggle('hide', which!=='stats');
}

/* =======================================================================
   学習状況（ダッシュボード）

   1問は必ず次の3つのどれか1つに入る（重複なし・合計＝問題数）:
     要復習   … p===1（間違えたまま、まだ正解していない）
     正解済み … p===0 かつ c>0
     未着手   … p===0 かつ c===0
   正答率は「解答回数のうち正解だった割合」= Σc / (Σc + Σw)。
   ======================================================================= */
let statSort = 'weak';        // weak: 苦手な順 / order: 出題順

function tally(list){
  let done=0, todo=0, fresh=0, c=0, w=0;
  list.forEach(q=>{
    const r = ST[q.id];
    if(r && r.p===1) todo++;
    else if(r && r.c>0) done++;
    else fresh++;
    if(r){ c += r.c||0; w += r.w||0; }
  });
  const tries = c + w;
  return {n:list.length, done, todo, fresh, c, w, tries,
          acc: tries ? c/tries : null,          // 正答率（未挑戦は null）
          touched: list.length - fresh};
}

function pct(x){ return Math.round(x*100); }

function renderStats(){
  const all = tally(ALL);
  $('stSub').textContent = all.tries ? '解答 '+all.tries+'回' : '';
  const body = $('stBody');
  body.innerHTML = '';

  if(all.tries===0){
    /* 記録が無いときこそ「読み込む」が要るので、持ち出しだけは出しておく */
    body.innerHTML = '<div class="stempty">まだ記録がありません。<br>問題を解くと、範囲ごとの得意・苦手がここに出ます。</div>'+
                     '<p class="sec" style="margin-top:26px">記録の持ち出し</p><div id="bkHost"></div>';
    bkPanel($('bkHost'));
    return;
  }

  /* ヒーロー数値はこの画面に1つだけ。「全問中どれだけ正解済みか」 */
  let html =
    '<div class="hero"><div class="hv">'+pct(all.done/all.n)+'<i>%</i></div>'+
    '<p class="hl">全'+all.n+'問のうち '+all.done+'問を正解済み</p></div>'+
    '<div class="tiles">'+
      '<div class="tile"><span class="tl">解いた問題</span><span class="tv">'+all.touched+'<small>/'+all.n+'</small></span></div>'+
      '<div class="tile"><span class="tl">正答率</span><span class="tv">'+pct(all.acc)+'<small>%</small></span></div>'+
      '<div class="tile"><span class="tl">要復習</span><span class="tv">'+all.todo+'<small>問</small></span></div>'+
    '</div>';

  /* 範囲ごとに集計 */
  const rows = TOPICS.map(t=>({t, s:tally(t.qs)}));
  const played = rows.filter(r=>r.s.tries>0);

  /* いちばん得意・いちばん苦手（挑戦した範囲の中で） */
  if(played.length>=2){
    const byAcc = played.slice().sort((a,b)=>a.s.acc-b.s.acc || b.s.todo-a.s.todo);
    const weak = byAcc[0], strong = byAcc[byAcc.length-1];
    html += '<div class="verdict">'+
      '<div class="vrow bad"><span class="vk">苦手</span><span class="vn">'+esc(weak.t.name)+'</span>'+
        '<span class="vp">正答率 '+pct(weak.s.acc)+'%</span></div>'+
      '<div class="vrow"><span class="vk">得意</span><span class="vn">'+esc(strong.t.name)+'</span>'+
        '<span class="vp">正答率 '+pct(strong.s.acc)+'%</span></div>'+
    '</div>';
  }

  /* 側ごと（教科書／オリジナル など）にもまとめて見えるようにする。
     側が1つしか無い科目では出さない。 */
  const sides = Object.keys(SIDES).map(k=>[SIDES[k].name, scopeList(k)]);
  if(sides.length > 1){
  html += '<p class="sec" style="margin:20px 0 9px">出どころべつ</p>';
  sides.forEach(([nm, list])=>{
    const s = tally(list);
    const seg = (v,cls)=> v>0 ? '<i class="'+cls+'" style="flex:'+v+'"></i>' : '';
    html += '<div class="srow src">'+
      '<span class="sh1"><span class="sn">'+esc(nm)+'</span>'+
        (s.tries ? '<span class="sa">正答率 '+pct(s.acc)+'%</span>'
                 : '<span class="sa none">まだ解いていない</span>')+'</span>'+
      '<span class="sbar">'+seg(s.done,'b1')+seg(s.todo,'b2')+seg(s.fresh,'b3')+'</span>'+
      '<span class="sf"><b>正解済み '+s.done+'</b>'+
        (s.todo? '<span class="w">要復習 '+s.todo+'</span>' : '')+
        (s.fresh? '<span>未着手 '+s.fresh+'</span>' : '')+
        '<span>全'+s.n+'問</span></span>'+
    '</div>';
  });
  }

  html += '<div class="mrow"><p class="sec" style="margin:16px 0 0">範囲べつ</p>'+
    '<div class="seg mini" id="sortSeg" style="width:150px">'+
      '<button data-s="weak"'+(statSort==='weak'?' class="on"':'')+'>苦手な順</button>'+
      '<button data-s="order"'+(statSort==='order'?' class="on"':'')+'>出題順</button>'+
    '</div></div>'+
    '<div class="legend"><span><i class="k1"></i>正解済み</span><span><i class="k2"></i>要復習</span>'+
    '<span><i class="k3"></i>未着手</span></div>';

  /* 苦手な順 = 正答率の低い順。未挑戦の範囲は最後にまとめる。 */
  const sorted = statSort==='order' ? rows : rows.slice().sort((a,b)=>{
    if(a.s.tries===0 && b.s.tries===0) return 0;
    if(a.s.tries===0) return 1;
    if(b.s.tries===0) return -1;
    return a.s.acc-b.s.acc || b.s.todo-a.s.todo;
  });

  sorted.forEach(({t,s})=>{
    const seg = (v,cls)=> v>0 ? '<i class="'+cls+'" style="flex:'+v+'"></i>' : '';
    html += '<button class="srow" data-topic="'+t.id+'">'+
      '<span class="sh1"><span class="sn">'+esc(t.name)+'</span>'+
        (s.tries ? '<span class="sa">正答率 '+pct(s.acc)+'%</span>'
                 : '<span class="sa none">まだ解いていない</span>')+'</span>'+
      '<span class="sbar">'+seg(s.done,'b1')+seg(s.todo,'b2')+seg(s.fresh,'b3')+'</span>'+
      '<span class="sf"><b>正解済み '+s.done+'</b>'+
        (s.todo? '<span class="w">要復習 '+s.todo+'</span>' : '')+
        (s.fresh? '<span>未着手 '+s.fresh+'</span>' : '')+
        (s.w? '<span>間違い計 '+s.w+'回</span>' : '')+'</span>'+
    '</button>';
  });

  /* よく間違える問題 */
  const worst = ALL.filter(q=>wcount(q.id)>0)
                   .sort((a,b)=>wcount(b.id)-wcount(a.id))
                   .slice(0,6);
  if(worst.length){
    html += '<p class="sec" style="margin:22px 0 9px">よく間違える問題</p><div class="wq">';
    worst.forEach(q=>{
      html += '<button class="wqi" data-q="'+q.id+'">'+
        '<span class="h"><span class="q mq">'+fmt(q.q)+'</span><span class="n">×'+wcount(q.id)+'</span></span>'+
        '<span class="t">'+esc(q.tname)+(isPending(q.id)?' ／ まだ正解していません':'')+'</span>'+
        /* 証明問題（自己採点）には照合用の正解がないので、解答だけを見せる */
        '<span class="x hide">'+(q.a ? '正解 '+fmt(q.a[0])+'<br>' : '')+fmt(q.e)+'</span>'+
      '</button>';
    });
    html += '</div>';
  }

  html += '<p class="sec" style="margin-top:26px">記録の持ち出し</p><div id="bkHost"></div>';
  body.innerHTML = html;
  bkPanel($('bkHost'));

  $('sortSeg').addEventListener('click', e=>{
    const b = e.target.closest('button');
    if(!b) return;
    statSort = b.dataset.s;
    renderStats();
  });
  /* 範囲をタップ → その範囲を演習（要復習があれば復習モードで） */
  body.querySelectorAll('.srow[data-topic]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const t = el.dataset.topic;
      const s = tally((topicById(t)||{qs:[]}).qs);
      S.mode = s.todo>0 ? 'wrong' : 'normal';
      startSession(t);
    });
  });
  /* 問題をタップ → 解説の開閉 */
  body.querySelectorAll('.wqi').forEach(el=>{
    el.addEventListener('click', ()=>el.querySelector('.x').classList.toggle('hide'));
  });
}

function openStats(){ renderStats(); show('stats'); }
$('statBtn').addEventListener('click', openStats);
$('stBack').addEventListener('click', ()=>{ renderHome(); show('home'); });

/* =======================================================================
   セッション
   ======================================================================= */
function startSession(topicId, fromStart){
  let p = poolOf(topicId, S.mode);
  if(p.length===0){ renderMenu(); return; }
  /* 復習系のモードは「間違いが多い順」に意味があるので並べ替えない */
  if(S.shuffle && S.mode==='normal') p = shuffled(p);
  if(fromStart) clearPos(topicId);
  const at = (!fromStart && S.mode==='normal' && !S.shuffle) ? getPos(topicId, p.length) : 0;
  runQueue(p, topicId, at);
}
/* 問題の並びを受け取ってセッションを始める（復習セッションもここを通る） */
function runQueue(list, topicId, at){
  closeSheets();
  S.locked = false; S.resFor = null;
  S.topic = topicId;
  S.queue = list;
  S.idx = (at>0 && at<list.length) ? at : 0;
  S.okCount = 0;
  S.wrongList = [];
  S.scored = {};
  resetPadStore();
  show('play');
  requestAnimationFrame(()=>{ setupPad(); renderQ(); });
}

function curQ(){ return S.queue[S.idx]; }

/* ---- 中断しても続きから再開できるようにセッションを保存する ---- */
const RKEY = SUBJECT.key + '_session_v1';
/* 途中で抜けても失わないよう、1問進むたびに保存する。
   書きかけの解答と、いま書いている計算も一緒に持たせる。 */
const PAD_SAVE_MAX = 300000;   // 手書きの保存はこの文字数まで（進み具合は必ず残す）
function packStrokes(){
  try{
    const r = Math.round;
    const a = strokes.map(s=>({t:s.tool==='era'?1:0, w:s.w,
      p:s.pts.map(pt=>[r(pt.x*10)/10, r(pt.y*10)/10])}));
    return JSON.stringify(a).length > PAD_SAVE_MAX ? [] : a;
  }catch(e){ return []; }
}
function unpackStrokes(a){
  if(!Array.isArray(a)) return [];
  return a.map(s=>({tool:s.t?'era':'pen', w:s.w,
    pts:(s.p||[]).map(q=>({x:q[0], y:q[1]}))}));
}
function saveSession(){
  const base = {
    topic:S.topic, mode:S.mode, idx:S.idx, ok:S.okCount,
    ids:S.queue.map(q=>q.id), wrong:S.wrongList, scored:Object.keys(S.scored),
    draft:IV, t:Date.now(),
    pw:0, ph:0   /* 昔の版が読んでいた「書いたときの広さ」。いまは使わない */
  };
  try{
    localStorage.setItem(RKEY, JSON.stringify(Object.assign({pad:packStrokes()}, base)));
  }catch(e){
    /* 手書きが大きすぎて入らないときは、それだけ諦めて進み具合は必ず残す */
    try{ localStorage.setItem(RKEY, JSON.stringify(base)); }catch(e2){}
  }
}
function clearSession(){ try{ localStorage.removeItem(RKEY); }catch(e){} }
function readSession(){
  try{
    const r = JSON.parse(localStorage.getItem(RKEY)||'null');
    if(!r || !r.ids || !r.ids.length) return null;
    if(Date.now()-r.t > 1000*60*60*24*14) return null;      // 2週間で失効
    if(r.idx<0 || r.idx>=r.ids.length) return null;          // 完了済みは復帰しない
    /* 何か手をつけていれば復帰させる。1問目でも、書いた計算や
       書きかけの解答があるなら失わせない。 */
    const started = r.idx>0 || (r.scored&&r.scored.length) ||
                    (r.draft&&r.draft.length) || (r.pad&&r.pad.length);
    if(!started) return null;
    if(r.ids.some(id=>!BYID[id])) return null;
    return r;
  }catch(e){ return null; }
}
function resumeSession(r){
  S.mode = r.mode;
  S.topic = r.topic;
  setSide(sideOfTopic(r.topic));   /* 続きから入ったときも、戻り先の側をそろえる */
  S.queue = r.ids.map(id=>BYID[id]);
  S.idx = r.idx;
  S.okCount = r.ok;
  S.wrongList = r.wrong||[];
  S.scored = {};
  (r.scored||[]).forEach(id=>{ S.scored[id]=true; });
  resetPadStore();
  /* 書いたときの広さに物差しを合わせる。合わせないと、画面の向きや
     問題文のたたみ方が変わっているぶんだけ、書いた形がずれて出る。 */
  /* 昔の版で保存されたぶんは、物差しの上の座標で入っている。
     いまは画面のピクセルで持つので、はみ出していれば setupPad が収めてくれる。 */
  show('play');
  requestAnimationFrame(()=>{
    setupPad();
    renderQ();
    /* 中断したときの解答と計算を戻す */
    const back = unpackStrokes(r.pad);
    if(back.length){ strokes.push.apply(strokes, back); bake(); }
    if(r.draft){ IV = r.draft; IC = IV.length; paintField(); }
  });
}

function renderQ(){
  const q = curQ();
  if(!q){ finish(); return; }
  if(posTrackable()) setPos(S.topic, S.idx);
  const tName = SCOPES[S.topic] ? q.tname : (topicById(S.topic)||{}).name;
  $('pTitle').textContent = tName || '';
  $('pCount').textContent = (S.idx+1)+' / '+S.queue.length;
  $('progBar').style.width = (S.idx/S.queue.length*100)+'%';
  $('qText').innerHTML = fmt(q.q);
  if(q.g){
    $('qGiven').innerHTML = 'ただし ' + fmt(q.g) + ' とする';
    $('qGiven').classList.remove('hide');
  }else{
    $('qGiven').classList.add('hide');
  }
  const w = wcount(q.id);
  $('qWrong').textContent = w>0 ? '間違い '+w+'回' : '';
  /* 自分でたたんだ／開いたときはその状態を引き継ぐ。
     まだ触っていないなら、画面が低いとき（横向きなど）だけ自動でたたむ
     （与えられた値がある問題は隠れてしまうので開いたまま）。 */
  setFold(foldPref !== null ? foldPref : (innerHeight <= 520 && !q.g));
  usePad(S.idx+'/'+q.id);
  resetInput();
  S.locked = false; S.resFor = null;
  syncPrev();
  saveSession();
}
/* 問題文のたたみ／ひらき。null は「まだ自分で選んでいない」 */
let foldPref = null;
function setFold(on){
  const box = $('qBox');
  box.classList.toggle('fold', on);
  box.setAttribute('aria-expanded', on?'false':'true');
  $('qFold').textContent = on ? 'ひらく' : 'たたむ';
  if(!$('play').classList.contains('hide')) requestAnimationFrame(setupPad);
}
$('qBox').addEventListener('click', ()=>{
  foldPref = !$('qBox').classList.contains('fold');
  setFold(foldPref);
});

/* 「前の問題」は1問目では押せない */
function syncPrev(){
  const b = $('mPrev');
  if(b) b.disabled = S.idx===0;
}

/* =======================================================================
   問題を選ぶ

   1問ずつ進むだけだと、戻りたいときや飛ばしたいときに困る。
   この範囲の一覧を出して、どれからでも始められるようにする。
   ======================================================================= */
function jumpMark(q){
  if(!S.scored[q.id]) return ['na','未'];
  return S.wrongList.indexOf(q.id) >= 0 ? ['ng','×'] : ['ok','○'];
}
/* 数式を組むのは重い。227問ぶんを一度に組むと、開くまで1秒以上かかって
   画面が固まったように見える。見えているところだけ組んで、
   スクロールで近づいたぶんを足していく。 */
let jumpIO = null;
function jumpShow(b){
  if(!b.dataset.raw) return;
  b.querySelector('.jq').innerHTML = fmt(b.dataset.raw);
  delete b.dataset.raw;
}
function openJump(){
  const list = $('jumpList');
  if(jumpIO){ jumpIO.disconnect(); jumpIO = null; }
  list.innerHTML = '';
  const frag = document.createDocumentFragment();
  S.queue.forEach((q, i)=>{
    const [cls, mk] = jumpMark(q);
    const b = document.createElement('button');
    b.className = 'jitem' + (i===S.idx ? ' now' : '');
    b.dataset.i = i;
    b.dataset.raw = q.q;
    b.innerHTML = '<span class="jn">'+(i+1)+'</span>'+
                  '<span class="jq mq">'+esc(q.q)+'</span>'+
                  '<span class="jm '+cls+'">'+mk+'</span>';
    frag.appendChild(b);
  });
  list.appendChild(frag);
  const items = list.children;
  if('IntersectionObserver' in window){
    jumpIO = new IntersectionObserver(es=>{
      es.forEach(en=>{ if(en.isIntersecting){ jumpShow(en.target); jumpIO.unobserve(en.target); } });
    }, {root:list, rootMargin:'400px'});
    for(let i=0;i<items.length;i++) jumpIO.observe(items[i]);
  }else{
    for(let i=0;i<items.length;i++) jumpShow(items[i]);
  }
  const done = S.queue.filter(q=>S.scored[q.id]).length;
  $('jumpCap').textContent = done + ' / ' + S.queue.length + ' 問';
  openSheet($('jumpSheet'));
  /* いま解いている問題が見えるところに来るように */
  const now = list.querySelector('.jitem.now');
  if(now){ jumpShow(now); now.scrollIntoView({block:'center'}); }
}
$('jumpList').addEventListener('click', e=>{
  const b = e.target.closest('.jitem');
  if(!b) return;
  goTo(parseInt(b.dataset.i, 10));
});
function goTo(i){
  closeSheets();
  if(!(i >= 0 && i < S.queue.length) || i === S.idx) return;
  S.idx = i;
  setTimeout(()=>{ renderQ(); }, 180);
}

function next(){
  S.idx++;
  if(S.idx>=S.queue.length){ finish(); }
  else{ renderQ(); }
}
function prev(){
  if(S.idx===0) return;
  S.idx--;
  renderQ();
}
/* 画面が切り替わる前の 180ms のあいだに、同じボタンを続けて叩かれることがある。
   （はやく2回たたく癖のある操作では、2回目・3回目も同じボタンに乗る。）
   押したときの問題番号を覚えておいて、まだそこにいるときだけ動かす。
   こうしないと「次の問題へ」を3回たたいたときに3問先まで飛んでしまう。 */
function laterMove(fn){
  const from = S.idx;
  setTimeout(()=>{ if(S.idx === from) fn(); }, 180);
}

function finish(){
  clearSession();
  clearPos(S.topic);          /* 最後まで解いたので、次はまた1問目から */
  $('progBar').style.width = '100%';
  const n = S.queue.length;
  $('dScore').innerHTML = S.okCount + '<i>/ '+n+'</i>';
  $('dSub').textContent = S.okCount===n ? 'ぜんぶ正解' : '正解数';

  const wrap = $('dWrongWrap'), list = $('dWrong');
  list.innerHTML = '';
  if(S.wrongList.length){
    wrap.classList.remove('hide');
    S.wrongList.forEach(id=>{
      const q = BYID[id];
      const d = document.createElement('button');
      d.className = 'witem';
      d.innerHTML = '<span class="q mq">'+fmt(q.q)+(q.g?'<span class="wg">（'+fmt(q.g)+'）</span>':'')+'</span>'+
                    '<span class="a">'+(q.a ? '正解 <b class="mq">'+fmt(q.a[0])+'</b> ／ ' : '')+
                    '累計 '+wcount(id)+'回'+
                    '<span class="more">'+(q.a?'解説':'解答')+'</span></span>'+
                    '<span class="wexp hide">'+fmt(q.e)+'</span>';
      /* タップで解説を開閉する（結果画面でそのまま復習できるように） */
      d.addEventListener('click', ()=>{
        const ex = d.querySelector('.wexp');
        const open = ex.classList.toggle('hide');
        d.querySelector('.more').textContent = open ? (q.a?'解説':'解答') : '閉じる';
      });
      list.appendChild(d);
    });
  }else{
    wrap.classList.add('hide');
  }

  const bts = $('dBtns');
  bts.innerHTML = '';
  const add = (label, ghost, fn)=>{
    const b = document.createElement('button');
    b.className = 'pbtn' + (ghost?' ghost':'');
    b.textContent = label;
    b.addEventListener('click', fn);
    bts.appendChild(b);
  };
  if(S.wrongList.length){
    const again = S.wrongList.slice();
    add('間違えた問題をもう一度', false, ()=>runQueue(again.map(id=>BYID[id]), S.topic));
  }
  add('同じ範囲をもう一度', S.wrongList.length>0, ()=>startSession(S.topic, true));
  add('メニューに戻る', true, goHome);
  show('done');
}

function goHome(){
  /* 抜けるときも必ず保存する。あとで「続きから」で同じ場所に戻れる。 */
  if(!$('play').classList.contains('hide') && S.queue.length) saveSession();
  closeSheets();
  if(S.topic) setSide(sideOfTopic(S.topic));   /* 解いていた側のメニューへ戻す */
  renderHome();
  renderMenu();
  show('menu');
}

/* メニューからトップ（教科書／オリジナルの選択）へ */
function goTop(){ renderHome(); show('home'); }

/* アプリを閉じた・切り替えたときも取りこぼさない */
function saveIfPlaying(){
  if(!$('play').classList.contains('hide') && S.queue.length) saveSession();
}
window.addEventListener('pagehide', saveIfPlaying);
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='hidden') saveIfPlaying();
});

/* =======================================================================
   計算スペース（キャンバス）

   確定したストロークはオフスクリーンに焼き込んでおき、描画中は
   「焼き込み済みの画像 ＋ 今引いている1本」だけを描く。
   一面に書き込んでも1回の描画コストが増えないようにするため。
   ======================================================================= */
const pad  = $('pad');
const ctx  = pad.getContext('2d');
const buf  = document.createElement('canvas');
const bctx = buf.getContext('2d');

let strokes = [];        // {tool,w,pts:[{x,y}]}
let redoStack = [];
let drawing = false, cur = null;
let tool = 'pen';
let penW = 2.2;          // 細 1.6 / 中 2.2 / 太 3.4
let eraW = 24;
let penSeen = false;
let fromTouch = false;         /* touch のほうで書き始めているか */     // スタイラスを検出したら以後タッチは無視（手のひら対策）
let dpr = 1;
/* 書いたものは、画面のピクセルそのままで持つ。
   以前は「書いたときの広さ」を物差しにして、今の広さとの比で縮めて出していた。
   ところが、縮んでいる最中に書いた線はその比で割って保存されるので、
   画面を戻すと比が戻ったぶんだけ大きくなってしまった（横で書いて縦に戻すと1.33倍）。
   いまは比をかけない。書いた大きさのまま、ずっと変わらない。
   画面がせまくなって枠からはみ出しても、こちらでは勝手に縮めない。
   （縮めると、そのあとに書いた線まで巻きこんでしまうため）
   はみ出したときは「枠に収める」ボタンが押せるようになるので、
   縮めるかどうかは自分で決める。画面を戻せば、そのまま元どおり見える。 */
let padKey = null;
const padStore = {};     // 問題ごとに計算内容を保持（前の問題に戻っても残る）
const padOrder = [];     // 古いものから捨てるための順番

function setupPad(){
  const r = pad.getBoundingClientRect();
  if(r.width===0 || r.height===0) return;
  dpr = Math.min(window.devicePixelRatio||1, 2.5);
  pad.width  = buf.width  = Math.round(r.width*dpr);
  pad.height = buf.height = Math.round(r.height*dpr);
  bake();
}
/* キャンバスの大きさが、いまの枠と食い違っていないか。
   食い違ったまま書くと、指の位置と線がずれる。 */
function padStale(){
  const r = pad.getBoundingClientRect();
  if(!r.width || !r.height) return false;
  return Math.abs(pad.width  - Math.round(r.width *dpr)) > 1
      || Math.abs(pad.height - Math.round(r.height*dpr)) > 1;
}
/* 計算スペースを作り直す。「次の問題へ」で直るのと同じことを、ほかのきっかけでもやる。
   iPad の Safari は、画面を消したり別のアプリに移ったりすると、
   キャンバスの中身を捨ててしまうことがある。戻ってきても誰も描き直さないので、
   書いたものが消えたり、その上にさらに書いて ぐちゃぐちゃになっていた。
   問題を移ると usePad → bake で焼き直されるので直る、という話だった。
   ここで同じ焼き直しをする。線そのものは strokes に残っているので、何も失われない。 */
let rfT = null;
function refreshPad(tries){
  if($('play').classList.contains('hide')) return;
  if(drawing){ refreshPadSoon(); return; }   /* 書いている途中には割りこまない */
  const r = pad.getBoundingClientRect();
  if(!r.width || !r.height){        /* まだ形が決まっていない。次の回で */
    if((tries||0) < 12) requestAnimationFrame(()=>refreshPad((tries||0)+1));
    return;
  }
  setupPad();                       /* 大きさを取り直して、焼き直す */
}
function refreshPadSoon(){ clearTimeout(rfT); rfT = setTimeout(()=>refreshPad(0), 60); }
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') refreshPadSoon();
});
window.addEventListener('pageshow', refreshPadSoon);
window.addEventListener('focus', refreshPadSoon);

/* すべての線の外接。redo に積んだぶんも一緒に動かす（やり直しても形が合うように） */
function inkBox(){
  const all = strokes.concat(redoStack);
  let x0=1e9, y0=1e9, x1=-1e9, y1=-1e9;
  all.forEach(s=>s.pts.forEach(p=>{
    if(p.x<x0) x0=p.x;  if(p.y<y0) y0=p.y;
    if(p.x>x1) x1=p.x;  if(p.y>y1) y1=p.y;
  }));
  return x1<x0 ? null : {x0, y0, x1, y1, all};
}
function scaleInk(all, k, dx, dy){
  all.forEach(s=>{
    s.w *= k;
    s.pts.forEach(p=>{ p.x = p.x*k + dx; p.y = p.y*k + dy; });
  });
}
/* いまの枠からはみ出しているか（少しの余裕は見逃す） */
function inkOutside(r){
  const b = inkBox();
  return !!b && (b.x1 > r.width - 2 || b.y1 > r.height - 2 || b.x0 < -2 || b.y0 < -2);
}

function inkStroke(c, s){
  if(!s.pts.length) return;
  c.save();
  c.setTransform(dpr,0,0,dpr,0,0);
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.lineWidth = s.w;
  if(s.tool==='era'){
    c.globalCompositeOperation = 'destination-out';
    c.strokeStyle = c.fillStyle = 'rgba(0,0,0,1)';
  }else{
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = c.fillStyle = '#111111';
  }
  if(s.pts.length===1){
    c.beginPath();
    c.arc(s.pts[0].x, s.pts[0].y, s.w/2, 0, Math.PI*2);
    c.fill();
  }else{
    c.beginPath();
    c.moveTo(s.pts[0].x, s.pts[0].y);
    for(let i=1;i<s.pts.length-1;i++){
      const mx=(s.pts[i].x+s.pts[i+1].x)/2, my=(s.pts[i].y+s.pts[i+1].y)/2;
      c.quadraticCurveTo(s.pts[i].x, s.pts[i].y, mx, my);
    }
    const L = s.pts[s.pts.length-1];
    c.lineTo(L.x, L.y);
    c.stroke();
  }
  c.restore();
}
/* 全ストロークをバッファに焼き直す（undo・消去・リサイズ時だけ） */
function bake(){
  bctx.setTransform(1,0,0,1,0,0);
  bctx.clearRect(0,0,buf.width,buf.height);
  for(let i=0;i<strokes.length;i++) inkStroke(bctx, strokes[i]);
  paint();
}
/* 画面に反映（描いている最中の1本だけ上乗せ） */
function paint(){
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,pad.width,pad.height);
  ctx.drawImage(buf,0,0);
  if(cur) inkStroke(ctx, cur);
  drawLasso(ctx);
  const n = strokes.length + (cur?1:0);
  $('padHint').style.opacity = n ? 0 : 1;
  $('tUndo').disabled = strokes.length===0;
  /* はみ出していないときは することが無いので押せないようにする。
     押しても何も起きないと「効かない」に見えるため。
     逆に、はみ出しているときは目にとまるよう色を変える。 */
  const out = strokes.length>0 && inkOutside(pad.getBoundingClientRect());
  $('tFit').disabled = !out;
  $('tFit').classList.toggle('warn', out);
  $('tRedo').disabled = redoStack.length===0;
}
function ptOf(e){
  const r = pad.getBoundingClientRect();
  /* 画面のピクセルそのまま。倍率をかけないので、あとから大きさが変わらない。 */
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

/* iPad の Safari は、はやく2回つづけて触ると、2回目を「ジェスチャかも」と
   握ったまま返してこない。2回目の pointerdown も touchstart も届かず、
   点が打てない（たんたん、の2つ目が書けない）。
   touch の既定の動きをこちらで止めておくと、Safari はジェスチャ判定を
   あきらめて、ふつうに合図を返してくるようになる。
   実機で4とおり試して、これだけが通った。 */
['touchstart','touchmove','touchend'].forEach(t=>
  pad.addEventListener(t, e=>{ e.preventDefault(); }, {passive:false}));

/* 書き始めの下ごしらえ。pointer からでも touch からでも同じところを通す。 */
function beginStroke(p){
  drawing = true;
  if(tool === 'sel'){ lasso = [p]; paint(); return; }
  redoStack.length = 0;
  cur = { tool:tool, w: tool==='era'?eraW:penW, pts:[p] };
  paint();
}
pad.addEventListener('pointerdown', e=>{
  if(e.pointerType==='pen') penSeen = true;
  if(penSeen && e.pointerType==='touch') return;
  if(e.pointerType==='mouse' && e.button!==0) return;
  if(fromTouch) return;                 /* touch のほうでもう始まっている */
  e.preventDefault();
  /* 何かの拍子に文字が選ばれていたら、書き始めに解いておく */
  const sel = window.getSelection && window.getSelection();
  if(sel && !sel.isCollapsed) sel.removeAllRanges();
  if(padStale()) setupPad();        /* 大きさが食い違っていたら、書き始める前に直す */
  beginStroke(ptOf(e));
  /* 画面の外まで手が出ても追えるようにする。
     ここでしくじっても書き始めはもう済んでいるので、線は消えない。 */
  try{ pad.setPointerCapture(e.pointerId); }catch(err){}
});
pad.addEventListener('pointermove', e=>{
  if(drawing && lasso){
    /* 点の拾い方もペンと同じにする。指の動きを取りこぼさない。 */
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for(let i=0;i<evs.length;i++){
      const p = ptOf(evs[i]);
      const last = lasso[lasso.length-1];
      if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y) < 0.7) continue;
      lasso.push(p);
    }
    paint();
    return;
  }
  if(!drawing || !cur) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for(let i=0;i<evs.length;i++){
    const p = ptOf(evs[i]);
    const last = cur.pts[cur.pts.length-1];
    if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y) < 0.7) continue;
    cur.pts.push(p);
  }
  paint();
});
function endDraw(){
  if(!drawing) return;
  drawing = false;
  if(lasso){ cutLasso(); return; }
  if(cur){ strokes.push(cur); inkStroke(bctx, cur); cur = null; }
  paint();
}
pad.addEventListener('pointerup', endDraw);
pad.addEventListener('pointercancel', endDraw);

/* 2本指タップで1つ戻す（手書きアプリの定番操作） */
let twoAt = 0;
/* ペンが混じっているときは「2本指」と見なさない。
   ペン＋手のひら を2本指と取りちがえると、書いている線が消える。 */
function fingersOnly(e){
  for(let i=0;i<e.touches.length;i++) if(e.touches[i].touchType === 'stylus') return false;
  return true;
}
pad.addEventListener('touchstart', e=>{
  if(e.touches.length===2 && fingersOnly(e)){
    twoAt = Date.now();
    /* 指で引きかけた線だけ取り消す。ペンで書いている線には触らない。 */
    if(drawing && !penSeen){ drawing=false; cur=null; paint(); }
  }
}, {passive:true});
pad.addEventListener('touchend', e=>{
  if(twoAt && e.touches.length===0){
    const quick = Date.now()-twoAt < 320;
    twoAt = 0;
    if(quick) undo();
  }
}, {passive:true});

/* iPad で、はやく2回つづけて点を打つと、2回目の pointerdown が
   ブラウザに飲みこまれて届かないことがある（2回目だけ書けない）。
   届かなかったときだけ、touch のほうで拾い直す。
   pointer が来ていれば drawing がもう立っているので、ここは素通りする。 */
function penTouch(t){
  if(!t) return false;
  return !penSeen || t.touchType === 'stylus';   /* ペンを使い出したら手のひらは無視 */
}
pad.addEventListener('touchstart', e=>{
  if(drawing || e.touches.length !== 1) return;
  const t = e.changedTouches[0];
  if(!penTouch(t)) return;
  fromTouch = true;
  beginStroke(ptOf(t));
}, {passive:true});
pad.addEventListener('touchmove', e=>{
  if(!fromTouch || !drawing) return;
  const arr = lasso || (cur && cur.pts);
  if(!arr || !arr.length) return;
  const p = ptOf(e.changedTouches[0]), last = arr[arr.length-1];
  if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y) >= 0.7) arr.push(p);
  paint();
}, {passive:true});
function endTouchDraw(){ if(!fromTouch) return; fromTouch = false; endDraw(); }
pad.addEventListener('touchend', endTouchDraw, {passive:true});
pad.addEventListener('touchcancel', endTouchDraw, {passive:true});

/* 枠の外に出てしまった書き込みを、枠の中に戻す。
   前は枠いっぱいまで引きのばしていた（最大2.5倍）が、
   「直すボタンを押したら余計に大きくなる」ので、拡大はしないことにした。
   入りきらないときだけ縮め、あとは必要なぶんだけ動かす。 */
function fitPad(){
  const b = inkBox();
  if(!b) return;
  const r = pad.getBoundingClientRect();
  if(!r.width || !r.height) return;
  const m = 10;
  const bw = Math.max(b.x1-b.x0, 1), bh = Math.max(b.y1-b.y0, 1);
  const k = Math.min(1, (r.width-m*2)/bw, (r.height-m*2)/bh);   /* 大きくはしない */
  /* 動かすのは、はみ出しているぶんだけ。中に収まっている線は動かさない */
  let dx = 0, dy = 0;
  if(b.x0*k < m) dx = m - b.x0*k;
  if(b.y0*k < m) dy = m - b.y0*k;
  if(b.x1*k + dx > r.width  - m) dx = r.width  - m - b.x1*k;
  if(b.y1*k + dy > r.height - m) dy = r.height - m - b.y1*k;
  scaleInk(b.all, k, dx, dy);
  bake();
  buzz(8);
}
$('tFit').addEventListener('click', fitPad);

function undo(){ if(strokes.length){ redoStack.push(strokes.pop()); bake(); buzz(6); } }
function redo(){ if(redoStack.length){ const s=redoStack.pop(); strokes.push(s); inkStroke(bctx,s); paint(); buzz(6); } }
function clearPad(){ strokes.length = 0; redoStack.length = 0; cur = null; lasso = null; clearClip(); bake(); }

/* 問題ごとの計算内容を出し入れする。
   1セッション156問ぶんを抱え続けないよう、古いものから捨てる。 */
const PAD_KEEP = 24;
function usePad(key){
  padKey = key;
  if(!padStore[key]){
    padStore[key] = {s:[], r:[]};
    padOrder.push(key);
    while(padOrder.length > PAD_KEEP){
      const old = padOrder.shift();
      if(old !== key) delete padStore[old];
    }
  }
  strokes   = padStore[key].s;
  redoStack = padStore[key].r;
  cur = null;
  bake();
}
function resetPadStore(){
  for(const k in padStore) delete padStore[k];
  padOrder.length = 0;
}

function setTool(t){
  tool = t;
  lasso = null;
  const sel = $('tSel'); if(sel) sel.classList.remove('on');
  $('tPen').classList.toggle('on', t==='pen');
  $('tEra').classList.toggle('on', t==='era');
}

/* =======================================================================
   囲って持っていく

   計算スペースの一部を丸で囲うと、その中だけを切り取っておく。
   解答を打つ画面は計算スペースを覆ってしまうので、切り取ったぶんを
   上に出しておけば、見ながら打てる。
   ======================================================================= */
const PAD_BG = '#FFFFFF';          /* 切り抜きの下地（計算スペースと同じ色） */
let lasso = null;                    /* 囲っている最中の点の列 */
const clipStore = {};                /* 問題ごとの切り抜き */

function setLasso(on){
  tool = on ? 'sel' : 'pen';
  $('tSel').classList.toggle('on', on);
  $('tPen').classList.toggle('on', !on);
  $('tEra').classList.remove('on');
}

/* 囲っている線は、ペンで描いているのとまったく同じに見せる。
   （描くのに使うのもペンと同じ関数。指を離したときだけ、線として残さず
     囲いとして使う） */
function drawLasso(c){
  if(!lasso || !lasso.length) return;
  inkStroke(c, {tool:'pen', w:penW, pts:lasso});
}
/* 囲いを閉じて、その中だけを切り抜く */
function cutLasso(){
  const pts = lasso;
  lasso = null;
  if(!pts || pts.length < 3){ paint(); return; }
  let x0=1e9, y0=1e9, x1=-1e9, y1=-1e9;
  pts.forEach(p=>{ x0=Math.min(x0,p.x); y0=Math.min(y0,p.y); x1=Math.max(x1,p.x); y1=Math.max(y1,p.y); });
  const k = dpr;                          /* 1ピクセルが、画面では何粒か */
  const m = 6, W = pad.width/k, H = pad.height/k;
  x0=Math.max(0,x0-m); y0=Math.max(0,y0-m); x1=Math.min(W,x1+m); y1=Math.min(H,y1+m);
  const w = Math.round(x1-x0), h = Math.round(y1-y0);
  if(w < 8 || h < 8){ setLasso(false); paint(); return; }   /* 点を打っただけのときは無視 */

  const cv = document.createElement('canvas');
  cv.width = Math.round(w*k); cv.height = Math.round(h*k);
  const cc = cv.getContext('2d');
  cc.setTransform(k,0,0,k,0,0);
  cc.fillStyle = PAD_BG;
  cc.fillRect(0,0,w,h);
  cc.beginPath();
  cc.moveTo(pts[0].x-x0, pts[0].y-y0);
  for(let i=1;i<pts.length;i++) cc.lineTo(pts[i].x-x0, pts[i].y-y0);
  cc.closePath();
  cc.clip();
  cc.setTransform(1,0,0,1,0,0);
  cc.drawImage(buf, Math.round(x0*k), Math.round(y0*k), Math.round(w*k), Math.round(h*k),
                    0, 0, Math.round(w*k), Math.round(h*k));

  if(padKey) clipStore[padKey] = cv.toDataURL('image/png');
  setLasso(false);
  paint();
  buzz(8);
  syncClip();
}

function clearClip(){
  if(padKey) delete clipStore[padKey];
  syncClip();
}

/* 解答を打つ画面の上に、切り抜きを出す */
function syncClip(){
  const host = $('ansClip');
  if(!host) return;
  const src = padKey ? clipStore[padKey] : null;
  if(!src){ host.classList.add('hide'); host.innerHTML = ''; return; }
  host.classList.remove('hide');
  host.innerHTML = '<img src="'+src+'" alt="囲った計算"><button class="cx" id="clipX">消す</button>';
  host.querySelector('#clipX').addEventListener('click', clearClip);
}
$('tSel').addEventListener('click', ()=>setLasso(tool !== 'sel'));
$('tPen').addEventListener('click', ()=>setTool('pen'));
$('tEra').addEventListener('click', ()=>setTool('era'));
$('tUndo').addEventListener('click', undo);
$('tRedo').addEventListener('click', redo);
$('tClr').addEventListener('click', ()=>{ clearPad(); buzz(10); });

let rzT = null, lastW = innerWidth, lastH = innerHeight;
window.addEventListener('resize', ()=>{
  if(innerWidth===lastW && innerHeight===lastH) return;   // ソフトキーボード等の微差では作り直さない
  lastW = innerWidth; lastH = innerHeight;
  clearTimeout(rzT);
  rzT = setTimeout(()=>{ if(!$('play').classList.contains('hide')) setupPad(); }, 140);
});

/* 触覚フィードバック（対応端末のみ） */
function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }

/* =======================================================================
   専用キーボード
   ======================================================================= */
/* 実際に解答へ出てくる文字だけを並べる。打っても正解になり得ない記号は置かない。 */
const KEYS = [
  [{t:'1'},{t:'2'},{t:'3'},{t:'('},{t:')'},{t:'^'},{f:'bs',svg:'<path d="M9 5h11v14H9L3 12z"/><path d="M14.5 9.5l-4 5M10.5 9.5l4 5"/>'}],
  [{t:'4'},{t:'5'},{t:'6'},{t:'⁄',lbl:'分の',cls:'sm'},{t:'√'},{t:'π'},{f:'l',svg:'<path d="M14 6l-6 6 6 6"/>'}],
  [{t:'7'},{t:'8'},{t:'9'},{t:'-'},{t:'+'},{t:'='},{f:'r',svg:'<path d="M10 6l6 6-6 6"/>'}],
  [{t:'0'},{t:'.'},{t:','},{t:'<'},{t:'>'},{t:'≦'},{t:'≧'}],
  [{t:'x'},{t:'y'},{t:'a'},{t:'b'},{t:'h'},{t:'n'},{t:'r'}],
  [{t:'p'},{t:'q'},{t:'t'},{t:'C'},{f:'go'}]
];
/* 文字のキーは科目で入れ替える。上4段（数字と記号）はどの科目でも同じ。 */
if(SUBJECT.keys){ KEYS.length = 4; SUBJECT.keys.forEach(r=>KEYS.push(r)); }
function buildKB(){
  /* 1枚のグリッドに全キーを並べる。縦向きは7列6段、横向きは12列に
     CSS だけで組み替わる（横向きだと6段では決定キーが画面外に出るため）。 */
  const kb = $('kb');
  kb.innerHTML = '';
  KEYS.forEach(row=>{
    row.forEach(k=>{
      const b = document.createElement('button');
      if(k.f==='go'){
        b.className = 'k go'; b.textContent = '決定';
        b.dataset.f = 'go';
      }else if(k.f){
        b.className = 'k fn';
        b.innerHTML = '<svg viewBox="0 0 24 24">'+k.svg+'</svg>';
        b.dataset.f = k.f;
        b.setAttribute('aria-label', {bs:'1文字消す', l:'カーソルを左へ', r:'カーソルを右へ'}[k.f] || '');
      }else{
        /* 数字のかたまり（1〜9・0 と 小数点・カンマ）だけ色を変える */
        const num = /^[0-9]$/.test(k.t) || k.t==='.' || k.t===',';
        b.className = 'k' + (num?' num':'') + (k.cls?' '+k.cls:'');
        b.textContent = k.lbl || k.t;
        b.dataset.t = k.ins || k.t;
      }
      kb.appendChild(b);
    });
  });
  kb.addEventListener('pointerdown', e=>{
    const b = e.target.closest('.k');
    if(!b) return;
    e.preventDefault();
    if(b.dataset.f) doFn(b.dataset.f);
    else insert(b.dataset.t);
  });
  /* iPad は はやく2回つづけて触ると、2回目を「ジェスチャかも」と握ったまま
     返してこない。キーも押しっぱなしのように無反応になる。
     計算スペースと同じで、touch の既定の動きを止めておけばふつうに返ってくる。
     キーは pointerdown で反応させているので、click を止めても困らない。 */
  ['touchstart','touchmove','touchend'].forEach(t=>
    kb.addEventListener(t, e=>{ e.preventDefault(); }, {passive:false}));
}
let IV = '', IC = 0;   // 入力値・カーソル位置
function resetInput(){
  IV = ''; IC = 0;
  $('field').classList.remove('err');
  clearWarn();
  gReset();            /* グラフの問題なら、かいた線も一緒に消す */
  paintField();
}
/* log は「底」と「真数」の2か所を埋める形なので、
   log_2(3) という綴りを覚えてもらう代わりに □ を置いて埋めてもらう。 */
const BOX = '□';
const LOG_TPL = 'log_'+BOX+'('+BOX+')';
const RT_TPL  = '√['+BOX+']{'+BOX+'}';   // n乗根も「指数」と「中身」の2か所を埋める

/* 比較記号やカンマは、ひな形の中身ではなく式全体を区切るために打つもの。
   □ を埋め終えた直後はカーソルが }（や ）)の内側に残っているので、
   そのまま打つと √[3]{3<√[7]{27}} のように入れ子になってしまう。
   これらのキーに限っては、閉じ括弧の外へ自分で出てから入れる。 */
const EXITERS = '<>≦≧=,';
function escapeGroups(){
  while(IC < IV.length && '}])'.indexOf(IV[IC]) >= 0) IC++;
}
function insert(t){
  if(EXITERS.indexOf(t)>=0 && IV[IC]!==BOX) escapeGroups();
  if(t==='log' || t==='ⁿ√'){           // ひな形ごと入れて、最初の □ に移る
    const tpl = t==='log' ? LOG_TPL : RT_TPL;
    IV = IV.slice(0,IC) + tpl + IV.slice(IC);
    IC = IV.indexOf(BOX, IC);
  }else if(IV[IC]===BOX){              // □ の上で打った文字は □ と置きかわる
    IV = IV.slice(0,IC) + t + IV.slice(IC+1);
    IC += t.length;
  }else{
    IV = IV.slice(0,IC) + t + IV.slice(IC);
    IC += t.length;
  }
  $('field').classList.remove('err');
  clearWarn();
  paintField();
  buzz(4);
}
function nextBox(){                    // カーソルより後ろの □ の位置（なければ -1）
  return IV.indexOf(BOX, IC+1)>=0 ? IV.indexOf(BOX, IC+1) : IV.indexOf(BOX);
}
function doFn(f){
  if(f==='bs'){ if(IC>0){ IV = IV.slice(0,IC-1)+IV.slice(IC); IC--; } }
  else if(f==='l'){ if(IC>0) IC--; }
  else if(f==='r'){
    const nb = nextBox();
    if(nb>=0 && nb!==IC) IC = nb;      // □ が残っていれば一気にそこへ飛ぶ
    else if(IC<IV.length) IC++;
  }
  else if(f==='go'){ submit(); return; }
  $('field').classList.remove('err');
  clearWarn();
  paintField();
}

/* =======================================================================
   グラフをかく問題

   方眼と軸はこちらで描いておいて、曲線だけをペンでかいてもらう。
   判定は「かいた線」と「正しい曲線」の近さで決める。
     ・かいた点が、正しい曲線からどれだけ離れているか（よけいな線を見つける）
     ・正しい曲線の各点に、かいた線がどれだけ近いか（かき残しを見つける）
   どちらも 9割の点が許容範囲に入っていれば正解にする。
   手でかく以上ぴったりにはならないので、ゆるめに取ってある。
   ======================================================================= */
let drawMode = false;               // グラフをかく問題かどうか
const gcv = $('gcv');
const gctx = gcv.getContext('2d');
let gQ = null, gFor = null;         // いま出ているグラフ問題の設定と、その問題の id
let gStrokes = [], gCur = null, gDrawing = false, gDpr = 1;
let gW = 0, gH = 0;                 // 見た目の大きさ（CSSピクセル）
const GPAD = 6;                     // ふちの余白

function gVal(x){
  try{
    const v = evalExpr(nz(gQ.f), {x});
    return isFinite(v) ? v : NaN;
  }catch(e){ return NaN; }
}
function gPx(x, y){
  return { x: GPAD + (x - gQ.x[0]) / (gQ.x[1] - gQ.x[0]) * (gW - GPAD*2),
           y: GPAD + (gQ.y[1] - y) / (gQ.y[1] - gQ.y[0]) * (gH - GPAD*2) };
}
function gSetup(){
  const r = gcv.getBoundingClientRect();
  if(!r.width || !r.height) return;
  gDpr = Math.min(window.devicePixelRatio || 1, 2.5);
  gW = r.width; gH = r.height;
  gcv.width = Math.round(gW * gDpr);
  gcv.height = Math.round(gH * gDpr);
  gPaint();
}
function gGrid(c){
  c.save();
  c.setTransform(gDpr,0,0,gDpr,0,0);
  c.clearRect(0,0,gW,gH);
  c.fillStyle = '#fff'; c.fillRect(0,0,gW,gH);
  const gx = gQ.gx || 1, gy = gQ.gy || 1;
  c.lineWidth = 1; c.strokeStyle = '#e8e6e0';
  c.beginPath();
  for(let x = Math.ceil(gQ.x[0]/gx)*gx; x <= gQ.x[1]+1e-9; x += gx){
    const p = gPx(x, 0); c.moveTo(Math.round(p.x)+.5, GPAD); c.lineTo(Math.round(p.x)+.5, gH-GPAD);
  }
  for(let y = Math.ceil(gQ.y[0]/gy)*gy; y <= gQ.y[1]+1e-9; y += gy){
    const p = gPx(0, y); c.moveTo(GPAD, Math.round(p.y)+.5); c.lineTo(gW-GPAD, Math.round(p.y)+.5);
  }
  c.stroke();
  /* 軸 */
  c.lineWidth = 1.4; c.strokeStyle = '#9a988f';
  c.beginPath();
  if(gQ.y[0] <= 0 && 0 <= gQ.y[1]){ const p = gPx(0,0); c.moveTo(GPAD, Math.round(p.y)+.5); c.lineTo(gW-GPAD, Math.round(p.y)+.5); }
  if(gQ.x[0] <= 0 && 0 <= gQ.x[1]){ const p = gPx(0,0); c.moveTo(Math.round(p.x)+.5, GPAD); c.lineTo(Math.round(p.x)+.5, gH-GPAD); }
  c.stroke();
  /* 目盛りの数字（軸の近くだけ、間引いて）。
     x・y の字と重なるぶんは出さない。数字が2つ並んで読めなくなるため。 */
  c.fillStyle = '#8a8880'; c.font = '10px system-ui,sans-serif';
  const o = gPx(0,0), sx = gQ.xs || gx, sy = gQ.ys || gy;
  const ly = Math.min(Math.max(o.y+3, GPAD), gH-GPAD-12);   /* x の目盛りを書く高さ */
  const lx = Math.min(Math.max(o.x-4, 24), gW-GPAD);        /* y の目盛りを書く横位置 */
  const xLet = gW-GPAD-9, yLet = GPAD+1;                    /* x・y の字を置くところ */
  c.textAlign = 'center'; c.textBaseline = 'top';
  for(let x = Math.ceil(gQ.x[0]/sx)*sx; x <= gQ.x[1]+1e-9; x += sx){
    if(Math.abs(x) < 1e-9) continue;
    const p = gPx(x, 0);
    if(p.x > xLet - 15) continue;
    c.fillText(String(+x.toFixed(2)), Math.min(Math.max(p.x, GPAD+11), gW-GPAD-11), ly);
  }
  c.textAlign = 'right'; c.textBaseline = 'middle';
  for(let y = Math.ceil(gQ.y[0]/sy)*sy; y <= gQ.y[1]+1e-9; y += sy){
    if(Math.abs(y) < 1e-9) continue;
    const p = gPx(0, y);
    if(p.y < yLet + 13 && Math.abs(lx - (o.x+4)) < 22) continue;
    c.fillText(String(+y.toFixed(2)), lx, Math.min(Math.max(p.y, GPAD+6), gH-GPAD-6));
  }
  c.textAlign = 'left'; c.textBaseline = 'top';
  c.fillText('x', xLet, ly);
  c.fillText('y', Math.min(Math.max(o.x+4, GPAD), gW-GPAD-10), yLet);
  c.restore();
}
function gInk(c, pts, col, w){
  if(pts.length < 2){
    if(pts.length===1){ c.beginPath(); c.arc(pts[0].x, pts[0].y, w/2, 0, Math.PI*2); c.fillStyle=col; c.fill(); }
    return;
  }
  c.save(); c.setTransform(gDpr,0,0,gDpr,0,0);
  c.lineCap = c.lineJoin = 'round'; c.lineWidth = w; c.strokeStyle = col;
  c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
  for(let i=1;i<pts.length;i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke(); c.restore();
}
/* 正しい曲線を、画面の中に入っているところだけ描く */
function gTruePts(){
  const out = [], N = 600;
  for(let i=0;i<=N;i++){
    const x = gQ.x[0] + (gQ.x[1]-gQ.x[0])*i/N;
    const y = gVal(x);
    if(!isFinite(y)) { out.push(null); continue; }
    out.push((y >= gQ.y[0] && y <= gQ.y[1]) ? gPx(x,y) : null);
  }
  return out;
}
function gInkTrue(c, col){
  const pts = gTruePts();
  c.save(); c.setTransform(gDpr,0,0,gDpr,0,0);
  c.lineCap = c.lineJoin = 'round'; c.lineWidth = 2.4; c.strokeStyle = col;
  let run = [];
  const flush = ()=>{ if(run.length>1){ c.beginPath(); c.moveTo(run[0].x, run[0].y);
    for(let i=1;i<run.length;i++) c.lineTo(run[i].x, run[i].y); c.stroke(); } run = []; };
  pts.forEach(p=>{ if(p) run.push(p); else flush(); });
  flush(); c.restore();
}
/* 大事な点に丸を打つ。合っていた点は白抜き、ずれていた点は赤で塗る */
function gInkKeys(c, off){
  if(!gQ.k || !gQ.k.length) return;
  c.save(); c.setTransform(gDpr,0,0,gDpr,0,0);
  gQ.k.forEach(k=>{
    const p = gPx(k[0], k[1]);
    const ng = (off||[]).some(o=>o[0]===k[0] && o[1]===k[1]);
    c.beginPath(); c.arc(p.x, p.y, 5, 0, Math.PI*2);
    c.fillStyle = ng ? '#b91c1c' : '#fff'; c.fill();
    c.lineWidth = 2; c.strokeStyle = ng ? '#b91c1c' : '#c2410c'; c.stroke();
  });
  c.restore();
}
/* 方眼 → 正しい曲線 → 自分の線 → 大事な点 の順。大事な点がいちばん上に来る */
function gPaintTo(c, showTrue, off){
  gGrid(c);
  if(showTrue) gInkTrue(c, '#c2410c');
  gStrokes.forEach(s=>gInk(c, s, '#111', 2.6));
  if(gCur) gInk(c, gCur, '#111', 2.6);
  if(showTrue) gInkKeys(c, off);
}
function gPaint(showTrue){
  if(!gQ) return;
  gPaintTo(gctx, showTrue);
  $('gUndo').disabled = gStrokes.length === 0;
  $('gClear').disabled = gStrokes.length === 0;
}
function gPt(e){
  const r = gcv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
gcv.addEventListener('pointerdown', e=>{
  if(!drawMode || S.locked) return;
  if(e.pointerType==='mouse' && e.button!==0) return;
  e.preventDefault();
  gDrawing = true; gCur = [gPt(e)];
  try{ gcv.setPointerCapture(e.pointerId); }catch(err){}
  gPaint();
});
gcv.addEventListener('pointermove', e=>{
  if(!gDrawing || !gCur) return;
  e.preventDefault();
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for(let i=0;i<evs.length;i++){
    const p = gPt(evs[i]), last = gCur[gCur.length-1];
    if(Math.abs(p.x-last.x)+Math.abs(p.y-last.y) < 0.8) continue;
    gCur.push(p);
  }
  gPaint();
});
function gEnd(){
  if(!gDrawing) return;
  gDrawing = false;
  if(gCur && gCur.length) gStrokes.push(gCur);
  gCur = null; gPaint();
}
gcv.addEventListener('pointerup', gEnd);
gcv.addEventListener('pointercancel', gEnd);
/* 計算スペースと同じ。iPad が2回目の合図を飲みこまないように */
['touchstart','touchmove','touchend'].forEach(t=>
  gcv.addEventListener(t, e=>{ e.preventDefault(); }, {passive:false}));

$('gUndo').addEventListener('click', ()=>{ if(gStrokes.length){ gStrokes.pop(); gPaint(); buzz(6); } });
$('gClear').addEventListener('click', ()=>{ gStrokes.length = 0; gCur = null; gPaint(); buzz(6); });
$('gGo').addEventListener('click', ()=>submit());

/* かいたグラフを、先生が採点するときと同じ見方で調べる。
   1 端から端までかけているか
   2 大事な点（極値・切片・軸との交点）の座標が合っているか  ← ここが本番
   3 その間で、線が大きく外れていないか（念のためのゆるい確認）
   線全体をぴったり合わせる必要はない。大事な点が合っていて、
   間の形が大きく崩れていなければ正解にする。 */
function gKeyName(k){
  const x = +Number(k[0]).toFixed(2), y = +Number(k[1]).toFixed(2);
  return (k[2] || 'この点') + '（' + x + ', ' + y + '）';
}
function gNear(p, arr){
  let best = 1e9;
  for(let i=0;i<arr.length;i++){
    const dx = p.x-arr[i].x, dy = p.y-arr[i].y, d = dx*dx+dy*dy;
    if(d < best) best = d;
  }
  return Math.sqrt(best);
}
function gJudge(){
  const mine = [];
  gStrokes.forEach(s=>s.forEach(p=>mine.push(p)));
  if(mine.length < 12) return { ok:false, why:'まだ かけていません' };
  const T = Math.max(14, 0.062 * Math.min(gW, gH));   /* 許容するズレ（方眼の半マスほど） */

  /* 1 端から端までかけているか。横を 40 に区切って、ぬけている区間を数える。
     点と点のあいだも線でつながっているので、その区間もまとめて埋める。 */
  const NB = 40, hit = new Array(NB).fill(false), span = Math.max(1, gW - GPAD*2);
  const bin = x => Math.floor((x - GPAD) / span * NB);
  gStrokes.forEach(st=>{
    for(let j=0;j<st.length;j++){
      let a = bin(st[j].x), b = a;
      if(j > 0) a = bin(st[j-1].x);
      if(a > b){ const t = a; a = b; b = t; }
      for(let i=Math.max(0,a); i<=Math.min(NB-1,b); i++) hit[i] = true;
    }
  });
  const cover = hit.filter(Boolean).length / NB;
  if(cover < 0.9)
    return { ok:false, T, cover, why:'かき足りないところがあります。方眼の端から端までかいてください' };

  /* 2 大事な点の座標が合っているか */
  const off = (gQ.k || []).filter(k => gNear(gPx(k[0], k[1]), mine) > T);
  if(off.length)
    return { ok:false, T, cover, off,
             why: gKeyName(off[0]) + ' のあたりがずれています'
                  + (off.length > 1 ? '（ほかに ' + (off.length-1) + " か所）" : '') };

  /* 3 何本かにわけてかいたとき、曲線と関係のない線が混ざっていないか。
     1本ずつ中央値で見る。全部まとめて数えると、余分な1本が多数決で埋もれてしまう。
     1本しかかいていないときは、ここでは何も言わない（それは「線の形」の話なので 4 で見る）。
     しきい値 1.2T は、ゆるくかいた正しい線（最大 1.1T ほど）と、
     外れた線（1.3T 以上）を実際に測って分けたもの。 */
  const truth = gTruePts().filter(Boolean);
  const q = (a, f)=>{ const b = a.slice().sort((u,v)=>u-v); return b[Math.min(b.length-1, Math.floor(b.length*f))]; };
  const L = T * 2.0;
  if(gStrokes.length >= 2){
    const stray = gStrokes.filter(st => st.length >= 5 && q(st.map(p=>gNear(p, truth)), 0.5) > T*1.2);
    if(stray.length)
      return { ok:false, T, cover, stray:stray.length, why:'曲線と関係のない線が混ざっています' };
  }

  /* 4 大事な点の間で、線が大きく外れていないか */
  const e1 = q(mine.map(p=>gNear(p, truth)), 0.9);   /* はみ出し */
  const e2 = q(truth.map(p=>gNear(p, mine)), 0.9);   /* 通っていないところ */
  if(e1 > L || e2 > L)
    return { ok:false, T, cover, e1, e2,
             why:'大事な点は合っていますが、その間の線の形が大きくちがいます' };

  return { ok:true, T, cover, e1, e2, why:'' };
}
/* 結果に出す「自分の線＋正しい曲線」の絵 */
function gSnapshot(off){
  if(!gQ || !gcv.width) return '';
  const cv = document.createElement('canvas');
  cv.width = gcv.width; cv.height = gcv.height;
  gPaintTo(cv.getContext('2d'), true, off);   /* 同じ手順で、この一時的な紙に描く */
  try{ return cv.toDataURL('image/png'); }catch(e){ return ''; }
}
/* グラフの問題に入る・出る */
function gEnter(q){
  gQ = q.gr; gFor = q.id; gStrokes = []; gCur = null; gDrawing = false;
  requestAnimationFrame(()=>{ gSetup(); requestAnimationFrame(gSetup); });
}
function gReset(){
  if(!drawMode) return;
  gStrokes = []; gCur = null; gDrawing = false; gPaint();
}
/* 画面の向きが変わっても方眼がずれないように */
window.addEventListener('resize', ()=>{ if(drawMode && !$('gbox').classList.contains('hide')) gSetup(); });

let pickMode = false;   // 選択式かどうか
function paintField(){
  const f = $('field');
  if(IV===''){
    f.innerHTML = pickMode
      ? '<span class="ph">下から選んでください</span>'
      : '<span class="caret"></span><span class="ph">ここに解答を入力</span>';
  }else if(pickMode){
    f.innerHTML = fmt(IV);      /* 選んだものも、選択肢と同じ組み方で見せる */
    syncAnsBtn();
    return;
  }else{
    /* カーソルの位置に目印を1文字はさんでから数式に組み、あとで縦棒に差し替える。
       こうすると分数や上付きの中にカーソルがあっても位置がずれない。 */
    const withCaret = IV.slice(0,IC) + CARET + IV.slice(IC);
    f.innerHTML = preview(withCaret).split(CARET).join('<span class="caret"></span>');
  }
  syncAnsBtn();
  paintPreview();
}
/* □ を「埋めるところ」として見せる */
function boxify(html){
  return html.split(BOX).join('<span class="bx">'+BOX+'</span>');
}

/* 打った文字列を数式の形に直して見せる。
   ^ や √ や log_ が思ったとおりに効いているか、打ちながら確認できるように。 */
function preview(s){
  const k = texHTML(unfrac(String(s)), esc);
  if(k !== null) return k;
  return previewOld(s);
}
function previewOld(s){
  let t = unfrac(String(s));   /* 打った 4⁄1 は 1/4 として読む */
  t = t.replace(/\^\(([^()]*)\)/g, '^{$1}');      // 2^(1/3) → 上付き 1/3
  t = t.replace(/√\(([^()]*)\)/g, '√{$1}');       // √(10)
  t = t.replace(/√([\d\u0001]+(?:\/[\d\u0001]+)?|[a-z]\u0001?)/g, '√{$1}');  // √2 にも横線を引く
  /* log_2(3) の括弧は入力の都合なので、表示では外して log₂3 にする */
  t = t.replace(/log_([\d□\u0001]+(?:\/[\d\u0001]+)?|[a-z]\u0001?)\(([^()]*)\)/g, 'log_{$1}$2');
  t = t.replace(/log_([\d□\u0001]+(?:\/[\d\u0001]+)?|[a-z]\u0001?)/g, 'log_{$1}');
  return boxify(fmt(t));
}
/* 答えが「ただの分数」のときだけ横棒に組む。
   1/10^3 のような式まで組むと (1/10)^3 に見えてしまうので手を出さない。 */
function fracHTML(h){
  return h.replace(FR_RE,
    (m,a,b)=>'<span class="fr"><span class="fn">'+a+'</span><span class="fd">'+b+'</span></span>');
}
/* 入力欄がそのまま数式になったので、下の行は「次に何をすればいいか」だけを言う。
   □ が残っている間はそれを、ふだんは問題ごとの書き方のヒントを出す。 */
function paintPreview(){
  const h = $('hintLine');
  if(h.classList.contains('warn')) return;      /* 警告を出している間はそのまま */
  const q = curQ();
  if(pickMode){ h.classList.remove('todo'); h.textContent = ''; return; }
  if(IV.indexOf(BOX)>=0){
    h.classList.add('todo');
    h.textContent = IV[IC]===BOX ? '□ に入力してください' : '→ を押して次の □ へ';
  }else{
    h.classList.remove('todo');
    h.textContent = (q && q.h) || '';
  }
}
/* 書きかけの解答は閉じても消えない。それが分かるようにボタンに出す */
function syncAnsBtn(){
  const b = $('ansBtn');
  if(!b) return;
  const q = curQ();
  if(S.locked && q && S.resFor === q.id){ b.textContent = '判定を見る'; return; }
  if(q && q.self){ b.textContent = '解答を見る'; return; }
  /* 「かきかけ」はいま開いている問題の線があるときだけ。前の問題の線を数えない */
  if(q && q.gr){ b.textContent = (gFor===q.id && gStrokes.length) ? 'グラフをかく（かきかけ）' : 'グラフをかく'; return; }
  if(IV==='') b.textContent = '解答する';
  else b.textContent = '解答する（入力中: '+(IV.length>14 ? IV.slice(0,14)+'…' : IV)+'）';
}
$('field').addEventListener('click', ()=>{ IC = IV.length; paintField(); });
$('clrIn').addEventListener('click', ()=>{ IV=''; IC=0; $('field').classList.remove('err'); paintField(); });
buildKB();

/* =======================================================================
   シート制御
   ======================================================================= */
function openSheet(el){
  $('back').classList.add('on');
  el.classList.add('on');
}
function closeSheets(){
  $('back').classList.remove('on');
  ['ansSheet','menuSheet','confSheet','jumpSheet'].forEach(id=>{
    const el = $(id);
    el.classList.remove('on');
    el.style.transform = '';
  });
}

/* シートを下にドラッグして閉じる（計算スペースを覗きたいときの自然な動き） */
function dragToClose(sheet){
  let sy = 0, dy = 0, on = false;
  const grab = e=>{
    /* つまめるのは上端（つまみ・見出し・問題文）だけ。
       キーボードや一覧の操作、判定パネルのスクロールと取り合わないようにする。 */
    if(!e.target.closest('.grip, .sh, .ansq')) return;
    if(e.target.closest('.lnk')) return;
    /* 判定中でも閉じられる。計算を見に行けるように。
       閉じても「解答する」ボタンが「判定を見る」に変わって戻れる。 */
    on = true; sy = e.clientY; dy = 0;
    sheet.style.transition = 'none';
    sheet.setPointerCapture(e.pointerId);
  };
  const move = e=>{
    if(!on) return;
    dy = Math.max(0, e.clientY - sy);
    sheet.style.transform = 'translateY('+dy+'px)';
  };
  const drop = ()=>{
    if(!on) return;
    on = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if(dy > 90) closeSheets();
  };
  sheet.addEventListener('pointerdown', grab);
  sheet.addEventListener('pointermove', move);
  sheet.addEventListener('pointerup', drop);
  sheet.addEventListener('pointercancel', drop);
}
dragToClose($('ansSheet'));
dragToClose($('menuSheet'));
dragToClose($('jumpSheet'));
$('back').addEventListener('click', ()=>{
  if($('confSheet').classList.contains('on')) { closeSheets(); return; }
  closeSheets();
});

/* 選択式の問題では、キーボードの代わりに選択肢を出す */
function buildChoices(q){
  const box = $('choices');
  box.innerHTML = '';
  q.c.forEach(label=>{
    const b = document.createElement('button');
    b.className = 'ch mq' + (label===IV ? ' on' : '');
    b.dataset.v = label;          /* 組んだあとの見た目ではなく、元の字を残しておく */
    /* 選択肢も数式として組む。a^{m+n} のような形が生の字で出ないように。 */
    b.innerHTML = fmt(label);
    b.addEventListener('click', ()=>{
      IV = label; IC = IV.length;
      Array.prototype.forEach.call(box.children, x=>x.classList.remove('on'));
      b.classList.add('on');
      $('field').classList.remove('err');
      paintField();
      buzz(4);
    });
    box.appendChild(b);
  });
  const go = document.createElement('button');
  go.className = 'pbtn';
  go.style.marginTop = '6px';
  go.textContent = '決定';
  go.addEventListener('click', submit);
  box.appendChild(go);
}

/* 証明問題は答え合わせができないので、模範解答を見せて
   「わかった／わからなかった」を自分で選んでもらう。 */
function showSelf(q){
  S.locked = true;
  S.resFor = q.id;
  syncAnsBtn();
  $('ansInput').classList.add('hide');
  const r = $('ansRes');
  r.classList.remove('hide');
  r.innerHTML =
    '<div class="rq mq">'+fmt(q.q)+'</div>'+
    '<div class="rans"><div class="lb">解答</div><div class="proof mq">'+fmt(q.e)+'</div></div>'+
    '<div class="selfask">自分の答案と見くらべて選んでください</div>'+
    '<div class="rbtns" id="resBtns"></div>';
  const bt = $('resBtns');
  const add = (label, ghost, ok)=>{
    const b = document.createElement('button');
    b.className = 'pbtn' + (ghost?' ghost':'');
    b.textContent = label;
    b.addEventListener('click', ()=>{
      score(q, ok);
      S.locked = false; S.resFor = null;
      closeSheets();
      laterMove(next);
    });
    bt.appendChild(b);
  };
  add('わからなかった', true, false);
  add('わかった', false, true);
  armBtns(bt);
}

function openAnswer(){
  const q = curQ();
  if(!q) return;
  /* 判定を出したまま閉じていたときは、その判定に戻る */
  if(S.locked && S.resFor === q.id){ openSheet($('ansSheet')); return; }
  if(q.self){ openSheet($('ansSheet')); showSelf(q); return; }
  $('ansInput').classList.remove('hide');
  $('ansRes').classList.add('hide');
  $('ansQ').innerHTML = fmt(q.q) + (q.g ? '<br><span style="color:var(--t3)">ただし '+fmt(q.g)+'</span>' : '');
  pickMode = !!q.c;
  drawMode = !!q.gr;
  $('hintLine').classList.remove('warn');
  /* 選択式に書式のヒントは要らない */
  $('hintLine').textContent = pickMode ? '' : (q.h || (drawMode ? '方眼の上に曲線をかいてください' : ''));
  $('howBtn').classList.toggle('hide', pickMode || drawMode);  /* 書き方の早見表は記述式だけ */
  showHow(false);                 /* キーボードの表示/非表示もここで決まる */
  $('choices').classList.toggle('hide', !pickMode);
  $('field').classList.toggle('jp', pickMode);
  /* グラフのときは入力欄も計算スペースの覗き見も要らない。方眼に場所をゆずる */
  $('field').classList.toggle('hide', drawMode);
  $('clrIn').classList.toggle('hide', drawMode);
  $('gbox').classList.toggle('hide', !drawMode);
  if(pickMode) buildChoices(q);
  if(drawMode) gEnter(q);
  paintField();
  syncClip();
  openSheet($('ansSheet'));
}

/* =======================================================================
   採点
   ======================================================================= */
/* 決定を押したのに採点されないときは、必ず理由を出す。
   赤枠だけだと「押しても何も起きない」と見えてしまうため。 */
function warnInput(msg){
  const h = $('hintLine');
  h.textContent = msg;
  h.classList.add('warn');
  $('field').classList.add('err');
  buzz([14,60,14]);
}
function clearWarn(){
  const h = $('hintLine');
  if(h.classList.contains('warn')){ h.classList.remove('warn'); paintPreview(); }
}

function submit(){
  const q = curQ();
  if(!q || q.self) return;   /* 証明問題は自己採点なので照合しない */
  if(q.gr){                  /* グラフはかいた線そのものを見る */
    if(S.locked && S.resFor === q.id) return;
    const g = gJudge();
    if(g.why === 'まだ かけていません'){ warnInput(g.why); return; }
    clearWarn();
    g.img = gSnapshot(g.off);  /* 判定に出す絵は、消える前にここで焼いておく */
    score(q, g.ok);
    showResult(q, g.ok, null, g);
    return;
  }
  if(nz(IV)===''){
    warnInput('解答が入力されていません');
    return;
  }
  if(IV.indexOf(BOX)>=0){    /* □ が残っている＝まだ書きかけ */
    warnInput(IV[IC]===BOX ? '□ がまだ空です。数字を押して埋めてください'
                           : '□ が残っています。→ で移って埋めてください');
    return;
  }
  const ok = judge(IV, q.a);
  score(q, ok);
  showResult(q, ok, IV);
}

/* 誤字などで不正解になったぶんを、あとから正解に付け替える。
   記録・この回の正解数・まちがい一覧の3つをそろえて直す。 */
function makeRight(q, given){
  const i = S.wrongList.indexOf(q.id);
  if(i < 0) return;                  /* すでに直してある */
  S.wrongList.splice(i, 1);
  S.okCount++;
  const r = rec(q.id);
  if(r.w > 0) r.w--;
  r.c++; r.p = 0;
  saveST();
  saveSession();
  showResult(q, true, given);        /* 判定の見た目も正解に差し替える */
}

function score(q, ok){
  if(S.scored[q.id]) return;   // 1問につき最初の1回だけ記録
  S.scored[q.id] = true;
  if(ok){
    S.okCount++;
    markRight(q.id);
  }else{
    S.wrongList.push(q.id);
    markWrong(q.id);
  }
}

/* 別解のうち「不等号を裏返しただけ」「単位付き」のものは表示しない（読み手には同じ答えなので） */
/* 決定キーと結果のボタンはほぼ同じ位置に出るので、決定を押した指の click が
   そのまま「次の問題へ」に乗ってしまうことがある。 */
/* 待たせるのではなく、「そのボタン自身を押し下げたときだけ効く」ようにする。
   決定キーの指が離れたときの click は押し下げが無いので通らない。
   自分で押したぶんは、その場ですぐ効く。 */
function armBtns(box){
  if(!box) return;
  Array.prototype.forEach.call(box.children, b=>{
    let down = false;
    b.addEventListener('pointerdown', ()=>{ down = true; });
    b.addEventListener('click', e=>{
      if(!down && e.detail !== 0){       /* detail 0 はキーボード操作なので通す */
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
      down = false;
    }, true);
  });
}

function shownAlts(list){
  return list.slice(1).filter(a=>!/[<>≦≧]/.test(a) && !/[桁位]$/.test(a) && !/^小数第/.test(a));
}

function showResult(q, ok, given, g){
  S.locked = true;
  S.resFor = q.id;
  syncAnsBtn();
  $('ansInput').classList.add('hide');
  if(q.gr) drawMode = false;   /* 判定を出しているあいだは かけないようにする */
  const r = $('ansRes');
  r.classList.remove('hide');

  /* ok は true=正解 / false=不正解 / null=スキップ（記録しないが答えは見せる） */
  const mark = ok===null
    ? '<div class="rmark sk"><svg viewBox="0 0 24 24"><path d="M6 5l9 7-9 7z"/><path d="M18 5v14"/></svg>スキップ</div>'
    : ok
    ? '<div class="rmark ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>正解</div>'
    : '<div class="rmark ng"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>不正解</div>';

  /* グラフは「自分の線」と「正しい曲線」を重ねた絵で見せるのがいちばん早い */
  const gimg = (q.gr && g && g.img)
    ? '<img class="gres" alt="かいた線と正しい曲線" src="'+g.img+'">' +
      '<div class="glegend"><span><i style="background:#111"></i>自分の線</span>' +
      '<span><i style="background:#c2410c"></i>正しい曲線</span>' +
      '<span><i class="dot"></i>大事な点</span></div>' +
      (ok===false && g.why ? '<div class="gwhy">'+esc(g.why)+'</div>' : '')
    : '';

  const your = (ok===false && given!=null && given!=='')
    /* 打った形のまま出すと √[3]{3} のような生の記号が見えるので、
       入力欄と同じように数式に組んでから見せる。 */
    ? '<div class="ryour">あなたの解答　<b class="mq">'+preview(given)+'</b></div>'
    : (ok===null ? '<div class="ryour">記録には残していません</div>' : '');

  const alts = shownAlts(q.a);
  const alt = alts.length
    ? '<div class="rsub">'+alts.map(a=>'<span class="mq">'+fmt(a)+'</span>').join(' / ')+' でも正解</div>' : '';

  r.innerHTML =
    /* シートが計算スペースを覆うので、判定側にも問題文を出しておく */
    '<div class="rq mq">'+fmt(q.q)+(q.g?'<span class="rg">（'+fmt(q.g)+'）</span>':'')+'</div>' +
    mark + your +
    gimg +
    '<div class="rans'+(ok===false?' ngb':'')+'"><div class="lb">答え</div><div class="va mq">'+fmt(q.a[0])+'</div>'+alt+'</div>' +
    (q.e ? '<div class="rexp">'+fmt(q.e)+'</div>' : '') +
    '<div class="rbtns" id="resBtns"></div>';

  const bt = $('resBtns');
  const add = (label, ghost, fn)=>{
    const b = document.createElement('button');
    b.className = 'pbtn' + (ghost?' ghost':'');
    b.textContent = label;
    b.addEventListener('click', fn);
    bt.appendChild(b);
  };
  if(ok===false){
    /* 打ち間違い・書き間違いで落とした時の手直し。
       記録の「まちがい」を1つ取り消して「正解」に付け替える。 */
    if(S.wrongList.indexOf(q.id) >= 0) add('正解にする', true, ()=>makeRight(q, given));
    add('もう一度解く', true, ()=>{
      S.locked = false; S.resFor = null;
      closeSheets();
      if(q.gr){ drawMode = true; gReset(); }
      resetInput();
    });
  }
  const last = S.idx===S.queue.length-1;
  add('計算を見る', true, ()=>{ closeSheets(); syncAnsBtn(); });
  add(last ? '結果を見る' : '次の問題へ', false, ()=>{
    S.locked = false; S.resFor = null;
    syncAnsBtn();
    closeSheets();
    laterMove(next);
  });
  bt.classList.toggle('four', bt.children.length >= 4);
  if(ok!==null) buzz(ok?8:[14,60,14]);
  armBtns(bt);
}

/* =======================================================================
   イベント
   ======================================================================= */

/* =======================================================================
   記録の持ち出し（画面まわり）
   ======================================================================= */
let bkFlash = null;      /* 取り込んだあと、描き直したさきで出す知らせ */
function bkPanel(host){
  host.innerHTML =
    '<div class="bkrow">'+
      '<button class="bkbtn" id="bkOut">書き出す</button>'+
      '<button class="bkbtn" id="bkIn">読み込む</button>'+
    '</div>'+
    '<div class="bknote">記録はこの端末のブラウザの中にしかありません。'+
      'アプリを入れ直したり、ブラウザのデータを消すと無くなります。'+
      '書き出した文字列をメモなどに貼っておけば、あとで戻せます。</div>'+
    '<div class="bkbox hide" id="bkBox"></div>'+
    (bkFlash ? '<p class="bkmsg ok">'+bkFlash+'</p>' : '');
  bkFlash = null;

  const box = host.querySelector('#bkBox');

  host.querySelector('#bkOut').addEventListener('click', ()=>{
    const s = bkExport();
    box.classList.remove('hide');
    box.innerHTML =
      '<p class="bkh">'+bkCount(s)+'問ぶんの記録です。全部コピーして、'+
        'メモやメッセージに貼っておいてください。</p>'+
      '<textarea class="bkta" id="bkTa" readonly></textarea>'+
      '<div class="bkrow"><button class="bkbtn go" id="bkCopy">コピー</button>'+
      '<button class="bkbtn" id="bkClose">とじる</button></div>';
    const ta = box.querySelector('#bkTa');
    ta.value = s;
    box.querySelector('#bkCopy').addEventListener('click', ()=>{
      ta.select(); ta.setSelectionRange(0, ta.value.length);
      const done = ()=>{ box.querySelector('#bkCopy').textContent = 'コピーしました'; };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(ta.value).then(done, ()=>{ try{ document.execCommand('copy'); done(); }catch(e){} });
      }else{ try{ document.execCommand('copy'); done(); }catch(e){} }
    });
    box.querySelector('#bkClose').addEventListener('click', ()=>box.classList.add('hide'));
  });

  host.querySelector('#bkIn').addEventListener('click', ()=>{
    box.classList.remove('hide');
    box.innerHTML =
      '<p class="bkh">書き出した文字列を貼りつけてください。'+
        'いまの記録とつき合わせて、多いほうを残します（同じものを二度読み込んでも増えません）。</p>'+
      '<textarea class="bkta" id="bkTa" placeholder="ここに貼りつけ"></textarea>'+
      '<div class="bkrow"><button class="bkbtn go" id="bkGo">読み込む</button>'+
      '<button class="bkbtn" id="bkClose">とじる</button></div>'+
      '<p class="bkmsg" id="bkMsg"></p>';
    box.querySelector('#bkClose').addEventListener('click', ()=>box.classList.add('hide'));
    box.querySelector('#bkGo').addEventListener('click', ()=>{
      const n = bkImport(box.querySelector('#bkTa').value);
      const msg = box.querySelector('#bkMsg');
      if(n === null){ msg.className = 'bkmsg ng'; msg.textContent = '読み込めませんでした。書き出した文字列を、切らずに全部貼りつけてください。'; return; }
      /* このあと画面を描き直すので、知らせは次の描画で出す */
      bkFlash = n + '問ぶんを取り込みました。';
      bkAfterImport();
    });
  });
}

/* 取り込んだあとは、いまの画面をその記録で描き直す */
function bkAfterImport(){
  loadST();
  renderStats();
  renderHome();
}
$('ansBtn').addEventListener('click', openAnswer);
$('menuBtn').addEventListener('click', ()=>{ syncPrev(); openSheet($('menuSheet')); });
$('peekBtn').addEventListener('click', closeSheets);   // 入力は残したままシートだけ下ろす

/* 早見表とキーボードは入れ替えで出す */
function showHow(on){
  $('how').classList.toggle('hide', !on);
  $('kb').classList.toggle('hide', on || pickMode || drawMode);
  $('howBtn').textContent = on ? '書き方 ▴' : '書き方 ▾';
  $('howBtn').setAttribute('aria-expanded', on?'true':'false');
}
$('howBtn').addEventListener('click', ()=>showHow($('how').classList.contains('hide')));
$('how').addEventListener('click', ()=>showHow(false));

$('penSeg').addEventListener('click', e=>{
  const b = e.target.closest('button');
  if(!b) return;
  penW = parseFloat(b.dataset.w);
  Array.prototype.forEach.call($('penSeg').children, x=>x.classList.toggle('on', x===b));
  setTool('pen');
});

/* 抜けても何も失わないので、確認を挟まずそのまま戻る */
$('backBtn').addEventListener('click', goHome);

$('menuSheet').addEventListener('click', e=>{
  const b = e.target.closest('.sitem');
  if(!b || b.disabled) return;
  const act = b.dataset.act;
  const from = S.idx;                 /* 続けて叩かれたぶんを効かせないため */
  closeSheets();
  setTimeout(()=>{
    if(act==='prev' && S.idx !== from) return;
    if(act==='jump'){ openJump(); }
    else if(act==='prev'){ prev(); }
    else if(act==='retry'){ clearPad(); resetInput(); }
    else if(act==='clear'){ clearPad(); }
    else if(act==='skip'){
      /* スキップでも答えと解説は見せる。記録だけ残さない。 */
      const q = curQ();
      if(!q){ next(); return; }
      openSheet($('ansSheet'));
      /* 証明問題は照合する答えがないので、いつもの自己採点画面を出す */
      if(q.self) showSelf(q); else showResult(q, null, IV);
    }
    else if(act==='reveal'){
      const q = curQ();
      if(!q) return;
      openSheet($('ansSheet'));
      if(q.self){ showSelf(q); return; }   /* 自己申告なので勝手に不正解にはしない */
      score(q, false);
      showResult(q, false, IV);
    }
    else if(act==='restart'){
      confirmAsk('最初からやり直しますか？','この範囲を1問目から出題し直します。','やり直す',()=>startSession(S.topic, true));
    }
    else if(act==='home'){ goHome(); }
  }, 200);
});

let confFn = null;
function confirmAsk(title, msg, yes, fn){
  $('confTtl').textContent = title;
  $('confMsg').textContent = msg;
  $('confYesTx').textContent = yes;
  confFn = fn;
  openSheet($('confSheet'));
}
$('confYes').addEventListener('click', ()=>{
  const f = confFn; confFn = null;
  closeSheets();
  setTimeout(()=>{ if(f) f(); }, 180);
});
$('confNo').addEventListener('click', ()=>{ confFn=null; closeSheets(); });

$('modeSeg').addEventListener('click', e=>{
  const b = e.target.closest('button');
  if(!b) return;
  S.mode = b.dataset.m;
  renderMenu();
});

$('toTop').addEventListener('click', goTop);

$('shufBtn').addEventListener('click', ()=>{
  S.shuffle = !S.shuffle;
  renderMenu();   /* 並べ替えると「途中から」は意味がなくなるので出し入れする */
});

$('resetAll').addEventListener('click', ()=>{
  confirmAsk('学習記録を消去しますか？','間違えた回数と復習リストがすべて消えます。この操作は元に戻せません。','すべて消去',()=>{
    ST = {}; saveST(); POS = {}; savePOS(); renderHome(); renderMenu();
  });
});

/* PCのキーボードでも入力できるように */
window.addEventListener('keydown', e=>{
  if(!$('ansSheet').classList.contains('on')) return;
  if($('ansRes').classList.contains('hide')===false){
    if(e.key==='Enter'){ const b=$('resBtns'); if(b&&b.lastChild){ e.preventDefault(); b.lastChild.click(); } }
    return;
  }
  if(e.key==='Enter'){ e.preventDefault(); submit(); return; }
  if(pickMode) return;        /* 選択式では文字入力を受け付けない */
  if(e.key==='Backspace'){ e.preventDefault(); doFn('bs'); }
  else if(e.key==='ArrowLeft'){ e.preventDefault(); doFn('l'); }
  else if(e.key==='ArrowRight'){ e.preventDefault(); doFn('r'); }
  else if(e.key.length===1 && /[0-9a-zA-Z.,+\-*/^()<>=]/.test(e.key)){ e.preventDefault(); insert(e.key); }
});

/* 起動 */
/* 2本指タップの案内は、指が2本使える端末にだけ出す */
if(!(navigator.maxTouchPoints > 1)){
  const tip = $('padHint').querySelector('small');
  if(tip) tip.remove();
}
renderHome();
renderMenu();
show('home');

/* ホーム画面のショートカットから学習状況を直接開けるように */
if(location.search.indexOf('view=stats')>=0) openStats();

/* ホーム画面から開いたときは縦のままにする。
   manifest の orientation だけだと効かない端末があるので、
   使える環境では画面の向きも直接ロックしておく（未対応なら黙って何もしない）。 */
try{
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if(standalone && screen.orientation && screen.orientation.lock){
    const r = screen.orientation.lock('portrait');
    if(r && r.catch) r.catch(()=>{});
  }
}catch(e){}

/* オフラインでも開けるようにする（file:// では登録できないので黙って見送る） */
if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}

