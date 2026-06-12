import express from 'express';
import { calculateShadeOptimizedRoute } from '../services/shadeScoring.js';

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { start, destination, timestamp } = req.body;

    if (!start || !destination) {
      return res.status(400).json({
        error: 'Missing required fields: start and destination',
      });
    }

    if (!start.lat || !start.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        error: 'Invalid location format. Expected { lat: number, lng: number }',
      });
    }

    const route = await calculateShadeOptimizedRoute({
      start,
      destination,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    res.json(route);
  } catch (error) {
    next(error);
  }
});

export default router;
