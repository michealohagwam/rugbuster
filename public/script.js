// Initialize toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
toastContainer.style.zIndex = '1050';
document.body.appendChild(toastContainer);

// Function to show toast notification
function showToast(message) {
  const toastId = `toast-${Date.now()}`;
  const toastHtml = `
    <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header">
        <strong class="me-auto">RugBuster</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    </div>
  `;
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement);
  toast.show();
}

// Fetch the API key from the server
let API_KEY = 'rugbuster-secret-123'; // Default fallback for internal API
async function loadApiKey() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const config = await response.json();
    API_KEY = config.apiKey;
    console.log('API key loaded successfully');
  } catch (error) {
    console.error('Failed to load API key:', error);
    showToast('Failed to load API key. Using fallback key.');
  }
}

// Clean coin ID from auto-suggestion
function cleanCoinId(input) {
  const match = input.match(/.*\s*-\s*([^\s]+)$/);
  return match ? match[1] : input.replace(/\s+/g, '-').toLowerCase();
}

// Auto-suggest coin names
const coinSearch = document.getElementById('coinSearch');
if (coinSearch) {
  coinSearch.addEventListener('input', async () => {
    const query = coinSearch.value.trim().toLowerCase();
    if (query.length < 3) return;

    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`);
      const data = response.ok ? await response.json() : { coins: [] };
      const suggestions = data.coins.slice(0, 5).map(coin => `${coin.name} (${coin.symbol.toUpperCase()}) - ${coin.id}`);
      const datalist = document.getElementById('coinSuggestions') || document.createElement('datalist');
      datalist.id = 'coinSuggestions';
      datalist.innerHTML = suggestions.map(s => `<option value="${s}">`).join('');
      if (!datalist.parentElement) document.body.appendChild(datalist);
      coinSearch.setAttribute('list', 'coinSuggestions');
    } catch (error) {
      console.error('Auto-suggest error:', error);
    }
  });
}

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  console.log('Theme toggle initialized');
  const themeIcon = themeToggle.querySelector('i');
  const setTheme = (theme) => {
    console.log('Setting theme:', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
    }
    localStorage.setItem('theme', theme);
    // Explicitly apply styles to ensure visibility
    document.body.style.backgroundColor = theme === 'dark' ? '#343a40' : '#fff';
    document.body.style.color = theme === 'dark' ? '#fff' : '#000';
    // Apply to blog-specific elements
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
      card.style.backgroundColor = theme === 'dark' ? '#495057' : '#fff';
      card.style.color = theme === 'dark' ? '#fff' : '#000';
    });
  };
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(currentTheme === 'light' ? 'dark' : 'light');
  });
}

// Function to download PDF
function downloadPDF(coinName, timestamp) {
  const element = document.getElementById('coinDetails');
  if (!element || !element.innerHTML.trim()) {
    console.error('coinDetails element is empty or not found');
    showToast('No content to download. Please search for a coin first.');
    return;
  }

  const safeCoinName = coinName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestampStr = timestamp.replace(/[:\s]/g, '-').replace(' UTC', '');
  const filename = `RugBuster_${safeCoinName}_${timestampStr}.pdf`;

  setTimeout(() => {
    const clone = element.cloneNode(true);
    clone.classList.add('pdf-content');
    clone.setAttribute('data-theme', 'light');
    clone.style.backgroundColor = '#fff';
    clone.style.color = '#000';
    clone.style.width = '210mm';
    clone.style.padding = '10mm';
    clone.style.boxSizing = 'border-box';

    const liquidityRows = clone.querySelectorAll('table tbody tr');
    liquidityRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2 && cells[0].textContent.trim() === 'Status') {
        cells[1].textContent = 'Liquidity lock status unavailable. Verify manually on Etherscan/BscScan.';
      }
    });

    const riskRows = clone.querySelectorAll('table tbody tr');
    riskRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2 && cells[0].textContent.trim() === 'Risk') {
        cells[1].textContent = 'Liquidity not locked: Potential rug pull risk. We are working on giving you the best.';
      }
    });

    const verdictRows = clone.querySelectorAll('table tbody tr');
    verdictRows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2 && cells[0].textContent.trim() === 'Verdict') {
        cells[1].textContent = 'Potential risks detected. Avoid or verify manually. Please Do Your Own Research DYOR.';
      }
    });

    const footer = document.createElement('div');
    footer.style.position = 'absolute';
    footer.style.bottom = '10mm';
    footer.style.width = '100%';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '10px';
    footer.style.color = '#666';
    footer.innerText = 'Powered by RugBuster';
    clone.appendChild(footer);

    const buttons = clone.getElementsByClassName('download-btn');
    while (buttons.length > 0) {
      buttons[0].remove();
    }

    const tables = clone.querySelectorAll('table');
    tables.forEach(table => {
      table.classList.add('table', 'table-bordered', 'table-striped');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
    });

    const cells = clone.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.style.border = '1px solid #dee2e6';
      cell.style.padding = '8px';
      cell.style.textAlign = 'left';
    });

    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
      el.style.display = 'block';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });

    const style = document.createElement('style');
    style.innerHTML = `
      table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin-bottom: 1rem;
      }
      th, td {
        border: 1px solid #dee2e6 !important;
        padding: 8px !important;
        text-align: left !important;
        vertical-align: top !important;
      }
      .table-striped tbody tr:nth-of-type(odd) {
        background-color: #f2f2f2 !important;
      }
      h2, h3, p {
        color: #000 !important;
      }
    `;
    clone.prepend(style);

    const opt = {
      margin: [10, 10, 20, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        logging: true,
        useCORS: true,
        onclone: (doc) => {
          console.log('Cloned document for PDF rendering:', doc.body.innerHTML);
        }
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().from(clone).set(opt).toPdf().get('pdf').then(pdf => {
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text('Powered by RugBuster', pdf.internal.pageSize.getWidth() / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' });
      }
    }).save().catch(err => {
      console.error('PDF generation error:', err);
      showToast('Failed to generate PDF. Please try again.');
    });
    showToast('PDF download started.');
  }, 100);
}

// Call loadApiKey when the page loads
window.addEventListener('load', loadApiKey);

// Search button handler
const searchBtn = document.getElementById('searchBtn');
if (searchBtn) {
  searchBtn.addEventListener('click', async () => {
    const searchTerm = document.getElementById('coinSearch').value.trim().toLowerCase();
    const auditLink = document.getElementById('auditLink').value.trim();
    const coinDetails = document.getElementById('coinDetails');
    const spinner = document.getElementById('loadingSpinner');

    if (!searchTerm) {
      showToast('Please enter a coin name or ID.');
      return;
    }

    if (!API_KEY) {
      showToast('Configuration not loaded. Please try again.');
      return;
    }

    spinner.style.display = 'flex';
    searchBtn.disabled = true;
    searchBtn.classList.add('disabled');
    coinDetails.innerHTML = '';

    try {
      const validId = cleanCoinId(searchTerm);
      const queryParams = new URLSearchParams({
        auditLink: encodeURIComponent(auditLink),
        bypassCache: 'true',
      });
      console.log('Fetching coin data for:', validId, 'with params:', queryParams.toString());
      const response = await fetch(
        `/api/fetchCoinData/${validId}?${queryParams}`,
        {
          headers: { 'X-API-Key': API_KEY },
        }
      );
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      const result = await response.json();
      if (result.error) {
        throw new Error(result.details || 'Failed to fetch coin data');
      }
      coinDetails.innerHTML = result.html;

      console.log('Appending download button');
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-btn btn';
      downloadBtn.innerHTML = '<i class="bi bi-download me-2"></i>Download PDF';
      downloadBtn.addEventListener('click', () => {
        downloadPDF(result.data?.name || validId, result.searchTime);
      });
      coinDetails.appendChild(downloadBtn);
    } catch (error) {
      console.error(`Coin fetch error: ${error.message}`);
      let errorMessage = error.message;
      if (errorMessage.includes('No data found')) {
        errorMessage = `No data found for "${searchTerm}". Try a different coin name or ID (e.g., "baby-doge-coin" for BabyDoge) or check API availability.`;
      } else if (errorMessage.includes('Server error: 404')) {
        errorMessage = `Server endpoint not found for "${searchTerm}". Please ensure the /api/fetchCoinData endpoint is deployed correctly on Netlify Functions.`;
      } else if (errorMessage.includes('Server error')) {
        errorMessage = `Server error while fetching data for "${searchTerm}". Please try again later or contact support.`;
      }
      coinDetails.innerHTML = `<p class="text-danger"><i class="bi bi-exclamation-circle me-2"></i>${errorMessage}</p>`;
      showToast(errorMessage);
    } finally {
      spinner.style.display = 'none';
      searchBtn.disabled = false;
      searchBtn.classList.remove('disabled');
    }
  });
}

// Initialize tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.forEach((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

// Fetch news (global scope for ticker and news page)
async function fetchNews() {
  const newsContainer = document.getElementById('news-container');
  if (newsContainer) {
    console.log('news-container found, setting loading state');
    newsContainer.innerHTML = '<p>Loading news...</p>';
  } else if (window.location.pathname.includes('news.html')) {
    console.warn('news-container not found on news.html');
  }

  let articles = [];
  const seenUrls = new Set(); // Track unique article URLs

  // Check cache first
  const cached = localStorage.getItem('newsCache');
  const cacheTime = localStorage.getItem('newsCacheTime');
  if (cached && cacheTime && Date.now() - cacheTime < 3600000) { // 1-hour cache
    try {
      articles = JSON.parse(cached);
      console.log('Loaded cached articles:', articles.length);
      articles = articles.map(article => ({
        ...article,
        date: new Date(article.date || Date.now())
      })).filter(article => {
        if (!isNaN(article.date.getTime()) && article.url && !seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          return true;
        }
        console.log('Filtered duplicate or invalid cached article:', article.url || article.title);
        return false;
      });
    } catch (e) {
      console.error('Cache parse error:', e);
    }
  }

  // Fetch from Netlify Function
  try {
    const response = await fetch('/.netlify/functions/fetchNews');
    if (!response.ok) {
      throw new Error(`Netlify Function error: HTTP ${response.status}`);
    }
    const { coingecko, cryptonews } = await response.json();
    console.log('Fetched news data:', { coingecko: coingecko?.length, cryptonews: cryptonews?.length });

    // Process CoinGecko articles
    if (coingecko && Array.isArray(coingecko)) {
      const cgArticles = coingecko.map(article => ({
        title: article.title || 'Untitled',
        description: article.description || 'No description available',
        url: article.url || '#',
        source: article.source || 'CoinGecko',
        date: article.date ? new Date(article.date) : new Date(),
        image: article.thumb || null
      })).filter(article => {
        if (article.url && !seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          return true;
        }
        console.log('Filtered duplicate CoinGecko article:', article.url || article.title);
        return false;
      });
      articles = articles.concat(cgArticles);
    }

    // Process Crypto.News articles
    if (cryptonews && Array.isArray(cryptonews)) {
      const cnArticles = cryptonews.map(item => ({
        title: item.title || 'Untitled',
        description: item.description ? item.description.replace(/<[^>]+>/g, '').slice(0, 100) + '...' : 'No description available',
        url: item.link || '#',
        source: 'Crypto.News',
        date: item.pubDate ? new Date(item.pubDate) : new Date(),
        image: item.thumbnail || null
      })).filter(article => {
        if (article.url && !seenUrls.has(article.url)) {
          seenUrls.add(article.url);
          return true;
        }
        console.log('Filtered duplicate Crypto.News article:', article.url || article.title);
        return false;
      });
      articles = articles.concat(cnArticles);
    }
  } catch (error) {
    console.error('Fetch news error:', error);
    showToast('Failed to fetch news. Using cached or fallback content.');
  }

  // Fallback mock articles if none retrieved
  if (articles.length === 0) {
    console.warn('No articles retrieved, using mock data');
    articles = [
      {
        title: 'Crypto Market Update',
        description: 'Latest trends in the crypto market.',
        url: '#crypto-market-update',
        source: 'RugBuster',
        date: new Date(),
        image: null
      },
      {
        title: 'Beware of Rug Pulls',
        description: 'Tips to avoid crypto scams.',
        url: '#beware-rug-pulls',
        source: 'RugBuster',
        date: new Date(),
        image: null
      }
    ].filter(article => {
      if (!seenUrls.has(article.url)) {
        seenUrls.add(article.url);
        return true;
      }
      return false;
    });
  }

  // Filter and sort articles
  articles = articles
    .filter(article => article.title && article.url && !isNaN(article.date.getTime()))
    .sort((a, b) => b.date - a.date)
    .slice(0, 15);

  // Cache articles
  try {
    localStorage.setItem('newsCache', JSON.stringify(articles));
    localStorage.setItem('newsCacheTime', Date.now());
    console.log('Cached articles:', articles.length);
  } catch (e) {
    console.error('Cache save error:', e);
  }

  if (newsContainer) {
    newsContainer.innerHTML = '';
    if (articles.length === 0) {
      console.warn('No valid articles after filtering');
      newsContainer.innerHTML = '<p class="text-muted">No news available. Please try again later.</p>';
    } else {
      console.log('Rendering articles:', articles.length);
      articles.forEach(article => {
        const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const shareUrl = `https://rugbuster.netlify.app/news.html?article=${encodeURIComponent(slug)}`;
        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
          <div class="card h-100">
            ${article.image ? `<img src="${article.image}" class="card-img-top" alt="${article.title}" style="max-height: 200px; object-fit: cover;">` : ''}
            <div class="card-body">
              <h5 class="card-title">${article.title}</h5>
              <p class="card-text">${article.description}</p>
              <p class="text-muted">Source: ${article.source} | ${article.date.toLocaleDateString()}</p>
              <div class="share-buttons mt-2">
                <a href="https://wa.me/?text=${encodeURIComponent(article.title + ' ' + shareUrl)}" target="_blank" class="btn btn-sm btn-outline-success me-1" title="Share on WhatsApp"><i class="bi bi-whatsapp"></i></a>
                <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(shareUrl)}" target="_blank" class="btn btn-sm btn-outline-primary me-1" title="Share on X"><i class="bi bi-twitter"></i></a>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" class="btn btn-sm btn-outline-primary me-1" title="Share on Facebook"><i class="bi bi-facebook"></i></a>
                <button class="btn btn-sm btn-outline-secondary copy-link" data-link="${shareUrl}" title="Copy Link"><i class="bi bi-clipboard"></i></button>
              </div>
              <a href="${article.url}" target="_blank" class="btn btn-outline-primary mt-2">Read More</a>
            </div>
          </div>
        `;
        newsContainer.appendChild(card);
      });

      const urlParams = new URLSearchParams(window.location.search);
      const articleSlug = urlParams.get('article');
      if (articleSlug) {
        const targetCard = Array.from(newsContainer.querySelectorAll('.card')).find(card => 
          card.querySelector('.card-title').textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === articleSlug
        );
        if (targetCard) {
          console.log('Highlighting article:', articleSlug);
          targetCard.scrollIntoView({ behavior: 'smooth' });
          targetCard.classList.add('highlight');
        } else {
          console.warn('Article not found for slug:', articleSlug);
        }
      }
    }
  }
  console.log('Returning articles:', articles.length);
  return articles;
}

// News ticker on homepage
if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
  async function loadTicker() {
    const tickerContent = document.getElementById('ticker-content');
    if (!tickerContent) {
      console.warn('ticker-content not found');
      return;
    }
    console.log('ticker-content found, setting loading state');
    tickerContent.innerHTML = '<span class="text-muted">Loading news...</span>';
    async function updateTicker() {
      try {
        const articles = await fetchNews();
        console.log('Ticker articles:', articles.length);
        const latestFive = articles.slice(0, 5);
        if (latestFive.length === 0) {
          console.warn('No articles for ticker');
          tickerContent.innerHTML = '<span class="text-muted">No news available at this time.</span>';
          return;
        }
        tickerContent.innerHTML = latestFive.map(article => {
          const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          return `<a href="/news.html?article=${encodeURIComponent(slug)}" class="ticker-item">${article.title} (${article.source})</a>`;
        }).join('');
      } catch (error) {
        console.error('Ticker loading error:', error);
        tickerContent.innerHTML = '<span class="text-muted">Unable to load news ticker.</span>';
      }
    }
    updateTicker();
    setInterval(updateTicker, 300000);
  }
  document.addEventListener('DOMContentLoaded', loadTicker);
}

// Crypto News Section
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('news.html')) {
    console.log('Initializing news section on news.html');
    fetchNews().catch(err => {
      console.error('News section error:', err);
      const newsContainer = document.getElementById('news-container');
      if (newsContainer) {
        newsContainer.innerHTML = '<p class="text-danger">Failed to load news. Please try again later.</p>';
      } else {
        console.error('news-container not found on news.html');
      }
    });
  }
});

// Blog section
document.addEventListener('DOMContentLoaded', () => {
  const normalizedPath = window.location.pathname.toLowerCase().replace(/\/$/, '');
  console.log('Checking blog section for path:', normalizedPath);
  if (normalizedPath.includes('blog') || normalizedPath === '/blog.html') {
    console.log('Blog section triggered');
    async function loadBlogPosts() {
      const blogContainer = document.getElementById('blog-container');
      const blogSearch = document.getElementById('blogSearch');
      const searchBlogBtn = document.getElementById('searchBlogBtn');
      const categoryFilter = document.getElementById('categoryFilter');
      console.log('Blog section loaded:', { blogContainer, blogSearch, searchBlogBtn, categoryFilter });

      if (!blogContainer) {
        console.error('blog-container not found');
        showToast('Blog container not found. Please check the page structure.');
        return;
      }

      const posts = [
        {
          title: 'How to Spot a Rug Pull',
          excerpt: 'Learn the red flags of crypto scams, like high holder concentration and unlocked liquidity.',
          date: '2025-05-15',
          slug: 'how-to-spot-a-rug-pull',
          image: null,
          category: 'Education',
          tags: ['rug pulls', 'crypto scams', 'security'],
          author: 'Micheal Ohagwam',
          draft: false
        },
        {
          title: 'Why RugBuster Uses CoinGecko',
          excerpt: 'Discover how trusted APIs power our real-time token analysis.',
          date: '2025-05-10',
          slug: 'why-rugbuster-uses-coingecko',
          image: null,
          category: 'Tutorials',
          tags: ['CoinGecko', 'data', 'analysis'],
          author: 'Micheal Ohagwam',
          draft: false
        }
      ];

      const categories = [...new Set(posts.map(post => post.category))];

      if (categoryFilter) {
        categoryFilter.innerHTML = '<option value="">All Categories</option>' + 
          categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
      } else {
        console.warn('categoryFilter not found');
      }

      function displayPosts(filteredPosts) {
        console.log('Displaying posts:', filteredPosts);
        blogContainer.innerHTML = '';
        if (filteredPosts.length === 0) {
          blogContainer.innerHTML = '<p class="text-muted">No posts found.</p>';
          return;
        }
        filteredPosts.forEach(post => {
          if (post.draft) return;
          const shareUrl = `https://rugbuster.netlify.app/blog/${post.slug}.html`;
          const card = document.createElement('div');
          card.className = 'col';
          card.innerHTML = `
            <div class="card h-100">
              ${post.image ? `<img src="${post.image}" class="card-img-top" alt="${post.title}" style="max-height: 200px; object-fit: cover;">` : ''}
              <div class="card-body">
                <h5 class="card-title">${post.title}</h5>
                <p class="card-text">${post.excerpt}</p>
                <p class="text-muted">By ${post.author} | ${new Date(post.date).toLocaleDateString()} | Category: ${post.category} | Tags: ${post.tags.join(', ')}</p>
                <div class="share-buttons mt-2">
                  <a href="https://wa.me/?text=${encodeURIComponent(post.title + ' ' + shareUrl)}" target="_blank" class="btn btn-sm btn-outline-success me-1" title="Share on WhatsApp" aria-label="Share ${post.title} on WhatsApp"><i class="bi bi-whatsapp"></i></a>
                  <a href="https://x.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(shareUrl)}" target="_blank" class="btn btn-sm btn-outline-primary me-1" title="Share on X" aria-label="Share ${post.title} on X"><i class="bi bi-twitter-x"></i></a>
                  <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" class="btn btn-sm btn-outline-primary me-1" title="Share on Facebook" aria-label="Share ${post.title} on Facebook"><i class="bi bi-facebook"></i></a>
                  <button class="btn btn-sm btn-outline-secondary copy-link" data-link="${shareUrl}" title="Copy Link" aria-label="Copy link to ${post.title}"><i class="bi bi-clipboard"></i></button>
                </div>
                <a href="/blog/${post.slug}.html" class="btn btn-outline-primary mt-2" aria-label="Read more about ${post.title}">Read More</a>
              </div>
            </div>
          `;
          blogContainer.appendChild(card);
        });
      }

      displayPosts(posts);

      function filterPosts() {
        const searchTerm = blogSearch ? blogSearch.value.trim().toLowerCase() : '';
        const category = categoryFilter ? categoryFilter.value : '';
        const filteredPosts = posts.filter(post => {
          if (post.draft) return false;
          const matchesSearch = searchTerm === '' || 
            post.title.toLowerCase().includes(searchTerm) || 
            post.excerpt.toLowerCase().includes(searchTerm) || 
            post.tags.some(tag => tag.toLowerCase().includes(searchTerm)) ||
            post.author.toLowerCase().includes(searchTerm);
          const matchesCategory = category === '' || post.category === category;
          return matchesSearch && matchesCategory;
        });
        displayPosts(filteredPosts);
      }

      let debounceTimeout;
      function debounceSearch() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(filterPosts, 300);
      }

      if (blogSearch) {
        blogSearch.addEventListener('input', debounceSearch);
        blogSearch.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            filterPosts();
          }
        });
      } else {
        console.warn('blogSearch not found');
      }

      if (searchBlogBtn) {
        searchBlogBtn.addEventListener('click', filterPosts);
      } else {
        console.warn('searchBlogBtn not found');
      }

      if (categoryFilter) {
        categoryFilter.addEventListener('change', filterPosts);
      } else {
        console.warn('categoryFilter not found');
      }
    }
    loadBlogPosts().catch(err => {
      console.error('Blog loading error:', err);
      showToast('Failed to load blog posts. Please try again.');
    });
  }
});

// Copy Link Handler
document.addEventListener('click', (event) => {
  if (event.target.closest('.copy-link')) {
    const button = event.target.closest('.copy-link');
    const link = button.dataset.link;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Link copied to clipboard!');
      button.innerHTML = '<i class="bi bi-clipboard-check"></i>';
      setTimeout(() => {
        button.innerHTML = '<i class="bi bi-clipboard"></i>';
      }, 2000);
    }).catch(() => {
      showToast('Failed to copy link.');
    });
  }
});

// Global error handler
window.onerror = function (message, source, lineno, colno, error) {
  console.error(`Global error: ${message} at ${source}:${lineno}:${colno}`, error);
  showToast('An error occurred. Please try refreshing the page.');
};