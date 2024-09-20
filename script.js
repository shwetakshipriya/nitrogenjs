// Initialize Webix Dashboard with sidebar and main content
webix.ui({
  container: 'dashboard',
  cols: [
    {
      view: 'form',
      width: 250,
      elements: [
        {
          view: 'combo',
          id: 'brandFilterInput',
          label: 'Brand',
          options: [],
          placeholder: 'Choose Brand(s)',
          multiple: true,
        },
        {
          view: 'combo',
          id: 'categoryFilterInput',
          label: 'Category',
          options: [],
          placeholder: 'Choose Category',
          multiple: true,
        },
        {
          view: 'text',
          id: 'productSearchInput',
          label: 'Product Name',
          placeholder: 'Search Product',
        },
        {
          view: 'slider',
          id: 'percentageFilterInput',
          label: 'Nitrogen Percentage',
          min: 0,
          max: 100,
          value: [0, 100],
          step: 1,
        },
        {
          view: 'button',
          value: 'Apply Filters',
          css: 'webix_primary',
          click: function () {
            applyFilters();
          },
        },
        {
          view: 'button',
          value: 'Reset Filters',
          css: 'webix_danger',
          click: function () {
            resetFilters();
          },
        },
      ],
    },
    {
      view: 'resizer',
    },
    {
      rows: [
        {
          view: 'tabbar',
          id: 'mainTabbar',
          multiview: true,
          options: [
            { value: 'Table View', id: 'tableView' },
            { value: 'Summary', id: 'summaryView' },
            { value: 'Visualization', id: 'visualizationView' },
          ],
        },
        {
          cells: [
            {
              id: 'tableView',
              rows: [
                {
                  view: 'datatable',
                  id: 'productTable',
                  autoConfig: true,
                  select: true,
                },
              ],
            },
            {
              id: 'summaryView',
              rows: [
                {
                  view: 'template',
                  id: 'summaryStats',
                  template: '',
                  data: {},
                },
              ],
            },
            {
              id: 'visualizationView',
              rows: [
                {
                  view: 'template',
                  id: 'barChartContainer',
                  template: "<canvas id='barChart'></canvas>",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

// Initialize empty chart reference
let chart = null;

// Fetch data from Excel file and process it
window.onload = function() {
  fetchData();
};

function fetchData() {
  const filePath = '../dataset/data.xlsx';

  // Fetch and parse Excel file
  fetch(filePath)
    .then((res) => res.arrayBuffer())
    .then((data) => {
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const productData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

      // Populate brand and category filters
      processData(productData);
    });
}

// Process and load data into Webix components
function processData(data) {
  const brandOptions = [...new Set(data.map((item) => item.Brand))].map(
    (brand) => ({ id: brand, value: brand })
  );
  const categoryOptions = [
    ...new Set(data.map((item) => item['Product Category'])),
  ].map((cat) => ({ id: cat, value: cat }));

  $$('brandFilterInput').define('options', brandOptions);
  $$('categoryFilterInput').define('options', categoryOptions);

  // Load data into the table
  $$('productTable').parse(data);

  // Update summary statistics
  updateSummary(data);

  // Render bar chart with all records initially
  renderBarChart(data);

  // Store the data globally for later use in filters
  window.productData = data;
}

// Custom function to calculate mean
function calculateMean(arr) {
  const total = arr.reduce((acc, val) => acc + val, 0);
  return arr.length ? total / arr.length : 0;
}

// Function to apply filters based on the selected criteria
function applyFilters() {
  if (!window.productData) {
    console.error("Product data is not available.");
    return;
  }

  const brandFilter = $$('brandFilterInput').getValue();
  const categoryFilter = $$('categoryFilterInput').getValue();
  const productSearch = $$('productSearchInput').getValue().toLowerCase();
  const percentageRange = $$('percentageFilterInput').getValue();

  const filteredData = window.productData.filter((item) => {
    const brandMatch = !brandFilter.length || brandFilter.includes(item.Brand);
    const categoryMatch =
      !categoryFilter.length ||
      categoryFilter.includes(item['Product Category']);
    const nameMatch =
      !productSearch ||
      item['Product Name'].toLowerCase().includes(productSearch);
    const percentageMatch =
      item['Percentage of the nitrogen ingredients in the product'] >=
        percentageRange[0] &&
      item['Percentage of the nitrogen ingredients in the product'] <=
        percentageRange[1];

    return brandMatch && categoryMatch && nameMatch && percentageMatch;
  });

  // Update all components with the filtered data
  $$('productTable').clearAll();
  $$('productTable').parse(filteredData);

  updateSummary(filteredData);
  renderBarChart(filteredData);
}

// Function to reset filters
function resetFilters() {
  $$('brandFilterInput').setValue([]);
  $$('categoryFilterInput').setValue([]);
  $$('productSearchInput').setValue('');
  $$('percentageFilterInput').setValue([0, 100]);

  // Reset to full dataset
  $$('productTable').clearAll();
  $$('productTable').parse(window.productData);

  updateSummary(window.productData);
  renderBarChart(window.productData);
}

// Update summary section dynamically
function updateSummary(data) {
  const nitrogenPercentages = data.map(
    (d) => d['Percentage of the nitrogen ingredients in the product']
  );

  const avgPercentage = calculateMean(nitrogenPercentages);
  const totalNitrogen = webix.sum(data.map((d) => d['Number of ingredients contains nitrogen']));
  const totalProducts = data.length;
  const medianPercentage = webix.median(nitrogenPercentages) || 0;

  const brandsCount = data.reduce((acc, product) => {
    acc[product.Brand] = (acc[product.Brand] || 0) + 1;
    return acc;
  }, {});

  const brandsSummary = Object.entries(brandsCount)
    .map(([brand, count]) => `${brand}: ${count}`)
    .join(', ');

  $$('summaryStats').define(
    'template',
    `
      <strong>Total Products:</strong> ${totalProducts}<br>
      <strong>Average Nitrogen Percentage:</strong> ${webix.Number.format(avgPercentage, { decimalDelimiter: '.', decimalSize: 2 })}%<br>
      <strong>Total Nitrogen Ingredients:</strong> ${totalNitrogen}<br>
      <strong>Median Nitrogen Percentage:</strong> ${webix.Number.format(medianPercentage, { decimalDelimiter: '.', decimalSize: 2 })}%<br>
      <strong>Products per Brand:</strong> ${brandsSummary}
    `
  );
  $$('summaryStats').refresh();
}

// Render the bar chart dynamically based on the filtered data
function renderBarChart(data) {
  const productNames = data.map((d) => d['Product Name']);
  const nitrogenPercentages = data.map(
    (d) => d['Percentage of the nitrogen ingredients in the product']
  );

  if (chart) {
    chart.destroy(); // Remove the previous chart instance if it exists
  }

  const ctx = document.getElementById('barChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: productNames,
      datasets: [{
        label: 'Nitrogen Percentage',
        data: nitrogenPercentages,
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Nitrogen Percentage'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Product Names'
          }
        }
      }
    }
  });
}