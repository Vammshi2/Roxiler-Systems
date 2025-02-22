import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Helper function to initialize database with data
async function initializeDatabase() {
  try {
    // Check if data already exists
    const { data: existingData, error: checkError } = await supabase
      .from('transactions')
      .select('id')
      .limit(1);

    if (checkError) throw checkError;

    // Only fetch and insert data if the table is empty
    if (!existingData || existingData.length === 0) {
      const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
      const products = response.data;

      // Insert data into Supabase in batches
      const batchSize = 100;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        const { error } = await supabase
          .from('transactions')
          .upsert(batch.map(product => ({
            title: product.title,
            price: product.price,
            description: product.description,
            category: product.category,
            image: product.image,
            sold: product.sold,
            dateOfSale: product.dateOfSale
          })));

        if (error) throw error;
      }
      console.log('Database initialized successfully');
    } else {
      console.log('Database already contains data');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// API Routes

// List Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const { month, search, page = 1, perPage = 10 } = req.query;
    const offset = (page - 1) * perPage;

    let query = supabase
      .from('transactions')
      .select('*', { count: 'exact' });

    // Filter by month
    if (month) {
      query = query.filter('dateOfSale', 'ilike', `%-${month}-%`);
    }

    // Search functionality
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,price::text.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range(offset, offset + perPage - 1)
      .order('dateOfSale', { ascending: false });

    if (error) throw error;

    res.json({
      data,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / perPage)
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Statistics
app.get('/api/statistics', async (req, res) => {
  try {
    const { month } = req.query;

    let query = supabase
      .from('transactions')
      .select('price, sold');

    if (month) {
      query = query.filter('dateOfSale', 'ilike', `%-${month}-%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const statistics = {
      totalSaleAmount: data.reduce((sum, item) => item.sold ? sum + item.price : sum, 0),
      totalSoldItems: data.filter(item => item.sold).length,
      totalUnsoldItems: data.filter(item => !item.sold).length
    };

    res.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bar Chart
app.get('/api/bar-chart', async (req, res) => {
  try {
    const { month } = req.query;

    let query = supabase
      .from('transactions')
      .select('price');

    if (month) {
      query = query.filter('dateOfSale', 'ilike', `%-${month}-%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const priceRanges = {
      '0-100': 0,
      '101-200': 0,
      '201-300': 0,
      '301-400': 0,
      '401-500': 0,
      '501-600': 0,
      '601-700': 0,
      '701-800': 0,
      '801-900': 0,
      '901-above': 0
    };

    data.forEach(item => {
      const price = item.price;
      if (price <= 100) priceRanges['0-100']++;
      else if (price <= 200) priceRanges['101-200']++;
      else if (price <= 300) priceRanges['201-300']++;
      else if (price <= 400) priceRanges['301-400']++;
      else if (price <= 500) priceRanges['401-500']++;
      else if (price <= 600) priceRanges['501-600']++;
      else if (price <= 700) priceRanges['601-700']++;
      else if (price <= 800) priceRanges['701-800']++;
      else if (price <= 900) priceRanges['801-900']++;
      else priceRanges['901-above']++;
    });

    res.json(priceRanges);
  } catch (error) {
    console.error('Error fetching bar chart data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pie Chart
app.get('/api/pie-chart', async (req, res) => {
  try {
    const { month } = req.query;

    let query = supabase
      .from('transactions')
      .select('category');

    if (month) {
      query = query.filter('dateOfSale', 'ilike', `%-${month}-%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const categoryCount = data.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    res.json(categoryCount);
  } catch (error) {
    console.error('Error fetching pie chart data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Combined Data
app.get('/api/combined-data', async (req, res) => {
  try {
    const { month } = req.query;
    
    const [statisticsRes, barChartRes, pieChartRes] = await Promise.all([
      fetch(`http://localhost:${PORT}/api/statistics?month=${month}`).then(res => res.json()),
      fetch(`http://localhost:${PORT}/api/bar-chart?month=${month}`).then(res => res.json()),
      fetch(`http://localhost:${PORT}/api/pie-chart?month=${month}`).then(res => res.json())
    ]);

    res.json({
      statistics: statisticsRes,
      barChart: barChartRes,
      pieChart: pieChartRes
    });
  } catch (error) {
    console.error('Error fetching combined data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize database and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});