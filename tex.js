/* =======================================================================
   いまの書き方 → LaTeX

   問題文は日本語と数式が混ざっているので、まず数式のかたまりを切り出して、
   そこだけを LaTeX に直す。かたまりの中は文字を1つずつ読んで組み立てるので、
   根号の中の根号のような入れ子でも崩れない。
   ======================================================================= */

/* 数式のかたまりに入れる文字 */
const MCH = "\u0001" + "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
          + ".,+-=<>()[]{}^_/√∛□≦≧≠×÷·・ ";
/* ただの数字やかっこだけの並びは、日本語の中の「6(2)」のような字なので数式にしない。
   下のどれかが入っていて初めて数式として組む。 */
const MSIG = /[\^_√∛×÷·・≦≧□/\u0001]|[A-Za-z]/;

const SYM = {'×':'\\times ', '÷':'\\div ', '·':'\\cdot ', '・':'\\cdot ',
             '≦':'\\leqq ', '≧':'\\geqq ', '≠':'\\neq ', '<':'<', '>':'>',
             '□':'\\htmlClass{tbx}{\\square}',
             '\u0001':'\\htmlClass{tcaret}{|}'};

/* かっこ [ ] や { } ( ) の対応を取って、中身をそのまま返す */
function balanced(s, i, open, close){
  let d = 0;
  for(let j=i; j<s.length; j++){
    if(s[j]===open) d++;
    else if(s[j]===close){ d--; if(d===0) return [s.slice(i+1, j), j+1]; }
  }
  return null;
}

/* 上付き・下付きの中身を読む。
   {…} や ( … ) で囲ってあればその中身。囲っていなければ、
   数字は続くかぎりまとめて読む（log_10 の底が「1」だけにならないように）。
   文字は1文字だけ（a^3b^2 が a の 3b2 乗にならないように）。 */
function script(s, i){
  if(s[i]==='{'){ const r = balanced(s, i, '{', '}'); if(r) return [conv(r[0]), r[1]]; }
  if(s[i]==='('){ const r = balanced(s, i, '(', ')'); if(r) return [conv(r[0]), r[1]]; }
  let j = i;
  if(s[j]==='-') j++;
  if(j<s.length && /[0-9]/.test(s[j])){ while(j<s.length && /[0-9]/.test(s[j])) j++; }
  else if(j<s.length && /[A-Za-z□]/.test(s[j])) j++;   /* □ は log や ⁿ√ のひな形の穴 */
  return [conv(s.slice(i, j)), j];
}

/* ひとかたまり（分数の分子・分母になる単位）を読む */
function atom(s, i){
  let tex, j;
  if(s[i]==='('){
    const r = balanced(s, i, '(', ')');
    if(!r) return null;
    tex = '\\left(' + conv(r[0]) + '\\right)'; j = r[1];
  }else if(s[i]==='√' || s[i]==='∛'){
    const r = root(s, i);
    tex = r[0]; j = r[1];
  }else{
    j = i;
    while(j<s.length && /[0-9A-Za-z.]/.test(s[j])) j++;
    if(j===i) return null;
    tex = s.slice(i, j);
    if(tex === 'log') tex = '\\log';    /* 分母に来た log も命令として出す */
  }
  /* うしろに上付き・下付きが続くなら、それも込みで1かたまり */
  while(j<s.length && (s[j]==='^' || s[j]==='_')){
    const [body, nj] = script(s, j+1);
    tex += s[j] + '{' + body + '}';
    j = nj;
  }
  return [tex, j];
}

function root(s, i){
  if(s[i]==='∛'){
    const a = atom(s, i+1);
    return a ? ['\\sqrt[3]{' + a[0] + '}', a[1]] : ['\\sqrt[3]{\\;}', i+1];
  }
  let j = i+1, idx = null;
  if(s[j]==='['){ const r = balanced(s, j, '[', ']'); if(r){ idx = conv(r[0]); j = r[1]; } }
  if(s[j]==='{'){ const r = balanced(s, j, '{', '}');
    if(r) return ['\\sqrt' + (idx ? '['+idx+']' : '') + '{' + conv(r[0]) + '}', r[1]]; }
  const a = atom(s, j);
  if(a) return ['\\sqrt' + (idx ? '['+idx+']' : '') + '{' + a[0] + '}', a[1]];
  return ['\\sqrt' + (idx ? '['+idx+']' : '') + '{\\;}', j];
}

