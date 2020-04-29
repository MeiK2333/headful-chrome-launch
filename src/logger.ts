import { createLogger, format, transports } from 'winston';
import moment from 'moment';

const { combine, printf } = format;

const fmt = printf(({ level, message }) => {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss').trim();
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
})

export const logger = createLogger({
    format: combine(
        fmt
    ),
    transports: [
        new transports.Console({ level: process.env.LOG_LEVEL || 'info' }),
    ]
});
