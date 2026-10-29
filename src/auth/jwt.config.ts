import 'dotenv/config';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32 || secret.startsWith('replace_')) {
  throw new Error('Укажите случайный JWT_SECRET длиной не менее 32 символов в .env');
}

export const jwtSettings = { secret, issuer: 'lab19', audience: 'lab19-api', expiresIn: 3600 };
