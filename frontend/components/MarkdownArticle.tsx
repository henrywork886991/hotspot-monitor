import { Fragment, ReactNode } from 'react';

// Minimal, safe Markdown renderer for AI-rewritten articles. We only emit the
// constructs the rewrite prompt is allowed to produce (## / ### headings, `- `
// bullet lists, **bold**, paragraphs) as React elements — no dangerouslySetInnerHTML,
// so there's no HTML-injection surface even though the content is model-generated.

function inline(text: string, keyBase: string): ReactNode[] {
  // Split on **bold** spans; everything else is plain text.
  const out: ReactNode[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  parts.forEach((p, i) => {
    if (!p) return;
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) out.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>);
    else out.push(<Fragment key={`${keyBase}-t${i}`}>{p}</Fragment>);
  });
  return out;
}

export default function MarkdownArticle({ md }: { md: string }) {
  const lines = md.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const txt = para.join(' ').trim();
      if (txt) blocks.push(<p key={`p${blocks.length}`}>{inline(txt, `p${blocks.length}`)}</p>);
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const items = [...list];
      blocks.push(
        <ul key={`u${blocks.length}`}>
          {items.map((it, i) => <li key={i}>{inline(it, `u${blocks.length}-${i}`)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) {
      flushPara(); flushList();
      blocks.push(<h3 key={`h${blocks.length}`}>{inline(line.replace(/^###\s+/, ''), `h${blocks.length}`)}</h3>);
    } else if (/^##\s+/.test(line)) {
      flushPara(); flushList();
      blocks.push(<h2 key={`h${blocks.length}`}>{inline(line.replace(/^##\s+/, ''), `h${blocks.length}`)}</h2>);
    } else if (/^#\s+/.test(line)) {
      flushPara(); flushList();
      blocks.push(<h2 key={`h${blocks.length}`}>{inline(line.replace(/^#\s+/, ''), `h${blocks.length}`)}</h2>);
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^[-*]\s+/, ''));
    } else if (line.trim() === '') {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara(); flushList();

  return <>{blocks}</>;
}
