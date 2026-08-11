/* =======================================================================
   記録の持ち出し

   記録はブラウザの中にしかない。端末を変えたり、アプリを入れ直したり、
   ブラウザのデータを消したりすると無くなる。持ち出せるように、
   記録を1本の文字列にして出し入れできるようにする。

   本編アプリ（/tiri/）とフィード（/jhvjh/）は同じ置き場所を見ているので、
   どちらから書き出しても両方ぶんが入るし、どちらでも読み込める。
   ======================================================================= */

const BK_KEYS = {
  main: 'explog_stats_v1',   // 本編（＝共有中のフィード）の記録
  feed: 'feed_stats_v1',     // フィード専用にしているときの記録
  fav : 'feed_fav_v1'        // フィードのお気に入り
};

function bkRead(k){
  try{
    const r = localStorage.getItem(k);
    const v = r ? JSON.parse(r) : null;
    return (v && typeof v === 'object') ? v : {};
  }catch(e){ return {}; }
}

/* {id:{c,w,p}} を [id, 正解数, 間違い数, 要復習] の並びに畳む。
   何もしていない問題は入れない。 */
function bkPack(st){
  const out = [];
  for(const id in st){
    const r = st[id] || {};
    const c = r.c|0, w = r.w|0, p = r.p===1 ? 1 : 0;
    if(c || w || p) out.push([id, c, w, p]);
  }
  return out;
}
function bkUnpack(rows){
  const st = {};
  (rows || []).forEach(r=>{
    if(!Array.isArray(r) || typeof r[0] !== 'string') return;
    st[r[0]] = {c: r[1]|0, w: r[2]|0, p: r[3] ? 1 : 0};
  });
  return st;
}

function bkExport(){
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
              + '-' + String(d.getDate()).padStart(2,'0');
  return JSON.stringify({
    v : 1,
    d : stamp,
    st : bkPack(bkRead(BK_KEYS.main)),
    fst: bkPack(bkRead(BK_KEYS.feed)),
    fav: Object.keys(bkRead(BK_KEYS.fav))
  });
}

/* 取り込みは「多いほうを残す」。同じものを二度読み込んでも増えないし、
   2台で解いたぶんを片方に寄せることもできる。 */
function bkMerge(cur, add){
  const out = {};
  const ids = {};
  for(const k in cur) ids[k] = 1;
  for(const k in add) ids[k] = 1;
  for(const id in ids){
    const a = cur[id] || {}, b = add[id] || {};
    out[id] = {
      c: Math.max(a.c|0, b.c|0),
      w: Math.max(a.w|0, b.w|0),
      p: (a.p===1 || b.p===1) ? 1 : 0
    };
  }
  return out;
}

/* 読み込む。戻り値は取り込んだ問題数（形が違えば null）。 */
function bkImport(text){
  let o;
  try{ o = JSON.parse(String(text).trim()); }catch(e){ return null; }
  if(!o || typeof o !== 'object' || o.v !== 1) return null;
  if(!Array.isArray(o.st) && !Array.isArray(o.fst) && !Array.isArray(o.fav)) return null;

  const main = bkMerge(bkRead(BK_KEYS.main), bkUnpack(o.st));
  const feed = bkMerge(bkRead(BK_KEYS.feed), bkUnpack(o.fst));
  const fav  = bkRead(BK_KEYS.fav);
  (o.fav || []).forEach(id=>{ if(typeof id === 'string') fav[id] = 1; });

  try{
    localStorage.setItem(BK_KEYS.main, JSON.stringify(main));
    localStorage.setItem(BK_KEYS.feed, JSON.stringify(feed));
    localStorage.setItem(BK_KEYS.fav,  JSON.stringify(fav));
  }catch(e){ return null; }

  const n = new Set(Object.keys(bkUnpack(o.st)).concat(Object.keys(bkUnpack(o.fst)))).size;
  return n;
}

/* 書き出しの文字列に、どれだけ入っているかを数えて見せる */
function bkCount(text){
  try{
    const o = JSON.parse(text);
    return new Set((o.st||[]).map(r=>r[0]).concat((o.fst||[]).map(r=>r[0]))).size;
  }catch(e){ return 0; }
}
