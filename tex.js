/* =======================================================================
   いまの書き方 → LaTeX

   問題文は日本語と数式が混ざっているので、まず数式のかたまりを切り出して、
   そこだけを LaTeX に直す。かたまりの中は文字を1つずつ読んで組み立てるので、
   根号の中の根号のような入れ子でも崩れない。
   ======================================================================= */

/* 数式のかたまりに入れる文字 */
const MCH = "\u0001" + "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
          + ".,+-=<>()[]{}^_/√∛□≦≧≠×÷·・± " + "π′→∞∫|αβ";
/* ただの数字やかっこだけの並びは、日本語の中の「6(2)」のような字なので数式にしない。
   下のどれかが入っていて初めて数式として組む。 */
const MSIG = /[\^_√∛×÷·・≦≧□±/\u0001π′→∞∫|αβ]|[A-Za-z]/;

/* 入力欄のカーソル位置を示す目印 */
const CT = '\u0001';

const SYM = {'×':'\\times ', '÷':'\\div ', '·':'\\cdot ', '・':'\\cdot ', '±':'\\pm ',
             '≦':'\\leqq ', '≧':'\\geqq ', '≠':'\\neq ', '<':'<', '>':'>',
             'π':'\\pi ', '′':"'", '→':'\\to ', '∞':'\\infty ',
             '∫':'\\int ', '|':'|', 'α':'\\alpha ', 'β':'\\beta ',
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
  /* 入力欄のカーソルの目印は、あっても無いものとして読む。
     目印で区切られて 2^{} のように崩れないように。 */
  let pre = '';
  while(s[i]===CT){ pre += SYM[CT]; i++; }
  if(s[i]==='{'){ const r = balanced(s, i, '{', '}'); if(r) return [pre + conv(r[0]), r[1]]; }
  if(s[i]==='('){ const r = balanced(s, i, '(', ')'); if(r) return [pre + conv(r[0]), r[1]]; }
  let j = i;
  if(s[j]==='-') j++;
  if(j<s.length && /[0-9]/.test(s[j])){ while(j<s.length && /[0-9\u0001]/.test(s[j])) j++; }
  else if(j<s.length && /[A-Za-zαβ□]/.test(s[j])){ j++; while(s[j]===CT) j++; }   /* □ は log や ⁿ√ のひな形の穴 */
  return [pre + conv(s.slice(i, j)), j];
}

/* ひとかたまり（分数の分子・分母になる単位）を読む */
function atom(s, i){
  let tex, j;
  /* 先頭のカーソルの目印は、かたまりの切れ目にしない */
  let pre = '';
  while(s[i]===CT){ pre += SYM[CT]; i++; }
  if(s[i]==='('){
    const r = balanced(s, i, '(', ')');
    if(!r) return null;
    tex = '\\left(' + conv(r[0]) + '\\right)'; j = r[1];
  }else if(s[i]==='√' || s[i]==='∛'){
    const r = root(s, i);
    tex = r[0]; j = r[1];
  }else{
    j = i;
    while(j<s.length && /[0-9A-Za-z.□\u0001]/.test(s[j])) j++;   /* □ は穴うめの箱 */
    if(j===i) return pre ? [pre, i] : null;
    tex = conv(s.slice(i, j));   /* 分母に来た log も命令として出る */
  }
  tex = pre + tex;
  /* うしろに上付き・下付きが続くなら、それも込みで1かたまり */
  while(j<s.length && (s[j]==='^' || s[j]==='_')){
    const [body, nj] = script(s, j+1);
    tex += s[j] + '{' + body + '}';
    j = nj;
  }
  /* log_2(7) や log_2 7 のような「中身つきの log」は、中身までで1かたまり。
     ここで切ると 1/log_2 7 が「1/log_2 のあとに 7」に化ける。 */
  if(/\\log/.test(tex)){
    if(s[j]==='('){
      const r = balanced(s, j, '(', ')');
      if(r){ tex += '\\left(' + conv(r[0]) + '\\right)'; j = r[1]; }
    }else if(s[j]===' '){
      const a = atom(s, j+1);
      if(a){ tex += '\\,' + a[0]; j = a[1]; }
    }
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

    /* lim_{x→2} のような極限。下に付くものを添字として組む。 */
    if(c==='l' && s.slice(i,i+3)==='lim'){
      i += 3;
      if(s[i]==='_'){ const [b, ni] = script(s, i+1); out += '\\lim_{' + b + '}'; i = ni; }
      else out += '\\lim ';
      continue;
    }
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
    /* 定積分の [ … ]_a^b。中身の高さに合わせて伸ばす。
       根号の指数 √[3]{8} は上の √ のところで先に読み終えているので、ここには来ない。 */
    if(c==='['){ const r = balanced(s, i, '[', ']');
      if(r){ out += '\\left[' + conv(r[0]) + '\\right]'; i = r[1]; continue; } }
    if(c===']'){ i++; continue; }

    if(SYM[c]){ out += SYM[c]; i++; continue; }
    if(c===' '){ out += '\\,'; i++; continue; }
    if(c==='&'){ out += '\\&'; i++; continue; }
    if(c==='%'){ out += '\\%'; i++; continue; }
    out += c; i++;
  }
  return out;
}

