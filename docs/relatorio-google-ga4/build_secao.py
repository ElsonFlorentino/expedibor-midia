# Gera as páginas "Alcance e interesse em Minas" (Meta + Google Ads + GA4) e insere
# no relatório executivo, sem valores de investimento. Idempotente: reexecutar substitui o bloco.
# Uso: python3 build_secao.py
import csv, collections, datetime as dt, json, re, unicodedata
from pathlib import Path

AQUI = Path(__file__).parent
REL = AQUI.parents[1] / 'painel' / 'relatorio-executivo-expedibor-campanha.html'
INI, FIM = '<!-- secao-google-ga4:start -->', '<!-- secao-google-ga4:end -->'
D = dt.date


def fmt(n):
    return f'{n:,}'.replace(',', '.')


# ---------- dados ----------
meta = json.load(open(AQUI / 'meta.json'))
mt = meta['metaTotal'][0]
fase = {r['adset_name'].split('][')[2]: r for r in meta['metaFase']}
meta_dia = collections.Counter()
for r in meta['metaDiario']:
    meta_dia[r['date_start']] += int(r['impressions'])

reg_dia = collections.defaultdict(collections.Counter)
for r in csv.reader(open(AQUI / 'ga4-regiao-data.csv')):
    if r and r[0].isdigit():
        reg_dia[D(int(r[0][:4]), int(r[0][4:6]), int(r[0][6:8]))][r[1]] += int(r[2])
MG, SP = 'State of Minas Gerais', 'State of Sao Paulo'
dias = sorted(d for d in reg_dia if d <= D(2026, 10, 29))


def soma(a, b, reg=None):
    ds = [d for d in dias if a <= d <= b]
    if reg:
        return sum(reg_dia[d][reg] for d in ds), len(ds)
    return sum(sum(reg_dia[d].values()) for d in ds), len(ds)


feira = (D(2026, 9, 30), D(2026, 10, 3))
pausa = (D(2026, 9, 10), D(2026, 9, 24))
mg_feira, nf = soma(*feira, MG)
tot_feira, _ = soma(*feira)
mg_pausa, np_ = soma(*pausa, MG)
sp_feira, _ = soma(*feira, SP)
mg_dia_feira, mg_dia_pausa = mg_feira / nf, mg_pausa / np_
mult = round(mg_dia_feira / mg_dia_pausa)
share_feira = round(100 * mg_feira / tot_feira)
tot_reg = collections.Counter()
for d in dias:
    tot_reg += reg_dia[d]

# cidades (período 01/08 a 29/10)
linhas = open(AQUI / 'ga4-resumo.csv', encoding='utf-8').read().split('\n')
i = linhas.index('Cidade,Usuários ativos')
cidades = []
for l in linhas[i + 1:]:
    if not l.strip() or l.startswith('#'):
        break
    c, v = l.rsplit(',', 1)
    cidades.append((c, int(v)))
NOMES = {'Sao Paulo': 'São Paulo', 'Uberlandia': 'Uberlândia', 'Juiz de Fora': 'Juiz de Fora',
         'Rio de Janeiro': 'Rio de Janeiro', 'Contagem': 'Contagem', 'Belo Horizonte': 'Belo Horizonte',
         'Curitiba': 'Curitiba', 'Suzano': 'Suzano', 'Montes Claros': 'Montes Claros',
         'Governador Valadares': 'Gov. Valadares', 'Betim': 'Betim'}
# fora do Brasil = em geral data centers e robôs (Singapore, Council Bluffs etc.): fora do ranking
top = [(NOMES[c], v) for c, v in cidades if c in NOMES][:10]
mg_cidades_txt = None
try:
    norm = lambda s: unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower().replace("'", '').replace('-', ' ').strip()
    mgset = {norm(m['nome']) for m in json.load(open(AQUI / 'ibge-municipios-mg.json'))}
    tot_c = sum(v for _, v in cidades)
    mg_c = sum(v for c, v in cidades if norm(c) in mgset)
    n_mg = sum(1 for c, _ in cidades if norm(c) in mgset)
    mg_cidades_txt = (round(100 * mg_c / tot_c), n_mg)
