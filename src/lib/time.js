import { DateTime } from 'luxon';
import { config } from '../config.js';

export function parseDeadline(input) {
  if (!input) return null;
  const formats = ['dd/MM/yyyy HH:mm', 'dd/MM/yyyy', 'd/M/yyyy HH:mm', 'd/M/yyyy'];
  for (const fmt of formats) {
    let dt = DateTime.fromFormat(input.trim(), fmt, { zone: config.timezone });
    if (dt.isValid) {
      if (!fmt.includes('HH')) dt = dt.endOf('day').startOf('minute');
      return dt.toUTC().toFormat('yyyy-LL-dd HH:mm:ss');
    }
  }
  return null;
}

export function displayDate(mysqlDate) {
  if (!mysqlDate) return 'Không có';
  const dt = DateTime.fromJSDate(mysqlDate instanceof Date ? mysqlDate : new Date(mysqlDate), { zone: 'utc' }).setZone(config.timezone);
  return dt.toFormat('dd/MM/yyyy HH:mm');
}

export function discordTimestamp(mysqlDate) {
  if (!mysqlDate) return null;
  const d = mysqlDate instanceof Date ? mysqlDate : new Date(mysqlDate);
  return `<t:${Math.floor(d.getTime()/1000)}:F> (<t:${Math.floor(d.getTime()/1000)}:R>)`;
}
