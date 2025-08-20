 const root = document.documentElement;
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'light') document.body.classList.add('theme-light');
    document.getElementById('themeBtn').addEventListener('click', () => {
      document.body.classList.toggle('theme-light');
      localStorage.setItem('theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
    });

    // --- Data: voeg je projecten hieronder toe ---
    /** @typedef {{ id:string, title:string, description:string, category:'Web'|'Data'|'Tooling'|'Design', tech:string[], tags:string[], stars:number, year:number, cover?:string, links?:{label:string, href:string}[] }} Project */
    /** @type {Project[]} */
    const PROJECTS = [
      {
        id: 'p1',
        title: 'UI Componentenkit',
        description: 'Herbruikbare UI-componenten met toegankelijke varianten, gebouwd met HTML/CSS en vanilla JS.',
        category: 'Web',
        tech: ['HTML', 'CSS', 'JS'],
        tags: ['design-system', 'accessibility'],
        stars: 18,
        year: 2025,
        cover: '',
        links: [
          { label: 'Live demo', href: '#' },
          { label: 'Broncode', href: '#' }
        ]
      },
      {
        id: 'p2',
        title: 'Data Explorer',
        description: 'Interactieve tabel met client-side filtering, sorteren en CSV-export.',
        category: 'Data',
        tech: ['JS'],
        tags: ['table', 'export', 'csv'],
        stars: 12,
        year: 2024,
        cover: '',
        links: [ { label: 'Repo', href: '#' } ]
      },
      {
        id: 'p3',
        title: 'Build Tool CLI',
        description: 'Minimalistische CLI voor project scaffolding met plug-in architectuur.',
        category: 'Tooling',
        tech: ['Node'],
        tags: ['cli', 'scaffold'],
        stars: 22,
        year: 2023,
        cover: '',
        links: [ { label: 'NPM', href: '#' } ]
      },
      {
        id: 'p4',
        title: 'Typografie Poster Generator',
        description: 'Canvas-gebaseerde poster generator; export naar PNG/PDF.',
        category: 'Design',
        tech: ['Canvas'],
        tags: ['graphics', 'export'],
        stars: 9,
        year: 2022,
        cover: '',
        links: [ { label: 'Demo', href: '#' } ]
      },
        {
        id: 'p5',
        title: 'Thematic analysis',
        description: 'Zorg georiënteerde Thematische analyse',
        category: 'Tooling',
        tech: ['Node'],
        tags: ['cli', 'scaffold'],
        stars: 22,
        year: 2023,
        cover: 'images/thematicpic',
        links: [ { label: 'GITHUB', href: 'https://jenshoutje.github.io/vragenlijst-triple-C/thematic-analysis.html' } ]
      },
    ];

    // --- Rendering ---
    const grid = document.getElementById('grid');
    const statCount = document.getElementById('stat-count');
    const statStars = document.getElementById('stat-stars');
    const statYear = document.getElementById('stat-year');

    const state = { q:'', sort:'recent', filter:'all' };

    const formatThumb = (p) => {
      if (p.cover) return `<img src="${p.cover}" alt="${p.title} afbeelding" class="thumb" loading="lazy">`;
      const initials = p.title.split(' ').map(w=>w[0]).slice(0,3).join('').toUpperCase();
      return `<div class="thumb" aria-hidden="true">${initials}</div>`;
    };

    function render() {
      const q = state.q.toLowerCase();
      const list = PROJECTS
        .filter(p => state.filter === 'all' || p.category === state.filter)
        .filter(p => !q || [p.title, p.description, p.category, ...(p.tech||[]), ...(p.tags||[])]
          .join(' ').toLowerCase().includes(q))
        .sort((a,b) => state.sort === 'az' ? a.title.localeCompare(b.title)
              : state.sort === 'stars' ? b.stars - a.stars
              : b.year - a.year);

      statCount.textContent = String(list.length);
      statStars.textContent = String(list.reduce((s,p)=>s+p.stars,0));
      statYear.textContent = String(Math.min(...PROJECTS.map(p=>p.year)) || new Date().getFullYear());

      grid.innerHTML = list.map(p => `
        <article class="card col-4" data-id="${p.id}">
          ${formatThumb(p)}
          <div class="card-body">
            <h3>${p.title}</h3>
            <p>${p.description}</p>
            <div class="tags">${[p.category, ...p.tech, ...p.tags].slice(0,6).map(t=>`<span class="tag">${t}</span>`).join('')}</div>
          </div>
          <div class="card-footer">
          
            <a class="link" href="#" data-open="${p.id}">Bekijk</a>
          </div>
        </article>
      `).join('');
    }

    // --- Interactie ---
    document.getElementById('search').addEventListener('input', (e) => { state.q = e.target.value; render(); });
    document.getElementById('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
    document.getElementById('filter').addEventListener('change', (e) => { state.filter = e.target.value; render(); });

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-open]');
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute('data-open');
      const p = PROJECTS.find(x=>x.id===id);
      if (p) openModal(p);
    });

    // --- Modal ---
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalThumb = document.getElementById('modalThumb');
    const modalDesc = document.getElementById('modalDesc');
    const modalTags = document.getElementById('modalTags');
    const modalLinks = document.getElementById('modalLinks');

    function openModal(p){
      modalTitle.textContent = p.title;
      modalThumb.innerHTML = formatThumb(p);
      modalDesc.textContent = p.description;
      modalTags.innerHTML = [p.category, ...p.tech, ...p.tags].map(t=>`<span class=tag>${t}</span>`).join(' ');
      modalLinks.innerHTML = (p.links||[]).map(l=>`<a class="link" target="_blank" rel="noreferrer" href="${l.href}">${l.label}</a>`).join(' ');
      modal.showModal();
    }
    document.getElementById('modalClose').addEventListener('click', ()=> modal.close());
    modal.addEventListener('click', (e)=>{ if(e.target === modal) modal.close(); });

    // --- Misc ---
    document.getElementById('year').textContent = new Date().getFullYear();
    render();