except FileNotFoundError:
    pass
RMBH = ['Belo Horizonte', 'Contagem', 'Betim', 'Ribeirao das Neves', 'Nova Lima', 'Sabara', 'Ibirite', 'Lagoa Santa',
        'Vespasiano', 'Sarzedo', 'Igarape', 'Juatuba', 'Pedro Leopoldo', 'Esmeraldas', 'Matozinhos', 'Caete',
        'Mateus Leme', 'Sao Joaquim de Bicas', 'Brumadinho']
rmbh = sum(v for c, v in cidades if c in RMBH)
bh = dict(cidades)['Belo Horizonte']
sp_city = dict(cidades)['Sao Paulo']

views = 0
for l in open(AQUI / 'gads-trueview-rede.csv', encoding='utf-8').read().split('\n')[1:]:
    if l.strip():
        views += sum(int(x.replace('.', '')) for x in l.split('",')[1].split(','))
GOOGLE_IMPR_OUT = 67608  # Porter, 13 a 26/10, 100% "State of Minas Gerais"


# ---------- gráfico SVG: visitantes por dia, MG × SP ----------
def grafico():
    W, H, L, R, T, B = 1000, 300, 34, 92, 18, 34
    d0, n = dias[0], len(dias)
    ymax = 90
    x = lambda d: L + (d - d0).days * (W - L - R) / (n - 1)
    y = lambda v: T + (H - T - B) * (1 - v / ymax)
    faixas = [('Meta · fase 0', D(2026, 8, 30), D(2026, 9, 9), '#eaf4fc', '#5c7f9b'),
              ('Aquecimento', D(2026, 9, 25), D(2026, 9, 29), '#eaf4fc', '#5c7f9b'),
              ('FEIRA', *feira, '#cfe7fa', '#00539a'),
              ('Google vídeo', D(2026, 10, 13), D(2026, 10, 26), '#f1f5f8', '#7d90a1')]
    s = [f'<svg viewBox="0 0 {W} {H}" role="img" aria-label="Visitantes do site por dia, Minas Gerais e São Paulo" style="width:100%;height:auto;display:block">']
    for nome, a, b, cor, txt in faixas:
        xa, xb = x(a) - 6, x(b) + 6
        s.append(f'<rect x="{xa:.1f}" y="{T}" width="{xb - xa:.1f}" height="{H - T - B}" fill="{cor}"/>')
        peso = 900 if nome == 'FEIRA' else 700
        ancora, xt = {'Aquecimento': ('end', xb - 2), 'FEIRA': ('start', xa + 2)}.get(nome, ('middle', (xa + xb) / 2))
        s.append(f'<text x="{xt:.1f}" y="{T - 5}" text-anchor="{ancora}" font-size="11" font-weight="{peso}" fill="{txt}">{nome}</text>')
    for v in (0, 30, 60, 90):
        s.append(f'<text x="{L - 8}" y="{y(v) + 4:.1f}" text-anchor="end" font-size="11" fill="#8aa0b2">{v}</text>')
    s.append(f'<line x1="{L}" x2="{W - R}" y1="{y(0):.1f}" y2="{y(0):.1f}" stroke="#c9d6e1"/>')
    for d in dias:
        if d.day in (1, 15):
            s.append(f'<text x="{x(d):.1f}" y="{H - 12}" text-anchor="middle" font-size="11" fill="#8aa0b2">{d.day:02d}/{d.month:02d}</text>')
    for reg, cor, w, rot in ((SP, '#a3b4c3', 2.5, 'São Paulo'), (MG, '#0060af', 4, 'Minas Gerais')):
        pts = ' '.join(f'{x(d):.1f},{y(reg_dia[d][reg]):.1f}' for d in dias)
        s.append(f'<polyline points="{pts}" fill="none" stroke="{cor}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"/>')
        u = dias[-1]
        dy = -14 if reg == MG else 14
        s.append(f'<text x="{x(u) + 8:.1f}" y="{y(reg_dia[u][reg]) + 4 + dy:.1f}" font-size="12" font-weight="900" fill="{cor}">{rot}</text>')
    pico = max((d for d in dias if feira[0] <= d <= feira[1]), key=lambda d: reg_dia[d][MG])
    s.append(f'<circle cx="{x(pico):.1f}" cy="{y(reg_dia[pico][MG]):.1f}" r="6" fill="#0060af" stroke="#fff" stroke-width="2"/>')
    s.append(f'<text x="{x(pico) + 12:.1f}" y="{y(reg_dia[pico][MG]) + 4:.1f}" font-size="12" font-weight="900" fill="#04111f">{reg_dia[pico][MG]} visitantes de MG em {pico.day:02d}/{pico.month:02d}</text>')
    s.append('</svg>')
    return ''.join(s)


