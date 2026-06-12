import axios from 'axios';

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

export async function getUVIndex(lat: number, lng: number): Promise<number> {
  if (!OPENWEATHER_API_KEY) {
    console.warn('OpenWeather API key not set, returning default UV index');
    return 5; // Default moderate UV index
  }

  try {
    const response = await axios.get(`${OPENWEATHER_BASE_URL}/uvi`, {
      params: {
        lat,
        lon: lng,
        appid: OPENWEATHER_API_KEY,
      },
    });

    return response.data.value || 5;
  } catch (error) {
    console.error('Error fetching UV index:', error);
    return 5; // Fallback to moderate UV
  }
}
