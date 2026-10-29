const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');
if (!fs.existsSync(target)) {
  let text = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const name of ['database_password', 'jwt_secret', 'admin_password', 'student_password']) {
    text = text.replace('generate_local_' + name, randomBytes(32).toString('hex'));
  }
  fs.writeFileSync(target, text, { flag: 'wx' });
  console.log('Создан .env со случайными паролями и JWT_SECRET.');
}