def barras(itens, destaque):
    vmax = itens[0][1]
    out = []
    for k, (nome, v) in enumerate(itens, 1):
        cinza = '' if nome in destaque else ' data-x'
        out.append(f'<div class="bar-row"><div class="bar-rank">{k}</div><div class="bar-name">{nome}</div>'
                   f'<div class="bar-track"><span{cinza} style="width:{100 * v / vmax:.1f}%"></span></div>'
                   f'<div class="bar-value">{fmt(v)}</div></div>')
    return ''.join(out)


def header(secao, num):
    return (f'<header class="page-header"><div class="wordmark">EXPEDIBOR</div>'
            f'<div class="page-section">{secao}</div><div class="page-number">{num:02d}</div></header>')


CSS = '''
    .mg-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:5mm}
    .phase-table td.l,.phase-table th.l{text-align:left}
    .phase-table .feira td{background:#eaf6ff!important;font-weight:900;color:var(--navy-900)}
    .channel-tag{display:inline-block;font-size:6.5px;font-weight:900;letter-spacing:.6px;padding:1mm 2mm;border-radius:8px;margin-right:2mm;vertical-align:1px}
    .tag-meta{background:var(--blue-100);color:var(--blue-700)}
    .tag-google{background:#eef1f4;color:#4d687d}
    .chart-box{border:1px solid var(--line);border-radius:4mm;padding:4mm 5mm 2mm;background:#fff}
    .chart-box h3{font-size:13px;margin-bottom:1mm;color:var(--navy-900)}
    .chart-box .chart-sub{font-size:8px;color:var(--muted);margin-bottom:2mm}
    .proof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:4mm}
    .bar-track span[data-x]{background:#b9cbd9}
    #resumo .lead{margin-bottom:4mm}
    #resumo .insight-banner{min-height:0;padding:5mm 6mm}
    #resumo .winner-panel{gap:3mm}
    #resumo .winner-box{padding:3mm 4mm}
    #resumo .kpi-grid{margin-top:4mm;gap:3mm}
    #resumo .kpi-card{min-height:0;padding:3.5mm 4.5mm}
    #resumo .kpi-card strong{margin:2mm 0 1.5mm}
    #resumo .metric-guide{margin-top:3.5mm;padding:3mm 5mm}
    #funil .yield-card{margin-top:4mm;padding:4mm 5mm}
    #funil .yield-card .bar-row{margin:2mm 0}
    #funil .yield-card .bar-track{height:4.5mm}
    #funil .method-strip{margin-top:3mm}
'''