/* すでに組んだ文字列の末尾から、分子にすべきかたまりを切り出す。

   末尾から順に、はがせるものをはがしていく。
   かっこは正規表現だと「いちばん手前の ( 」まで飲みこんでしまい、
   (a)=(b)/(c) が丸ごと分子になるので、対応する ( を数えて探す。 */
const RE_TC   = /\\htmlClass\{tcaret\}\{\|\}$/;          /* カーソルの目印 */
/* 上付き・下付き。中にカーソルの目印（\htmlClass{tcaret}{|}）が入っていても
   はがせるようにする。目印はかっこを含むので、素朴に [^{}]* と書くと
   x^{3|} のようなときだけ分数に組めなくなる。 */
const CT_TEX  = '\\\\htmlClass\\{tcaret\\}\\{\\|\\}';
const RE_SCR  = new RegExp('[\\^_]\\{(?:' + CT_TEX + '|[^{}])*\\}$');
const RE_SQRT = /\\sqrt(?:\[[^\]]*\])?\{(?:[^{}]|\{[^{}]*\})*\}$/;
/* \log のような命令は先頭の \ まで含めて切り出す。
   ここで \ を置いていくと \ + frac に割れて、画面に frac の字が出る。
   カーソルの目印は、かたまりの切れ目にしない。切れ目にすると、
   分母と分子の間にカーソルがあるときだけ分数にならない。 */
const RE_TOK  = /(?:[0-9.]*\\[A-Za-z]+|[0-9A-Za-z.]+)(?:\\htmlClass\{tcaret\}\{\|\}[0-9A-Za-z.]*)*$/;
/* かっこの前に付いた log_2 のような名前。これも分子に入れないと
   log_2(7)/log_2(3) が「log の中が分数」に化ける。 */
const RE_FN   = new RegExp('\\\\?[0-9A-Za-z.]+(?:_\\{(?:' + CT_TEX + '|[^{}])*\\})?$');
/* log_2 8 のように、間を空けて書いた log の中身。ここで切ると
   log_2 8/log_2 3 が「log の中が分数」に化ける。 */
const RE_LOGA = /\\log\s*(?:_\{[^{}]*\})?\s*(?:\\,)?$/;

/* かっこの種類ごとの、開き・閉じの組 */
const PAIRS = [['\\left(', '\\right)'], ['\\left\\{', '\\right\\}']];

/* \pi のような命令のうしろに付く区切りの空白は、あっても無いものとして見る。
   はがすたびに呼ぶ。カーソルの目印をはがしたあとに空白が出てくることがあり、
   そこで見落とすと 32π|/3 のときだけ分数に組めなくなる。 */
const trimCmd = t => t.replace(/(\\[A-Za-z]+)\s+$/, '$1');

function lastAtom(out){
  let tail = '', m;
  out = trimCmd(out);
  while((m = RE_TC.exec(out))){  tail = m[0] + tail; out = trimCmd(out.slice(0, m.index)); }
  while((m = RE_SCR.exec(out))){ tail = m[0] + tail; out = trimCmd(out.slice(0, m.index)); }

  let start = -1;
  const pair = PAIRS.find(p => out.slice(-p[1].length) === p[1]);
  if(pair){
    /* 対応する開きかっこを後ろから数えて探す */
    const [op, cl] = pair;
    let i = out.length, d = 0;
    while(i > 0){
      if(i >= cl.length && out.startsWith(cl, i-cl.length)){ d++; i -= cl.length; continue; }
      if(i >= op.length && out.startsWith(op, i-op.length)){ d--; i -= op.length; if(d === 0){ start = i; break; } continue; }
      i--;
    }
    /* かっこの前に付いた log_2 のような名前は分子に含める。
       ただし lim は「かっこの中身の極限」なので、分子に飲みこませない
       （飲みこむと lim(x^2-9)/(x+3) が「lim の分数」に化ける）。 */
    if(start > 0){ const f = RE_FN.exec(out.slice(0, start));
      if(f && !/^\\lim/.test(f[0])) start = f.index; }
  }
  else if((m = RE_SQRT.exec(out))) start = m.index;
  else if((m = RE_TOK.exec(out)))  start = m.index;

  if(start < 0) return null;
  const lg = RE_LOGA.exec(out.slice(0, start));   /* 手前の log ごと切り出す */
  if(lg) start = lg.index;
  return {head: out.slice(0, start), tex: out.slice(start) + tail};
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