/* 数式のかたまりを LaTeX に組み立てる */
function conv(s){
  let out = '', i = 0;
  while(i < s.length){
    const c = s[i];

    if(c==='l' && s.slice(i,i+3)==='log'){
      i += 3;
      if(s[i]==='_'){ const [b, ni] = script(s, i+1); out += '\\log_{' + b + '}'; i = ni; }
      else out += '\\log ';
      continue;
    }
    if(c==='√' || c==='∛'){ const [t, ni] = root(s, i); out += t; i = ni; continue; }
    if(c==='^' || c==='_'){ const [b, ni] = script(s, i+1); out += c + '{' + b + '}'; i = ni; continue; }

    if(c==='/'){
      /* 前後に空白がない a/b は横棒の分数。空白があるものは
         「どこまでが分子か」が決められないので、割り算として ÷ で出す。 */
      const spaced = (i>0 && s[i-1]===' ') || s[i+1]===' ';
      if(spaced){ out += '\\div '; i++; continue; }
      const den = atom(s, i+1);
      const num = lastAtom(out);
      if(den && num){ out = num.head + '\\frac{' + num.tex + '}{' + den[0] + '}'; i = den[1]; continue; }
      out += '/'; i++; continue;
    }

    if(c==='('){ const r = balanced(s, i, '(', ')');
      if(r){ out += '\\left(' + conv(r[0]) + '\\right)'; i = r[1]; continue; } }
    /* 上付き等で使い切らずに残った波かっこは、見せるためのかっこ */
    if(c==='{'){ const r = balanced(s, i, '{', '}');
      if(r){ out += '\\left\\{' + conv(r[0]) + '\\right\\}'; i = r[1]; continue; } }
    if(c==='}'){ i++; continue; }

    if(SYM[c]){ out += SYM[c]; i++; continue; }
    if(c===' '){ out += '\\,'; i++; continue; }
    if(c==='&'){ out += '\\&'; i++; continue; }
    if(c==='%'){ out += '\\%'; i++; continue; }
    out += c; i++;
  }
  return out;
}

/* すでに組んだ文字列の末尾から、分子にすべきかたまりを切り出す */
function lastAtom(out){
  /* \log のような命令の先頭の \ まで含めて切り出す。
     ここで \ を置いていくと \ + frac に割れて、画面に frac の字が出る。 */
  const m = /((?:\\left\((?:[^()]|\\left\(|\\right\))*\\right\)|\\sqrt(?:\[[^\]]*\])?\{[^{}]*\}|\\?[0-9A-Za-z.]+)(?:[\^_]\{[^{}]*\})*)$/.exec(out);
  if(!m) return null;
  return {head: out.slice(0, m.index), tex: m[0]};
}

/* 日本語まじりの文字列を、地の文と数式に切り分ける */
function segments(src){
  const segs = [];
  let buf = '', mode = null;
  const flush = ()=>{ if(buf) segs.push({math: mode==='m', s: buf}); buf=''; };
  for(let i=0;i<src.length;i++){
    const c = src[i];
    const m = MCH.indexOf(c) >= 0;
    if(mode===null) mode = m ? 'm' : 't';
    if((m?'m':'t') !== mode){ flush(); mode = m ? 'm' : 't'; }
    buf += c;
  }
  flush();
  /* 記号らしさが無いかたまり（「6(2)」など）は地の文に戻す */
  return segs.map(g => (g.math && !MSIG.test(g.s)) ? {math:false, s:g.s} : g);
}

function toTeXParts(src){
  return segments(String(src)).map(g => g.math
    ? {math:true,  s: conv(g.s.replace(/^\s+|\s+$/g, m=>m)) , raw:g.s}
    : {math:false, s: g.s});
}


/* =======================================================================
   組み立てて画面に出す
   ======================================================================= */
/* 文字列を「地の文＋数式」に分けて、数式だけ KaTeX で組む。
   KaTeX が読み込めていないときは null を返して、昔の組み方に任せる。 */
function texHTML(src, escape){
  if(typeof katex === 'undefined') return null;
  let out = '';
  for(const g of segments(String(src))){
    if(!g.math){ out += escape(g.s); continue; }
    try{
      out += katex.renderToString(conv(g.s), {
        throwOnError:false, trust:true, strict:false, output:'html'
      });
    }catch(e){ out += escape(g.s); }
  }
  return out;
}