def paginas(n0):
    f0, f1, f2 = fase['FASE0-AGOSTO'], fase['FASE1-INTENSIFICACAO'], fase['FASE2-DURANTE-FEIRA']
    imp_dia_ago = sum(v for k, v in meta_dia.items() if '2026-08-13' <= k <= '2026-09-09') / 28
    imp_dia_feira = sum(v for k, v in meta_dia.items() if '2026-09-30' <= k <= '2026-10-03') / 4
    p1 = f'''
    <section class="page" id="alcance-mg">
      {header('Alcance em Minas · Meta + Google', n0)}
      <span class="eyebrow">Campanha completa · 12/08 a 26/10</span>
      <h2>{fmt(int(mt['reach']))} pessoas em Minas Gerais viram a Expedibor</h2>
      <p class="lead">O objetivo era awareness: colocar a marca na frente do público mineiro antes, durante e depois da MinasParts. A entrega foi 100% dentro de Minas, e na semana da feira o ritmo subiu para cerca de {fmt(int(round(imp_dia_feira, -3)))} impressões por dia, quase 3 vezes o ritmo de agosto.</p>
      <div class="mg-kpis">
        <div class="kpi-card featured impressions-kpi"><span class="kpi-label">Pessoas alcançadas · Meta</span><strong>{fmt(int(mt['reach']))}</strong><small>Pessoas únicas em MG, sem contar a mesma pessoa duas vezes.</small></div>
        <div class="kpi-card featured"><span class="kpi-label">Impressões · Meta</span><strong>{fmt(int(mt['impressions']))}</strong><small>Cada pessoa viu a marca {mt['frequency'][:3].replace('.', ',')} vezes em média.</small></div>
        <div class="kpi-card"><span class="kpi-label">Visualizações de vídeo · Google</span><strong>{fmt(views)}</strong><small>YouTube, Rede de Display e Google TV.</small></div>
        <div class="kpi-card"><span class="kpi-label">Entrega dentro de MG</span><strong>100%</strong><small>Meta e Google segmentados só para Minas Gerais.</small></div>
      </div>
      <table class="data-table phase-table" style="margin-top:5mm">
        <thead><tr><th class="l">Fase</th><th class="l">Período</th><th class="l">Público</th><th>Pessoas alcançadas</th><th>Impressões</th></tr></thead>
        <tbody>
          <tr><td class="l"><span class="channel-tag tag-meta">META</span>Fase 0 · presença de marca</td><td class="l">12/08 a 09/09</td><td class="l">Minas Gerais</td><td>{fmt(int(f0['reach']))}</td><td>{fmt(int(f0['impressions']))}</td></tr>
          <tr><td class="l"><span class="channel-tag tag-meta">META</span>Fase 1 · aquecimento</td><td class="l">25/09 a 29/09</td><td class="l">Minas Gerais</td><td>{fmt(int(f1['reach']))}</td><td>{fmt(int(f1['impressions']))}</td></tr>
          <tr class="feira"><td class="l"><span class="channel-tag tag-meta">META</span>Fase 2 · durante a feira</td><td class="l">30/09 a 03/10</td><td class="l">Raio do Expominas, BH</td><td>{fmt(int(f2['reach']))}</td><td>{fmt(int(f2['impressions']))}</td></tr>
          <tr><td class="l"><span class="channel-tag tag-google">GOOGLE</span>Vídeo · aquecimento e pós-feira</td><td class="l">25/09 a 29/09 e 13/10 a 26/10</td><td class="l">Minas Gerais</td><td>{fmt(views)} views</td><td>{fmt(GOOGLE_IMPR_OUT)}*</td></tr>
        </tbody>
      </table>
      <div class="proof-grid">
        <div class="scale-stat"><strong>{fmt(int(round(imp_dia_ago, -3)))} → {fmt(int(round(imp_dia_feira, -3)))}</strong><span>impressões por dia em agosto × nos dias da feira. A presença da marca cresceu quando mais importava.</span></div>
        <div class="scale-stat"><strong>{fmt(int(f2['reach']))}</strong><span>pessoas alcançadas em 4 dias no raio do Expominas, onde a MinasParts aconteceu.</span></div>
        <div class="scale-stat"><strong>{fmt(int(f0['reach']))}</strong><span>pessoas em Minas já conheciam a marca pela fase 0, mais de um mês antes da feira.</span></div>
      </div>
      <div class="method-strip">O alcance de cada fase não deve ser somado: a mesma pessoa pode ter sido impactada em mais de uma fase. O total de {fmt(int(mt['reach']))} já desconta essas repetições. *Impressões do Google de 13 a 26/10; para 25 a 29/09 a plataforma exportou só as visualizações.</div>
      <footer class="page-footer"><span>Fontes: API de Marketing da Meta e Google Ads · 01/08 a 29/10/2026</span><span>Relatório executivo</span></footer>
    </section>'''

    p2 = f'''
    <section class="page" id="site-mg">
      {header('Interesse no site · Google Analytics', n0 + 1)}
      <span class="eyebrow">Visitantes do site por dia, por estado</span>
      <h2>Quando a marca esteve no ar em Minas, Minas foi ao site</h2>
      <p class="lead">Na semana da feira, o site recebeu {round(mg_dia_feira)} visitantes de Minas por dia, contra {str(round(mg_dia_pausa, 1)).replace('.', ',')} por dia na pausa de setembro. São Paulo, onde fica a fábrica, ficou estável o tempo todo: é a prova de que o salto veio de Minas.</p>
      <div class="chart-box">
        <h3>Visitantes do site por dia: Minas Gerais × São Paulo</h3>
        <p class="chart-sub">Usuários ativos no Google Analytics 4, de 30/08 a 29/10/2026. Faixas = períodos com mídia no ar.</p>
        {grafico()}
      </div>
      <div class="proof-grid">
        <div class="scale-stat"><strong>{mult}x</strong><span>mais visitantes de MG por dia na feira ({round(mg_dia_feira)}/dia) do que na pausa de setembro ({str(round(mg_dia_pausa, 1)).replace('.', ',')}/dia).</span></div>
        <div class="scale-stat"><strong>{share_feira}%</strong><span>dos visitantes do site durante a feira eram de Minas Gerais ({mg_feira} de {tot_feira}).</span></div>
        <div class="scale-stat"><strong>{round(sp_feira / nf)} por dia</strong><span>era o ritmo de São Paulo na feira, o mesmo de sempre. O pico foi só mineiro.</span></div>
      </div>
      <footer class="page-footer"><span>Fonte: Google Analytics 4 · propriedade Expedibor site · exploração Região × Data</span><span>Relatório executivo</span></footer>
    </section>'''

    pct_txt = (f'<div class="scale-stat"><strong>{mg_cidades_txt[0]}%</strong><span>dos visitantes do site no período vieram de cidades mineiras, de {mg_cidades_txt[1]} municípios diferentes.</span></div>'
               if mg_cidades_txt else '')
    p3 = f'''
    <section class="page" id="cidades-mg">
      {header('Interesse no site · Google Analytics', n0 + 2)}
      <span class="eyebrow">Quem visitou o site · 01/08 a 29/10</span>
      <h2>Belo Horizonte já é a cidade que mais visita o site</h2>
      <p class="lead">Mesmo com a fábrica em Ferraz de Vasconcelos (SP), Belo Horizonte trouxe {fmt(bh)} visitantes, quase o dobro de São Paulo ({fmt(sp_city)}). No período, Minas somou {fmt(tot_reg[MG])} visitantes, contra {fmt(tot_reg[SP])} de São Paulo.</p>
      <div class="section-grid">
        <div class="chart-card">
          <h3>Visitantes do site por cidade</h3><p class="chart-sub">Top 10 cidades do Brasil. Em azul, cidades de Minas Gerais.</p>
          {barras(top, {'Belo Horizonte', 'Contagem', 'Uberlândia', 'Juiz de Fora', 'Montes Claros', 'Gov. Valadares', 'Betim'})}
        </div>
        <div style="display:grid;gap:4mm;align-content:start">
          <div class="scale-stat"><strong>{fmt(rmbh)}</strong><span>visitantes da Grande BH, a região do Expominas, onde a feira aconteceu.</span></div>
          {pct_txt}
          <div class="scale-stat"><strong>{fmt(tot_reg[MG])} × {fmt(tot_reg[SP])}</strong><span>visitantes de Minas × São Paulo entre 30/08 e 29/10.</span></div>
        </div>
      </div>
      <div class="method-strip">Acessos de cidades fora do Brasil (como Singapura e Council Bluffs, nos EUA) são, em geral, servidores e robôs, e ficaram fora do ranking. A principal porta de entrada foi o Instagram, seguido da busca orgânica do Google. O site oficial da MinasParts também levou visitantes ao site da Expedibor.</div>
      <footer class="page-footer"><span>Fonte: Google Analytics 4 · propriedade Expedibor site · 01/08 a 29/10/2026</span><span>Relatório executivo</span></footer>
    </section>'''
    return p1 + p2 + p3


