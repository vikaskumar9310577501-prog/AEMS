import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });

import { sendDailyOverduePlantMails } from "../server/dailyOverdueMail.js";

const result = await sendDailyOverduePlantMails({ ignoreHour: true });
console.log(new Date().toISOString(), JSON.stringify(result));
if (result.errors.length > 0) process.exit(1);
