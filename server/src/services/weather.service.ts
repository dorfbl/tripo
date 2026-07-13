/**
 * Weather via Open-Meteo (free, no API key).
 * https://open-meteo.com/
 */

export interface DailyWeather {
  date: string; // YYYY-MM-DD
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number | null;
  emoji: string;
  label: string;
}

export interface WeatherBundle {
  lat: number;
  lng: number;
  locationLabel: string;
  source: 'open-meteo';
  daily: DailyWeather[];
  today: DailyWeather | null;
  tomorrow: DailyWeather | null;
}

const WMO: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'בהיר' },
  1: { emoji: '🌤️', label: 'בעיקר בהיר' },
  2: { emoji: '⛅', label: 'מעונן חלקית' },
  3: { emoji: '☁️', label: 'מעונן' },
  45: { emoji: '🌫️', label: 'ערפל' },
  48: { emoji: '🌫️', label: 'ערפל קפוא' },
  51: { emoji: '🌦️', label: 'טפטוף קל' },
  53: { emoji: '🌦️', label: 'טפטוף' },
  55: { emoji: '🌧️', label: 'טפטוף חזק' },
  61: { emoji: '🌧️', label: 'גשם קל' },
  63: { emoji: '🌧️', label: 'גשם' },
  65: { emoji: '🌧️', label: 'גשם חזק' },
  71: { emoji: '🌨️', label: 'שלג קל' },
  73: { emoji: '🌨️', label: 'שלג' },
  75: { emoji: '❄️', label: 'שלג חזק' },
  80: { emoji: '🌦️', label: 'ממטרים' },
  81: { emoji: '🌧️', label: 'ממטרים חזקים' },
  82: { emoji: '⛈️', label: 'ממטרים עזים' },
  95: { emoji: '⛈️', label: 'סופה' },
  96: { emoji: '⛈️', label: 'סופה עם ברד' },
  99: { emoji: '⛈️', label: 'סופה חזקה עם ברד' },
};

function codeMeta(code: number) {
  return WMO[code] || { emoji: '🌡️', label: 'מזג אוויר' };
}

export async function fetchWeatherForecast(
  lat: number,
  lng: number,
  startDate?: string | null,
  endDate?: string | null,
  locationLabel = 'יעד הטיול',
): Promise<WeatherBundle> {
  const today = new Date();
  const start =
    startDate?.slice(0, 10) ||
    today.toISOString().slice(0, 10);
  const endDefault = new Date(today);
  endDefault.setDate(endDefault.getDate() + 7);
  const end =
    endDate?.slice(0, 10) ||
    endDefault.toISOString().slice(0, 10);

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto` +
    `&start_date=${start}&end_date=${end}`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo HTTP ${r.status}`);
  const data: any = await r.json();

  const dates: string[] = data.daily?.time || [];
  const daily: DailyWeather[] = dates.map((date, i) => {
    const code = Number(data.daily.weather_code?.[i] ?? 0);
    const meta = codeMeta(code);
    return {
      date,
      weatherCode: code,
      tempMax: Math.round(Number(data.daily.temperature_2m_max?.[i] ?? 0)),
      tempMin: Math.round(Number(data.daily.temperature_2m_min?.[i] ?? 0)),
      precipitationProbability:
        data.daily.precipitation_probability_max?.[i] != null
          ? Number(data.daily.precipitation_probability_max[i])
          : null,
      emoji: meta.emoji,
      label: meta.label,
    };
  });

  const todayKey = today.toISOString().slice(0, 10);
  const tom = new Date(today);
  tom.setDate(tom.getDate() + 1);
  const tomKey = tom.toISOString().slice(0, 10);

  return {
    lat,
    lng,
    locationLabel,
    source: 'open-meteo',
    daily,
    today: daily.find((d) => d.date === todayKey) || daily[0] || null,
    tomorrow: daily.find((d) => d.date === tomKey) || null,
  };
}
