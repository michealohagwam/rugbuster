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
let API_KEY;
async function loadApiKey() {
  try {
    const response = await fetch('http://localhost:3000/api/config');
    const config = await response.json();
    API_KEY = config.apiKey;
  } catch (error) {
    console.error('Failed to load API key:', error);
    showToast('Failed to load configuration. Using fallback key.');
    API_KEY = 'rugbuster-secret-123';
  }
}

// Clean coin ID from auto-suggestion
function cleanCoinId(input) {
  const match = input.match(/.*\s*-\s*([^\s]+)$/);
  return match ? match[1] : input.replace(/\s+/g, '-').toLowerCase();
}

// Auto-suggest coin names
const coinSearch = document.getElementById('coinSearch');
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

// Theme toggle
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  const themeIcon = themeToggle.querySelector('i');
  const setTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.className = theme === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
    localStorage.setItem('theme', theme);
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

  // Delay to ensure DOM is fully rendered
  setTimeout(() => {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true);
    clone.classList.add('pdf-content');

    // Force light theme for PDF rendering
    clone.setAttribute('data-theme', 'light');
    clone.style.backgroundColor = '#fff';
    clone.style.color = '#000';
    clone.style.width = '210mm'; // A4 width
    clone.style.padding = '10mm';
    clone.style.boxSizing = 'border-box';

    // Update text content for Liquidity, Rug Pull Risks, and Verdict
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

    // Add footer
    const footer = document.createElement('div');
    footer.style.position = 'absolute';
    footer.style.bottom = '10mm';
    footer.style.width = '100%';
    footer.style.textAlign = 'center';
    footer.style.fontSize = '10px';
    footer.style.color = '#666';
    footer.innerText = 'Powered by RugBuster';
    clone.appendChild(footer);

    // Remove the download button from the PDF
    const buttons = clone.getElementsByClassName('download-btn');
    while (buttons.length > 0) {
      buttons[0].remove();
    }

    // Ensure all tables have proper Bootstrap styling
    const tables = clone.querySelectorAll('table');
    tables.forEach(table => {
      table.classList.add('table', 'table-bordered', 'table-striped');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
    });

    // Ensure table cells have proper styling
    const cells = clone.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.style.border = '1px solid #dee2e6';
      cell.style.padding = '8px';
      cell.style.textAlign = 'left';
    });

    // Ensure all elements are visible
    const allElements = clone.querySelectorAll('*');
    allElements.forEach(el => {
      el.style.display = 'block';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
    });

    // Add CSS to enforce table styling
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

    // Ensure footer appears on every page
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
  }, 100); // 100ms delay to ensure DOM rendering
}

// Call loadApiKey when the page loads
window.addEventListener('load', loadApiKey);

// Search button handler
document.getElementById('searchBtn').addEventListener('click', async () => {
  const searchTerm = document.getElementById('coinSearch').value.trim().toLowerCase();
  const auditLink = document.getElementById('auditLink').value.trim();
  const coinDetails = document.getElementById('coinDetails');
  const searchBtn = document.getElementById('searchBtn');
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
    const response = await fetch(
      `http://localhost:3000/api/fetchCoinData/${validId}?${queryParams}`,
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

    // Add download button
    console.log('Appending download button'); // Debug log
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
    } else if (errorMessage.includes('Server error: 500')) {
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

// Initialize tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
tooltipTriggerList.forEach((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));