# ---------- inserção no relatório ----------
html = REL.read_text(encoding='utf-8')
html = re.sub(re.escape(INI) + '.*?' + re.escape(FIM), '', html, flags=re.S)
html = re.sub(r'\n    /\* secao-google-ga4 \*/.*?/\* fim \*/', '', html, flags=re.S)
html = html.replace('  </style>', f'    /* secao-google-ga4 */{CSS}    /* fim */\n  </style>', 1)

# as novas páginas entram logo depois do resumo e o resto é renumerado
ordem = [s for s in re.findall(r'<section class="page[^"]*" id="([^"]+)">', html) if s not in ('alcance-mg', 'site-mg', 'cidades-mg')]
pos_resumo = ordem.index('resumo')
final = ordem[:pos_resumo + 1] + ['alcance-mg', 'site-mg', 'cidades-mg'] + ordem[pos_resumo + 1:]

bloco = INI + paginas(pos_resumo + 2) + '\n    ' + FIM + '\n'
fim_resumo = html.index('</section>', html.index('id="resumo"')) + len('</section>')
html = html[:fim_resumo] + '\n\n    ' + bloco + html[fim_resumo:]

def numerar(m):
    sid = m.group(1)
    trecho = m.group(0)
    return re.sub(r'<div class="page-number">\d+</div>', f'<div class="page-number">{final.index(sid) + 1:02d}</div>', trecho, count=1)
