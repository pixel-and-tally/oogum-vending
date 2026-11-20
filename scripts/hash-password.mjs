// Makes one HUB_USERS entry. Usage: npm run hub:hash -- stephen 'their password'
import { randomBytes, scryptSync } from "node:crypto";

const [user, password] = process.argv.slice(2);
if (!user || !password) {
  console.error("Usage: npm run hub:hash -- <username> <password>");
  process.exit(1);
}
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 32).toString("hex");
console.log(`${user.toLowerCase()}:scrypt$${salt}$${hash}`);
console.log("\nJoin entries with commas and paste them into HUB_USERS on Netlify.");
