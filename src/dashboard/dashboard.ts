import express, { Request, Response } from 'express';
import path from 'path';
import { getSearchAnalytics, getUserAnalytics, getPopularQueries } from '../utils/analytics';
import { getDatabaseStats } from '../utils/cleanup';

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/analytics', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await getSearchAnalytics(days);
    res.json(analytics);
  } catch (error) {
    console.error('Ошибка получения аналитики:', error);
    res.status(500).json({ error: 'Ошибка получения аналитики' });
  }
});

app.get('/api/popular-queries', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const queries = await getPopularQueries(limit);
    res.json(queries);
  } catch (error) {
    console.error('Ошибка получения популярных запросов:', error);
    res.status(500).json({ error: 'Ошибка получения популярных запросов' });
  }
});

app.get('/api/database-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getDatabaseStats();
    res.json(stats);
  } catch (error) {
    console.error('Ошибка получения статистики БД:', error);
    res.status(500).json({ error: 'Ошибка получения статистики БД' });
  }
});

app.get('/api/user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const analytics = await getUserAnalytics(userId);
    if (analytics) {
      res.json(analytics);
    } else {
      res.status(404).json({ error: 'Пользователь не найден' });
    }
  } catch (error) {
    console.error('Ошибка получения аналитики пользователя:', error);
    res.status(500).json({ error: 'Ошибка получения аналитики пользователя' });
  }
});

// Главная страница дашборда
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

export function startDashboard() {
  app.listen(PORT, () => {
    console.log(`📊 Дашборд запущен на http://localhost:${PORT}`);
  });
}

// Запускаем дашборд если файл запущен напрямую
if (require.main === module) {
  startDashboard();
} 