html = re.sub(r'<section class="page[^"]*" id="([^"]+)">.*?</section>', numerar, html, flags=re.S)

# navegação lateral
nav = ''.join(f'<a href="#{s}">{s}</a>' for s in final)
html = re.sub(r'(<nav class="screen-nav"[^>]*>)\s*.*?\s*(</nav>)', lambda m: m.group(1) + '\n    ' + nav + '\n  ' + m.group(2), html, count=1, flags=re.S)

# capa: visão da campanha completa, sem valores
html = re.sub(r'<div class="cover-label">.*?</div>', '<div class="cover-label">Meta Ads · Google Ads · Google Analytics</div>', html, count=1)
html = re.sub(r'<p class="cover-subtitle">.*?</p>', '<p class="cover-subtitle">Alcance da marca em Minas Gerais, o interesse no site durante a MinasParts e a performance dos criativos.</p>', html, count=1)
html = re.sub(r'<p class="cover-meta">.*?</p>', '<p class="cover-meta">MinasParts 2026 · Expominas, Belo Horizonte · 12/08 a 26/10</p>', html, count=1)
html = re.sub(r'<div class="cover-kpis">.*?</div>\s*</div>\s*</div>',
              f'<div class="cover-kpis">\n          <div class="cover-kpi"><strong>{fmt(int(mt["reach"]))}</strong><span>Pessoas alcançadas em MG</span></div>\n'
              f'          <div class="cover-kpi"><strong>{mult}x</strong><span>Visitas de MG ao site na feira</span></div>\n'
              f'          <div class="cover-kpi"><strong>{share_feira}%</strong><span>Do público do site na feira</span></div>\n        </div>\n      </div>',
              html, count=1, flags=re.S)
REL.write_text(html, encoding='utf-8')
print('ok', final, mult, share_feira, round(mg_dia_feira, 1), round(mg_dia_pausa, 1), mg_cidades_txt, rmbh, views)
